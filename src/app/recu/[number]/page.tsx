import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PrintButton } from '@/components/PrintButton';
import { getCurrentUser } from '@/lib/auth';
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/constants';
import { formatDateTime, formatMoney } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { isStaff } from '@/lib/rbac';
import { getSettings } from '@/lib/settings';
import { resolveLogo } from '@/lib/brand';

export const metadata = { title: 'Reçu' };
export const dynamic = 'force-dynamic';

export default async function ReceiptPage({ params }: { params: { number: string } }) {
  const number = decodeURIComponent(params.number);

  const receipt = await prisma.receipt.findUnique({
    where: { number },
    include: { payment: true, issuedBy: { select: { fullName: true } } },
  });
  if (!receipt) notFound();

  const user = await getCurrentUser().catch(() => null);
  const owns =
    !!user &&
    ((user.customer && receipt.payment.customerId === user.customer.id) ||
      (user.student && receipt.payment.studentId === user.student.id));
  if (!user || (!owns && !isStaff(user.role))) {
    return (
      <div className="container-page py-16 text-center">
        <h1 className="section-title">Accès restreint</h1>
        <p className="mt-2 text-sm text-cream-muted">Ce reçu n’est consultable que par son titulaire ou la boutique.</p>
        <Link href="/connexion" className="btn-gold mt-6 inline-flex">
          Se connecter
        </Link>
      </div>
    );
  }

  const settings = await getSettings();

  return (
    <div className="min-h-dvh py-8">
      <div className="container-page mb-5 flex flex-wrap items-center justify-between gap-3 no-print">
        <Link href={owns ? '/espace/paiements' : '/admin/recus'} className="text-sm text-cream-muted hover:text-cream">
          ← Retour
        </Link>
        <PrintButton />
      </div>

      <div className="container-page">
        <div
          className="print-sheet mx-auto w-full max-w-2xl rounded-card p-6 sm:p-10"
          style={{ background: '#FFFDF8', color: '#2A0B3D' }}
        >
          <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-5" style={{ borderColor: '#E3D6C0' }}>
            <div>
              {resolveLogo(settings['shop.logoUrl']) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resolveLogo(settings['shop.logoUrl']) ?? ''} alt={settings['shop.name']} className="mb-2 h-14 object-contain" />
              ) : null}
              <p className="font-script text-2xl font-semibold" style={{ color: '#8A6A2F' }}>
                {settings['shop.name']}
              </p>
              <p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: '#8A6A2F' }}>
                {settings['shop.tagline']}
              </p>
              <p className="mt-2 text-xs" style={{ color: '#6B5A78' }}>
                {settings['shop.address']}
                <br />
                {settings['shop.phone']} · {settings['shop.email']}
              </p>
            </div>
            <div className="text-right">
              <p className="font-display text-xl uppercase tracking-wider">Reçu</p>
              <p className="mt-1 text-sm font-semibold" style={{ color: '#8A6A2F' }}>
                {receipt.number}
              </p>
              <p className="text-xs" style={{ color: '#6B5A78' }}>
                {formatDateTime(receipt.issuedAt)}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] uppercase tracking-wider" style={{ color: '#8A6A2F' }}>
                Client
              </p>
              <p className="text-sm font-medium">{receipt.payerName}</p>
            </div>
            <div className="sm:text-right">
              <p className="text-[11px] uppercase tracking-wider" style={{ color: '#8A6A2F' }}>
                Mode de paiement
              </p>
              <p className="text-sm font-medium">
                {PAYMENT_METHOD_LABELS[receipt.method as PaymentMethod] ?? receipt.method}
              </p>
              {receipt.payment.providerRef ? (
                <p className="text-xs" style={{ color: '#6B5A78' }}>
                  Réf. opérateur : {receipt.payment.providerRef}
                </p>
              ) : null}
            </div>
          </div>

          <table className="mt-6 w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #E3D6C0' }}>
                <th className="py-2 text-left font-medium" style={{ color: '#6B5A78' }}>
                  Désignation
                </th>
                <th className="py-2 text-right font-medium" style={{ color: '#6B5A78' }}>
                  Montant
                </th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #F0E7D6' }}>
                <td className="py-3">{receipt.itemLabel}</td>
                <td className="py-3 text-right">{formatMoney(receipt.totalAmount)}</td>
              </tr>
            </tbody>
          </table>

          <div className="mt-4 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span style={{ color: '#6B5A78' }}>Montant total</span>
              <span>{formatMoney(receipt.totalAmount)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span style={{ color: '#6B5A78' }}>Montant payé</span>
              <span style={{ color: '#1F7A4D' }}>{formatMoney(receipt.paidAmount)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold" style={{ borderColor: '#E3D6C0' }}>
              <span style={{ color: '#6B5A78' }}>Reste à payer</span>
              <span style={{ color: receipt.balance > 0 ? '#A8571B' : '#1F7A4D' }}>{formatMoney(receipt.balance)}</span>
            </div>
          </div>

          {receipt.notes ? (
            <p className="mt-5 text-xs" style={{ color: '#6B5A78' }}>
              {receipt.notes}
            </p>
          ) : null}

          <div className="mt-8 flex items-end justify-between gap-4 border-t pt-4" style={{ borderColor: '#E3D6C0' }}>
            <p className="text-[11px]" style={{ color: '#6B5A78' }}>
              Reçu émis par {receipt.issuedBy?.fullName ?? settings['shop.name']}
              <br />
              Merci de votre confiance.
            </p>
            <div className="text-center">
              <div
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 text-[8px] uppercase"
                style={{ borderColor: '#C9A227', color: '#8A6A2F' }}
              >
                Cachet
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
