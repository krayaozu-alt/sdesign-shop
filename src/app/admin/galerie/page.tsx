import { Plus, Star, Trash2 } from 'lucide-react';
import { GalleryForm, TestimonialForm } from '@/components/admin/ContentForms';
import { Badge, Card, EmptyState, Media } from '@/components/ui/primitives';
import { Disclosure } from '@/components/ui/Disclosure';
import { GALLERY_CATEGORY_LABELS, type GalleryCategory } from '@/lib/constants';
import { formatDateShort } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { deleteGalleryItemAction, deleteTestimonialAction } from '@/server/actions/content';
import { requirePermission } from '@/lib/auth';

export const metadata = { title: 'Galerie' };
export const dynamic = 'force-dynamic';

export default async function AdminGalleryPage() {
  await requirePermission('gallery.manage');
  const [items, testimonials] = await Promise.all([
    prisma.galleryItem.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] }),
    prisma.testimonial.findMany({ orderBy: { createdAt: 'desc' } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="label-eyebrow mb-1">Contenu</p>
        <h1 className="section-title">Galerie & témoignages</h1>
      </div>

      <section className="space-y-4">
        <Disclosure label={<><Plus size={15} /> Ajouter une photo ou une vidéo</>}>
          <GalleryForm />
        </Disclosure>

        {items.length === 0 ? (
          <EmptyState title="Galerie vide" description="Ajoutez vos réalisations pour les afficher sur le site." />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {items.map((item) => (
              <Card key={item.id} className="p-0">
                {item.mediaType === 'VIDEO' ? (
                  <video src={item.url} controls className="aspect-square w-full rounded-t-card bg-black object-cover" />
                ) : (
                  <Media src={item.url} alt={item.title} label={item.title} ratio="aspect-square" />
                )}
                <div className="p-3">
                  <p className="truncate text-xs text-cream">{item.title}</p>
                  <p className="text-[10px] text-cream-dim">
                    {GALLERY_CATEGORY_LABELS[item.category as GalleryCategory] ?? item.category}
                  </p>
                  <Badge tone={item.isPublished ? 'green' : 'neutral'} className="mt-1">
                    {item.isPublished ? 'Publié' : 'Masqué'}
                  </Badge>
                  <form action={deleteGalleryItemAction} className="mt-2">
                    <input type="hidden" name="id" value={item.id} />
                    <button type="submit" className="btn-danger w-full px-2 py-1.5 text-[10px]">
                      <Trash2 size={11} /> Supprimer
                    </button>
                  </form>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl text-cream">Témoignages</h2>
        <Disclosure variant="ghost" label={<><Plus size={15} /> Ajouter un témoignage</>}>
          <TestimonialForm />
        </Disclosure>

        {testimonials.length === 0 ? (
          <Card className="text-sm text-cream-muted">
            Aucun témoignage. Ceux publiés apparaissent sur la page d’accueil.
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((t) => (
              <Card key={t.id}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm text-cream">{t.authorName}</p>
                  <span className="flex gap-0.5 text-gold-400">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} size={11} fill="currentColor" />
                    ))}
                  </span>
                </div>
                <p className="mb-2 text-xs italic text-cream-muted">« {t.message} »</p>
                <p className="mb-3 text-[11px] text-cream-dim">
                  {t.role} · {formatDateShort(t.createdAt)} · {t.isPublished ? 'publié' : 'masqué'}
                </p>
                <form action={deleteTestimonialAction}>
                  <input type="hidden" name="id" value={t.id} />
                  <button type="submit" className="btn-danger w-full px-3 py-1.5 text-xs">
                    Supprimer
                  </button>
                </form>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
