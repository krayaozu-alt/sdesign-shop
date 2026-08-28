'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, hashPassword } from '@/lib/auth';
import { verifierPlaceDisponible } from '@/server/sessions';
import { logAudit } from '@/lib/audit';
import {
  COURSE_STATUS,
  ENROLLMENT_STATUS,
  NOTIFICATION_TYPES,
  PAYMENT_PURPOSE,
  PAYMENT_STATUS,
  ROLES,
} from '@/lib/constants';
import { formatMoney } from '@/lib/format';
import { notify, notifyStaff } from '@/lib/notifications';
import { nextReference } from '@/lib/refs';
import { enrollmentPublicSchema, zodToState, type ActionState } from '@/lib/validation';

function formToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  formData.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

/** Mot de passe provisoire lisible, communique une seule fois a l'inscription. */
function temporaryPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

/**
 * Inscription publique a une formation.
 * - relie l'inscription au compte connecte, ou au compte existant du meme
 *   numero, ou cree un compte eleve avec mot de passe provisoire ;
 * - enregistre l'acompte declare en PAIEMENT EN ATTENTE : aucun encaissement
 *   n'est simule, la caisse le confirme dans Admin > Paiements.
 */
export async function createEnrollmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = enrollmentPublicSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodToState(parsed.error);
  const data = parsed.data;

  const course = await prisma.course.findUnique({
    where: { id: data.courseId },
    include: { _count: { select: { enrollments: true } } },
  });
  if (!course) return { ok: false, message: 'Formation introuvable.' };
  if (course.status === COURSE_STATUS.ARCHIVEE || course.status === COURSE_STATUS.BROUILLON) {
    return { ok: false, message: 'Cette formation n’est pas ouverte aux inscriptions.' };
  }
  // Inscription rattachee a une session precise : c'est la capacite de CETTE
  // session qui fait foi, relue au moment de l'ecriture pour qu'aucune
  // surreservation ne passe entre deux demandes simultanees.
  let session: { id: string; title: string; price: number | null; courseId: string } | null = null;
  if (data.sessionId) {
    const disponible = await verifierPlaceDisponible(data.sessionId);
    if (!disponible.ok) return { ok: false, message: disponible.error };
    session = await prisma.courseSession.findUnique({
      where: { id: data.sessionId },
      select: { id: true, title: true, price: true, courseId: true },
    });
    if (!session) return { ok: false, message: 'Session introuvable.' };
    if (session.courseId !== course.id) {
      return { ok: false, message: 'Cette session ne correspond pas à cette formation.' };
    }
  } else {
    // Demande sans date precise : on retombe sur la capacite de la formation.
    const seatsLeft = course.capacity - course._count.enrollments;
    if (seatsLeft <= 0) {
      return { ok: false, message: 'Cette formation est complète. Contactez-nous pour la prochaine session.' };
    }
  }

  // Le prix retenu est celui de la session lorsqu'elle en definit un.
  const prixApplicable = session?.price ?? course.price;
  if (data.depositAmount > prixApplicable) {
    return { ok: false, message: 'L’acompte ne peut pas dépasser le prix de la formation.' };
  }

  const sessionUser = await getCurrentUser().catch(() => null);
  let user = sessionUser;
  let tempPassword: string | null = null;

  if (!user) {
    user = await prisma.user.findFirst({
      where: { phone: data.phone },
      include: { student: true, customer: true, trainer: true },
    });
  }

  if (!user) {
    tempPassword = temporaryPassword();
    user = await prisma.user.create({
      data: {
        fullName: data.fullName,
        phone: data.phone,
        whatsapp: data.whatsapp ?? data.phone,
        email: data.email ?? null,
        passwordHash: await hashPassword(tempPassword),
        role: ROLES.ELEVE,
      },
      include: { student: true, customer: true, trainer: true },
    });
  }

  // Profil eleve (cree a la premiere inscription)
  let student = await prisma.student.findUnique({ where: { userId: user.id } });
  if (!student) {
    student = await prisma.student.create({
      data: { userId: user.id, matricule: await nextReference('student') },
    });
    if (user.role === ROLES.CLIENTE) {
      await prisma.user.update({ where: { id: user.id }, data: { role: ROLES.ELEVE } });
    }
  }

  const already = await prisma.enrollment.findFirst({
    where: {
      studentId: student.id,
      courseId: course.id,
      status: { in: [ENROLLMENT_STATUS.EN_ATTENTE, ENROLLMENT_STATUS.CONFIRMEE, ENROLLMENT_STATUS.EN_COURS] },
    },
  });
  if (already) {
    return {
      ok: false,
      message: `Une inscription est déjà en cours pour cette formation (${already.reference}).`,
    };
  }

  const reference = await nextReference('enrollment');
  const enrollment = await prisma.enrollment.create({
    data: {
      reference,
      studentId: student.id,
      courseId: course.id,
      // Le dossier conserve la session visee, pas seulement la formation.
      sessionId: session?.id ?? null,
      status: ENROLLMENT_STATUS.EN_ATTENTE,
      amountDue: prixApplicable,
      amountPaid: 0,
      desiredDate: data.desiredDate ? new Date(data.desiredDate) : null,
      notes: data.notes ?? null,
    },
  });

  let paymentReference: string | null = null;
  if (data.depositAmount > 0) {
    paymentReference = await nextReference('payment');
    await prisma.payment.create({
      data: {
        reference: paymentReference,
        amount: data.depositAmount,
        method: data.paymentMethod,
        status: PAYMENT_STATUS.EN_ATTENTE,
        purpose: PAYMENT_PURPOSE.FORMATION,
        label: `Acompte — ${course.name}`,
        studentId: student.id,
        enrollmentId: enrollment.id,
        notes: 'Acompte déclaré lors de l’inscription en ligne, à confirmer par la caisse.',
      },
    });
  }

  await Promise.all([
    logAudit({
      userId: user.id,
      action: 'CREATE',
      entity: 'Enrollment',
      entityId: enrollment.id,
      details: `${reference} — ${course.name}`,
    }),
    notify({
      userId: user.id,
      type: NOTIFICATION_TYPES.INSCRIPTION,
      title: 'Inscription enregistrée',
      message: `Votre inscription ${reference} à la formation « ${course.name} » a bien été enregistrée.`,
      link: '/espace/eleve',
    }),
    notifyStaff({
      type: NOTIFICATION_TYPES.INSCRIPTION,
      title: 'Nouvelle inscription',
      message: `${data.fullName} — ${course.name} (${reference})${
        data.depositAmount > 0 ? ` — acompte annoncé ${formatMoney(data.depositAmount)}` : ''
      }`,
      link: '/admin/inscriptions',
    }),
  ]);

  revalidatePath('/admin');
  revalidatePath('/formations');

  return {
    ok: true,
    message: 'Inscription enregistrée.',
    data: {
      reference,
      courseName: course.name,
      price: course.price,
      deposit: data.depositAmount,
      paymentReference,
      tempPassword,
      phone: data.phone,
      hadAccount: !tempPassword,
    },
  };
}
