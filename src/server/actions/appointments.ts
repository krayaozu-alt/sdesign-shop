'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { APPOINTMENT_STATUS, NOTIFICATION_TYPES } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import { notify, notifyStaff } from '@/lib/notifications';
import { nextReference } from '@/lib/refs';
import { appointmentPublicSchema, zodToState, type ActionState } from '@/lib/validation';

function formToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  formData.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

/**
 * Reservation publique d'une prestation.
 * Le rendez-vous est cree au statut EN_ATTENTE : il devient CONFIRME une fois
 * valide par la boutique depuis Admin > Reservations.
 */
export async function createAppointmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = appointmentPublicSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodToState(parsed.error);
  const data = parsed.data;

  const service = await prisma.service.findUnique({ where: { id: data.serviceId } });
  if (!service) return { ok: false, message: 'Prestation introuvable.' };
  if (!service.isAvailable) return { ok: false, message: 'Cette prestation n’est pas disponible actuellement.' };

  const scheduledAt = new Date(`${data.date}T${data.time}:00`);
  if (Number.isNaN(scheduledAt.getTime())) return { ok: false, message: 'Date ou heure invalide.' };
  if (scheduledAt.getTime() < Date.now()) return { ok: false, message: 'Choisissez une date à venir.' };

  const sessionUser = await getCurrentUser().catch(() => null);

  // Fiche cliente : reutilisee si le numero existe deja (base CRM unique)
  let customer = await prisma.customer.findFirst({
    where: sessionUser?.customer ? { id: sessionUser.customer.id } : { phone: data.phone },
  });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        userId: sessionUser?.id ?? null,
        fullName: data.fullName,
        phone: data.phone,
        whatsapp: data.whatsapp ?? data.phone,
        email: data.email ?? null,
      },
    });
  } else {
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        fullName: data.fullName,
        whatsapp: data.whatsapp ?? customer.whatsapp,
        email: data.email ?? customer.email,
        userId: customer.userId ?? sessionUser?.id ?? null,
      },
    });
  }

  const duplicate = await prisma.appointment.findFirst({
    where: {
      customerId: customer.id,
      serviceId: service.id,
      scheduledAt,
      status: { in: [APPOINTMENT_STATUS.EN_ATTENTE, APPOINTMENT_STATUS.CONFIRME] },
    },
  });
  if (duplicate) {
    return { ok: false, message: `Vous avez déjà une réservation à ce créneau (${duplicate.reference}).` };
  }

  const reference = await nextReference('appointment');
  const appointment = await prisma.appointment.create({
    data: {
      reference,
      customerId: customer.id,
      serviceId: service.id,
      scheduledAt,
      durationMinutes: service.durationMinutes,
      status: APPOINTMENT_STATUS.EN_ATTENTE,
      amountDue: service.price,
      notes: data.notes ?? null,
      source: 'SITE',
    },
  });

  await Promise.all([
    logAudit({
      userId: sessionUser?.id ?? null,
      action: 'CREATE',
      entity: 'Appointment',
      entityId: appointment.id,
      details: `${reference} — ${service.name}`,
    }),
    sessionUser
      ? notify({
          userId: sessionUser.id,
          type: NOTIFICATION_TYPES.RESERVATION_NOUVELLE,
          title: 'Réservation enregistrée',
          message: `Votre réservation ${reference} (${service.name}) du ${formatDateTime(scheduledAt)} est en attente de confirmation.`,
          link: '/espace/rendez-vous',
        })
      : Promise.resolve(),
    notifyStaff({
      type: NOTIFICATION_TYPES.RESERVATION_NOUVELLE,
      title: 'Nouvelle réservation',
      message: `${data.fullName} — ${service.name} le ${formatDateTime(scheduledAt)} (${reference})`,
      link: '/admin/reservations',
    }),
  ]);

  revalidatePath('/admin');
  revalidatePath('/espace/rendez-vous');

  return {
    ok: true,
    message: 'Votre réservation a été enregistrée.',
    data: {
      reference,
      serviceName: service.name,
      scheduledAt: scheduledAt.toISOString(),
      amount: service.price,
      duration: service.durationMinutes,
    },
  };
}

/* ------------------------------------------------ ACTIONS DE LA CLIENTE */

/**
 * Verifie que le rendez-vous appartient bien a la cliente connectee.
 * Une cliente ne peut agir que sur ses propres rendez-vous.
 */
async function rendezVousDeLaCliente(id: string) {
  const user = await getCurrentUser().catch(() => null);
  if (!user?.customer) return null;
  const rdv = await prisma.appointment.findFirst({
    where: { id, customerId: user.customer.id },
    include: { service: { select: { name: true } } },
  });
  return rdv ? { user, rdv } : null;
}

/** Annulation par la cliente de son propre rendez-vous. */
export async function cancelMyAppointmentAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const ctx = await rendezVousDeLaCliente(id);
  if (!ctx) return;
  if (![APPOINTMENT_STATUS.EN_ATTENTE, APPOINTMENT_STATUS.CONFIRME].includes(ctx.rdv.status as never)) return;

  await prisma.appointment.update({ where: { id }, data: { status: APPOINTMENT_STATUS.ANNULE } });

  await notifyStaff({
    type: NOTIFICATION_TYPES.RESERVATION_NOUVELLE,
    title: 'Rendez-vous annulé par la cliente',
    message: `${ctx.rdv.reference} — ${ctx.rdv.service.name} du ${formatDateTime(ctx.rdv.scheduledAt)}.`,
    link: '/admin/reservations',
  });
  await logAudit({ userId: ctx.user.id, action: 'CANCEL', entity: 'Appointment', entityId: id, details: 'par la cliente' });

  revalidatePath('/espace/rendez-vous');
  revalidatePath('/espace');
  revalidatePath('/admin/reservations');
}

/** Report par la cliente de son propre rendez-vous (repasse en attente de confirmation). */
export async function rescheduleMyAppointmentAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const date = String(formData.get('date') ?? '');
  const time = String(formData.get('time') ?? '');
  if (!id || !date || !/^\d{2}:\d{2}$/.test(time)) return;

  const ctx = await rendezVousDeLaCliente(id);
  if (!ctx) return;
  if (![APPOINTMENT_STATUS.EN_ATTENTE, APPOINTMENT_STATUS.CONFIRME].includes(ctx.rdv.status as never)) return;

  const scheduledAt = new Date(`${date}T${time}:00`);
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now()) return;

  await prisma.appointment.update({
    where: { id },
    data: { scheduledAt, status: APPOINTMENT_STATUS.EN_ATTENTE },
  });

  await notifyStaff({
    type: NOTIFICATION_TYPES.RESERVATION_NOUVELLE,
    title: 'Rendez-vous déplacé par la cliente',
    message: `${ctx.rdv.reference} — ${ctx.rdv.service.name} désormais le ${formatDateTime(scheduledAt)}. À reconfirmer.`,
    link: '/admin/reservations',
  });
  await logAudit({ userId: ctx.user.id, action: 'RESCHEDULE', entity: 'Appointment', entityId: id, details: 'par la cliente' });

  revalidatePath('/espace/rendez-vous');
  revalidatePath('/espace');
  revalidatePath('/admin/reservations');
}
