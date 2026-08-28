import Link from 'next/link';
import { CalendarRange, MapPin, Plus, Search, Trash2, Users } from 'lucide-react';
import type { Prisma } from '@prisma/client';
import { SessionForm } from '@/components/admin/CatalogForms';
import { Card, EmptyState } from '@/components/ui/primitives';
import { Disclosure } from '@/components/ui/Disclosure';
import { formatDateShort, formatMoney } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { contient } from '@/lib/db-search';
import { requirePermission } from '@/lib/auth';
import { SESSION_STATUS_LABELS, SESSION_STATUS_VALUES, type SessionStatus } from '@/lib/constants';
import { deleteSessionAction } from '@/server/actions/catalog';
import { etatSession, filtreInscriptionsOccupantes, prixSession } from '@/server/sessions';

export const metadata = { title: 'Sessions de formation' };
export const dynamic = 'force-dynamic';

/** Filtres de période, appliqués sur la date de début. */
const PERIODES = [
  { cle: '', libelle: 'Toutes' },
  { cle: 'a-venir', libelle: 'À venir' },
  { cle: 'semaine', libelle: 'Cette semaine' },
  { cle: 'mois', libelle: 'Ce mois' },
  { cle: 'passees', libelle: 'Passées' },
] as const;

function filtrePeriode(cle: string): Prisma.CourseSessionWhereInput {
  const maintenant = new Date();
  const finJournee = new Date(maintenant);
  finJournee.setHours(23, 59, 59, 999);

  switch (cle) {
    case 'a-venir':
      return { endDate: { gte: maintenant } };
    case 'semaine': {
      const fin = new Date(finJournee);
      fin.setDate(fin.getDate() + 7);
      return { startDate: { gte: maintenant, lte: fin } };
    }
    case 'mois': {
      const fin = new Date(maintenant.getFullYear(), maintenant.getMonth() + 1, 0, 23, 59, 59);
      return { startDate: { gte: maintenant, lte: fin } };
    }
    case 'passees':
      return { endDate: { lt: maintenant } };
    default:
      return {};
  }
}

const TONS: Record<string, string> = {
  ouvert: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  tension: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  ferme: 'border-red-400/30 bg-red-400/10 text-red-200',
  neutre: 'chip',
};

