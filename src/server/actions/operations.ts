'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import {
  APPOINTMENT_STATUS,
  APPOINTMENT_STATUS_VALUES,
  ENROLLMENT_STATUS,
  ENROLLMENT_STATUS_VALUES,
  NOTIFICATION_TYPES,
} from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import { notify } from '@/lib/notifications';
import { nextReference } from '@/lib/refs';
import {
  appointmentAdminSchema,
  attendanceSchema,
  enrollmentAdminSchema,
  zodToState,
  type ActionState,
} from '@/lib/validation';
import { formToObject, guard, isDenied } from '@/server/guard';

/* ------------------------------------------------------------ INSCRIPTIONS */

export async function saveEnrollmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const g = await guard('students.manage');
  if (isDenied(g)) return g.error;

  const parsed = enrollmentAdminSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodToState(parsed.error);
  const d = parsed.data;

  if (d.id) {
    const before = await prisma.enrollment.findUnique({
      where: { id: d.id },
      include: { student: { include: { user: true } }, course: { select: { name: true } } },
    });
    if (!before) return { ok: false, message: 'Inscription introuvable.' };

    const enrollment = await prisma.enrollment.update({
      where: { id: d.id },
      data: {
        status: d.status,
        progress: d.progress,
        amountDue: d.amountDue,
        sessionId: d.sessionId || null,
        notes: d.notes ?? null,
        completedAt: d.status === ENROLLMENT_STATUS.TERMINEE ? (before.completedAt ?? new Date()) : null,
      },
    });

    if (before.status !== d.status) {
      await notify({
        userId: before.student.userId,
        type: NOTIFICATION_TYPES.INSCRIPTION,
        title: 'Mise à jour de votre inscription',
        message: `Votre inscription ${enrollment.reference} (${before.course.name}) est maintenant : ${d.status.toLowerCase().replace('_', ' ')}.`,
        link: '/espace/formations',
      });
    }

    await logAudit({ userId: g.user.id, action: 'UPDATE', entity: 'Enrollment', entityId: enrollment.id });
    revalidatePath('/admin/inscriptions');
    return { ok: true, message: 'Inscription mise à jour.' };
  }

  const course = await prisma.course.findUnique({ where: { id: d.courseId } });
  if (!course) return { ok: false, message: 'Formation introuvable.' };

  const duplicate = await prisma.enrollment.findFirst({
    where: {
      studentId: d.studentId,
      courseId: d.courseId,
      status: { in: [ENROLLMENT_STATUS.EN_ATTENTE, ENROLLMENT_STATUS.CONFIRMEE, ENROLLMENT_STATUS.EN_COURS] },
    },
  });
  if (duplicate) return { ok: false, message: `Inscription déjà existante (${duplicate.reference}).` };

  const enrollment = await prisma.enrollment.create({
    data: {
      reference: await nextReference('enrollment'),
      studentId: d.studentId,
      courseId: d.courseId,
      sessionId: d.sessionId || null,
      status: d.status,
      progress: d.progress,
      amountDue: d.amountDue || course.price,
      notes: d.notes ?? null,
    },
    include: { student: true },
  });

  await notify({
    userId: enrollment.student.userId,
    type: NOTIFICATION_TYPES.INSCRIPTION,
    title: 'Nouvelle inscription',
    message: `Vous avez été inscrite à la formation « ${course.name} » (${enrollment.reference}).`,
    link: '/espace/formations',
  });
  await logAudit({ userId: g.user.id, action: 'CREATE', entity: 'Enrollment', entityId: enrollment.id });
  revalidatePath('/admin/inscriptions');
  return { ok: true, message: `Inscription créée — ${enrollment.reference}.` };
}

