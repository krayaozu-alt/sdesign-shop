import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/primitives';
import { formatDate } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { getSettings } from '@/lib/settings';

export const metadata: Metadata = { title: 'Vérification de certificat' };
export const dynamic = 'force-dynamic';

export default async function VerifyPage({ params }: { params: { code: string } }) {
  const code = decodeURIComponent(params.code).trim().toUpperCase();
  const settings = await getSettings();

  const certificate = await prisma.certificate.findFirst({
    where: { OR: [{ verificationCode: code }, { number: code }] },
    include: { enrollment: { include: { course: { select: { name: true, durationLabel: true } } } } },
  });

  const valid = certificate && certificate.status === 'VALIDE';

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-lg">
        <Card strong className="text-center">
          <span
            className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border ${
              valid
                ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                : 'border-red-400/40 bg-red-400/10 text-red-300'
            }`}
          >
            {valid ? <ShieldCheck size={30} /> : <ShieldAlert size={30} />}
          </span>

          {valid ? (
            <>
              <h1 className="font-display text-2xl text-cream">Certificat authentique</h1>
              <p className="mt-1 text-sm text-cream-muted">
                Ce certificat a bien été délivré par {settings['shop.name']}.
              </p>

              <dl className="mt-6 space-y-2 text-left text-sm">
                <div className="flex justify-between gap-3 border-b border-white/8 pb-2">
                  <dt className="text-cream-dim">Numéro</dt>
                  <dd className="font-semibold text-gold-300">{certificate.number}</dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-white/8 pb-2">
                  <dt className="text-cream-dim">Titulaire</dt>
                  <dd className="text-cream">{certificate.studentName}</dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-white/8 pb-2">
                  <dt className="text-cream-dim">Formation</dt>
                  <dd className="text-cream">{certificate.courseName}</dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-white/8 pb-2">
                  <dt className="text-cream-dim">Durée</dt>
                  <dd className="text-cream">{certificate.durationLabel}</dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-white/8 pb-2">
                  <dt className="text-cream-dim">Mention</dt>
                  <dd className="text-cream">{certificate.mention}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-cream-dim">Délivré le</dt>
                  <dd className="text-cream">{formatDate(certificate.issuedAt)}</dd>
                </div>
              </dl>
            </>
          ) : certificate ? (
            <>
              <h1 className="font-display text-2xl text-cream">Certificat révoqué</h1>
              <p className="mt-1 text-sm text-cream-muted">
                Le certificat {certificate.number} a été révoqué par {settings['shop.name']} et n’est plus valable.
              </p>
            </>
          ) : (
            <>
              <h1 className="font-display text-2xl text-cream">Certificat introuvable</h1>
              <p className="mt-1 text-sm text-cream-muted">
                Aucun certificat ne correspond au code <span className="text-cream">{code}</span>.
              </p>
            </>
          )}

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/verifier" className="btn-outline">
              Vérifier un autre code
            </Link>
            <Link href="/contact" className="btn-ghost">
              Nous contacter
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
