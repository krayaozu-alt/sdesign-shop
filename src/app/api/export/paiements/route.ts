import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/constants';
import { can } from '@/lib/rbac';
import { endOfDay, getRevenueRows, startOfDay, startOfMonth } from '@/server/reports';

export const dynamic = 'force-dynamic';

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

/** Export CSV des encaissements d'une periode (Admin > Rapports). */
export async function GET(request: Request) {
  const user = await getCurrentUser().catch(() => null);
  if (!user || !can(user.role, 'reports.view')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const url = new URL(request.url);
  const duParam = url.searchParams.get('du');
  const auParam = url.searchParams.get('au');
  const from = duParam ? startOfDay(new Date(`${duParam}T00:00:00`)) : startOfMonth();
  const to = auParam ? endOfDay(new Date(`${auParam}T00:00:00`)) : endOfDay();

  const rows = await getRevenueRows(
    Number.isNaN(from.getTime()) ? startOfMonth() : from,
    Number.isNaN(to.getTime()) ? endOfDay() : to,
  );

  const header = ['Date', 'Reference', 'Payeur', 'Libelle', 'Methode', 'Montant FCFA', 'Recu'];
  const lines = [header.map(csvCell).join(';')];

  for (const r of rows) {
    lines.push(
      [
        new Date(r.paidAt).toLocaleDateString('fr-FR'),
        r.reference,
        r.student?.user.fullName ?? r.customer?.fullName ?? '',
        r.label,
        PAYMENT_METHOD_LABELS[r.method as PaymentMethod] ?? r.method,
        r.amount,
        r.receipt?.number ?? '',
      ]
        .map(csvCell)
        .join(';'),
    );
  }

  const total = rows.reduce((s, r) => s + r.amount, 0);
  lines.push(['', '', '', 'TOTAL', '', total, ''].map(csvCell).join(';'));

  // BOM UTF-8 pour qu'Excel affiche correctement les accents.
  const body = `﻿${lines.join('\r\n')}`;
  const filename = `sdesign-paiements-${duParam ?? 'debut-mois'}_${auParam ?? 'aujourdhui'}.csv`;

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