export async function setEnrollmentStatusAction(formData: FormData): Promise<void> {
  const g = await guard('students.manage');
  if (isDenied(g)) return;
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!id || !(ENROLLMENT_STATUS_VALUES as readonly string[]).includes(status)) return;

  const enrollment = await prisma.enrollment.update({
    where: { id },
    data: {
      status,
      completedAt: status === ENROLLMENT_STATUS.TERMINEE ? new Date() : null,
      ...(status === ENROLLMENT_STATUS.TERMINEE ? { progress: 100 } : {}),
    },
    include: { student: true, course: { select: { name: true } } },
  });

  await notify({
    userId: enrollment.student.userId,
    type: NOTIFICATION_TYPES.INSCRIPTION,
    title: 'Mise à jour de votre inscription',
    message: `Inscription ${enrollment.reference} — ${enrollment.course.name} : ${status.toLowerCase().replace('_', ' ')}.`,
    link: '/espace/formations',
  });
  await logAudit({ userId: g.user.id, action: 'STATUS', entity: 'Enrollment', entityId: id, details: status });
  revalidatePath('/admin/inscriptions');
}

export async function setProgressAction(formData: FormData): Promise<void> {
  const g = await guard('students.manage');
  if (isDenied(g)) return;
  const id = String(formData.get('id') ?? '');
  const progress = Math.max(0, Math.min(100, Number.parseInt(String(formData.get('progress') ?? '0'), 10) || 0));
  if (!id) return;
  await prisma.enrollment.update({ where: { id }, data: { progress } });
  await logAudit({ userId: g.user.id, action: 'PROGRESS', entity: 'Enrollment', entityId: id, details: `${progress}%` });
  revalidatePath('/admin/inscriptions');
}

export async function toggleModuleProgressAction(formData: FormData): Promise<void> {
  const g = await guard('attendance.manage');
  if (isDenied(g)) return;
  const enrollmentId = String(formData.get('enrollmentId') ?? '');
  const moduleId = String(formData.get('moduleId') ?? '');
  if (!enrollmentId || !moduleId) return;

  const existing = await prisma.moduleProgress.findUnique({
    where: { enrollmentId_moduleId: { enrollmentId, moduleId } },
  });
  if (existing) {
    await prisma.moduleProgress.update({
      where: { id: existing.id },
      data: { completed: !existing.completed, completedAt: existing.completed ? null : new Date() },
    });
  } else {
    await prisma.moduleProgress.create({
      data: { enrollmentId, moduleId, completed: true, completedAt: new Date() },
    });
  }

  // La progression globale est recalculee a partir des modules valides.
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { course: { include: { _count: { select: { modules: true } } } }, modules: true },
  });
  if (enrollment && enrollment.course._count.modules > 0) {
    const done = enrollment.modules.filter((m) => m.completed).length;
    const progress = Math.round((done / enrollment.course._count.modules) * 100);
    await prisma.enrollment.update({ where: { id: enrollmentId }, data: { progress } });
  }

  revalidatePath(`/admin/inscriptions/${enrollmentId}`);
}

export async function saveAttendanceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const g = await guard('attendance.manage');
  if (isDenied(g)) return g.error;

  const parsed = attendanceSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodToState(parsed.error);
  const d = parsed.data;

  await prisma.attendance.create({
    data: {
      enrollmentId: d.enrollmentId,
      date: new Date(d.date),
      status: d.status,
      note: d.note ?? null,
    },
  });
  await logAudit({ userId: g.user.id, action: 'CREATE', entity: 'Attendance', entityId: d.enrollmentId });
  revalidatePath(`/admin/inscriptions/${d.enrollmentId}`);
  return { ok: true, message: 'Présence enregistrée.' };
}

/* ------------------------------------------------------------ RESERVATIONS */

export async function saveAppointmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const g = await guard('appointments.manage');
  if (isDenied(g)) return g.error;

  const parsed = appointmentAdminSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodToState(parsed.error);
  const d = parsed.data;

  const scheduledAt = new Date(d.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) return { ok: false, message: 'Date et heure invalides.' };

  const data = {
    customerId: d.customerId,
    serviceId: d.serviceId,
    staffUserId: d.staffUserId || null,
    scheduledAt,
    durationMinutes: d.durationMinutes,
    status: d.status,
    amountDue: d.amountDue,
    notes: d.notes ?? null,
  };

  const appointment = d.id
    ? await prisma.appointment.update({ where: { id: d.id }, data })
    : await prisma.appointment.create({ data: { ...data, reference: await nextReference('appointment'), source: 'SUR_PLACE' } });

  await logAudit({
    userId: g.user.id,
    action: d.id ? 'UPDATE' : 'CREATE',
    entity: 'Appointment',
    entityId: appointment.id,
  });
  revalidatePath('/admin/reservations');
  revalidatePath('/admin/calendrier');
  return { ok: true, message: d.id ? 'Rendez-vous mis à jour.' : `Rendez-vous créé — ${appointment.reference}.` };
}

