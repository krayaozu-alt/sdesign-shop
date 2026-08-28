'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { NOTIFICATION_TYPES, WAITLIST_STATUS } from '@/lib/constants';
import { notifyStaff } from '@/lib/notifications';
import { waitlistSchema, zodToState, type ActionState } from '@/lib/validation';

function formToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  formData.forEach((value, key) => {
    if (value instanceof File) return;
    out[key] = value;
  });
  return out;
}

/**
 * Inscription a la liste d'attente d'une session complete.
 *
 * AUCUNE PLACE N'EST RESERVEE : la personne est seulement enregistree pour
 * etre prevenue. C'est elle qui confirmera son inscription le moment venu.
 * Ce choix est deliberé — reserver automatiquement au-dela de la capacite
 * reviendrait a promettre une place qui n'existe pas.
 */
export async function rejoindreListeAttenteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = waitlistSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodToState(parsed.error);
  const d = parsed.data;

  const session = await prisma.courseSession.findUnique({
    where: { id: d.sessionId },
    select: { id: true, title: true, slug: true, course: { select: { name: true } } },
  });
  if (!session) return { ok: false, message: 'Session introuvable.' };

  const user = await getCurrentUser().catch(() => null);

  const dejaInscrite = await prisma.waitlist.findUnique({
    where: { sessionId_phone: { sessionId: d.sessionId, phone: d.phone } },
    select: { id: true, status: true },
  });

  if (dejaInscrite) {
    // Une demande annulee peut etre reactivee ; sinon on ne cree pas de doublon.
    if (dejaInscrite.status === WAITLIST_STATUS.ANNULEE) {
      await prisma.waitlist.update({
        where: { id: dejaInscrite.id },
        data: { status: WAITLIST_STATUS.EN_ATTENTE, fullName: d.fullName, email: d.email || null, notes: d.notes ?? null },
      });
      return { ok: true, message: 'Votre demande a bien été enregistrée. Nous vous préviendrons.' };
    }
    return { ok: true, message: 'Vous figurez déjà sur cette liste. Nous vous préviendrons dès qu’une place se libère.' };
  }

  const entree = await prisma.waitlist.create({
    data: {
      sessionId: d.sessionId,
      userId: user?.id ?? null,
      fullName: d.fullName,
      phone: d.phone,
      email: d.email || null,
      notes: d.notes ?? null,
      status: WAITLIST_STATUS.EN_ATTENTE,
    },
  });

  await notifyStaff({
    type: NOTIFICATION_TYPES.SYSTEME,
    title: 'Nouvelle demande en liste d’attente',
    message: `${d.fullName} souhaite être informée pour « ${session.course.name} — ${session.title} ».`,
    link: '/admin/sessions',
  });
  await logAudit({
    userId: user?.id ?? null,
    action: 'CREATE',
    entity: 'Waitlist',
    entityId: entree.id,
    details: `${session.course.name} — ${session.title}`,
  });

  revalidatePath(`/sessions/${session.slug}`);
  return {
    ok: true,
    message: 'C’est noté. Nous vous préviendrons dès qu’une place se libère ou qu’une nouvelle session est programmée.',
  };
}
