import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarRange, Clock, GraduationCap, MapPin, UserRound, Users } from 'lucide-react';
import { Media } from '@/components/ui/primitives';
import { PartageSession } from '@/components/public/PartageSession';
import { FormulaireListeAttente } from '@/components/public/FormulaireListeAttente';
import { periodeLisible } from '@/components/public/SessionCard';
import { formatMoney } from '@/lib/format';
import { appUrl } from '@/lib/qr';
import { sessionParSlug } from '@/server/sessions';

export const dynamic = 'force-dynamic';

/**
 * Metadonnees de partage.
 *
 * Le titre, la periode, le prix et la photo sont repris de la base : le lien
 * partage sur WhatsApp ou Facebook affiche donc les vraies informations, et
 * reste juste si la session evolue.
 */
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const session = await sessionParSlug(params.slug);
  if (!session) return { title: 'Session introuvable' };

  const titre = `S.DESIGN SHOP — Formation ${session.course.name}`;
  const description = `${periodeLisible(session.startDate, session.endDate)} · ${formatMoney(session.prix)} · ${
    session.etat.restantes > 0 ? `${session.etat.restantes} place(s) disponible(s)` : 'Session complète'
  }`;
  const url = appUrl(`/sessions/${session.slug}`);

  return {
    // `absolute` empeche le gabarit du layout d'ajouter « | S.DESIGN SHOP »,
    // que ce titre contient deja.
    title: { absolute: titre },
    description,
    alternates: { canonical: url },
    openGraph: {
      title: titre,
      description,
      url,
      type: 'article',
      siteName: 'S.DESIGN SHOP',
      locale: 'fr_FR',
      ...(session.photo ? { images: [{ url: session.photo, alt: session.course.name }] } : {}),
    },
    twitter: {
      card: session.photo ? 'summary_large_image' : 'summary',
      title: titre,
      description,
      ...(session.photo ? { images: [session.photo] } : {}),
    },
  };
}

const TONS: Record<string, string> = {
  ouvert: 'border-emerald-400/30 bg-emerald-400/15 text-emerald-100',
  tension: 'border-amber-400/30 bg-amber-400/15 text-amber-100',
  ferme: 'border-red-400/30 bg-red-400/15 text-red-100',
  neutre: 'border-white/15 bg-white/10 text-cream-muted',
};

