import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState, Media } from '@/components/ui/primitives';
import { GALLERY_CATEGORY_LABELS, type GalleryCategory } from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import { appUrl } from '@/lib/qr';

export const metadata: Metadata = {
  title: 'Galerie',
  alternates: { canonical: appUrl('/galerie') },
};
export const dynamic = 'force-dynamic';

export default async function GalleryPage({ searchParams }: { searchParams: { categorie?: string } }) {
  const categorie = searchParams.categorie ?? '';

  // Deux lectures distinctes : ce que la categorie demandee contient, et ce que
  // la galerie contient en tout. La seconde decide de l'affichage des filtres —
  // proposer onze categories sur une galerie entierement vide ne mene nulle
  // part. Des qu'une seule photo existe, les filtres reviennent, y compris
  // lorsque la categorie consultee est vide : il faut pouvoir en sortir.
  const [items, totalPublie] = await Promise.all([
    prisma.galleryItem.findMany({
      where: { isPublished: true, ...(categorie ? { category: categorie } : {}) },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    }),
    prisma.galleryItem.count({ where: { isPublished: true } }),
  ]);

  return (
    <div className="container-page py-8">
      <div className="mb-6">
        <p className="label-eyebrow mb-1">Nos réalisations</p>
        <h1 className="section-title">Galerie</h1>
      </div>

      {totalPublie > 0 && (
      <div className="mb-6 flex flex-wrap gap-2">
        <Link href="/galerie" className={categorie === '' ? 'btn-gold px-4 py-2 text-xs' : 'chip'}>
          Tout
        </Link>
        {Object.entries(GALLERY_CATEGORY_LABELS).map(([value, label]) => (
          <Link
            key={value}
            href={`/galerie?categorie=${value}`}
            className={categorie === value ? 'btn-gold px-4 py-2 text-xs' : 'chip'}
          >
            {label}
          </Link>
        ))}
      </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          title="Galerie vide pour le moment"
          description="Les photos et vidéos ajoutées depuis Admin > Galerie apparaîtront ici."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <figure key={item.id} className="surface overflow-hidden p-0">
              {item.mediaType === 'VIDEO' ? (
                <video src={item.url} controls className="aspect-square w-full bg-black object-cover" />
              ) : (
                <Media src={item.url} alt={item.title} label={item.title} ratio="aspect-square" />
              )}
              <figcaption className="px-3 py-2">
                <p className="truncate text-xs text-cream">{item.title}</p>
                <p className="text-[10px] text-cream-dim">
                  {GALLERY_CATEGORY_LABELS[item.category as GalleryCategory] ?? item.category}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
