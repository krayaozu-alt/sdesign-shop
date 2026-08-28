import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PrintButton } from '@/components/PrintButton';
import { getCurrentUser } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { appUrl, qrDataUrl } from '@/lib/qr';
import { isStaff } from '@/lib/rbac';
import { getSettings } from '@/lib/settings';
import { resolveLogo } from '@/lib/brand';

export const metadata = { title: 'Certificat' };
export const dynamic = 'force-dynamic';

export default async function CertificatePage({ params }: { params: { number: string } }) {
  const number = decodeURIComponent(params.number);

  const certificate = await prisma.certificate.findUnique({
    where: { number },
    include: { enrollment: { include: { student: { include: { user: true } } } } },
  });
  if (!certificate) notFound();

  const user = await getCurrentUser().catch(() => null);
  const isOwner = user?.student?.id === certificate.enrollment.studentId;
  if (!user || (!isOwner && !isStaff(user.role))) {
    return (
      <div className="container-page py-16 text-center">
        <h1 className="section-title">Accès restreint</h1>
        <p className="mt-2 text-sm text-cream-muted">
          Ce certificat n’est consultable que par sa titulaire ou l’équipe de la boutique. Pour vérifier son
          authenticité, utilisez la page de vérification publique.
        </p>
        <Link href={`/verifier/${certificate.verificationCode}`} className="btn-gold mt-6 inline-flex">
          Vérifier ce certificat
        </Link>
      </div>
    );
  }

  const settings = await getSettings();
  const verifyUrl = appUrl(`/verifier/${certificate.verificationCode}`);
  const qr = await qrDataUrl(verifyUrl);

  return (
    <div className="min-h-dvh py-8">
      <div className="container-page mb-5 flex flex-wrap items-center justify-between gap-3 no-print">
        <Link href={isOwner ? '/espace/certificats' : '/admin/certificats'} className="text-sm text-cream-muted hover:text-cream">
          ← Retour
        </Link>
        <PrintButton />
      </div>

      {/* Feuille A4 paysage - fond clair pour l'impression */}
      <div className="container-page">
        <div
          className="print-sheet mx-auto w-full max-w-4xl rounded-card border-[6px] border-double p-6 sm:p-12"
          style={{ background: '#FFFDF8', borderColor: '#C9A227', color: '#2A0B3D' }}
        >
          <div className="text-center">
            {resolveLogo(settings['shop.logoUrl']) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resolveLogo(settings['shop.logoUrl']) ?? ''} alt={settings['shop.name']} className="mx-auto mb-3 h-20 object-contain" />
            ) : null}
            <p className="font-script text-4xl font-semibold" style={{ color: '#8A6A2F' }}>
              {settings['shop.name']}
            </p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.35em]" style={{ color: '#8A6A2F' }}>
              {settings['shop.tagline']}
            </p>
          </div>

          <div className="mx-auto my-7 h-px w-48" style={{ background: '#C9A227' }} />

          <h1 className="text-center font-display text-3xl uppercase tracking-[0.2em] sm:text-4xl">Certificat</h1>
          <p className="mt-2 text-center text-sm" style={{ color: '#6B5A78' }}>
            Il est certifié que
          </p>

          <p className="mt-4 text-center font-script text-4xl font-semibold sm:text-5xl">{certificate.studentName}</p>

          <p className="mx-auto mt-5 max-w-2xl text-center text-sm leading-relaxed" style={{ color: '#3C2450' }}>
            a suivi et validé avec succès la formation
            <br />
            <span className="font-display text-xl">« {certificate.courseName} »</span>
            <br />
            d’une durée de {certificate.durationLabel} — mention {certificate.mention}.
          </p>

          <p className="mx-auto mt-5 max-w-2xl text-center text-xs" style={{ color: '#6B5A78' }}>
            {settings['certificate.footer']}
          </p>

          <div className="mt-10 flex flex-col items-end justify-between gap-6 sm:flex-row sm:items-end">
            <div className="text-left text-xs" style={{ color: '#6B5A78' }}>
              <p>
                <strong style={{ color: '#2A0B3D' }}>N° :</strong> {certificate.number}
              </p>
              <p>
                <strong style={{ color: '#2A0B3D' }}>Code :</strong> {certificate.verificationCode}
              </p>
              <p>
                <strong style={{ color: '#2A0B3D' }}>Délivré le :</strong> {formatDate(certificate.issuedAt)}
              </p>
              <p className="mt-1">{settings['shop.address']}</p>
            </div>

            {qr ? (
              <div className="text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="QR code de vérification" className="mx-auto h-24 w-24" />
                <p className="mt-1 text-[9px]" style={{ color: '#6B5A78' }}>
                  Vérifier l’authenticité
                </p>
              </div>
            ) : null}

            <div className="text-center">
              <div
                className="mx-auto mb-1 flex h-20 w-20 items-center justify-center rounded-full border-2 text-[8px] uppercase leading-tight"
                style={{ borderColor: '#C9A227', color: '#8A6A2F' }}
              >
                Cachet
                <br />
                officiel
              </div>
              <p className="mt-2 border-t pt-1 text-xs" style={{ borderColor: '#C9A227', color: '#2A0B3D' }}>
                {certificate.signedBy}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
