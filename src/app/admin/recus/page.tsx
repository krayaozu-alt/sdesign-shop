import Link from 'next/link';
import { Search } from 'lucide-react';
import { DataTable, EmptyState, Td } from '@/components/ui/primitives';
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/constants';
import { formatDateShort, formatMoney } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { contient } from '@/lib/db-search';

export const metadata = { title: 'Reçus' };
export const dynamic = 'force-dynamic';

export default async function AdminReceiptsPage({ searchParams }: { searchParams: { q?: string } }) {
  await requirePermission('receipts.manage');
  const q = (searchParams.q ?? '').trim();

  const receipts = await prisma.receipt.findMany({
    where: q ? { OR: [{ number: contient(q) }, { payerName: contient(q) }, { itemLabel: contient(q) }] } : {},
    include: { payment: { select: { reference: true } } },
    orderBy: { issuedAt: 'desc' },
    take: 300,
  });

  const total = receipts.reduce((s, r) => s + r.paidAmount, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-eyebrow mb-1">Caisse</p>
          <h1 className="section-title">Reçus</h1>
        </div>
        <form method="get" className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cream-dim" />
          <input name="q" defaultValue={q} placeholder="Numéro, client…" className="w-64 pl-9" />
        </form>
      </div>

      {receipts.length === 0 ? (
        <EmptyState
          title="Aucun reçu"
          description="Un reçu est généré automatiquement pour chaque paiement au statut « Payé »."
        />
      ) : (
        <>
          <p className="text-sm text-cream-muted">
            {receipts.length} reçu(s) — {formatMoney(total)} encaissés
          </p>
          <DataTable head={['Numéro', 'Date', 'Client', 'Objet', 'Méthode', 'Payé', 'Reste', '']}>
            {receipts.map((r) => (
              <tr key={r.id}>
                <Td className="whitespace-nowrap text-cream">{r.number}</Td>
                <Td className="whitespace-nowrap">{formatDateShort(r.issuedAt)}</Td>
                <Td>{r.payerName}</Td>
                <Td>{r.itemLabel}</Td>
                <Td className="whitespace-nowrap">{PAYMENT_METHOD_LABELS[r.method as PaymentMethod] ?? r.method}</Td>
                <Td className="whitespace-nowrap font-semibold text-emerald-300">{formatMoney(r.paidAmount)}</Td>
                <Td className={r.balance > 0 ? 'whitespace-nowrap text-amber-300' : 'whitespace-nowrap'}>
                  {formatMoney(r.balance)}
                </Td>
                <Td>
                  <Link href={`/recu/${r.number}`} className="btn-ghost px-3 py-1.5 text-xs">
                    Imprimer
                  </Link>
                </Td>
              </tr>
            ))}
          </DataTable>
        </>
      )}
    </div>
  );
}
