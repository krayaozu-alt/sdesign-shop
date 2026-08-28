import Link from 'next/link';
import { Plus } from 'lucide-react';
import { EnrollmentForm } from '@/components/admin/OpsForms';
import { Badge, Card, DataTable, EmptyState, Td, toneForStatus } from '@/components/ui/primitives';
import { Disclosure } from '@/components/ui/Disclosure';
import { ENROLLMENT_STATUS_LABELS, ENROLLMENT_STATUS_VALUES, type EnrollmentStatus } from '@/lib/constants';
import { formatDateShort, formatMoney } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { setEnrollmentStatusAction } from '@/server/actions/operations';
import { requirePermission } from '@/lib/auth';

export const metadata = { title: 'Inscriptions' };
export const dynamic = 'force-dynamic';

export default async function AdminEnrollmentsPage({ searchParams }: { searchParams: { statut?: string } }) {
  await requirePermission('students.manage');
  const statut = searchParams.statut ?? '';

  const [enrollments, students, courses] = await Promise.all([
    prisma.enrollment.findMany({
      where: statut ? { status: statut } : {},
      include: {
        student: { include: { user: { select: { fullName: true } } } },
        course: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    }),
    prisma.student.findMany({ include: { user: { select: { fullName: true } } }, orderBy: { createdAt: 'desc' } }),
    prisma.course.findMany({ select: { id: true, name: true, price: true }, orderBy: { name: 'asc' } }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <p className="label-eyebrow mb-1">Centre de formation</p>
        <h1 className="section-title">Inscriptions</h1>
      </div>

      <Disclosure label={<><Plus size={15} /> Inscrire une élève</>}>
        <EnrollmentForm
          enrollment={null}
          students={students.map((s) => ({ id: s.id, label: `${s.user.fullName} — ${s.matricule}` }))}
          courses={courses.map((c) => ({ id: c.id, label: `${c.name} (${formatMoney(c.price)})`, price: c.price }))}
        />
      </Disclosure>

      <div className="flex flex-wrap gap-2">
        <Link href="/admin/inscriptions" className={statut === '' ? 'btn-gold px-4 py-2 text-xs' : 'chip'}>
          Toutes
        </Link>
        {ENROLLMENT_STATUS_VALUES.map((s) => (
          <Link key={s} href={`/admin/inscriptions?statut=${s}`} className={statut === s ? 'btn-gold px-4 py-2 text-xs' : 'chip'}>
            {ENROLLMENT_STATUS_LABELS[s]}
          </Link>
        ))}
      </div>

      {enrollments.length === 0 ? (
        <EmptyState title="Aucune inscription" description="Les inscriptions en ligne et manuelles apparaissent ici." />
      ) : (
        <DataTable head={['Référence', 'Élève', 'Formation', 'Date', 'Progression', 'Solde', 'Statut', '']}>
          {enrollments.map((e) => {
            const balance = Math.max(0, e.amountDue - e.amountPaid);
            return (
              <tr key={e.id}>
                <Td className="whitespace-nowrap text-cream">{e.reference}</Td>
                <Td>{e.student.user.fullName}</Td>
                <Td>{e.course.name}</Td>
                <Td className="whitespace-nowrap">{formatDateShort(e.enrolledAt)}</Td>
                <Td>{e.progress} %</Td>
                <Td className={balance > 0 ? 'whitespace-nowrap text-amber-300' : 'whitespace-nowrap text-emerald-300'}>
                  {formatMoney(balance)}
                </Td>
                <Td>
                  <Badge tone={toneForStatus(e.status)}>
                    {ENROLLMENT_STATUS_LABELS[e.status as EnrollmentStatus] ?? e.status}
                  </Badge>
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-2">
                    <form action={setEnrollmentStatusAction} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={e.id} />
                      <select name="status" defaultValue={e.status} className="w-36 px-2 py-1.5 text-xs">
                        {ENROLLMENT_STATUS_VALUES.map((s) => (
                          <option key={s} value={s}>
                            {ENROLLMENT_STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="btn-ghost px-3 py-1.5 text-xs">
                        OK
                      </button>
                    </form>
                    <Link href={`/admin/inscriptions/${e.id}`} className="btn-ghost px-3 py-1.5 text-xs">
                      Dossier
                    </Link>
                  </div>
                </Td>
              </tr>
            );
          })}
        </DataTable>
      )}

      <Card className="text-xs text-cream-muted">
        Le solde est recalculé automatiquement à partir des paiements confirmés. Passez une inscription à « Terminée »
        pour pouvoir générer son certificat.
      </Card>
    </div>
  );
}
