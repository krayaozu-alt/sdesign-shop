import Link from 'next/link';
import { ImageOff, Plus, Search } from 'lucide-react';
import { CourseForm } from '@/components/admin/CatalogForms';
import { Badge, Card, DataTable, EmptyState, Td, toneForStatus } from '@/components/ui/primitives';
import { Disclosure } from '@/components/ui/Disclosure';
import { COURSE_STATUS_LABELS, type CourseStatus } from '@/lib/constants';
import { formatMoney } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { deleteCourseAction } from '@/server/actions/catalog';
import { requirePermission } from '@/lib/auth';
import { contient } from '@/lib/db-search';

export const metadata = { title: 'Formations' };
export const dynamic = 'force-dynamic';

export default async function AdminCoursesPage({ searchParams }: { searchParams: { q?: string } }) {
  await requirePermission('courses.manage');
  const q = (searchParams.q ?? '').trim();

  const [courses, trainers] = await Promise.all([
    prisma.course.findMany({
      where: q ? { OR: [{ name: contient(q) }, { category: contient(q) }] } : {},
      include: { trainer: { select: { fullName: true } }, _count: { select: { enrollments: true, images: true } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    }),
    prisma.trainer.findMany({ where: { isActive: true }, select: { id: true, fullName: true }, orderBy: { fullName: 'asc' } }),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-eyebrow mb-1">Catalogue</p>
          <h1 className="section-title">Formations</h1>
        </div>
        <form method="get" className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cream-dim" />
          <input name="q" defaultValue={q} placeholder="Rechercher…" className="w-56 pl-9" />
        </form>
      </div>

      <Disclosure label={<><Plus size={15} /> Nouvelle formation</>}>
        <CourseForm course={null} trainers={trainers} />
      </Disclosure>

      {courses.length === 0 ? (
        <EmptyState title="Aucune formation" description="Créez votre première formation avec le bouton ci-dessus." />
      ) : (
        <DataTable head={['Formation', 'Catégorie', 'Prix', 'Places', 'Formatrice', 'Statut', '']}>
          {courses.map((c) => (
            <tr key={c.id}>
              <Td className="text-cream">
                <Link href={`/admin/formations/${c.id}`} className="hover:text-gold-200">
                  {c.name}
                </Link>
                {c._count.images === 0 ? (
                  <Badge tone="amber" className="ml-2">
                    <ImageOff size={10} /> sans photo
                  </Badge>
                ) : (
                  <span className="ml-2 text-[11px] text-cream-dim">
                    {c._count.images} photo{c._count.images > 1 ? 's' : ''}
                  </span>
                )}
              </Td>
              <Td>{c.category}</Td>
              <Td className="whitespace-nowrap text-gold-300">{formatMoney(c.price)}</Td>
              <Td className="whitespace-nowrap">
                {c._count.enrollments} / {c.capacity}
              </Td>
              <Td>{c.trainer?.fullName ?? '—'}</Td>
              <Td>
                <Badge tone={toneForStatus(c.status)}>
                  {COURSE_STATUS_LABELS[c.status as CourseStatus] ?? c.status}
                </Badge>
              </Td>
              <Td>
                <div className="flex justify-end gap-2">
                  <Link href={`/admin/formations/${c.id}`} className="btn-ghost px-3 py-1.5 text-xs">
                    Ouvrir
                  </Link>
                  <form action={deleteCourseAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" className="btn-danger px-3 py-1.5 text-xs">
                      {c._count.enrollments > 0 ? 'Archiver' : 'Supprimer'}
                    </button>
                  </form>
                </div>
              </Td>
            </tr>
          ))}
        </DataTable>
      )}

      <Card className="text-xs text-cream-muted">
        Une formation déjà suivie par des élèves n’est jamais supprimée : elle est archivée pour préserver les
        inscriptions, les paiements et les certificats liés.
      </Card>
    </div>
  );
}
