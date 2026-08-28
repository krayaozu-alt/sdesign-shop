import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge, Card, toneForStatus } from '@/components/ui/primitives';
import { APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from '@/lib/constants';
import { formatMoney, formatTime, toDateInput, toDateTimeLocal } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import {
  rescheduleAppointmentAction,
  sendDailyRemindersAction,
  setAppointmentStatusAction,
} from '@/server/actions/operations';
import { requirePermission } from '@/lib/auth';

export const metadata = { title: 'Calendrier' };
export const dynamic = 'force-dynamic';

const DAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // lundi = 0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default async function AdminCalendarPage({ searchParams }: { searchParams: { date?: string } }) {
  await requirePermission('appointments.manage');
  const base = searchParams.date ? new Date(`${searchParams.date}T00:00:00`) : new Date();
  const reference = Number.isNaN(base.getTime()) ? new Date() : base;
  const weekStart = startOfWeek(reference);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const prev = new Date(weekStart);
  prev.setDate(prev.getDate() - 7);
  const next = new Date(weekStart);
  next.setDate(next.getDate() + 7);

  const appointments = await prisma.appointment.findMany({
    where: { scheduledAt: { gte: weekStart, lt: weekEnd } },
    include: { customer: { select: { fullName: true, phone: true } }, service: { select: { name: true } } },
    orderBy: { scheduledAt: 'asc' },
  });

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const todayKey = toDateInput(new Date());

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label-eyebrow mb-1">Activité</p>
          <h1 className="section-title">Calendrier</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/calendrier?date=${toDateInput(prev)}`} className="btn-ghost px-3 py-2 text-xs">
            <ChevronLeft size={14} /> Semaine précédente
          </Link>
          <Link href="/admin/calendrier" className="btn-outline px-3 py-2 text-xs">
            Aujourd’hui
          </Link>
          <Link href={`/admin/calendrier?date=${toDateInput(next)}`} className="btn-ghost px-3 py-2 text-xs">
            Semaine suivante <ChevronRight size={14} />
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-cream-muted">
          Semaine du {weekStart.toLocaleDateString('fr-FR')} au{' '}
          {new Date(weekEnd.getTime() - 86400000).toLocaleDateString('fr-FR')} — {appointments.length} rendez-vous
        </p>
        <form action={sendDailyRemindersAction}>
          <button type="submit" className="btn-outline px-4 py-2 text-xs">
            Envoyer les rappels de demain
          </button>
        </form>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {days.map((day, i) => {
          const key = toDateInput(day);
          const dayAppointments = appointments.filter((a) => toDateInput(a.scheduledAt) === key);
          return (
            <Card key={key} className={key === todayKey ? 'border-gold-500/40 p-3' : 'p-3'}>
              <p className="mb-2 text-xs font-semibold text-cream">
                {DAY_LABELS[i]}{' '}
                <span className="text-cream-dim">
                  {day.getDate()}/{day.getMonth() + 1}
                </span>
              </p>
              {dayAppointments.length === 0 ? (
                <p className="text-[11px] text-cream-dim">—</p>
              ) : (
                <ul className="space-y-2">
                  {dayAppointments.map((a) => (
                    <li key={a.id} className="rounded-xl bg-white/[0.04] p-2">
                      <p className="text-[11px] font-semibold text-gold-300">{formatTime(a.scheduledAt)}</p>
                      <p className="truncate text-xs text-cream">{a.customer.fullName}</p>
                      <p className="truncate text-[11px] text-cream-muted">{a.service.name}</p>
                      <p className="text-[10px] text-cream-dim">{formatMoney(a.amountDue)}</p>
                      <Badge tone={toneForStatus(a.status)} className="mt-1">
                        {APPOINTMENT_STATUS_LABELS[a.status as AppointmentStatus] ?? a.status}
                      </Badge>

                      <details className="mt-2">
                        <summary className="cursor-pointer list-none text-[10px] text-cream-dim hover:text-cream">
                          Gérer
                        </summary>
                        <form action={rescheduleAppointmentAction} className="mt-2">
                          <input type="hidden" name="id" value={a.id} />
                          <input
                            type="datetime-local"
                            name="scheduledAt"
                            defaultValue={toDateTimeLocal(a.scheduledAt)}
                            className="px-2 py-1.5 text-[11px]"
                          />
                          <button type="submit" className="btn-ghost mt-1 w-full px-2 py-1 text-[10px]">
                            Déplacer
                          </button>
                        </form>
                        <div className="mt-1 flex gap-1">
                          <form action={setAppointmentStatusAction} className="flex-1">
                            <input type="hidden" name="id" value={a.id} />
                            <input type="hidden" name="status" value="CONFIRME" />
                            <button type="submit" className="btn-outline w-full px-2 py-1 text-[10px]">
                              Confirmer
                            </button>
                          </form>
                          <form action={setAppointmentStatusAction} className="flex-1">
                            <input type="hidden" name="id" value={a.id} />
                            <input type="hidden" name="status" value="ANNULE" />
                            <button type="submit" className="btn-danger w-full px-2 py-1 text-[10px]">
                              Annuler
                            </button>
                          </form>
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
