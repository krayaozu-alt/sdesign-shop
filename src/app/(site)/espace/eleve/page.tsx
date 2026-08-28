import Link from 'next/link';
import { CalendarDays, CheckCircle2, Circle, Wallet } from 'lucide-react';
import { Badge, Card, EmptyState, ProgressLabelled, StatTile, toneForStatus } from '@/components/ui/primitives';
import { requireUser } from '@/lib/auth';
import {
  ATTENDANCE_STATUS_LABELS,
  ENROLLMENT_STATUS_LABELS,
  type AttendanceStatus,
  type EnrollmentStatus,
} from '@/lib/constants';
import { formatDate, formatDateShort, formatMoney } from '@/lib/format';
import { prisma } from '@/lib/prisma';

export const metadata = { title: 'Espace élève' };
export const dynamic = 'force-dynamic';

export default async function StudentSpacePage() {
  const user = await requireUser();

  if (!user.student) {
    return (
      <EmptyState
        title="Vous n’êtes pas encore inscrite à une formation"
        description="Inscrivez-vous à une formation pour ouvrir votre espace élève."
        action={
          <Link href="/formations" className="btn-gold">
            Voir les formations
          </Link>
        }
      />
    );
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId: user.student.id },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: {
      course: { include: { modules: { orderBy: { orderIndex: 'asc' } }, trainer: true } },
      session: true,
      modules: true,
      attendances: { orderBy: { date: 'desc' }, take: 12 },
      payments: { orderBy: { paidAt: 'desc' } },
      certificate: true,
    },
  });

  if (!enrollment) {
    return (
      <EmptyState
        title="Aucune formation en cours"
        description="Votre inscription apparaîtra ici dès qu’elle sera enregistrée."
        action={
          <Link href="/formations" className="btn-gold">
            Voir les formations
          </Link>
        }
      />
    );
  }

  const balance = Math.max(0, enrollment.amountDue - enrollment.amountPaid);
  const doneModuleIds = new Set(enrollment.modules.filter((m) => m.completed).map((m) => m.moduleId));
  const presentCount = enrollment.attendances.filter((a) => a.status === 'PRESENT').length;

  return (
    <div className="space-y-5">
      <Card strong>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge tone={toneForStatus(enrollment.status)}>
            {ENROLLMENT_STATUS_LABELS[enrollment.status as EnrollmentStatus] ?? enrollment.status}
          </Badge>
          <span className="text-xs text-cream-dim">{enrollment.reference}</span>
        </div>
        <h2 className="font-display text-2xl text-cream">{enrollment.course.name}</h2>
        <p className="mt-1 text-sm text-cream-muted">
          {enrollment.course.durationLabel} · {enrollment.course.trainer?.fullName ?? 'Formatrice à définir'}
        </p>
        <div className="mt-5">
          <ProgressLabelled value={enrollment.progress} label="Progression de la formation" />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Modules validés" value={`${doneModuleIds.size} / ${enrollment.course.modules.length}`} />
        <StatTile label="Présences" value={String(presentCount)} icon={<CalendarDays size={16} />} />
        <StatTile label="Déjà réglé" value={formatMoney(enrollment.amountPaid)} icon={<Wallet size={16} />} />
        <StatTile label="Solde restant" value={formatMoney(balance)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <p className="mb-4 text-sm text-cream">Modules de la formation</p>
          {enrollment.course.modules.length === 0 ? (
            <p className="text-sm text-cream-muted">Le programme sera publié prochainement.</p>
          ) : (
            <ol className="space-y-2">
              {enrollment.course.modules.map((m) => {
                const done = doneModuleIds.has(m.id);
                return (
                  <li key={m.id} className="flex items-start gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5">
                    {done ? (
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-300" />
                    ) : (
                      <Circle size={16} className="mt-0.5 shrink-0 text-cream-dim" />
                    )}
                    <div className="min-w-0">
                      <p className={done ? 'text-sm text-cream' : 'text-sm text-cream-muted'}>{m.title}</p>
                      {m.durationHours > 0 ? (
                        <p className="text-[11px] text-cream-dim">{m.durationHours} h</p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <p className="mb-3 text-sm text-cream">Présences récentes</p>
            {enrollment.attendances.length === 0 ? (
              <p className="text-sm text-cream-muted">Aucun pointage enregistré.</p>
            ) : (
              <ul className="space-y-2">
                {enrollment.attendances.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-cream-muted">{formatDateShort(a.date)}</span>
                    <Badge tone={toneForStatus(a.status)}>
                      {ATTENDANCE_STATUS_LABELS[a.status as AttendanceStatus] ?? a.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <p className="mb-3 text-sm text-cream">Calendrier</p>
            {enrollment.session ? (
              <p className="text-sm text-cream-muted">
                {enrollment.session.title}
                <br />
                {formatDate(enrollment.session.startDate)} → {formatDate(enrollment.session.endDate)}
                {enrollment.session.location ? ` · ${enrollment.session.location}` : ''}
              </p>
            ) : enrollment.course.startDate ? (
              <p className="text-sm text-cream-muted">
                Début : {formatDate(enrollment.course.startDate)}
                {enrollment.course.endDate ? ` — Fin : ${formatDate(enrollment.course.endDate)}` : ''}
              </p>
            ) : (
              <p className="text-sm text-cream-muted">Le calendrier vous sera communiqué par la formatrice.</p>
            )}
          </Card>

          {enrollment.certificate ? (
            <Card strong>
              <p className="mb-1 text-sm text-cream">Certificat disponible</p>
              <p className="text-xs text-cream-muted">{enrollment.certificate.number}</p>
              <Link href={`/certificat/${enrollment.certificate.number}`} className="btn-gold mt-3 w-full px-4 py-2 text-xs">
                Voir mon certificat
              </Link>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