export default async function AdminSessionsPage({
  searchParams,
}: {
  searchParams: { q?: string; statut?: string; formation?: string; formateur?: string; periode?: string };
}) {
  await requirePermission('sessions.manage');

  const q = (searchParams.q ?? '').trim();
  const statut = searchParams.statut ?? '';
  const formationFiltre = searchParams.formation ?? '';
  const formateurFiltre = searchParams.formateur ?? '';
  const periode = searchParams.periode ?? '';

  const where: Prisma.CourseSessionWhereInput = {
    AND: [
      q ? { OR: [{ title: contient(q) }, { location: contient(q) }, { course: { name: contient(q) } }] } : {},
      statut ? { status: statut } : {},
      formationFiltre ? { courseId: formationFiltre } : {},
      formateurFiltre ? { trainerId: formateurFiltre } : {},
      filtrePeriode(periode),
    ],
  };

  const [sessions, formations, formateurs] = await Promise.all([
    prisma.courseSession.findMany({
      where,
      orderBy: { startDate: 'desc' },
      take: 200,
      include: {
        course: { select: { id: true, name: true, slug: true, price: true, imageUrl: true } },
        trainer: { select: { id: true, fullName: true } },
        _count: { select: { enrollments: { where: filtreInscriptionsOccupantes }, waitlist: true } },
      },
    }),
    prisma.course.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, price: true } }),
    prisma.trainer.findMany({ where: { isActive: true }, orderBy: { fullName: 'asc' }, select: { id: true, fullName: true } }),
  ]);

  const prixFormations = Object.fromEntries(formations.map((f) => [f.id, f.price]));
  const enrichies = sessions.map((s) => ({
    ...s,
    etat: etatSession(s, s._count.enrollments),
    prix: prixSession(s, s.course),
  }));

  // Synthèse, calculée sur les sessions affichées.
  const ouvertes = enrichies.filter((s) => s.etat.inscriptionPossible).length;
  const placesLibres = enrichies.filter((s) => s.etat.visiblePublic).reduce((n, s) => n + s.etat.restantes, 0);
  const placesPrises = enrichies.filter((s) => s.etat.visiblePublic).reduce((n, s) => n + s.etat.occupees, 0);

  const lien = (modif: Record<string, string>) => {
    const p = new URLSearchParams();
    const base = { q, statut, formation: formationFiltre, formateur: formateurFiltre, periode, ...modif };
    for (const [k, v] of Object.entries(base)) if (v) p.set(k, v);
    return p.toString() ? `/admin/sessions?${p}` : '/admin/sessions';
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-eyebrow mb-1">Formations</p>
          <h1 className="section-title">Sessions de formation</h1>
          <p className="mt-2 max-w-2xl text-sm text-cream-muted">
            Une formation est permanente ; une session est une période réelle. Une même formation peut en avoir
            plusieurs.
          </p>
        </div>
        <form method="get" className="relative">
          {statut ? <input type="hidden" name="statut" value={statut} /> : null}
          {periode ? <input type="hidden" name="periode" value={periode} /> : null}
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cream-dim" />
          <input name="q" defaultValue={q} placeholder="Formation, intitulé, lieu…" className="w-64 pl-9" />
        </form>
      </div>

      {/* Synthèse */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-cream-dim">Sessions ouvertes aux inscriptions</p>
          <p className="mt-1 font-display text-2xl text-gold-300">{ouvertes}</p>
        </Card>
        <Card>
          <p className="text-xs text-cream-dim">Places encore disponibles</p>
          <p className="mt-1 font-display text-2xl text-cream">{placesLibres}</p>
        </Card>
        <Card>
          <p className="text-xs text-cream-dim">Places occupées</p>
          <p className="mt-1 font-display text-2xl text-cream">{placesPrises}</p>
        </Card>
      </div>

      <Disclosure label={<><Plus size={15} /> Nouvelle session</>}>
        <SessionForm formations={formations} formateurs={formateurs} prixFormations={prixFormations} />
      </Disclosure>

      {/* Filtres */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {PERIODES.map((p) => (
            <Link key={p.cle || 'toutes'} href={lien({ periode: p.cle })} className={periode === p.cle ? 'btn-gold px-4 py-2 text-xs' : 'chip'}>
              {p.libelle}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={lien({ statut: '' })} className={statut === '' ? 'btn-gold px-4 py-2 text-xs' : 'chip'}>
            Tous les statuts
          </Link>
          {SESSION_STATUS_VALUES.map((s) => (
            <Link key={s} href={lien({ statut: s })} className={statut === s ? 'btn-gold px-4 py-2 text-xs' : 'chip'}>
              {SESSION_STATUS_LABELS[s as SessionStatus]}
            </Link>
          ))}
        </div>
        {formations.length ? (
          <div className="flex flex-wrap gap-2">
            <Link href={lien({ formation: '' })} className={formationFiltre === '' ? 'btn-gold px-4 py-2 text-xs' : 'chip'}>
              Toutes les formations
            </Link>
            {formations.map((f) => (
              <Link key={f.id} href={lien({ formation: f.id })} className={formationFiltre === f.id ? 'btn-gold px-4 py-2 text-xs' : 'chip'}>
                {f.name}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      {enrichies.length === 0 ? (
        <EmptyState
          title="Aucune session"
          description="Créez une session pour ouvrir les inscriptions à une période précise."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {enrichies.map((s) => (
            <Card key={s.id}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-display text-lg text-cream">{s.course.name}</p>
                  <p className="text-sm text-cream-muted">{s.title}</p>
                </div>
                <span className={`chip shrink-0 ${TONS[s.etat.pastille.ton] ?? ''}`}>{s.etat.pastille.texte}</span>
              </div>

              <div className="mb-3 flex flex-wrap gap-2 text-xs">
                <span className="chip">
                  <CalendarRange size={12} /> {formatDateShort(s.startDate)} → {formatDateShort(s.endDate)}
                </span>
                {s.location ? (
                  <span className="chip">
                    <MapPin size={12} /> {s.location}
                  </span>
                ) : null}
                {s.trainer ? <span className="chip">{s.trainer.fullName}</span> : null}
                <span className="chip text-gold-300">
                  {formatMoney(s.prix)}
                  {s.price !== null ? ' · prix propre' : ' · prix officiel'}
                </span>
              </div>

              {/* Places — jamais codées en dur, toujours recalculées */}
              <div className="mb-3">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-cream-muted">
                    <Users size={12} className="mr-1 inline" />
                    {s.etat.occupees} / {s.etat.capacite} places
                  </span>
                  <span className={s.etat.restantes === 0 ? 'text-red-200' : s.etat.presqueComplete ? 'text-amber-200' : 'text-emerald-200'}>
                    {s.etat.restantes} restante{s.etat.restantes > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full ${s.etat.restantes === 0 ? 'bg-red-400' : s.etat.presqueComplete ? 'bg-amber-400' : 'bg-emerald-400'}`}
                    style={{ width: `${s.etat.complete}%` }}
                  />
                </div>
                {s._count.waitlist > 0 ? (
                  <p className="mt-2 text-xs text-amber-200">{s._count.waitlist} personne(s) en liste d’attente</p>
                ) : null}
              </div>

              {!s.etat.inscriptionPossible && s.etat.raisonRefus ? (
                <p className="mb-3 text-xs text-cream-dim">{s.etat.raisonRefus}</p>
              ) : null}

              <div className="space-y-2">
                <Disclosure variant="row" label="Modifier la session">
                  <SessionForm
                    session={{
                      id: s.id,
                      courseId: s.courseId,
                      title: s.title,
                      startDate: s.startDate.toISOString().slice(0, 10),
                      startTime: s.startDate.toISOString().slice(11, 16),
                      endDate: s.endDate.toISOString().slice(0, 10),
                      endTime: s.endDate.toISOString().slice(11, 16),
                      registrationDeadline: s.registrationDeadline?.toISOString().slice(0, 10) ?? '',
                      location: s.location ?? '',
                      capacity: s.capacity,
                      price: s.price === null ? '' : String(s.price),
                      trainerId: s.trainerId ?? '',
                      status: s.status,
                      description: s.description ?? '',
                      imageUrl: s.imageUrl,
                    }}
                    formations={formations}
                    formateurs={formateurs}
                    prixFormations={prixFormations}
                  />
                </Disclosure>
                <form action={deleteSessionAction}>
                  <input type="hidden" name="id" value={s.id} />
                  <button type="submit" className="btn-danger w-full px-3 py-2 text-xs">
                    <Trash2 size={13} /> {s._count.enrollments > 0 ? 'Annuler la session' : 'Supprimer'}
                  </button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
