import Link from 'next/link';
import { Badge, Card, EmptyState, Progress, toneForStatus } from '@/components/ui/primitives';
import { requireUser } from '@/lib/auth';
import { ENROLLMENT_STATUS_LABELS, type EnrollmentStatus } from '@/lib/constants';
import { formatDate, formatMoney } from '@/lib/format';
import { prisma } from '@/lib/prisma';

export const metadata = { title: 'Mes formations' };
export const dynamic = 'force-dynamic';

export default async function MyCoursesPage() {
  const user = await requireUser();

  const enrollments = user.student
    ? await prisma.enrollment.findMany({
        where: { studentId: user.student.id },
        include: { course: true, certificate: true },
        orderBy: { createdAt: 'desc' },
      })
    : [];

  if (enrollments.length === 0) {
    return (
      <EmptyState
        title="Aucune inscription"
        description="Inscrivez-vous à une formation pour suivre ici votre progression, vos paiements et votre certificat."
        action={
          <Link href="/formations" className="btn-gold">
            Voir les formations
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {enrollments.map((e) => {
        const balance = Math.max(0, e.amountDue - e.amountPaid);
        return (
          <Card key={e.id}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge tone={toneForStatus(e.status)}>
                {ENROLLMENT_STATUS_LABELS[e.status as EnrollmentStatus] ?? e.status}
              </Badge>
              <span className="text-xs text-cream-dim">{e.reference}</span>
            </div>

            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/formations/${e.course.slug}`} className="font-display text-lg text-cream hover:text-gold-200">
                  {e.course.name}
                </Link>
                <p className="text-sm text-cream-muted">
                  {e.course.durationLabel} · inscrite le {formatDate(e.enrolledAt)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-cream-dim">Reste à payer</p>
                <p className={balance > 0 ? 'font-semibold text-amber-300' : 'font-semibold text-emerald-300'}>
                  {formatMoney(balance)}
                </p>
                <p className="text-[11px] text-cream-dim">
                  {formatMoney(e.amountPaid)} / {formatMoney(e.amountDue)}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-cream-dim">Progression</span>
                <span className="text-gold-300">{e.progress} %</span>
              </div>
              <Progress value={e.progress} />
            </div>

            {e.certificate ? (
              <Link href="/espace/certificats" className="btn-outline mt-4 w-full px-4 py-2 text-xs">
                Certificat disponible — {e.certificate.number}
              </Link>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}
