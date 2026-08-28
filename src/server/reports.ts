import 'server-only';
import { prisma } from '@/lib/prisma';
import { APPOINTMENT_STATUS, COURSE_STATUS, ENROLLMENT_STATUS, PAYMENT_STATUS } from '@/lib/constants';

export function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
export function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
export function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
export function startOfYear(d = new Date()) {
  return new Date(d.getFullYear(), 0, 1);
}

async function sumPayments(gte: Date, lt?: Date): Promise<number> {
  const agg = await prisma.payment.aggregate({
    _sum: { amount: true },
    where: { status: PAYMENT_STATUS.PAYE, paidAt: { gte, ...(lt ? { lt } : {}) } },
  });
  return agg._sum.amount ?? 0;
}

export async function getDashboardStats() {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [
    revenueTotal,
    revenueToday,
    revenueMonth,
    revenueYear,
    customers,
    students,
    appointmentsToday,
    appointmentsPending,
    activeCourses,
    pendingPayments,
    enrollments,
    certificates,
  ] = await Promise.all([
    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: PAYMENT_STATUS.PAYE } }),
    sumPayments(today, tomorrow),
    sumPayments(startOfMonth(now)),
    sumPayments(startOfYear(now)),
    prisma.customer.count(),
    prisma.student.count(),
    prisma.appointment.count({
      where: {
        scheduledAt: { gte: today, lt: tomorrow },
        status: { in: [APPOINTMENT_STATUS.EN_ATTENTE, APPOINTMENT_STATUS.CONFIRME] },
      },
    }),
    prisma.appointment.count({ where: { status: APPOINTMENT_STATUS.EN_ATTENTE } }),
    prisma.course.count({ where: { status: { in: [COURSE_STATUS.OUVERTE, COURSE_STATUS.EN_COURS] } } }),
    prisma.payment.aggregate({ _sum: { amount: true }, _count: true, where: { status: PAYMENT_STATUS.EN_ATTENTE } }),
    prisma.enrollment.findMany({
      where: { status: { in: [ENROLLMENT_STATUS.EN_ATTENTE, ENROLLMENT_STATUS.CONFIRMEE, ENROLLMENT_STATUS.EN_COURS] } },
      select: { amountDue: true, amountPaid: true },
    }),
    prisma.certificate.count({ where: { status: 'VALIDE' } }),
  ]);

  const outstanding = enrollments.reduce((sum, e) => sum + Math.max(0, e.amountDue - e.amountPaid), 0);

  return {
    revenueTotal: revenueTotal._sum.amount ?? 0,
    revenueToday,
    revenueMonth,
    revenueYear,
    customers,
    students,
    appointmentsToday,
    appointmentsPending,
    activeCourses,
    pendingPaymentsCount: pendingPayments._count,
    pendingPaymentsAmount: pendingPayments._sum.amount ?? 0,
    activeEnrollments: enrollments.length,
    outstanding,
    certificates,
  };
}

/** Serie journaliere des recettes encaissees sur N jours (bornes incluses). */
export async function getRevenueSeries(days = 30) {
  const from = startOfDay(new Date());
  from.setDate(from.getDate() - (days - 1));

  const payments = await prisma.payment.findMany({
    where: { status: PAYMENT_STATUS.PAYE, paidAt: { gte: from } },
    select: { amount: true, paidAt: true },
  });

  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i += 1) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const p of payments) {
    const key = new Date(p.paidAt).toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + p.amount);
  }

  return Array.from(buckets.entries()).map(([key, value]) => ({
    label: `${key.slice(8, 10)}/${key.slice(5, 7)}`,
    value,
  }));
}

/** Recettes mensuelles de l'annee en cours. */
export async function getMonthlyRevenue(year = new Date().getFullYear()) {
  const payments = await prisma.payment.findMany({
    where: {
      status: PAYMENT_STATUS.PAYE,
      paidAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
    },
    select: { amount: true, paidAt: true },
  });
  const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  const totals = new Array(12).fill(0) as number[];
  for (const p of payments) totals[new Date(p.paidAt).getMonth()] += p.amount;
  return months.map((label, i) => ({ label, value: totals[i] }));
}

export async function getTopCourses(limit = 5) {
  const courses = await prisma.course.findMany({
    include: { _count: { select: { enrollments: true } } },
    orderBy: { enrollments: { _count: 'desc' } },
    take: limit,
  });
  return courses
    .filter((c) => c._count.enrollments > 0)
    .map((c) => ({ id: c.id, label: c.name, value: c._count.enrollments, price: c.price }));
}

export async function getTopServices(limit = 5) {
  const services = await prisma.service.findMany({
    include: { _count: { select: { appointments: true } } },
    orderBy: { appointments: { _count: 'desc' } },
    take: limit,
  });
  return services
    .filter((s) => s._count.appointments > 0)
    .map((s) => ({ id: s.id, label: s.name, value: s._count.appointments, price: s.price }));
}

export async function getNewCustomers(days = 30) {
  const from = startOfDay(new Date());
  from.setDate(from.getDate() - days);
  return prisma.customer.count({ where: { createdAt: { gte: from } } });
}

/** Lignes du rapport de chiffre d'affaires sur une periode. */
export async function getRevenueRows(from: Date, to: Date) {
  return prisma.payment.findMany({
    where: { status: PAYMENT_STATUS.PAYE, paidAt: { gte: from, lte: to } },
    include: {
      customer: { select: { fullName: true } },
      student: { include: { user: { select: { fullName: true } } } },
      receipt: { select: { number: true } },
    },
    orderBy: { paidAt: 'desc' },
  });
}

const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

/** Nombre d'inscriptions par mois sur l'annee en cours. */
export async function getMonthlyEnrollments(year = new Date().getFullYear()) {
  const rows = await prisma.enrollment.findMany({
    where: { createdAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
    select: { createdAt: true },
  });
  const totaux = new Array(12).fill(0) as number[];
  for (const r of rows) totaux[new Date(r.createdAt).getMonth()] += 1;
  return MOIS.map((label, i) => ({ label, value: totaux[i] }));
}

/** Nombre de rendez-vous par mois sur l'annee en cours (hors annules). */
export async function getMonthlyAppointments(year = new Date().getFullYear()) {
  const rows = await prisma.appointment.findMany({
    where: {
      scheduledAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
      status: { not: APPOINTMENT_STATUS.ANNULE },
    },
    select: { scheduledAt: true },
  });
  const totaux = new Array(12).fill(0) as number[];
  for (const r of rows) totaux[new Date(r.scheduledAt).getMonth()] += 1;
  return MOIS.map((label, i) => ({ label, value: totaux[i] }));
}

/** Repartition des paiements par statut, pour le graphique du tableau de bord. */
export async function getPaymentBreakdown() {
  const rows = await prisma.payment.groupBy({ by: ['status'], _sum: { amount: true }, _count: true });
  return rows.map((r) => ({ label: r.status, value: r._sum.amount ?? 0, count: r._count }));
}
