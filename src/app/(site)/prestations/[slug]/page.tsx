import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle2, Clock, Tag } from 'lucide-react';
import { Badge, Card, Media } from '@/components/ui/primitives';
import { formatDuration, priceLabel } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { appUrl } from '@/lib/qr';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const service = await prisma.service.findUnique({ where: { slug: params.slug } }).catch(() => null);
  return {
    title: service?.name ?? 'Prestation',
    alternates: { canonical: appUrl(`/prestations/${params.slug}`) },
  };
}

export default async function ServiceDetailPage({ params }: { params: { slug: string } }) {
  const service = await prisma.service.findUnique({ where: { slug: params.slug } });
  if (!service) notFound();

  const related = await prisma.service.findMany({
    where: { category: service.category, id: { not: service.id }, isAvailable: true },
    take: 3,
  });

  return (
    <div className="container-page py-8">
      <Link href="/prestations" className="mb-4 inline-block text-sm text-cream-muted hover:text-cream">
        ← Toutes les prestations
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <Media src={service.imageUrl} alt={service.name} label={service.name} ratio="aspect-[16/9]" className="mb-5" />
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge>{service.category}</Badge>
            <Badge tone={service.isAvailable ? 'green' : 'red'}>
              {service.isAvailable ? 'Disponible' : 'Indisponible'}
            </Badge>
          </div>
          <h1 className="font-display text-3xl text-cream">{service.name}</h1>
          <p className="mt-3 text-cream-muted">{service.description}</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="surface flex items-center gap-3 p-4">
              <Clock size={18} className="text-gold-400" />
              <div>
                <p className="text-xs text-cream-dim">Durée estimée</p>
                <p className="text-sm text-cream">{formatDuration(service.durationMinutes)}</p>
              </div>
            </div>
            <div className="surface flex items-center gap-3 p-4">
              <Tag size={18} className="text-gold-400" />
              <div>
                <p className="text-xs text-cream-dim">Tarif</p>
                <p className="text-sm text-cream">{priceLabel(service.price)}</p>
              </div>
            </div>
          </div>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card strong>
            <p className="label-eyebrow mb-1">Tarif</p>
            <p className="font-display text-3xl text-gold-300">{priceLabel(service.price)}</p>
            <p className="mt-1 text-xs text-cream-muted">{formatDuration(service.durationMinutes)} en institut</p>
            <div className="my-5 gold-rule" />
            <ul className="mb-5 space-y-2 text-sm text-cream-muted">
              <li className="flex items-start gap-2">
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-gold-400" />
                Réservation en ligne en 4 étapes
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-gold-400" />
                Confirmation par notre équipe
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-gold-400" />
                Règlement sur place, reçu officiel remis
              </li>
            </ul>
            {service.isAvailable ? (
              <Link href={`/reservation?prestation=${service.slug}`} className="btn-gold w-full">
                RÉSERVER
              </Link>
            ) : (
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-center text-sm text-amber-100">
                Prestation momentanément indisponible.
              </div>
            )}
          </Card>

          {related.length > 0 ? (
            <Card className="mt-4">
              <p className="label-eyebrow mb-3">Dans la même catégorie</p>
              <ul className="space-y-2">
                {related.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/prestations/${r.slug}`}
                      className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm text-cream-muted transition hover:bg-white/5 hover:text-cream"
                    >
                      <span>{r.name}</span>
                      <span className="text-gold-300">{priceLabel(r.price)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
