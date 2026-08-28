import Link from 'next/link';
import { CalendarDays, Clock, MapPin, Plus } from 'lucide-react';
import { Badge, Card, EmptyState, toneForStatus } from '@/components/ui/primitives';
import { Disclosure } from '@/components/ui/Disclosure';
import { requireUser } from '@/lib/auth';
import { APPOINTMENT_STATUS_LABELS, DEFAULT_TIME_SLOTS, type AppointmentStatus } from '@/lib/constants';
import { formatDate, formatDateTime, formatDuration, formatMoney, formatTime, toDateInput } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { getSettings, splitList } from '@/lib/settings';
import { cancelMyAppointmentAction, rescheduleMyAppointmentAction } from '@/server/actions/appointments';

export const metadata = { title: 'Mes rendez-vous' };
export const dynamic = 'force-dynamic';

export default async function MyAppointmentsPage() {
  const user = await requireUser();
  const settings = await getSettings();
  const creneaux = splitList(settings['booking.slots']);
  const slots = creneaux.length ? creneaux : DEFAULT_TIME_SLOTS;

  const rendezVous = user.customer
    ? await prisma.appointment.findMany({
        where: { customerId: user.customer.id },
        include: { service: { select: { name: true, slug: true } } },
        orderBy: { scheduledAt: 'desc' },
      })
    : [];

  const maintenant = Date.now();
  const aVenir = rendezVous.filter(
    (r) => r.scheduledAt.getTime() >= maintenant && ['EN_ATTENTE', 'CONFIRME'].includes(r.status),
  );
  const prochain = [...aVenir].sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())[0];
  const historique = rendezVous.filter((r) => r.id !== prochain?.id);

  if (rendezVous.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays size={28} />}
        title="Aucun rendez-vous"
        description="Réservez une prestation et retrouvez ici son suivi complet."
        action={
          <Link href="/reservation" className="btn-gold">
            <Plus size={16} /> Nouveau rendez-vous
          </Link>
        }
      />
    );
  }

  const minDate = toDateInput(new Date());

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl text-cream">Prochain rendez-vous</h2>
        <Link href="/reservation" className="btn-gold px-5 py-2.5 text-xs">
          <Plus size={15} /> Nouveau rendez-vous
        </Link>
      </div>

      {prochain ? (
        <Card strong>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge tone={toneForStatus(prochain.status)}>
                  {APPOINTMENT_STATUS_LABELS[prochain.status as AppointmentStatus] ?? prochain.status}
                </Badge>
                <span className="text-xs text-cream-dim">{prochain.reference}</span>
              </div>
              <p className="font-display text-2xl text-cream">{prochain.service.name}</p>
              <ul className="mt-3 space-y-1.5 text-sm text-cream-muted">
                <li className="flex items-center gap-2">
                  <CalendarDays size={14} className="text-gold-400" /> {formatDate(prochain.scheduledAt)}
                </li>
                <li className="flex items-center gap-2">
                  <Clock size={14} className="text-gold-400" /> {formatTime(prochain.scheduledAt)} ·{' '}
                  {formatDuration(prochain.durationMinutes)}
                </li>
                <li className="flex items-center gap-2">
                  <MapPin size={14} className="text-gold-400" /> {settings['shop.address']}
                </li>
              </ul>
            </div>
            <div className="text-right">
              <p className="text-xs text-cream-dim">Montant</p>
              <p className="font-display text-2xl text-gold-300">{formatMoney(prochain.amountDue)}</p>
              {prochain.amountPaid > 0 ? (
                <p className="text-[11px] text-cream-muted">Réglé : {formatMoney(prochain.amountPaid)}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Disclosure variant="ghost" label="Modifier le rendez-vous">
              <form action={rescheduleMyAppointmentAction} className="surface space-y-3 p-4">
                <input type="hidden" name="id" value={prochain.id} />
                <div>
                  <label htmlFor="date-rdv">Nouvelle date</label>
                  <input
                    id="date-rdv"
                    type="date"
                    name="date"
                    min={minDate}
                    defaultValue={toDateInput(prochain.scheduledAt)}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="heure-rdv">Nouveau créneau</label>
                  <select id="heure-rdv" name="time" defaultValue={formatTime(prochain.scheduledAt).replace('h', ':')}>
                    {slots.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-cream-dim">
                  Le rendez-vous repassera « en attente » : notre équipe vous confirmera le nouveau créneau.
                </p>
                <button type="submit" className="btn-gold w-full px-4 py-2.5 text-xs">
                  Enregistrer le nouveau créneau
                </button>
              </form>
            </Disclosure>

            <form action={cancelMyAppointmentAction}>
              <input type="hidden" name="id" value={prochain.id} />
              <button type="submit" className="btn-danger w-full">
                Annuler le rendez-vous
              </button>
            </form>
          </div>
        </Card>
      ) : (
        <Card className="text-center text-sm text-cream-muted">
          Aucun rendez-vous à venir. Vos rendez-vous passés restent consultables ci-dessous.
        </Card>
      )}

      {historique.length > 0 ? (
        <section>
          <h2 className="mb-3 font-display text-xl text-cream">Historique</h2>
          <div className="space-y-3">
            {historique.map((a) => (
              <Card key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge tone={toneForStatus(a.status)}>
                      {APPOINTMENT_STATUS_LABELS[a.status as AppointmentStatus] ?? a.status}
                    </Badge>
                    <span className="text-xs text-cream-dim">{a.reference}</span>
                  </div>
                  <p className="font-display text-lg text-cream">{a.service.name}</p>
                  <p className="text-sm text-cream-muted">
                    {formatDateTime(a.scheduledAt)} · {formatDuration(a.durationMinutes)}
                  </p>
                  {a.notes ? <p className="mt-1 text-xs text-cream-dim">{a.notes}</p> : null}
                </div>
                <div className="text-right">
                  <p className="text-xs text-cream-dim">Montant</p>
                  <p className="font-semibold text-gold-300">{formatMoney(a.amountDue)}</p>
                  {a.amountPaid > 0 ? (
                    <p className="text-[11px] text-cream-muted">Réglé : {formatMoney(a.amountPaid)}</p>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
