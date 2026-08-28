'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import {
  ENROLLMENT_STATUS,
  NOTIFICATION_TYPES,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS,
  type PaymentMethod,
} from '@/lib/constants';
import { formatMoney } from '@/lib/format';
import { notify } from '@/lib/notifications';
import { nextReference, randomVerificationCode } from '@/lib/refs';
import { getSetting } from '@/lib/settings';
import { certificateSchema, paymentSchema, zodToState, type ActionState } from '@/lib/validation';
import { formToObject, guard, isDenied } from '@/server/guard';

/**
 * Recalcule le montant deja regle d'une inscription ou d'un rendez-vous a
 * partir des paiements au statut PAYE. Aucune valeur n'est saisie a la main :
 * les soldes derivent toujours des ecritures de paiement.
 */
async function refreshBalances(params: { enrollmentId?: string | null; appointmentId?: string | null }) {
  if (params.enrollmentId) {
    const agg = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { enrollmentId: params.enrollmentId, status: PAYMENT_STATUS.PAYE },
    });
    await prisma.enrollment.update({
      where: { id: params.enrollmentId },
      data: { amountPaid: agg._sum.amount ?? 0 },
    });
  }
  if (params.appointmentId) {
    const agg = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { appointmentId: params.appointmentId, status: PAYMENT_STATUS.PAYE },
    });
    await prisma.appointment.update({
      where: { id: params.appointmentId },
      data: { amountPaid: agg._sum.amount ?? 0 },
    });
  }
}

/* ---------------------------------------------------------------- PAIEMENTS */

export async function recordPaymentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const g = await guard('payments.manage');
  if (isDenied(g)) return g.error;

  const parsed = paymentSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodToState(parsed.error);
  const d = parsed.data;

  const enrollment = d.enrollmentId
    ? await prisma.enrollment.findUnique({
        where: { id: d.enrollmentId },
        include: { student: { include: { user: true } }, course: { select: { name: true } } },
      })
    : null;
  const appointment = d.appointmentId
    ? await prisma.appointment.findUnique({
        where: { id: d.appointmentId },
        include: { customer: true, service: { select: { name: true } } },
      })
    : null;

  const payment = await prisma.payment.create({
    data: {
      reference: await nextReference('payment'),
      amount: d.amount,
      method: d.method,
      status: d.status,
      purpose: d.purpose,
      label: d.label,
      providerRef: d.providerRef ?? null,
      paidAt: d.paidAt ? new Date(d.paidAt) : new Date(),
      customerId: d.customerId || appointment?.customerId || null,
      studentId: d.studentId || enrollment?.studentId || null,
      enrollmentId: d.enrollmentId || null,
      appointmentId: d.appointmentId || null,
      recordedByUserId: g.user.id,
      notes: d.notes ?? null,
    },
  });

  await refreshBalances({ enrollmentId: payment.enrollmentId, appointmentId: payment.appointmentId });

  let receiptNumber: string | null = null;
  if (payment.status === PAYMENT_STATUS.PAYE) {
    const payerName =
      enrollment?.student.user.fullName ?? appointment?.customer.fullName ?? (await payerFallback(payment.customerId, payment.studentId));

    const refreshed = payment.enrollmentId
      ? await prisma.enrollment.findUnique({ where: { id: payment.enrollmentId } })
      : payment.appointmentId
        ? await prisma.appointment.findUnique({ where: { id: payment.appointmentId } })
        : null;

    const total = refreshed?.amountDue ?? payment.amount;
    const paid = refreshed?.amountPaid ?? payment.amount;

    receiptNumber = await nextReference('receipt');
    await prisma.receipt.create({
      data: {
        number: receiptNumber,
        paymentId: payment.id,
        payerName,
        itemLabel: payment.label,
        totalAmount: total,
        paidAmount: paid,
        balance: Math.max(0, total - paid),
        method: payment.method,
        issuedByUserId: g.user.id,
      },
    });

    const targetUserId = enrollment?.student.userId ?? appointment?.customer.userId ?? null;
    if (targetUserId) {
      await notify({
        userId: targetUserId,
        type: NOTIFICATION_TYPES.PAIEMENT,
        title: 'Paiement enregistré',
        message: `${formatMoney(payment.amount)} reçu par ${PAYMENT_METHOD_LABELS[payment.method as PaymentMethod] ?? payment.method}. Reçu ${receiptNumber}.`,
        link: '/espace/paiements',
      });
      const balance = Math.max(0, total - paid);
      if (balance > 0) {
        await notify({
          userId: targetUserId,
          type: NOTIFICATION_TYPES.SOLDE,
          title: 'Solde restant',
          message: `Il reste ${formatMoney(balance)} à régler.`,
          link: '/espace/paiements',
        });
      }
    }
  }

  await logAudit({
    userId: g.user.id,
    action: 'CREATE',
    entity: 'Payment',
    entityId: payment.id,
    details: `${payment.reference} — ${formatMoney(payment.amount)}`,
  });

  revalidatePath('/admin/paiements');
  revalidatePath('/admin/recus');
  revalidatePath('/admin');
  return {
    ok: true,
    message: receiptNumber
      ? `Paiement enregistré — reçu ${receiptNumber}.`
      : 'Paiement enregistré en attente de confirmation.',
    data: { receiptNumber },
  };
}

