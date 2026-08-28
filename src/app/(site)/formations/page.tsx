import type { Metadata } from 'next';
import Link from 'next/link';
import { Filter, Search } from 'lucide-react';
import { CourseCard } from '@/components/public/CourseCard';
import { EmptyState } from '@/components/ui/primitives';
import { COURSE_STATUS, LEVEL_LABELS } from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import { contient } from '@/lib/db-search';
import { bannieresActives } from '@/server/marketing';
import { AnnonceLarge, versAnnonce } from '@/components/public/Annonce';
import { BANNER_PLACEMENTS } from '@/lib/constants';
import { appUrl } from '@/lib/qr';

export const metadata: Metadata = {
  title: 'Nos formations',
  alternates: { canonical: appUrl('/formations') },
};
export const dynamic = 'force-dynamic';

type SearchParams = { q?: string; categorie?: string; niveau?: string };

export default async function CoursesPage({ searchParams }: { searchParams: SearchParams }) {
  const q = (searchParams.q ?? '').trim();
  const categorie = searchParams.categorie ?? '';
  const niveau = searchParams.niveau ?? '';

  const where = {
    status: { notIn: [COURSE_STATUS.BROUILLON, COURSE_STATUS.ARCHIVEE] },
    ...(q ? { OR: [{ name: contient(q) }, { shortDescription: contient(q) }, { category: contient(q) }] } : {}),
    ...(categorie ? { category: categorie } : {}),
    ...(niveau ? { level: niveau } : {}),
  };

  const [courses, categories, bannieres] = await Promise.all([
    prisma.course.findMany({
      where,
      orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }],
      include: { trainer: { select: { fullName: true } }, _count: { select: { enrollments: true } } },
    }),
    prisma.course.findMany({
      where: { status: { notIn: [COURSE_STATUS.BROUILLON, COURSE_STATUS.ARCHIVEE] } },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    }),
    bannieresActives(BANNER_PLACEMENTS.FORMATIONS, 2),
  ]);

  return (
    <div className="container-page py-8">
      <div className="mb-6">
        <p className="label-eyebrow mb-1">Centre de formation</p>
        <h1 className="section-title">Nos formations</h1>
        <p className="mt-2 max-w-2xl text-sm text-cream-muted">
          Des parcours professionnels complets, encadrés et sanctionnés par un certificat authentifiable.
        </p>
      </div>

      {/* Bannières de la page des formations */}
      {bannieres.length > 0 ? (
        <div className="mb-6 space-y-5">
          {bannieres.map((b) => (
            <AnnonceLarge key={b.id} annonce={versAnnonce(b)} />
          ))}
        </div>
      ) : null}

      {/* Recherche et filtres : formulaire GET, fonctionne sans JavaScript */}
      <form method="get" className="surface mb-6 grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cream-dim" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Rechercher une formation…"
            className="pl-9"
            aria-label="Rechercher une formation"
          />
        </div>
        <select name="categorie" defaultValue={categorie} aria-label="Catégorie" className="sm:w-44">
          <option value="">Toutes catégories</option>
          {categories.map((c) => (
            <option key={c.category} value={c.category}>
              {c.category}
            </option>
          ))}
        </select>
        <select name="niveau" defaultValue={niveau} aria-label="Niveau" className="sm:w-40">
          <option value="">Tous niveaux</option>
          {Object.entries(LEVEL_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-gold">
          <Filter size={16} /> Filtrer
        </button>
      </form>

      {courses.length === 0 ? (
        <EmptyState
          title="Aucune formation ne correspond"
          description="Modifiez votre recherche ou consultez l’ensemble du catalogue."
          action={
            <Link href="/formations" className="btn-outline">
              Voir tout le catalogue
            </Link>
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={{
                id: course.id,
                slug: course.slug,
                name: course.name,
                shortDescription: course.shortDescription,
                imageUrl: course.imageUrl,
                price: course.price,
                durationLabel: course.durationLabel,
                level: course.level,
                capacity: course.capacity,
                enrolled: course._count.enrollments,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
