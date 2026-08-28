import Link from 'next/link';
import {
  AlertCircle,
  Award,
  CalendarDays,
  CalendarRange,
  CreditCard,
  GraduationCap,
  ImageOff,
  Newspaper,
  Plus,
  TrendingUp,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';
import { CountBarChart, RevenueAreaChart, SharePieChart } from '@/components/charts/Charts';
import { Badge, Card, EmptyState, SectionHeader, SeeAllLink, StatTile, toneForStatus } from '@/components/ui/primitives';
import { requirePermission } from '@/lib/auth';
import {
  APPOINTMENT_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  type AppointmentStatus,
  type PaymentStatus,
} from '@/lib/constants';
import { formatDateTime, formatMoney } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { compteursMarketing } from '@/server/marketing';
import { prochainesSessions } from '@/server/sessions';
import { can, type Permission } from '@/lib/rbac';
import { getSettings } from '@/lib/settings';
import {
  getDashboardStats,
  getMonthlyAppointments,
  getMonthlyEnrollments,
  getPaymentBreakdown,
  getRevenueSeries,
  getTopCourses,
} from '@/server/reports';

export const metadata = { title: 'Tableau de bord' };
export const dynamic = 'force-dynamic';

/** Raccourcis vers les formulaires reels du back-office. */
const ACTIONS = [
  { href: '/admin/inscriptions', label: 'Nouvelle inscription', icon: GraduationCap, permission: 'students.manage' },
  { href: '/admin/reservations', label: 'Nouveau rendez-vous', icon: CalendarDays, permission: 'appointments.manage' },
  { href: '/admin/clients', label: 'Nouvelle cliente', icon: UserRound, permission: 'customers.manage' },
  { href: '/admin/eleves', label: 'Nouvel élève', icon: Users, permission: 'students.manage' },
  { href: '/admin/paiements', label: 'Enregistrer un paiement', icon: CreditCard, permission: 'payments.manage' },
  { href: '/admin/certificats', label: 'Créer un certificat', icon: Award, permission: 'certificates.manage' },
] as const;

export default async function AdminDashboardPage() {
  const user = await requirePermission('dashboard.view');
  const prenom = user.fullName.trim().split(/\s+/)[0] || user.fullName;

  const [
    settings,
    stats,
    series,
    topCourses,
    inscriptionsMensuelles,
    rendezVousMensuels,
    repartitionPaiements,
    prochains,
    derniersPaiements,
    sansPhoto,
    marketing,
    sessionsPubliques,
  ] = await Promise.all([
    getSettings(),
    getDashboardStats(),
    getRevenueSeries(30),
    getTopCourses(5),
    getMonthlyEnrollments(),
    getMonthlyAppointments(),
    getPaymentBreakdown(),
    prisma.appointment.findMany({
      where: { scheduledAt: { gte: new Date() }, status: { in: ['EN_ATTENTE', 'CONFIRME'] } },
      include: { customer: { select: { fullName: true } }, service: { select: { name: true } } },
      orderBy: { scheduledAt: 'asc' },
      take: 6,
    }),
    prisma.payment.findMany({
      include: { receipt: { select: { number: true } } },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
    prisma.course.count({ where: { status: { notIn: ['BROUILLON', 'ARCHIVEE'] }, images: { none: {} } } }),
    compteursMarketing(),
    prochainesSessions(50),
  ]);

  const inscriptionsTotal = inscriptionsMensuelles.reduce((s, m) => s + m.value, 0);
  const rendezVousTotal = rendezVousMensuels.reduce((s, m) => s + m.value, 0);
  const aDesRecettes = series.some((s) => s.value > 0);
  const annee = new Date().getFullYear();

  // Chiffres marketing : ils comptent ce qui est REELLEMENT en ligne a cet
  // instant, fenetre de diffusion comprise, et non ce qui porte le statut
  // « publiee ». Les places libres sont recalculees, jamais stockees.
  const sessionsOuvertes = sessionsPubliques.filter((s) => s.etat.inscriptionPossible);
  const placesDisponibles = sessionsOuvertes.reduce((n, s) => n + s.etat.restantes, 0);

  return (
    <div className="space-y-6">
      {/* --------------------------------------------------------- Salutation */}
      <header>
        <h1 className="font-display text-2xl text-cream sm:text-3xl">Bonjour, {prenom} 👋</h1>
        <p className="mt-1 text-sm text-cream-muted">
          Voici un aperçu de l’activité de {settings['shop.name']}.
        </p>
      </header>

      {/* ----------------------------------------------------- Actions rapides */}
      <section>
        <p className="label-eyebrow mb-2">Actions rapides</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {ACTIONS.filter((a) => can(user.role, a.permission as Permission)).map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.href}
                href={a.href}
                className="surface flex flex-col items-center gap-2 p-3 text-center transition hover:border-gold-500/40"
              >
                <span className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gold-500/12 text-gold-300">
                  <Icon size={16} />
                  <Plus size={10} className="absolute -right-0.5 -top-0.5 rounded-full bg-gold-500 text-night-950" />
                </span>
                <span className="text-[11px] leading-tight text-cream-muted">{a.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {sansPhoto > 0 ? (
        <Link
          href="/admin/formations"
          className="flex items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100 transition hover:bg-amber-400/15"
        >
          <ImageOff size={18} className="shrink-0" />
          <span>
            <strong>{sansPhoto} formation(s) sans photo.</strong> Ouvrez la formation puis « Photothèque » pour
            téléverser les vraies photos.
          </span>
        </Link>
      ) : null}

      {/* ------------------------------------------------------ Chiffres clés */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Chiffre d’affaires"
          value={formatMoney(stats.revenueTotal)}
          hint={`Ce mois : ${formatMoney(stats.revenueMonth)}`}
          icon={<TrendingUp size={16} />}
          href="/admin/rapports"
        />
        <StatTile
          label="Inscriptions"
          value={String(inscriptionsTotal)}
          hint={`${stats.activeEnrollments} en cours`}
          icon={<GraduationCap size={16} />}
          href="/admin/inscriptions"
        />
        <StatTile
          label="Rendez-vous"
          value={String(rendezVousTotal)}
          hint={`${stats.appointmentsToday} aujourd’hui`}
          icon={<CalendarDays size={16} />}
          href="/admin/reservations"
        />
        <StatTile
          label="Élèves actifs"
          value={String(stats.students)}
          hint={`${stats.customers} cliente(s)`}
          icon={<Users size={16} />}
          href="/admin/eleves"
        />
        <StatTile label="Recettes du jour" value={formatMoney(stats.revenueToday)} icon={<Wallet size={16} />} />
        <StatTile
          label="Soldes à récupérer"
          value={formatMoney(stats.outstanding)}
          icon={<AlertCircle size={16} />}
          href="/admin/inscriptions"
        />
        <StatTile
          label="Paiements en attente"
          value={String(stats.pendingPaymentsCount)}
          hint={formatMoney(stats.pendingPaymentsAmount)}
          icon={<CreditCard size={16} />}
          href="/admin/paiements"
        />
        <StatTile
          label="Publications en ligne"
          value={String(marketing.publications)}
          hint={`${marketing.bannieres} bannière(s) en ligne`}
          icon={<Newspaper size={16} />}
          href="/admin/publications"
        />
        <StatTile
          label="Sessions ouvertes"
          value={String(sessionsOuvertes.length)}
          hint={`${placesDisponibles} place(s) disponible(s)`}
          icon={<CalendarRange size={16} />}
          href="/admin/sessions"
        />
        <StatTile
          label="Certificats délivrés"
          value={String(stats.certificates)}
          icon={<Award size={16} />}
          href="/admin/certificats"
        />
      </div>

      {/* ---------------------------------------------------------- Graphiques */}
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <SectionHeader
            eyebrow="30 derniers jours"
            title="Évolution du chiffre d’affaires"
            action={<SeeAllLink href="/admin/rapports" label="Rapports" />}
          />
          {aDesRecettes ? (
            <RevenueAreaChart data={series} />
          ) : (
            <p className="py-14 text-center text-sm text-cream-muted">
              Aucun encaissement sur la période. La courbe se remplit dès le premier paiement enregistré.
            </p>
          )}
        </Card>

        <Card>
          <SectionHeader eyebrow="Répartition" title="Paiements" />
          {repartitionPaiements.length === 0 ? (
            <p className="py-14 text-center text-sm text-cream-muted">Aucun paiement enregistré.</p>
          ) : (
            <SharePieChart
              data={repartitionPaiements.map((r) => ({
                label: PAYMENT_STATUS_LABELS[r.label as PaymentStatus] ?? r.label,
                value: r.value,
              }))}
            />
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <SectionHeader eyebrow={String(annee)} title="Inscriptions" />
          {inscriptionsTotal === 0 ? (
            <p className="py-14 text-center text-sm text-cream-muted">Aucune inscription cette année.</p>
          ) : (
            <CountBarChart data={inscriptionsMensuelles} label="Inscriptions" />
          )}
        </Card>

        <Card>
          <SectionHeader eyebrow={String(annee)} title="Rendez-vous" />
          {rendezVousTotal === 0 ? (
            <p className="py-14 text-center text-sm text-cream-muted">Aucun rendez-vous cette année.</p>
          ) : (
            <CountBarChart data={rendezVousMensuels} label="Rendez-vous" />
          )}
        </Card>

        <Card>
          <SectionHeader eyebrow="Classement" title="Formations populaires" />
          {topCourses.length === 0 ? (
            <p className="py-14 text-center text-sm text-cream-muted">Aucune inscription enregistrée.</p>
          ) : (
            <ol className="space-y-2.5">
              {topCourses.map((c, i) => (
                <li key={c.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-cream-muted">
                    <span className="mr-1.5 text-gold-300">{i + 1}.</span>
                    {c.label}
                  </span>
                  <span className="shrink-0 text-gold-300">{c.value}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {/* --------------------------------------------------------- Activité */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionHeader
            eyebrow="À venir"
            title="Prochains rendez-vous"
            action={<SeeAllLink href="/admin/calendrier" label="Calendrier" />}
          />
          {prochains.length === 0 ? (
            <EmptyState title="Aucun rendez-vous à venir" description="Les réservations apparaîtront ici." />
          ) : (
            <ul className="space-y-2">
              {prochains.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-cream">{a.customer.fullName}</p>
                    <p className="truncate text-xs text-cream-muted">
                      {a.service.name} · {formatDateTime(a.scheduledAt)}
                    </p>
                  </div>
                  <Badge tone={toneForStatus(a.status)}>
                    {APPOINTMENT_STATUS_LABELS[a.status as AppointmentStatus] ?? a.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionHeader
            eyebrow="Caisse"
            title="Derniers paiements"
            action={<SeeAllLink href="/admin/paiements" label="Tous" />}
          />
          {derniersPaiements.length === 0 ? (
            <EmptyState title="Aucun paiement" description="Les encaissements apparaîtront ici." />
          ) : (
            <ul className="space-y-2">
              {derniersPaiements.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-cream">{p.label}</p>
                    <p className="text-xs text-cream-muted">
                      {p.reference}
                      {p.receipt ? ` · reçu ${p.receipt.number}` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-gold-300">{formatMoney(p.amount)}</p>
                    <Badge tone={toneForStatus(p.status)}>
                      {PAYMENT_STATUS_LABELS[p.status as PaymentStatus] ?? p.status}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
