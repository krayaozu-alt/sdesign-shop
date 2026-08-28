import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PaymentForm } from '@/components/admin/FinanceForms';
import { Badge, Card, DataTable, EmptyState, StatTile, Td, toneForStatus } from '@/components/ui/primitives';
import { Disclosure } from '@/components/ui/Disclosure';
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_VALUES,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_VALUES,
  type PaymentMethod,
  type PaymentStatus,
} from '@/lib/constants';
import { formatDateShort, formatMoney } from '@/lib/format';
import { hasOnlinePayment } from '@/lib/payments';
import { prisma } from '@/lib/prisma';
import { getSettings, splitList } from '@/lib/settings';
import { cancelPaymentAction, confirmPaymentAction } from '@/server/actions/finance';
import { getDashboardStats } from '@/server/reports';
import { requirePermission } from '@/lib/auth';

export const metadata = { title: 'Paiements' };
export const dynamic = 'force-dynamic';

export default async function AdminPaymentsPage({ searchParams }: { searchParams: { statut?: string } }) {
  await requirePermission('payments.manage');
  const statut = searchParams.statut ?? '';

  const [payments, settings, stats, openEnrollments, openAppointments] = await Promise.all([
    prisma.payment.findMany({
      where: statut ? { status: statut } : {},
      include: {
        receipt: { select: { number: true } },
        student: { include: { user: { select: { fullName: true } } } },
        customer: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    }),
    getSettings(),
    getDashboardStats(),
    prisma.enrollment.findMany({
      where: { status: { in: ['EN_ATTENTE', 'CONFIRMEE', 'EN_COURS'] } },
      include: { student: { include: { user: { select: { fullName: true } } } }, course: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.appointment.findMany({
      where: { status: { in: ['EN_ATTENTE', 'CONFIRME', 'TERMINE'] } },
      include: { customer: { select: { fullName: true } }, service: { select: { name: true } } },
      orderBy: { scheduledAt: 'desc' },
      take: 100,
    }),
  ]);

  const methods = splitList(settings['payments.methods']).filter((m) =>
    (PAYMENT_METHOD_VALUES as readonly string[]).includes(m),
  ) as PaymentMethod[];

  return (
    <div className="space-y-5">
      <div>
        <p className="label-eyebrow mb-1">Caisse</p>
        <h1 className="section-title">Paiements</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total encaissé" value={formatMoney(stats.revenueTotal)} />
        <StatTile label="Aujourd’hui" value={formatMoney(stats.revenueToday)} />
        <StatTile label="Ce mois" value={formatMoney(stats.revenueMonth)} />
        <StatTile
          label="En attente"
          value={formatMoney(stats.pendingPaymentsAmount)}
          hint={`${stats.pendingPaymentsCount} opération(s)`}
        />
      </div>

      <Disclosure label={<><Plus size={15} /> Enregistrer un paiement</>}>
        <PaymentForm
          methods={methods.length ? methods : (['ESPECES'] as PaymentMethod[])}
          enrollments={openEnrollments.map((e) => ({
            id: e.id,
            label: `${e.reference} — ${e.student.user.fullName} · ${e.course.name}`,
            balance: Math.max(0, e.amountDue - e.amountPaid),
          }))}
          appointments={openAppointments.map((a) => ({
            id: a.id,
            label: `${a.reference} — ${a.customer.fullName} · ${a.service.name}`,
            balance: Math.max(0, a.amountDue - a.amountPaid),
          }))}
        />
      </Disclosure>

      <div className="flex flex-wrap gap-2">
        <Link href="/admin/paiements" className={statut === '' ? 'btn-gold px-4 py-2 text-xs' : 'chip'}>
          Tous
        </Link>
        {PAYMENT_STATUS_VALUES.map((s) => (
          <Link key={s} href={`/admin/paiements?statut=${s}`} className={statut === s ? 'btn-gold px-4 py-2 text-xs' : 'chip'}>
            {PAYMENT_STATUS_LABELS[s]}
          </Link>
        ))}
      </div>

      {payments.length === 0 ? (
        <EmptyState title="Aucun paiement" description="Enregistrez le premier encaissement avec le bouton ci-dessus." />
      ) : (
        <DataTable head={['Date', 'Référence', 'Payeur', 'Libellé', 'Méthode', 'Montant', 'Statut', 'Reçu', '']}>
          {payments.map((p) => (
            <tr key={p.id}>
              <Td className="whitespace-nowrap">{formatDateShort(p.paidAt)}</Td>
              <Td className="whitespace-nowrap text-cream">{p.reference}</Td>
              <Td>{p.student?.user.fullName ?? p.customer?.fullName ?? '—'}</Td>
              <Td>{p.label}</Td>
              <Td className="whitespace-nowrap">{PAYMENT_METHOD_LABELS[p.method as PaymentMethod] ?? p.method}</Td>
              <Td className="whitespace-nowrap font-semibold text-gold-300">{formatMoney(p.amount)}</Td>
              <Td>
                <Badge tone={toneForStatus(p.status)}>
                  {PAYMENT_STATUS_LABELS[p.status as PaymentStatus] ?? p.status}
                </Badge>
              </Td>
              <Td>
                {p.receipt ? (
                  <Link href={`/recu/${p.receipt.number}`} className="text-gold-300 hover:text-gold-200">
                    {p.receipt.number}
                  </Link>
                ) : (
                  '—'
                )}
              </Td>
              <Td>
                <div className="flex justify-end gap-2">
                  {p.status === 'EN_ATTENTE' ? (
                    <form action={confirmPaymentAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <button type="submit" className="btn-outline px-3 py-1.5 text-xs">
                        Confirmer
                      </button>
                    </form>
                  ) : null}
                  {p.status !== 'ANNULE' ? (
                    <form action={cancelPaymentAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <button type="submit" className="btn-danger px-3 py-1.5 text-xs">
                        Annuler
                      </button>
                    </form>
                  ) : null}
                </div>
              </Td>
            </tr>
          ))}
        </DataTable>
      )}

      <Card className="text-xs text-cream-muted">
        <p className="mb-1 text-cream">Encaissement</p>
        {hasOnlinePayment() ? (
          <p>Un fournisseur de paiement en ligne est configuré.</p>
        ) : (
          <p>
            Aucun paiement n’est prélevé en ligne : les règlements (espèces, Orange Money, Moov Money, Wave) sont
            encaissés par la boutique puis saisis ici. L’architecture prévoit le branchement d’une API opérateur —
            voir <code className="text-gold-300">src/lib/payments.ts</code> — sans modifier le reste de l’application.
          </p>
        )}
      </Card>
    </div>
  );
}
