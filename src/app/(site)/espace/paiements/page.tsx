import Link from 'next/link';
import { CreditCard, Receipt } from 'lucide-react';
import { Badge, Card, DataTable, EmptyState, Progress, StatTile, Td, toneForStatus } from '@/components/ui/primitives';
import { requireUser } from '@/lib/auth';
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, type PaymentMethod, type PaymentStatus } from '@/lib/constants';
import { formatDateShort, formatMoney } from '@/lib/format';
import { prisma } from '@/lib/prisma';

export const metadata = { title: 'Mes paiements' };
export const dynamic = 'force-dynamic';

export default async function MyPaymentsPage() {
  const user = await requireUser();

  const ownership = [
    ...(user.customer ? [{ customerId: user.customer.id }] : []),
    ...(user.student ? [{ studentId: user.student.id }] : []),
  ];

  if (ownership.length === 0) {
    return (
      <EmptyState
        icon={<CreditCard size={28} />}
        title="Aucun paiement"
        description="Vos règlements et vos reçus apparaîtront ici."
      />
    );
  }

  const [paiements, inscriptions] = await Promise.all([
    prisma.payment.findMany({
      where: { OR: ownership },
      include: { receipt: { select: { number: true } } },
      orderBy: { paidAt: 'desc' },
    }),
    user.student
      ? prisma.enrollment.findMany({
          where: { studentId: user.student.id },
          include: { course: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
        })
      : [],
  ]);

  const totalFormations = inscriptions.reduce((s, e) => s + e.amountDue, 0);
  const payeFormations = inscriptions.reduce((s, e) => s + e.amountPaid, 0);
  const resteFormations = Math.max(0, totalFormations - payeFormations);
  const totalRegle = paiements.filter((p) => p.status === 'PAYE').reduce((s, p) => s + p.amount, 0);
  const enAttente = paiements.filter((p) => p.status === 'EN_ATTENTE').reduce((s, p) => s + p.amount, 0);
  const pourcentage = totalFormations > 0 ? Math.round((payeFormations / totalFormations) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total formations" value={formatMoney(totalFormations)} />
        <StatTile label="Montant payé" value={formatMoney(payeFormations)} />
        <StatTile label="Reste à payer" value={formatMoney(resteFormations)} />
        <StatTile label="En attente de confirmation" value={formatMoney(enAttente)} />
      </div>

      {/* Detail par formation : montant du, regle, solde */}
      {inscriptions.length > 0 ? (
        <Card>
          <div className="mb-4 flex items-center justify-between text-sm">
            <span className="text-cream-muted">Avancement du règlement</span>
            <span className="font-semibold text-gold-300">{pourcentage} %</span>
          </div>
          <Progress value={pourcentage} />

          <ul className="mt-5 space-y-3">
            {inscriptions.map((e) => {
              const solde = Math.max(0, e.amountDue - e.amountPaid);
              return (
                <li key={e.id} className="rounded-xl bg-white/[0.03] px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-cream">{e.course.name}</p>
                      <p className="text-xs text-cream-dim">{e.reference}</p>
                    </div>
                    <div className="text-right text-sm">
                      <span className="text-cream-muted">{formatMoney(e.amountPaid)}</span>
                      <span className="text-cream-dim"> / {formatMoney(e.amountDue)}</span>
                      <p className={solde > 0 ? 'text-xs text-amber-300' : 'text-xs text-emerald-300'}>
                        {solde > 0 ? `Reste ${formatMoney(solde)}` : 'Soldé'}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      <section>
        <h2 className="mb-3 font-display text-xl text-cream">Historique des paiements</h2>
        {paiements.length === 0 ? (
          <Card className="text-center text-sm text-cream-muted">
            Aucun règlement enregistré pour le moment. Total réglé : {formatMoney(totalRegle)}.
          </Card>
        ) : (
          <DataTable head={['Date', 'Référence', 'Objet', 'Méthode', 'Montant', 'Statut', 'Reçu']}>
            {paiements.map((p) => (
              <tr key={p.id}>
                <Td className="whitespace-nowrap">{formatDateShort(p.paidAt)}</Td>
                <Td className="whitespace-nowrap text-cream">{p.reference}</Td>
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
                    <Link href={`/recu/${p.receipt.number}`} className="btn-ghost px-3 py-1.5 text-xs">
                      <Receipt size={13} /> Voir le reçu
                    </Link>
                  ) : (
                    <span className="text-cream-dim">—</span>
                  )}
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>
    </div>
  );
}
