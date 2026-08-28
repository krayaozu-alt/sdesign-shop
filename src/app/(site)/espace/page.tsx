import Link from 'next/link';
import { Award, Bell, CalendarDays, CreditCard, GraduationCap, MapPin, Wallet } from 'lucide-react';
import { Badge, Card, Media, Progress, StatTile, toneForStatus } from '@/components/ui/primitives';
import { requireUser } from '@/lib/auth';
import {
  APPOINTMENT_STATUS_LABELS,
  ENROLLMENT_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  type AppointmentStatus,
  type EnrollmentStatus,
  type PaymentStatus,
} from '@/lib/constants';
import { formatDate, formatDateShort, formatDateTime, formatMoney, formatTime, relativeFromNow } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { getSettings } from '@/lib/settings';

export const metadata = { title: 'Mon espace' };
export const dynamic = 'force-dynamic';

export default async function EspaceAccueilPage() {
  const user = await requireUser();
  const settings = await getSettings();

  const [inscriptions, rendezVous, paiements, certificats, notifications] = await Promise.all([
    user.student
      ? prisma.enrollment.findMany({
          where: { studentId: user.student.id },
          include: { course: true },
          orderBy: { createdAt: 'desc' },
        })
      : [],
    user.customer
      ? prisma.appointment.findMany({
          where: { customerId: user.customer.id },
          include: { service: { select: { name: true } } },
          orderBy: { scheduledAt: 'asc' },
        })
      : [],
    prisma.payment.findMany({
      where: {
        OR: [
          ...(user.customer ? [{ customerId: user.customer.id }] : []),
          ...(user.student ? [{ studentId: user.student.id }] : []),
          { id: '__aucun__' },
        ],
      },
      include: { receipt: { select: { number: true } } },
      orderBy: { paidAt: 'desc' },
      take: 4,
    }),
    user.student
      ? prisma.certificate.findMany({
          where: { enrollment: { studentId: user.student.id } },
          orderBy: { issuedAt: 'desc' },
          take: 3,
        })
      : [],
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 4 }),
  ]);

  const enCours = inscriptions.find((e) => ['CONFIRMEE', 'EN_COURS'].includes(e.status)) ?? inscriptions[0] ?? null;
  const prochainRdv = rendezVous.find(
    (r) => r.scheduledAt.getTime() >= Date.now() && ['EN_ATTENTE', 'CONFIRME'].includes(r.status),
  );
  const resteAPayer = inscriptions.reduce((s, e) => s + Math.max(0, e.amountDue - e.amountPaid), 0);
  const nonLues = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6">
      {/* Chiffres personnels — issus de la base, jamais inventés */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Mes formations"
          value={String(inscriptions.length)}
          href="/espace/formations"
          icon={<GraduationCap size={16} />}
        />
        <StatTile
          label="Mes rendez-vous"
          value={String(rendezVous.length)}
          href="/espace/rendez-vous"
          icon={<CalendarDays size={16} />}
        />
        <StatTile
          label="Reste à payer"
          value={formatMoney(resteAPayer)}
          href="/espace/paiements"
          icon={<Wallet size={16} />}
        />
        <StatTile
          label="Mes certificats"
          value={String(certificats.length)}
          href="/espace/certificats"
          icon={<Award size={16} />}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* ------------------------------------------------ Formation en cours */}
        <section>
          <h2 className="mb-3 font-display text-xl text-cream">Ma formation</h2>
          {enCours ? (
            <Card className="overflow-hidden p-0">
              <div className="sm:flex">
                <Media
                  src={enCours.course.imageUrl}
                  alt={enCours.course.name}
                  label={enCours.course.name}
                  ratio="aspect-[4/3] sm:aspect-auto"
                  className="rounded-none sm:h-full sm:w-56 sm:shrink-0"
                />
                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge tone={toneForStatus(enCours.status)}>
                      {ENROLLMENT_STATUS_LABELS[enCours.status as EnrollmentStatus] ?? enCours.status}
                    </Badge>
                    <span className="text-xs text-cream-dim">{enCours.reference}</span>
                  </div>
                  <h3 className="font-display text-2xl text-cream">{enCours.course.name}</h3>
                  <p className="mt-1 text-lg font-semibold text-gold-300">{formatMoney(enCours.course.price)}</p>

                  <div className="mt-4">
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="text-cream-muted">Progression</span>
                      <span className="font-semibold text-gold-300">{enCours.progress} %</span>
                    </div>
                    <Progress value={enCours.progress} />
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link href="/espace/eleve" className="btn-gold px-5 py-2.5 text-xs">
                      Continuer ma formation
                    </Link>
                    <Link href={`/formations/${enCours.course.slug}`} className="btn-ghost px-4 py-2.5 text-xs">
                      Voir le programme
                    </Link>
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="text-center">
              <GraduationCap size={26} className="mx-auto mb-3 text-gold-400/70" />
              <p className="text-sm text-cream-muted">
                Vous n’êtes inscrite à aucune formation pour le moment.
              </p>
              <Link href="/formations" className="btn-gold mt-4 inline-flex">
                Découvrir les formations
              </Link>
            </Card>
          )}
        </section>

        {/* ------------------------------------------------ Prochain rendez-vous */}
        <section>
          <h2 className="mb-3 font-display text-xl text-cream">Prochain rendez-vous</h2>
          {prochainRdv ? (
            <Card strong className="flex h-[calc(100%-2.5rem)] flex-col">
              <Badge tone={toneForStatus(prochainRdv.status)} className="self-start">
                {APPOINTMENT_STATUS_LABELS[prochainRdv.status as AppointmentStatus] ?? prochainRdv.status}
              </Badge>
              <p className="mt-3 font-display text-xl text-cream">{prochainRdv.service.name}</p>
              <p className="mt-1 text-sm text-cream-muted">
                {formatDate(prochainRdv.scheduledAt)} à {formatTime(prochainRdv.scheduledAt)}
              </p>
              <p className="mt-2 flex items-center gap-2 text-xs text-cream-dim">
                <MapPin size={13} className="text-gold-400" /> {settings['shop.address']}
              </p>
              <p className="mt-3 text-sm">
                <span className="text-cream-dim">Montant : </span>
                <span className="font-semibold text-gold-300">{formatMoney(prochainRdv.amountDue)}</span>
              </p>
              <div className="mt-auto flex flex-wrap gap-2 pt-5">
                <Link href="/espace/rendez-vous" className="btn-ghost flex-1 px-4 py-2 text-xs">
                  Gérer
                </Link>
                <Link href="/reservation" className="btn-gold flex-1 px-4 py-2 text-xs">
                  Nouveau
                </Link>
              </div>
            </Card>
          ) : (
            <Card className="text-center">
              <CalendarDays size={26} className="mx-auto mb-3 text-gold-400/70" />
              <p className="text-sm text-cream-muted">Aucun rendez-vous à venir.</p>
              <Link href="/reservation" className="btn-gold mt-4 inline-flex">
                Prendre rendez-vous
              </Link>
            </Card>
          )}
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ------------------------------------------------------- Paiements */}
        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="font-display text-xl text-cream">Mes paiements</h2>
            <Link href="/espace/paiements" className="text-sm text-gold-300 hover:text-gold-200">
              Tout voir →
            </Link>
          </div>
          <Card className={paiements.length === 0 ? 'text-center' : 'p-0'}>
            {paiements.length === 0 ? (
              <>
                <CreditCard size={24} className="mx-auto mb-3 text-gold-400/70" />
                <p className="text-sm text-cream-muted">Aucun paiement enregistré.</p>
              </>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {paiements.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-cream">{p.label}</p>
                      <p className="text-xs text-cream-dim">
                        {formatDateShort(p.paidAt)} · {p.reference}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-gold-300">{formatMoney(p.amount)}</p>
                      {p.receipt ? (
                        <Link href={`/recu/${p.receipt.number}`} className="text-[11px] text-cream-muted hover:text-cream">
                          Voir le reçu →
                        </Link>
                      ) : (
                        <Badge tone={toneForStatus(p.status)} className="mt-0.5">
                          {PAYMENT_STATUS_LABELS[p.status as PaymentStatus] ?? p.status}
                        </Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        {/* --------------------------------------------------- Notifications */}
        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="font-display text-xl text-cream">
              Notifications
              {nonLues > 0 ? <span className="ml-2 text-sm text-gold-300">{nonLues} non lue(s)</span> : null}
            </h2>
            <Link href="/espace/notifications" className="text-sm text-gold-300 hover:text-gold-200">
              Tout voir →
            </Link>
          </div>
          <Card className={notifications.length === 0 ? 'text-center' : 'p-0'}>
            {notifications.length === 0 ? (
              <>
                <Bell size={24} className="mx-auto mb-3 text-gold-400/70" />
                <p className="text-sm text-cream-muted">Aucune notification.</p>
              </>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {notifications.map((n) => (
                  <li key={n.id} className="flex items-start gap-3 px-5 py-3.5">
                    <span
                      className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${n.isRead ? 'bg-white/15' : 'bg-gold-500'}`}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm text-cream">{n.title}</p>
                      <p className="line-clamp-2 text-xs text-cream-muted">{n.message}</p>
                      <p className="mt-0.5 text-[11px] text-cream-dim">{relativeFromNow(n.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>

      {/* ------------------------------------------------------- Certificats */}
      {certificats.length > 0 ? (
        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="font-display text-xl text-cream">Mes certificats</h2>
            <Link href="/espace/certificats" className="text-sm text-gold-300 hover:text-gold-200">
              Tout voir →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {certificats.map((c) => (
              <Card key={c.id} strong>
                <Award size={20} className="mb-2 text-gold-400" />
                <p className="font-display text-lg text-cream">{c.courseName}</p>
                <p className="text-xs text-cream-dim">
                  {c.number} · {formatDateShort(c.issuedAt)}
                </p>
                <Link href={`/certificat/${c.number}`} className="btn-outline mt-4 w-full px-4 py-2 text-xs">
                  Voir le certificat
                </Link>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {rendezVous.length > 0 && !prochainRdv ? (
        <p className="text-center text-xs text-cream-dim">
          Dernier rendez-vous : {formatDateTime(rendezVous[rendezVous.length - 1].scheduledAt)}
        </p>
      ) : null}
    </div>
  );
}
