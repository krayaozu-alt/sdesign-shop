import { Download } from 'lucide-react';
import { CountBarChart, RevenueAreaChart, SharePieChart } from '@/components/charts/Charts';
import { PrintButton } from '@/components/PrintButton';
import { Card, DataTable, SectionHeader, StatTile, Td } from '@/components/ui/primitives';
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/constants';
import { formatDateShort, formatMoney, toDateInput } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import {
  endOfDay,
  getDashboardStats,
  getMonthlyRevenue,
  getNewCustomers,
  getRevenueRows,
  getRevenueSeries,
  getTopCourses,
  getTopServices,
  startOfDay,
  startOfMonth,
} from '@/server/reports';
import { requirePermission } from '@/lib/auth';

export const metadata = { title: 'Rapports' };
export const dynamic = 'force-dynamic';

export default async function AdminReportsPage({ searchParams }: { searchParams: { du?: string; au?: string } }) {
  await requirePermission('reports.view');
  const defaultFrom = startOfMonth();
  const from = searchParams.du ? startOfDay(new Date(`${searchParams.du}T00:00:00`)) : defaultFrom;
  const to = searchParams.au ? endOfDay(new Date(`${searchParams.au}T00:00:00`)) : endOfDay();

  const validFrom = Number.isNaN(from.getTime()) ? defaultFrom : from;
  const validTo = Number.isNaN(to.getTime()) ? endOfDay() : to;

  const [stats, series, monthly, topCourses, topServices, newCustomers, rows, methodTotals] = await Promise.all([
    getDashboardStats(),
    getRevenueSeries(30),
    getMonthlyRevenue(),
    getTopCourses(6),
    getTopServices(6),
    getNewCustomers(30),
    getRevenueRows(validFrom, validTo),
    prisma.payment.groupBy({
      by: ['method'],
      _sum: { amount: true },
      where: { status: 'PAYE', paidAt: { gte: validFrom, lte: validTo } },
    }),
  ]);

  const periodTotal = rows.reduce((s, r) => s + r.amount, 0);
  const exportUrl = `/api/export/paiements?du=${toDateInput(validFrom)}&au=${toDateInput(validTo)}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 no-print">
        <div>
          <p className="label-eyebrow mb-1">Pilotage</p>
          <h1 className="section-title">Rapports</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href={exportUrl} className="btn-ghost px-4 py-2 text-xs">
            <Download size={14} /> Export CSV
          </a>
          <PrintButton label="Imprimer / PDF" />
        </div>
      </div>

      <form method="get" className="surface flex flex-wrap items-end gap-3 p-4 no-print">
        <div>
          <label htmlFor="du">Du</label>
          <input id="du" type="date" name="du" defaultValue={toDateInput(validFrom)} className="w-44" />
        </div>
        <div>
          <label htmlFor="au">Au</label>
          <input id="au" type="date" name="au" defaultValue={toDateInput(validTo)} className="w-44" />
        </div>
        <button type="submit" className="btn-gold">
          Appliquer
        </button>
      </form>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="CA de la période" value={formatMoney(periodTotal)} hint={`${rows.length} encaissement(s)`} />
        <StatTile label="CA du jour" value={formatMoney(stats.revenueToday)} />
        <StatTile label="CA du mois" value={formatMoney(stats.revenueMonth)} />
        <StatTile label="CA de l’année" value={formatMoney(stats.revenueYear)} />
        <StatTile label="Nouvelles clientes (30 j)" value={String(newCustomers)} />
        <StatTile label="Élèves" value={String(stats.students)} />
        <StatTile
          label="Paiements en attente"
          value={formatMoney(stats.pendingPaymentsAmount)}
          hint={`${stats.pendingPaymentsCount} opération(s)`}
        />
        <StatTile label="Soldes à récupérer" value={formatMoney(stats.outstanding)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionHeader eyebrow="30 derniers jours" title="Recettes journalières" />
          <RevenueAreaChart data={series} />
        </Card>
        <Card>
          <SectionHeader eyebrow={String(new Date().getFullYear())} title="Recettes mensuelles" />
          <CountBarChart data={monthly} label="FCFA" />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <SectionHeader eyebrow="Classement" title="Formations vendues" />
          {topCourses.length === 0 ? (
            <p className="text-sm text-cream-muted">Aucune inscription.</p>
          ) : (
            <ol className="space-y-2">
              {topCourses.map((c, i) => (
                <li key={c.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-cream-muted">
                    {i + 1}. {c.label}
                  </span>
                  <span className="shrink-0 text-gold-300">{c.value}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card>
          <SectionHeader eyebrow="Classement" title="Prestations demandées" />
          {topServices.length === 0 ? (
            <p className="text-sm text-cream-muted">Aucune réservation.</p>
          ) : (
            <ol className="space-y-2">
              {topServices.map((s, i) => (
                <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-cream-muted">
                    {i + 1}. {s.label}
                  </span>
                  <span className="shrink-0 text-gold-300">{s.value}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card>
          <SectionHeader eyebrow="Répartition" title="Moyens de paiement" />
          {methodTotals.length === 0 ? (
            <p className="text-sm text-cream-muted">Aucun encaissement sur la période.</p>
          ) : (
            <SharePieChart
              data={methodTotals.map((m) => ({
                label: PAYMENT_METHOD_LABELS[m.method as PaymentMethod] ?? m.method,
                value: m._sum.amount ?? 0,
              }))}
            />
          )}
        </Card>
      </div>

      <div>
        <h2 className="mb-3 font-display text-lg text-cream">
          Détail des encaissements — {formatDateShort(validFrom)} au {formatDateShort(validTo)}
        </h2>
        {rows.length === 0 ? (
          <Card className="text-sm text-cream-muted">Aucun encaissement sur la période sélectionnée.</Card>
        ) : (
          <DataTable head={['Date', 'Référence', 'Payeur', 'Libellé', 'Méthode', 'Montant', 'Reçu']}>
            {rows.map((r) => (
              <tr key={r.id}>
                <Td className="whitespace-nowrap">{formatDateShort(r.paidAt)}</Td>
                <Td className="whitespace-nowrap text-cream">{r.reference}</Td>
                <Td>{r.student?.user.fullName ?? r.customer?.fullName ?? '—'}</Td>
                <Td>{r.label}</Td>
                <Td className="whitespace-nowrap">{PAYMENT_METHOD_LABELS[r.method as PaymentMethod] ?? r.method}</Td>
                <Td className="whitespace-nowrap font-semibold text-gold-300">{formatMoney(r.amount)}</Td>
                <Td>{r.receipt?.number ?? '—'}</Td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>
    </div>
  );
}
