import Link from 'next/link';
import { MessageCircle, Pencil, Phone, Plus, Search } from 'lucide-react';
import { StudentForm } from '@/components/admin/PeopleForms';
import { Badge, Card, EmptyState, Progress } from '@/components/ui/primitives';
import { Disclosure } from '@/components/ui/Disclosure';
import { ENROLLMENT_STATUS_LABELS, type EnrollmentStatus } from '@/lib/constants';
import { formatMoney } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { whatsappLink } from '@/lib/utils';
import { deleteStudentAction } from '@/server/actions/people';
import { requirePermission } from '@/lib/auth';
import { contient } from '@/lib/db-search';

export const metadata = { title: 'Élèves' };
export const dynamic = 'force-dynamic';

export default async function AdminStudentsPage({ searchParams }: { searchParams: { q?: string } }) {
  await requirePermission('students.manage');
  const q = (searchParams.q ?? '').trim();

  const students = await prisma.student.findMany({
    where: q
      ? {
          OR: [
            { matricule: contient(q) },
            { user: { fullName: contient(q) } },
            { user: { phone: contient(q) } },
          ],
        }
      : {},
    include: {
      user: true,
      enrollments: { include: { course: { select: { name: true } } }, orderBy: { createdAt: 'desc' } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-eyebrow mb-1">Centre de formation</p>
          <h1 className="section-title">Élèves</h1>
        </div>
        <form method="get" className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cream-dim" />
          <input name="q" defaultValue={q} placeholder="Nom, matricule, téléphone…" className="w-64 pl-9" />
        </form>
      </div>

      <Disclosure label={<><Plus size={15} /> Nouvelle élève</>}>
        <StudentForm student={null} />
      </Disclosure>

      {students.length === 0 ? (
        <EmptyState title="Aucune élève" description="Les inscriptions créent automatiquement la fiche élève." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {students.map((s) => {
            const totalDue = s.enrollments.reduce((sum, e) => sum + e.amountDue, 0);
            const totalPaid = s.enrollments.reduce((sum, e) => sum + e.amountPaid, 0);
            const balance = Math.max(0, totalDue - totalPaid);
            const active = s.enrollments.find((e) => ['CONFIRMEE', 'EN_COURS'].includes(e.status));
            const wa = whatsappLink(s.user.whatsapp ?? s.user.phone);

            return (
              <Card key={s.id}>
                <div className="mb-1 flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate font-display text-lg text-cream">{s.user.fullName}</p>
                  <Badge tone="gold">{s.matricule}</Badge>
                </div>

                <div className="mb-3 mt-2 flex flex-wrap gap-2">
                  <a href={`tel:${s.user.phone}`} className="chip hover:text-cream">
                    <Phone size={12} /> {s.user.phone}
                  </a>
                  {wa ? (
                    <a href={wa} target="_blank" rel="noreferrer" className="chip hover:text-cream">
                      <MessageCircle size={12} /> WhatsApp
                    </a>
                  ) : null}
                </div>

                {active ? (
                  <div className="mb-3">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="truncate text-cream-muted">{active.course.name}</span>
                      <span className="text-gold-300">{active.progress} %</span>
                    </div>
                    <Progress value={active.progress} />
                  </div>
                ) : (
                  <p className="mb-3 text-xs text-cream-dim">Aucune formation en cours</p>
                )}

                <dl className="mb-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-cream-dim">Inscriptions</dt>
                    <dd className="text-cream">{s.enrollments.length}</dd>
                  </div>
                  <div>
                    <dt className="text-cream-dim">Réglé</dt>
                    <dd className="text-emerald-300">{formatMoney(totalPaid)}</dd>
                  </div>
                  <div>
                    <dt className="text-cream-dim">Solde</dt>
                    <dd className={balance > 0 ? 'text-amber-300' : 'text-cream'}>{formatMoney(balance)}</dd>
                  </div>
                </dl>

                {s.enrollments.length > 0 ? (
                  <ul className="mb-3 space-y-1">
                    {s.enrollments.slice(0, 3).map((e) => (
                      <li key={e.id} className="flex items-center justify-between gap-2 text-xs">
                        <Link href={`/admin/inscriptions/${e.id}`} className="truncate text-cream-muted hover:text-cream">
                          {e.course.name}
                        </Link>
                        <span className="shrink-0 text-cream-dim">
                          {ENROLLMENT_STATUS_LABELS[e.status as EnrollmentStatus] ?? e.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                <div className="space-y-2">
                  <Disclosure variant="row" label={<><Pencil size={13} /> Modifier la fiche</>}>
                    <StudentForm
                      student={{
                        id: s.id,
                        fullName: s.user.fullName,
                        phone: s.user.phone,
                        whatsapp: s.user.whatsapp,
                        email: s.user.email,
                        birthDate: s.birthDate,
                        address: s.address,
                        emergencyContact: s.emergencyContact,
                        notes: s.notes,
                      }}
                    />
                  </Disclosure>
                  {s.enrollments.length === 0 ? (
                    <form action={deleteStudentAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <button type="submit" className="btn-danger w-full px-3 py-2 text-xs">
                        Supprimer
                      </button>
                    </form>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
