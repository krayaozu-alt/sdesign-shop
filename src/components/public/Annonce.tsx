import Link from 'next/link';
import { CalendarRange, MessageCircle, Users } from 'lucide-react';
import { Media } from '@/components/ui/primitives';
import { periodeLisible } from '@/components/public/SessionCard';
import { formatMoney } from '@/lib/format';

/**
 * Rendu d'une annonce — publication ou banniere.
 *
 * Ce composant sert a la fois au site public ET a l'apercu de
 * l'administration : l'administrateur voit donc exactement ce que verra la
 * cliente, sans qu'aucun second rendu ne puisse diverger.
 *
 * Les dates, le prix et les places ne sont jamais saisis : ils viennent de la
 * session liee, relus a chaque affichage.
 */

export type AnnonceData = {
  titre: string;
  sousTitre: string | null;
  texte: string | null;
  photo: string | null;
  prix: number | null;
  lien: string | null;
  libelleBouton: string;
  formationNom: string | null;
  periode: { debut: Date; fin: Date } | null;
  places: { restantes: number; pastille: { texte: string; ton: 'ouvert' | 'tension' | 'ferme' | 'neutre' } } | null;
};

const TONS: Record<string, string> = {
  ouvert: 'border-emerald-400/30 bg-emerald-400/15 text-emerald-100',
  tension: 'border-amber-400/30 bg-amber-400/15 text-amber-100',
  ferme: 'border-red-400/30 bg-red-400/15 text-red-100',
  neutre: 'border-white/15 bg-white/10 text-cream-muted',
};

/** Un lien WhatsApp s'ouvre dans un nouvel onglet, pas les liens internes. */
function BoutonAnnonce({ lien, libelle }: { lien: string; libelle: string }) {
  const externe = /^https?:\/\//i.test(lien);
  if (externe) {
    return (
      <a href={lien} target="_blank" rel="noreferrer" className="btn-gold px-5 py-2.5 text-sm">
        {/wa\.me|whatsapp/i.test(lien) ? <MessageCircle size={15} /> : null}
        {libelle}
      </a>
    );
  }
  return (
    <Link href={lien} className="btn-gold px-5 py-2.5 text-sm">
      {libelle}
    </Link>
  );
}

/** Format large : bandeau d'en-tête ou mise en avant « À la une ». */
export function AnnonceLarge({ annonce, etiquette }: { annonce: AnnonceData; etiquette?: string }) {
  return (
    <article className="surface overflow-hidden p-0 md:grid md:grid-cols-[1fr_1.1fr]">
      <div className="relative">
        <Media
          src={annonce.photo}
          alt={annonce.titre}
          ratio="aspect-[16/10] md:aspect-auto md:h-full"
          label={annonce.formationNom ?? annonce.titre}
        />
        {etiquette ? (
          <span className="chip absolute left-4 top-4 border-gold-400/40 bg-plum-950/80 text-gold-200 backdrop-blur">
            {etiquette}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col justify-center p-6 sm:p-8">
        {annonce.sousTitre ? <p className="label-eyebrow mb-2">{annonce.sousTitre}</p> : null}
        <h2 className="mb-2 font-display text-2xl leading-tight text-cream sm:text-3xl">{annonce.titre}</h2>

        {annonce.formationNom && annonce.formationNom !== annonce.titre ? (
          <p className="mb-3 text-sm text-cream-muted">{annonce.formationNom}</p>
        ) : null}

        {annonce.texte ? (
          <p className="mb-4 whitespace-pre-line text-sm leading-relaxed text-cream-muted">{annonce.texte}</p>
        ) : null}

        {/* Donnees vivantes : jamais recopiees dans le texte de l'annonce */}
        <div className="mb-5 flex flex-wrap gap-2 text-xs">
          {annonce.periode ? (
            <span className="chip">
              <CalendarRange size={12} /> {periodeLisible(annonce.periode.debut, annonce.periode.fin)}
            </span>
          ) : null}
          {annonce.prix !== null ? <span className="chip text-gold-300">{formatMoney(annonce.prix)}</span> : null}
          {annonce.places ? (
            <span className={`chip ${TONS[annonce.places.pastille.ton]}`}>
              <Users size={12} />
              {annonce.places.restantes === 0
                ? 'Complet'
                : `${annonce.places.restantes} place${annonce.places.restantes > 1 ? 's' : ''} disponible${annonce.places.restantes > 1 ? 's' : ''}`}
            </span>
          ) : null}
        </div>

        {annonce.lien ? (
          <div className="flex flex-wrap gap-3">
            <BoutonAnnonce lien={annonce.lien} libelle={annonce.libelleBouton} />
          </div>
        ) : null}
      </div>
    </article>
  );
}

/** Format carte : listes de publications. */
export function AnnonceCarte({ annonce }: { annonce: AnnonceData }) {
  return (
    <article className="surface flex flex-col overflow-hidden p-0">
      <Media
        src={annonce.photo}
        alt={annonce.titre}
        ratio="aspect-[16/9]"
        label={annonce.formationNom ?? annonce.titre}
      />
      <div className="flex flex-1 flex-col p-4">
        {annonce.sousTitre ? <p className="label-eyebrow mb-1">{annonce.sousTitre}</p> : null}
        <h3 className="mb-2 font-display text-lg leading-snug text-cream">{annonce.titre}</h3>
        {annonce.texte ? (
          <p className="mb-3 line-clamp-3 whitespace-pre-line text-sm text-cream-muted">{annonce.texte}</p>
        ) : null}

        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          {annonce.periode ? (
            <span className="chip">
              <CalendarRange size={11} /> {periodeLisible(annonce.periode.debut, annonce.periode.fin)}
            </span>
          ) : null}
          {annonce.prix !== null ? <span className="chip text-gold-300">{formatMoney(annonce.prix)}</span> : null}
          {annonce.places ? (
            <span className={`chip ${TONS[annonce.places.pastille.ton]}`}>{annonce.places.pastille.texte}</span>
          ) : null}
        </div>

        {annonce.lien ? (
          <div className="mt-auto">
            <BoutonAnnonce lien={annonce.lien} libelle={annonce.libelleBouton} />
          </div>
        ) : null}
      </div>
    </article>
  );
}

/** Conversion depuis les objets de `src/server/marketing.ts`. */
export function versAnnonce(x: {
  title: string;
  subtitle?: string | null;
  body?: string | null;
  description?: string | null;
  photo: string | null;
  prix: number | null;
  lien: string | null;
  libelleBouton: string;
  formationNom: string | null;
  sessionPeriode: { debut: Date; fin: Date } | null;
  sessionEtat: { restantes: number; pastille: { texte: string; ton: 'ouvert' | 'tension' | 'ferme' | 'neutre' } } | null;
}): AnnonceData {
  return {
    titre: x.title,
    sousTitre: x.subtitle ?? null,
    texte: x.body ?? x.description ?? null,
    photo: x.photo,
    prix: x.prix,
    lien: x.lien,
    libelleBouton: x.libelleBouton,
    formationNom: x.formationNom,
    periode: x.sessionPeriode,
    places: x.sessionEtat,
  };
}
