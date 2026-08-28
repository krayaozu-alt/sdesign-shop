import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ImagePlus, Plus, Star, Trash2 } from 'lucide-react';
import { CourseForm, ModuleForm, SessionForm } from '@/components/admin/CatalogForms';
import { CourseImageUploader } from '@/components/admin/CourseImageUploader';
import { Badge, Card, DataTable, Td, toneForStatus } from '@/components/ui/primitives';
import { Disclosure } from '@/components/ui/Disclosure';
import { ENROLLMENT_STATUS_LABELS, type EnrollmentStatus } from '@/lib/constants';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import {
  deleteCourseImageAction,
  deleteModuleAction,
  deleteSessionAction,
  setPrimaryCourseImageAction,
} from '@/server/actions/catalog';
import { requirePermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AdminCourseDetailPage({ params }: { params: { id: string } }) {
  await requirePermission('courses.manage');
  const [course, trainers] = await Promise.all([
    prisma.course.findUnique({
      where: { id: params.id },
      include: {
        images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }] },
        modules: { orderBy: { orderIndex: 'asc' } },
        sessions: { orderBy: { startDate: 'asc' } },
        enrollments: {
          include: { student: { include: { user: { select: { fullName: true } } } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    }),
    prisma.trainer.findMany({ where: { isActive: true }, select: { id: true, fullName: true }, orderBy: { fullName: 'asc' } }),
  ]);

  if (!course) notFound();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/formations" className="text-sm text-cream-muted hover:text-cream">
            ← Formations
          </Link>
          <h1 className="section-title mt-1">{course.name}</h1>
        </div>
        <Link href={`/formations/${course.slug}`} className="btn-ghost px-4 py-2 text-xs">
          Voir la page publique
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <CourseForm
          course={{
            id: course.id,
            name: course.name,
            category: course.category,
            shortDescription: course.shortDescription,
            description: course.description,
            objectives: course.objectives,
            requirements: course.requirements,
            durationLabel: course.durationLabel,
            durationHours: course.durationHours,
            level: course.level,
            price: course.price,
            depositAmount: course.depositAmount,
            capacity: course.capacity,
            startDate: course.startDate,
            endDate: course.endDate,
            trainerId: course.trainerId,
            status: course.status,
            isFeatured: course.isFeatured,
          }}
          trainers={trainers}
        />

        <div className="space-y-5">
          <Card>
            <h2 className="mb-1 font-display text-lg text-cream">Photothèque ({course.images.length})</h2>
            <p className="mb-3 text-xs text-cream-muted">
              La photo marquée « Principale » est celle affichée sur le site public. Utilisez uniquement des photos
              montrant réellement cette technique.
            </p>

            {course.images.length === 0 ? (
              <p className="mb-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                Aucune photo. Le site affiche une vignette de secours en attendant vos vraies photos.
              </p>
            ) : (
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {course.images.map((img) => (
                  <div key={img.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={img.alt ?? course.name} className="aspect-square w-full object-cover" />
                    <div className="p-2">
                      {img.isPrimary ? (
                        <Badge tone="gold" className="mb-2 w-full justify-center">
                          <Star size={10} fill="currentColor" /> Principale
                        </Badge>
                      ) : (
                        <form action={setPrimaryCourseImageAction} className="mb-2">
                          <input type="hidden" name="id" value={img.id} />
                          <input type="hidden" name="courseId" value={course.id} />
                          <button type="submit" className="btn-ghost w-full px-2 py-1 text-[10px]">
                            <Star size={10} /> Définir principale
                          </button>
                        </form>
                      )}
                      <form action={deleteCourseImageAction}>
                        <input type="hidden" name="id" value={img.id} />
                        <input type="hidden" name="courseId" value={course.id} />
                        <button type="submit" className="btn-danger w-full px-2 py-1 text-[10px]">
                          <Trash2 size={10} /> Supprimer
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Disclosure variant="ghost" label={<><ImagePlus size={14} /> Ajouter des photos</>}>
              <CourseImageUploader courseId={course.id} courseName={course.name} />
            </Disclosure>
          </Card>

          <Card>
            <h2 className="mb-3 font-display text-lg text-cream">Programme ({course.modules.length})</h2>
            {course.modules.length === 0 ? (
              <p className="mb-3 text-sm text-cream-muted">Aucun module. Ajoutez le programme détaillé.</p>
            ) : (
              <ol className="mb-4 space-y-2">
                {course.modules.map((m, i) => (
                  <li key={m.id} className="flex items-start justify-between gap-2 rounded-xl bg-white/[0.03] px-3 py-2">
                    <span className="min-w-0 text-sm text-cream-muted">
                      <span className="text-gold-300">{i + 1}.</span> {m.title}
                      {m.durationHours > 0 ? <span className="text-cream-dim"> · {m.durationHours} h</span> : null}
                    </span>
                    <form action={deleteModuleAction}>
                      <input type="hidden" name="id" value={m.id} />
                      <input type="hidden" name="courseId" value={course.id} />
                      <button type="submit" aria-label="Supprimer le module" className="text-red-300 hover:text-red-200">
                        <Trash2 size={14} />
                      </button>
                    </form>
                  </li>
                ))}
              </ol>
            )}
            <Disclosure variant="ghost" label={<><Plus size={14} /> Ajouter un module</>}>
              <ModuleForm courseId={course.id} />
            </Disclosure>
          </Card>

          <Card>
            <h2 className="mb-3 font-display text-lg text-cream">Sessions ({course.sessions.length})</h2>
            {course.sessions.length === 0 ? (
              <p className="mb-3 text-sm text-cream-muted">Aucune session planifiée.</p>
            ) : (
              <ul className="mb-4 space-y-2">
                {course.sessions.map((s) => (
                  <li key={s.id} className="flex items-start justify-between gap-2 rounded-xl bg-white/[0.03] px-3 py-2">
                    <span className="min-w-0 text-sm text-cream-muted">
                      {s.title}
                      <br />
                      <span className="text-xs text-cream-dim">
                        {formatDateTime(s.startDate)} → {formatDate(s.endDate)}
                      </span>
                    </span>
                    <form action={deleteSessionAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="courseId" value={course.id} />
                      <button type="submit" aria-label="Supprimer la session" className="text-red-300 hover:text-red-200">
                        <Trash2 size={14} />
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <Disclosure variant="ghost" label={<><Plus size={14} /> Planifier une session</>}>
              <SessionForm courseId={course.id} />
            </Disclosure>
          </Card>
        </div>
      </div>

      <div>
        <h2 className="mb-3 font-display text-lg text-cream">Élèves inscrites ({course.enrollments.length})</h2>
        {course.enrollments.length === 0 ? (
          <Card className="text-sm text-cream-muted">Aucune inscription pour cette formation.</Card>
        ) : (
          <DataTable head={['Référence', 'Élève', 'Statut', 'Progression', 'Réglé', 'Solde', '']}>
            {course.enrollments.map((e) => {
              const balance = Math.max(0, e.amountDue - e.amountPaid);
              return (
                <tr key={e.id}>
                  <Td className="text-cream">{e.reference}</Td>
                  <Td>{e.student.user.fullName}</Td>
                  <Td>
                    <Badge tone={toneForStatus(e.status)}>
                      {ENROLLMENT_STATUS_LABELS[e.status as EnrollmentStatus] ?? e.status}
                    </Badge>
                  </Td>
                  <Td>{e.progress} %</Td>
                  <Td>{formatMoney(e.amountPaid)}</Td>
                  <Td className={balance > 0 ? 'text-amber-300' : 'text-emerald-300'}>{formatMoney(balance)}</Td>
                  <Td>
                    <Link href={`/admin/inscriptions/${e.id}`} className="btn-ghost px-3 py-1.5 text-xs">
                      Dossier
                    </Link>
                  </Td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </div>
    </div>
  );
}