export async function setAppointmentStatusAction(formData: FormData): Promise<void> {
  const g = await guard('appointments.manage');
  if (isDenied(g)) return;
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!id || !(APPOINTMENT_STATUS_VALUES as readonly string[]).includes(status)) return;

  const appointment = await prisma.appointment.update({
    where: { id },
    data: { status },
    include: { customer: true, service: { select: { name: true } } },
  });

  if (appointment.customer.userId) {
    await notify({
      userId: appointment.customer.userId,
      type:
        status === APPOINTMENT_STATUS.CONFIRME
          ? NOTIFICATION_TYPES.RESERVATION_CONFIRMEE
          : NOTIFICATION_TYPES.RESERVATION_NOUVELLE,
      title:
        status === APPOINTMENT_STATUS.CONFIRME ? 'Rendez-vous confirmé' : 'Mise à jour de votre rendez-vous',
      message: `${appointment.service.name} — ${formatDateTime(appointment.scheduledAt)} (${appointment.reference}) : ${status.toLowerCase()}.`,
      link: '/espace/rendez-vous',
    });
  }

  await logAudit({ userId: g.user.id, action: 'STATUS', entity: 'Appointment', entityId: id, details: status });
  revalidatePath('/admin/reservations');
  revalidatePath('/admin/calendrier');
}

export async function rescheduleAppointmentAction(formData: FormData): Promise<void> {
  const g = await guard('appointments.manage');
  if (isDenied(g)) return;
  const id = String(formData.get('id') ?? '');
  const value = String(formData.get('scheduledAt') ?? '');
  if (!id || !value) return;
  const scheduledAt = new Date(value);
  if (Number.isNaN(scheduledAt.getTime())) return;

  const appointment = await prisma.appointment.update({
    where: { id },
    data: { scheduledAt },
    include: { customer: true, service: { select: { name: true } } },
  });

  if (appointment.customer.userId) {
    await notify({
      userId: appointment.customer.userId,
      type: NOTIFICATION_TYPES.RAPPEL_RDV,
      title: 'Rendez-vous déplacé',
      message: `${appointment.service.name} est désormais prévu le ${formatDateTime(scheduledAt)}.`,
      link: '/espace/rendez-vous',
    });
  }

  await logAudit({ userId: g.user.id, action: 'RESCHEDULE', entity: 'Appointment', entityId: id });
  revalidatePath('/admin/reservations');
  revalidatePath('/admin/calendrier');
}

/**
 * Rappels de rendez-vous du lendemain.
 * Declenche manuellement depuis le calendrier (aucun planificateur n'est
 * installe) : une notification est creee pour chaque cliente disposant d'un
 * compte, et une entree en file d'attente pour les canaux non configures.
 */
export async function sendDailyRemindersAction(): Promise<void> {
  const g = await guard('appointments.manage');
  if (isDenied(g)) return;

  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const appointments = await prisma.appointment.findMany({
    where: {
      scheduledAt: { gte: start, lt: end },
      status: { in: [APPOINTMENT_STATUS.EN_ATTENTE, APPOINTMENT_STATUS.CONFIRME] },
    },
    include: { customer: true, service: { select: { name: true } } },
  });

  for (const a of appointments) {
    if (!a.customer.userId) continue;
    await notify({
      userId: a.customer.userId,
      type: NOTIFICATION_TYPES.RAPPEL_RDV,
      title: 'Rappel de rendez-vous',
      message: `${a.service.name} demain à ${formatDateTime(a.scheduledAt).split(' à ')[1]} — référence ${a.reference}.`,
      link: '/espace/rendez-vous',
    });
  }

  await logAudit({
    userId: g.user.id,
    action: 'REMINDERS',
    entity: 'Appointment',
    details: `${appointments.length} rendez-vous concernés`,
  });
  revalidatePath('/admin/calendrier');
}
