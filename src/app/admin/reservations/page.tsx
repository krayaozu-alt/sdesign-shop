import Link from 'next/link';
import { Pencil, Plus } from 'lucide-react';
import { AppointmentForm } from '@/components/admin/OpsForms';
import { Badge, Card, DataTable, EmptyState, Td, toneForStatus } from '@/components/ui/primitives';
import { Disclosure } from '@/components/ui/Disclosure';
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_VALUES, ROLES, type AppointmentStatus } from '@/lib/constants';
import { formatDateTime, formatMoney } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { setAppointmentStatusAction } from '@/server/actions/operations';
import { requirePermission } from '@/lib/auth';

export const metadata = { title: 'Réservations' };
export const dynamic = 'force-dynamic';

export default async function AdminAppointmentsPage({
  searchParams,
}: {
  searchParams: { statut?: string; prestation?: string };
}) {
  await requirePermission('appointments.manage');
  const statut = searchParams.statut ?? '';
  const prestation = searchParams.prestation ?? '';

  const [appointments, customers, services, staff] = await Promise.all([
    prisma.appointment.findMany({
      where: { ...(statut ? { status: statut } : {}), ...(prestation ? { serviceId: prestation } : {}) },
      include: {
        customer: { select: { fullName: true, phone: true } },
        service: { select: { name: true } },
        staffUser: { select: { fullName: true } },
      },
      orderBy: { scheduledAt: 'desc' },
      take: 300,
    }),
    prisma.customer.findMany({ select: { id: true, fullName: true, phone: true }, orderBy: { fullName: 'asc' } }),
    prisma.service.findMany({ select: { id: true, name: true, price: true, durationMinutes: true }, orderBy: { name: 'asc' } }),
    prisma.user.findMany({
      where: { isActive: true, role: { in: [ROLES.ADMIN, ROLES.EMPLOYE, ROLES.FORMATEUR] } },
      select: { id: true, fullName: true },
    }),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-eyebrow mb-1">Activité</p>
          <h1 className="section-title">Réservations</h1>
        </div>
        <Link href="/admin/calendrier" className="btn-ghost px-4 py-2 text-xs">
          Vue calendrier
        </Link>
      </div>

      <Disclosure label={<><Plus size={15} /> Nouveau rendez-vous</>}>
        <AppointmentForm
          appointment={null}
          customers={customers.map((c) => ({ id: c.id, label: `${c.fullName} — ${c.phone}` }))}
          services={services.map((s) => ({ id: s.id, label: s.name, price: s.price, duration: s.durationMinutes }))}
          staff={staff.map((s) => ({ id: s.id, label: s.fullName }))}
        />
      </Disclosure>

      <div className="flex flex-wrap gap-2">
        <Link href="/admin/reservations" className={statut === '' && !prestation ? 'btn-gold px-4 py-2 text-xs' : 'chip'}>
          Toutes
        </Link>
        {APPOINTMENT_STATUS_VALUES.map((s) => (
          <Link key={s} href={`/admin/reservations?statut=${s}`} className={statut === s ? 'btn-gold px-4 py-2 text-xs' : 'chip'}>
            {APPOINTMENT_STATUS_LABELS[s]}
          </Link>
        ))}
      </div>

      <form method="get" className="flex flex-wrap items-center gap-2">
        <select name="prestation" defaultValue={prestation} className="w-56">
          <option value="">Toutes les prestations</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-ghost px-4 py-2 text-xs">
          Filtrer
        </button>
      </form>

      {appointments.length === 0 ? (
        <EmptyState title="Aucune réservation" description="Les réservations du site apparaissent ici." />
      ) : (
        <DataTable head={['Référence', 'Cliente', 'Prestation', 'Date & heure', 'Employée', 'Montant', 'Statut', '']}>
          {appointments.map((a) => (
            <tr key={a.id}>
              <Td className="whitespace-nowrap text-cream">{a.reference}</Td>
              <Td>
                {a.customer.fullName}
                <br />
                <span className="text-xs text-cream-dim">{a.customer.phone}</span>
              </Td>
              <Td>{a.service.name}</Td>
              <Td className="whitespace-nowrap">{formatDateTime(a.scheduledAt)}</Td>
              <Td>{a.staffUser?.fullName ?? '—'}</Td>
              <Td className="whitespace-nowrap text-gold-300">{formatMoney(a.amountDue)}</Td>
              <Td>
                <Badge tone={toneForStatus(a.status)}>
                  {APPOINTMENT_STATUS_LABELS[a.status as AppointmentStatus] ?? a.status}
                </Badge>
              </Td>
              <Td>
                <div className="flex items-center justify-end gap-2">
                  <form action={setAppointmentStatusAction} className="flex items-center gap-1">
                    <input type="hidden" name="id" value={a.id} />
                    <select name="status" defaultValue={a.status} className="w-32 px-2 py-1.5 text-xs">
                      {APPOINTMENT_STATUS_VALUES.map((s) => (
                        <option key={s} value={s}>
                          {APPOINTMENT_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="btn-ghost px-3 py-1.5 text-xs">
                      OK
                    </button>
                  </form>
                  <Disclosure variant="row" label={<Pencil size={13} />}>
                    <AppointmentForm
                      appointment={{
                        id: a.id,
                        customerId: a.customerId,
                        serviceId: a.serviceId,
                        staffUserId: a.staffUserId,
                        scheduledAt: a.scheduledAt,
                        durationMinutes: a.durationMinutes,
                        status: a.status,
                        amountDue: a.amountDue,
                        notes: a.notes,
                      }}
                      customers={customers.map((c) => ({ id: c.id, label: `${c.fullName} — ${c.phone}` }))}
                      services={services.map((s) => ({ id: s.id, label: s.name, price: s.price, duration: s.durationMinutes }))}
                      staff={staff.map((s) => ({ id: s.id, label: s.fullName }))}
                    />
                  </Disclosure>
                </div>
              </Td>
            </tr>
          ))}
        </DataTable>
      )}

      <Card className="text-xs text-cream-muted">
        Confirmer un rendez-vous envoie automatiquement une notification à la cliente si elle possède un compte.
      </Card>
    </div>
  );
}
