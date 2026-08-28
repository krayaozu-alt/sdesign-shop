import Link from 'next/link';
import { Award, Printer, ShieldCheck } from 'lucide-react';
import { Badge, Card, EmptyState, toneForStatus } from '@/components/ui/primitives';
import { requireUser } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { appUrl, qrDataUrl } from '@/lib/qr';

export const metadata = { title: 'Mes certificats' };
export const dynamic = 'force-dynamic';

export default async function MyCertificatesPage() {
  const user = await requireUser();

  const certificats = user.student
    ? await prisma.certificate.findMany({
        where: { enrollment: { studentId: user.student.id } },
        orderBy: { issuedAt: 'desc' },
      })
    : [];

  // QR de verification genere cote serveur, integre en data URL (aucun appel reseau).
  const avecQr = await Promise.all(
    certificats.map(async (c) => ({ ...c, qr: await qrDataUrl(appUrl(`/verifier/${c.verificationCode}`)) })),
  );

  if (avecQr.length === 0) {
    return (
      <EmptyState
        icon={<Award size={28} />}
        title="Aucun certificat pour l’instant"
        description="Votre certificat est généré automatiquement à la fin de votre formation, avec un QR code permettant de vérifier son authenticité."
        action={
          <Link href="/formations" className="btn-outline">
            Découvrir les formations
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {avecQr.map((c) => (
        <Card key={c.id} strong className="flex gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge tone={toneForStatus(c.status)}>{c.status === 'VALIDE' ? 'Valide' : 'Révoqué'}</Badge>
              <span className="text-xs text-cream-dim">{c.number}</span>
            </div>
            <p className="font-display text-xl leading-tight text-cream">{c.courseName}</p>
            <p className="mt-1 text-sm text-cream-muted">
              {c.durationLabel} · délivré le {formatDate(c.issuedAt)}
            </p>
            <p className="mt-1 text-xs text-cream-dim">Mention : {c.mention}</p>
            <p className="mt-1 font-mono text-xs text-gold-300">{c.verificationCode}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/certificat/${c.number}`} className="btn-gold px-4 py-2 text-xs">
                Voir le certificat
              </Link>
              <Link href={`/certificat/${c.number}`} className="btn-ghost px-4 py-2 text-xs">
                <Printer size={13} /> Imprimer
              </Link>
            </div>
          </div>

          {c.qr ? (
            <div className="shrink-0 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.qr}
                alt={`QR code de vérification du certificat ${c.number}`}
                className="h-24 w-24 rounded-lg bg-white p-1.5"
              />
              <Link
                href={`/verifier/${c.verificationCode}`}
                className="mt-1.5 flex items-center justify-center gap-1 text-[10px] text-cream-dim hover:text-cream"
              >
                <ShieldCheck size={11} /> Vérifier
              </Link>
            </div>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