const heure = (d: Date) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const dateComplete = (d: Date) =>
  d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export default async function SessionPage({ params }: { params: { slug: string } }) {
  const session = await sessionParSlug(params.slug);
  if (!session) notFound();

  const { etat } = session;
  const jours = Math.max(
    1,
    Math.ceil((session.endDate.getTime() - session.startDate.getTime()) / 86400000),
  );

  return (
    <div className="container-page py-8 sm:py-12">
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-xs text-cream-dim">
        <Link href="/calendrier-formations" className="hover:text-gold-300">
          Calendrier des formations
        </Link>
        <span>›</span>
        <Link href={`/formations/${session.course.slug}`} className="hover:text-gold-300">
          {session.course.name}
        </Link>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr]">
        {/* Visuel et description */}
        <div>
          <div className="relative">
            <Media src={session.photo} alt={session.course.name} ratio="aspect-[4/3]" label={session.course.name} />
            <span className={`chip absolute left-4 top-4 backdrop-blur ${TONS[etat.pastille.ton]}`}>
              {etat.pastille.texte}
            </span>
          </div>

          {session.description ? (
            <div className="mt-6">
              <h2 className="mb-2 font-display text-lg text-cream">À propos de cette session</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-cream-muted">{session.description}</p>
            </div>
          ) : null}

          <div className="mt-6">
            <h2 className="mb-2 font-display text-lg text-cream">La formation</h2>
            <p className="text-sm leading-relaxed text-cream-muted">{session.course.shortDescription}</p>
            <Link href={`/formations/${session.course.slug}`} className="btn-outline mt-4 px-4 py-2 text-xs">
              Voir le programme complet
            </Link>
          </div>
        </div>

        {/* Informations pratiques et actions */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="surface p-5 sm:p-6">
            <p className="label-eyebrow mb-1">{session.course.name}</p>
            <h1 className="mb-1 font-display text-2xl leading-tight text-cream sm:text-3xl">{session.title}</h1>
            <p className="mb-5 font-display text-3xl text-gold-300">{formatMoney(session.prix)}</p>

            <dl className="mb-5 space-y-3 text-sm">
              <div className="flex gap-3">
                <CalendarRange size={16} className="mt-0.5 shrink-0 text-gold-300" />
                <div>
                  <dt className="text-cream">{periodeLisible(session.startDate, session.endDate)}</dt>
                  <dd className="text-xs text-cream-dim">
                    Du {dateComplete(session.startDate)} au {dateComplete(session.endDate)}
                  </dd>
                </div>
              </div>
              <div className="flex gap-3">
                <Clock size={16} className="mt-0.5 shrink-0 text-gold-300" />
                <div>
                  <dt className="text-cream">
                    {heure(session.startDate)} — {heure(session.endDate)}
                  </dt>
                  <dd className="text-xs text-cream-dim">
                    {jours} jour{jours > 1 ? 's' : ''} · {session.course.durationLabel}
                  </dd>
                </div>
              </div>
              {session.location ? (
                <div className="flex gap-3">
                  <MapPin size={16} className="mt-0.5 shrink-0 text-gold-300" />
                  <dt className="text-cream">{session.location}</dt>
                </div>
              ) : null}
              {session.trainer ? (
                <div className="flex gap-3">
                  <UserRound size={16} className="mt-0.5 shrink-0 text-gold-300" />
                  <dt className="text-cream">{session.trainer.fullName}</dt>
                </div>
              ) : null}
              <div className="flex gap-3">
                <Users size={16} className="mt-0.5 shrink-0 text-gold-300" />
                <div>
                  <dt className="text-cream">
                    {etat.occupees} / {etat.capacite} places
                  </dt>
                  <dd
                    className={`text-xs ${etat.restantes === 0 ? 'text-red-200' : etat.presqueComplete ? 'text-amber-200' : 'text-emerald-200'}`}
                  >
                    {etat.restantes === 0
                      ? 'Aucune place disponible'
                      : `${etat.restantes} place${etat.restantes > 1 ? 's' : ''} restante${etat.restantes > 1 ? 's' : ''}`}
                  </dd>
                </div>
              </div>
              {session.registrationDeadline ? (
                <div className="flex gap-3">
                  <GraduationCap size={16} className="mt-0.5 shrink-0 text-gold-300" />
                  <div>
                    <dt className="text-cream">Inscriptions jusqu’au {dateComplete(session.registrationDeadline)}</dt>
                  </div>
                </div>
              ) : null}
            </dl>

            {/* Barre de remplissage */}
            <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full ${etat.restantes === 0 ? 'bg-red-400' : etat.presqueComplete ? 'bg-amber-400' : 'bg-emerald-400'}`}
                style={{ width: `${etat.complete}%` }}
              />
            </div>

            {etat.inscriptionPossible ? (
              <Link
                href={`/formations/${session.course.slug}/inscription?session=${session.slug}`}
                className="btn-gold w-full justify-center"
              >
                S’inscrire à cette session
              </Link>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
                <p className="mb-1 font-display text-base text-cream">{etat.raisonRefus}</p>
                <p className="text-xs text-cream-dim">
                  Laissez vos coordonnées : nous vous préviendrons dès qu’une place se libère ou qu’une nouvelle
                  session est programmée.
                </p>
              </div>
            )}

            <div className="mt-4">
              <PartageSession
                url={appUrl(`/sessions/${session.slug}`)}
                titre={`Formation ${session.course.name} — S.DESIGN SHOP`}
                texte={`${periodeLisible(session.startDate, session.endDate)} · ${formatMoney(session.prix)}`}
              />
            </div>
          </div>

          {!etat.inscriptionPossible ? (
            <div className="surface mt-4 p-5 sm:p-6">
              <h2 className="mb-1 font-display text-lg text-cream">Être informée</h2>
              <p className="mb-4 text-xs text-cream-muted">
                Aucune place n’est réservée par cette demande : vous confirmerez vous-même votre inscription.
              </p>
              <FormulaireListeAttente sessionId={session.id} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
