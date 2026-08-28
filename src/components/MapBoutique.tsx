import { ExternalLink, MapPin, Navigation } from 'lucide-react';
import { ShareLocationButton } from '@/components/ShareLocationButton';
import { mapDirectionsUrl, mapEmbedUrl, mapLinkUrl, type Coordonnees } from '@/lib/settings-schema';
import { cn } from '@/lib/utils';

/**
 * Carte interactive de la boutique.
 * La position provient exclusivement des parametres (Admin > Parametres >
 * Localisation) : aucune coordonnee n'est ecrite en dur ici.
 */
export function MapBoutique({
  coordonnees,
  nom,
  adresse,
  hauteur = 'h-[300px] sm:h-[420px]',
  className,
}: {
  coordonnees: Coordonnees;
  nom: string;
  adresse: string;
  hauteur?: string;
  className?: string;
}) {
  return (
    <div className={cn('overflow-hidden', className)}>
      <iframe
        title={`Localisation de ${nom}`}
        src={mapEmbedUrl(coordonnees)}
        className={cn('w-full rounded-card border-0', hauteur)}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />

      {/* Marqueur textuel : le nom de la boutique reste lisible meme si la
          carte ne se charge pas (connexion coupee). */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="chip border-gold-500/30 text-gold-200">
          <MapPin size={12} /> {nom}
        </span>
        <span className="text-xs text-cream-dim">{adresse}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={mapDirectionsUrl(coordonnees)}
          target="_blank"
          rel="noreferrer"
          className="btn-gold px-5 py-2.5 text-xs"
        >
          <Navigation size={14} /> Voir l’itinéraire
        </a>
        <a
          href={mapLinkUrl(coordonnees)}
          target="_blank"
          rel="noreferrer"
          className="btn-ghost px-4 py-2.5 text-xs"
        >
          <ExternalLink size={14} /> Ouvrir dans Google Maps
        </a>
        <ShareLocationButton url={mapLinkUrl(coordonnees)} nom={nom} adresse={adresse} />
      </div>
    </div>
  );
}
