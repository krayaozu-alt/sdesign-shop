import Link from 'next/link';
import { CalendarRange, MapPin, Users } from 'lucide-react';
import { Media } from '@/components/ui/primitives';
import { formatMoney } from '@/lib/format';

/**
 * Carte d'une session de formation.
 *
 * Elle sert a la fois sur l'accueil, dans le calendrier public et dans
 * l'espace cliente : un seul composant, donc un seul rendu des places et du
 * statut. Les valeurs affichees viennent toutes du calcul centralise
 * (`etatSession`) — aucune n'est recalculee ici.
 */

export type SessionCardData = {
  slug: string;
  titre: string;
  formationNom: string;
  formationSlug: string;
  photo: string | null;
  debut: Date;
  fin: Date;
  lieu: string | null;
  prix: number;
  etat: {
    restantes: number;
    capacite: number;
    inscriptionPossible: boolean;
    pastille: { texte: string; ton: 'ouvert' | 'tension' | 'ferme' | 'neutre' };
  };
};

/** Couleurs de pastille, alignees sur les indicateurs demandes. */
const TONS: Record<SessionCardData['etat']['pastille']['ton'], string> = {
  ouvert: 'border-emerald-400/30 bg-emerald-400/15 text-emerald-100',
  tension: 'border-amber-400/30 bg-amber-400/15 text-amber-100',
  ferme: 'border-red-400/30 bg-red-400/15 text-red-100',
  neutre: 'border-white/15 bg-white/10 text-cream-muted',
};

/** « 8 → 15 septembre » ; « 28 sept. → 3 oct. » lorsque le mois change. */
export function periodeLisible(debut: Date, fin: Date): string {
  const memeMois = debut.getMonth() === fin.getMonth() && debut.getFullYear() === fin.getFullYear();
  const jour = (d: Date) => d.getDate();
  const mois = (d: Date) => d.toLocaleDateString('fr-FR', { month: memeMois ? 'long' : 'short' });
  return memeMois
    ? `${jour(debut)} → ${jour(fin)} ${mois(fin)}`
    : `${jour(debut)} ${mois(debut)} → ${jour(fin)} ${mois(fin)}`;
}

export function SessionCard({ session, compact = false }: { session: SessionCardData; compact?: boolean }) {
  const { etat } = session;

  return (
    <article className="surface group flex flex-col overflow-hidden p-0 transition-transform duration-300 hover:-translate-y-1 hover:shadow-lift">
      <Link href={`/sessions/${session.slug}`} className="relative block">
        <Media
          src={session.photo}
          alt={session.formationNom}
          ratio={compact ? 'aspect-[16/9]' : 'aspect-[4/3]'}
          label={session.formationNom}
        />
        <span className={`chip absolute left-3 top-3 backdrop-blur ${TONS[etat.pastille.ton]}`}>
          {etat.pastille.texte}
        </span>
        <span className="absolute bottom-3 left-3 rounded-full bg-gold-400/95 px-3 py-1 font-display text-sm font-semibold text-plum-900">
          {formatMoney(session.prix)}
        </span>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <p className="label-eyebrow mb-1">{session.formationNom}</p>
        <h3 className="mb-2 font-display text-lg leading-snug text-cream">
          <Link href={`/sessions/${session.slug}`} className="hover:text-gold-200">
            {session.titre}
          </Link>
        </h3>

        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <span className="chip">
            <CalendarRange size={12} /> {periodeLisible(session.debut, session.fin)}
          </span>
          {session.lieu ? (
            <span className="chip">
              <MapPin size={12} /> {session.lieu}
            </span>
          ) : null}
          <span className={`chip ${etat.restantes === 0 ? 'text-red-200' : etat.restantes <= 3 ? 'text-amber-200' : 'text-emerald-200'}`}>
            <Users size={12} />
            {etat.restantes === 0
              ? 'Complet'
              : `${etat.restantes} place${etat.restantes > 1 ? 's' : ''} disponible${etat.restantes > 1 ? 's' : ''}`}
          </span>
        </div>

        <div className="mt-auto grid gap-2 sm:grid-cols-2">
          <Link href={`/formations/${session.formationSlug}`} className="btn-outline justify-center px-3 py-2 text-xs">
            Voir la formation
          </Link>
          {etat.inscriptionPossible ? (
            <Link
              href={`/formations/${session.formationSlug}/inscription?session=${session.slug}`}
              className="btn-gold justify-center px-3 py-2 text-xs"
            >
              S’inscrire
            </Link>
          ) : (
            <Link href={`/sessions/${session.slug}`} className="btn-ghost justify-center px-3 py-2 text-xs">
              {etat.restantes === 0 ? 'Être informée' : 'En savoir plus'}
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

/** Conversion depuis les objets renvoyes par `src/server/sessions.ts`. */
export function versCarte(s: {
  slug: string;
  title: string;
  startDate: Date;
  endDate: Date;
  location: string | null;
  prix: number;
  photo: string | null;
  course: { name: string; slug: string };
  etat: SessionCardData['etat'];
}): SessionCardData {
  return {
    slug: s.slug,
    titre: s.title,
    formationNom: s.course.name,
    formationSlug: s.course.slug,
    photo: s.photo,
    debut: s.startDate,
    fin: s.endDate,
    lieu: s.location,
    prix: s.prix,
    etat: s.etat,
  };
}
