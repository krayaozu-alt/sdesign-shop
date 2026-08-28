import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle2, Circle, Plus } from 'lucide-react';
import { PaymentForm } from '@/components/admin/FinanceForms';
import { AttendanceForm, EnrollmentForm } from '@/components/admin/OpsForms';
import { Badge, Card, DataTable, ProgressLabelled, StatTile, Td, toneForStatus } from '@/components/ui/primitives';
import { Disclosure } from '@/components/ui/Disclosure';
import {
  ATTENDANCE_STATUS_LABELS,
  ENROLLMENT_STATUS_LABELS,
  PAYMENT_METHOD_VALUES,
  PAYMENT_STATUS_LABELS,
  type AttendanceStatus,
  type EnrollmentStatus,
  type PaymentMethod,
  type PaymentStatus,
} from '@/lib/constants';
import { formatDateShort, formatMoney } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { getSettings, splitList } from '@/lib/settings';
import { toggleModuleProgressAction } from '@/server/actions/operations';
import { requirePermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AdminEnrollmentDetailPage({ params }: { params: { id: string } }) {
  await requirePermission('students.manage');
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: params.id },
    include: {
      student: { include: { user: true } },
      course: { include: { modules: { orderBy: { orderIndex: 'asc' } } } },
      modules: true,
      attendances: { orderBy: { date: 'desc' } },
      payments: { include: { receipt: true }, orderBy: { paidAt: 'desc' } },
      certificate: true,
    },
  });
  if (!enrollment) notFound();

  const [settings, students, courses] = await Promise.all([
    getSettings(),
    prisma.student.findMany({ include: { user: { select: { fullName: true } } } }),
    prisma.course.findMany({ select: { id: true, name: true, price: true } }),
  ]);

  const methods = splitList(settings['payments.methods']).filter((m) =>
    (PAYMENT_METHOD_VALUES as readonly string[]).includes(m),
  ) as PaymentMethod[];

  const balance = Math.max(0, enrollment.amountDue - enrollment.amountPaid);
  const done = new Set(enrollment.modules.filter((m) => m.completed).map((m) => m.moduleId));
  const present = enrollment.attendances.filter((a) => a.status === 'PRESENT').length;
  const absent = enrollment.attendances.filter((a) => a.status === 'ABSENT').length;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/inscriptions" className="text-sm text-cream-muted hover:text-cream">
          ← Inscriptions
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="section-title">{enrollment.student.user.fullName}</h1>
          <Badge tone={toneForStatus(enrollment.status)}>
            {ENROLLMENT_STATUS_LABELS[enrollment.status as EnrollmentStatus] ?? enrollment.status}
          </Badge>
          <span className="text-sm text-cream-dim">{enrollment.reference}</span>
        </div>
        <p className="mt-1 text-sm text-cream-muted">
          {enrollment.course.name} · matricule {enrollment.student.matricule} · {enrollment.student.user.phone}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Montant dû" value={formatMoney(enrollment.amountDue)} />
        <StatTile label="Déjà réglé" value={formatMoney(enrollment.amountPaid)} />
        <StatTile label="Solde restant" value={formatMoney(balance)} />
        <StatTile label="Présences / absences" value={`${present} / ${absent}`} />
      </div>

      <Card>
        <ProgressLabelled value={enrollment.progress} label="Progression globale" />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-display text-lg text-cream">Modules validés</h2>
          {enrollment.course.modules.length === 0 ? (
            <p className="text-sm text-cream-muted">Aucun module défini pour cette formation.</p>
          ) : (
            <ul className="space-y-2">
              {enrollment.course.modules.map((m) => {
                const completed = done.has(m.id);
                return (
                  <li key={m.id}>
                    <form action={toggleModuleProgressAction}>
                      <input type="hidden" name="enrollmentId" value={enrollment.id} />
                      <input type="hidden" name="moduleId" value={m.id} />
                      <button
                        type="submit"
                        className="flex w-full items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5 text-left transition hover:bg-white/[0.07]"
                      >
                        {completed ? (
                          <CheckCircle2 size={16} className="shrink-0 text-emerald-300" />
                        ) : (
                          <Circle size={16} className="shrink-0 text-cream-dim" />
                        )}
                        <span className={completed ? 'text-sm text-cream' : 'text-sm text-cream-muted'}>{m.title}</span>
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-cream-dim">
            La progression globale est recalculée automatiquement à partir des modules validés.
          </p>
        </Card>

        <Card>
          <h2 className="mb-3 font-display text-lg text-cream">Présences</h2>
          <Disclosure variant="ghost" label={<><Plus size={14} /> Enregistrer une présence</>} className="mb-4">
            <AttendanceForm enrollmentId={enrollment.id} />
          </Disclosure>
          {enrollment.attendances.length === 0 ? (
            <p className="text-sm text-cream-muted">Aucun pointage enregistré.</p>
          ) : (
            <ul className="space-y-2">
              {enrollment.attendances.slice(0, 12).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-cream-muted">{formatDateShort(a.date)}</span>
                  <span className="flex items-center gap-2">
                    {a.note ? <span className="text-xs text-cream-dim">{a.note}</span> : null}
                    <Badge tone={toneForStatus(a.status)}>
                      {ATTENDANCE_STATUS_LABELS[a.status as AttendanceStatus] ?? a.status}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div>
        <h2 className="mb-3 font-display text-lg text-cream">Paiements</h2>
        <Disclosure label={<><Plus size={15} /> Enregistrer un paiement</>} className="mb-4">
          <PaymentForm
            methods={methods.length ? methods : (['ESPECES'] as PaymentMethod[])}
            enrollments={[
              {
                id: enrollment.id,
                label: `${enrollment.reference} — ${enrollment.course.name}`,
                balance,
              },
            ]}
            appointments={[]}
            defaultEnrollmentId={enrollment.id}
          />
        </Disclosure>

        {enrollment.payments.length === 0 ? (
          <Card className="text-sm text-cream-muted">Aucun paiement enregistré.</Card>
        ) : (
          <DataTable head={['Date', 'Référence', 'Libellé', 'Montant', 'Statut', 'Reçu']}>
            {enrollment.payments.map((p) => (
              <tr key={p.id}>
                <Td>{formatDateShort(p.paidAt)}</Td>
                <Td className="text-cream">{p.reference}</Td>
                <Td>{p.label}</Td>
                <Td className="whitespace-nowrap text-gold-300">{formatMoney(p.amount)}</Td>
                <Td>
                  <Badge tone={toneForStatus(p.status)}>{PAYMENT_STATUS_LABELS[p.status as PaymentStatus] ?? p.status}</Badge>
                </Td>
                <Td>
                  {p.receipt ? (
                    <Link href={`/recu/${p.receipt.number}`} className="text-gold-300 hover:text-gold-200">
                      {p.receipt.number}
                    </Link>
                  ) : (
                    '—'
                  )}
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-display text-lg text-cream">Modifier l’inscription</h2>
          <EnrollmentForm
            enrollment={{
              id: enrollment.id,
              studentId: enrollment.studentId,
              courseId: enrollment.courseId,
              sessionId: enrollment.sessionId,
              status: enrollment.status,
              progress: enrollment.progress,
              amountDue: enrollment.amountDue,
              notes: enrollment.notes,
            }}
            students={students.map((s) => ({ id: s.id, label: `${s.user.fullName} — ${s.matricule}` }))}
            courses={courses.map((c) => ({ id: c.id, label: c.name, price: c.price }))}
          />
        </Card>

        <Card>
          <h2 className="mb-3 font-display text-lg text-cream">Certificat</h2>
          {enrollment.certificate ? (
            <>
              <p className="text-sm text-cream-muted">
                {enrollment.certificate.number} — délivré le {formatDateShort(enrollment.certificate.issuedAt)}
              </p>
              <Link href={`/certificat/${enrollment.certificate.number}`} className="btn-gold mt-3 w-full">
                Voir / Imprimer
              </Link>
            </>
          ) : enrollment.status === 'TERMINEE' ? (
            <>
              <p className="text-sm text-cream-muted">
                La formation est terminée : le certificat peut être généré depuis la page Certificats.
              </p>
              <Link href="/admin/certificats" className="btn-outline mt-3 w-full">
                Générer le certificat
              </Link>
            </>
          ) : (
            <p className="text-sm text-cream-muted">
              Le certificat sera disponible lorsque l’inscription passera au statut « Terminée ».
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