async function payerFallback(customerId: string | null, studentId: string | null): Promise<string> {
  if (customerId) {
    const c = await prisma.customer.findUnique({ where: { id: customerId }, select: { fullName: true } });
    if (c) return c.fullName;
  }
  if (studentId) {
    const s = await prisma.student.findUnique({ where: { id: studentId }, include: { user: true } });
    if (s) return s.user.fullName;
  }
  return 'Client';
}

/** Confirme un paiement declare en ligne (statut EN_ATTENTE -> PAYE) et emet le recu. */
export async function confirmPaymentAction(formData: FormData): Promise<void> {
  const g = await guard('payments.manage');
  if (isDenied(g)) return;
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      receipt: true,
      enrollment: { include: { student: { include: { user: true } } } },
      appointment: { include: { customer: true } },
    },
  });
  if (!payment || payment.status === PAYMENT_STATUS.PAYE) return;

  await prisma.payment.update({ where: { id }, data: { status: PAYMENT_STATUS.PAYE, paidAt: new Date() } });
  await refreshBalances({ enrollmentId: payment.enrollmentId, appointmentId: payment.appointmentId });

  if (!payment.receipt) {
    const refreshed = payment.enrollmentId
      ? await prisma.enrollment.findUnique({ where: { id: payment.enrollmentId } })
      : payment.appointmentId
        ? await prisma.appointment.findUnique({ where: { id: payment.appointmentId } })
        : null;
    const total = refreshed?.amountDue ?? payment.amount;
    const paid = refreshed?.amountPaid ?? payment.amount;

    await prisma.receipt.create({
      data: {
        number: await nextReference('receipt'),
        paymentId: payment.id,
        payerName:
          payment.enrollment?.student.user.fullName ??
          payment.appointment?.customer.fullName ??
          (await payerFallback(payment.customerId, payment.studentId)),
        itemLabel: payment.label,
        totalAmount: total,
        paidAmount: paid,
        balance: Math.max(0, total - paid),
        method: payment.method,
        issuedByUserId: g.user.id,
      },
    });
  }

  const targetUserId = payment.enrollment?.student.userId ?? payment.appointment?.customer.userId ?? null;
  if (targetUserId) {
    await notify({
      userId: targetUserId,
      type: NOTIFICATION_TYPES.PAIEMENT,
      title: 'Paiement confirmé',
      message: `Votre règlement de ${formatMoney(payment.amount)} a été confirmé.`,
      link: '/espace/paiements',
    });
  }

  await logAudit({ userId: g.user.id, action: 'CONFIRM', entity: 'Payment', entityId: id });
  revalidatePath('/admin/paiements');
  revalidatePath('/admin/recus');
}

export async function cancelPaymentAction(formData: FormData): Promise<void> {
  const g = await guard('payments.manage');
  if (isDenied(g)) return;
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const payment = await prisma.payment.update({ where: { id }, data: { status: PAYMENT_STATUS.ANNULE } });
  await refreshBalances({ enrollmentId: payment.enrollmentId, appointmentId: payment.appointmentId });
  await logAudit({ userId: g.user.id, action: 'CANCEL', entity: 'Payment', entityId: id });
  revalidatePath('/admin/paiements');
}

/* -------------------------------------------------------------- CERTIFICATS */

export async function generateCertificateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const g = await guard('certificates.manage');
  if (isDenied(g)) return g.error;

  const parsed = certificateSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodToState(parsed.error);
  const d = parsed.data;

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: d.enrollmentId },
    include: { student: { include: { user: true } }, course: true, certificate: true },
  });
  if (!enrollment) return { ok: false, message: 'Inscription introuvable.' };
  if (enrollment.certificate) {
    return { ok: false, message: `Un certificat existe déjà (${enrollment.certificate.number}).` };
  }
  if (enrollment.status !== ENROLLMENT_STATUS.TERMINEE) {
    return { ok: false, message: 'La formation doit être terminée avant de délivrer le certificat.' };
  }

  const signedBy = d.signedBy || (await getSetting('shop.director'));

  const certificate = await prisma.certificate.create({
    data: {
      number: await nextReference('certificate'),
      verificationCode: randomVerificationCode(),
      enrollmentId: enrollment.id,
      studentName: enrollment.student.user.fullName,
      courseName: enrollment.course.name,
      durationLabel: enrollment.course.durationLabel,
      mention: d.mention || 'Satisfaisant',
      signedBy,
    },
  });

  await notify({
    userId: enrollment.student.userId,
    type: NOTIFICATION_TYPES.CERTIFICAT,
    title: 'Votre certificat est disponible',
    message: `Certificat ${certificate.number} — ${enrollment.course.name}.`,
    link: '/espace/certificats',
  });
  await logAudit({
    userId: g.user.id,
    action: 'CREATE',
    entity: 'Certificate',
    entityId: certificate.id,
    details: certificate.number,
  });

  revalidatePath('/admin/certificats');
  revalidatePath('/espace/certificats');
  return { ok: true, message: `Certificat ${certificate.number} généré.`, data: { number: certificate.number } };
}

export async function revokeCertificateAction(formData: FormData): Promise<void> {
  const g = await guard('certificates.manage');
  if (isDenied(g)) return;
  const id = String(formData.get('id') ?? '');
  const next = String(formData.get('status') ?? 'REVOQUE');
  if (!id) return;
  await prisma.certificate.update({ where: { id }, data: { status: next === 'VALIDE' ? 'VALIDE' : 'REVOQUE' } });
  await logAudit({ userId: g.user.id, action: 'STATUS', entity: 'Certificate', entityId: id, details: next });
  revalidatePath('/admin/certificats');
}
