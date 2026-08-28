import type { Metadata } from 'next';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import { Badge, Card, EmptyState, Media } from '@/components/ui/primitives';
import { formatDuration, priceLabel } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { appUrl } from '@/lib/qr';

export const metadata: Metadata = {
  title: 'Nos prestations',
  alternates: { canonical: appUrl('/prestations') },
};
export const dynamic = 'force-dynamic';

export default async function ServicesPage({ searchParams }: { searchParams: { categorie?: string } }) {
  const categorie = searchParams.categorie ?? '';

  const [services, categories] = await Promise.all([
    prisma.service.findMany({
      where: { isAvailable: true, ...(categorie ? { category: categorie } : {}) },
      orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }],
    }),
    prisma.service.findMany({
      where: { isAvailable: true },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    }),
  ]);

  return (
    <div className="container-page py-8">
      <div className="mb-6">
        <p className="label-eyebrow mb-1">Institut de beauté</p>
        <h1 className="section-title">Nos prestations</h1>
        <p className="mt-2 max-w-2xl text-sm text-cream-muted">
          Coiffure, maquillage, onglerie, turbans, voiles et décoration : réservez en quelques secondes.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Link href="/prestations" className={categorie === '' ? 'btn-gold px-4 py-2 text-xs' : 'chip'}>
          Toutes
        </Link>
        {categories.map((c) => (
          <Link
            key={c.category}
            href={`/prestations?categorie=${encodeURIComponent(c.category)}`}
            className={categorie === c.category ? 'btn-gold px-4 py-2 text-xs' : 'chip'}
          >
            {c.category}
          </Link>
        ))}
      </div>

      {services.length === 0 ? (
        <EmptyState
          title="Aucune prestation disponible"
          description="Les prestations publiées depuis l’administration apparaîtront ici."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <Card key={service.id} className="flex flex-col p-0">
              <Media src={service.imageUrl} alt={service.name} label={service.name} ratio="aspect-[5/3]" />
              <div className="flex flex-1 flex-col p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h2 className="font-display text-lg leading-tight text-cream">{service.name}</h2>
                  <Badge tone="gold">{priceLabel(service.price)}</Badge>
                </div>
                <p className="mb-3 line-clamp-3 flex-1 text-xs text-cream-muted">{service.description}</p>
                <div className="mb-3 flex items-center gap-3 text-[11px] text-cream-dim">
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> {formatDuration(service.durationMinutes)}
                  </span>
                  <span>{service.category}</span>
                </div>
                <div className="flex gap-2">
                  <Link href={`/prestations/${service.slug}`} className="btn-ghost flex-1 px-3 py-2 text-xs">
                    DÉTAIL
                  </Link>
                  <Link
                    href={`/reservation?prestation=${service.slug}`}
                    className="btn-gold flex-1 px-3 py-2 text-xs"
                  >
                    RÉSERVER
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
