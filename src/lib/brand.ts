/**
 * Resolution du logo officiel S.DESIGN SHOP.
 *
 * Ordre de priorite :
 *   1. le logo televerse depuis Admin > Parametres (reglage « shop.logoUrl »),
 *      qui pointe vers le disque local en developpement et vers Cloudflare R2
 *      en production ;
 *   2. la variable d'environnement BRAND_LOGO_URL, utile pour figer un logo
 *      sans passer par la base ;
 *   3. null -> l'interface affiche le logotype typographique de secours.
 *
 * Aucun acces disque : ce module doit fonctionner a l'identique sous Node,
 * sur un runtime edge et sur Cloudflare Workers, ou `node:fs` n'existe pas.
 *
 * Le logo officiel porte deja sa signature (« Creation | Formation | Elegance ») :
 * lorsqu'une image est utilisee, l'interface n'ajoute pas de baseline en dessous.
 */

export function getProjectLogo(): string | null {
  const url = process.env.BRAND_LOGO_URL?.trim();
  return url ? url : null;
}

/** Logo a afficher : reglage televerse, sinon variable d'environnement, sinon null. */
export function resolveLogo(settingsLogoUrl: string | null | undefined): string | null {
  return settingsLogoUrl?.trim() ? settingsLogoUrl : getProjectLogo();
}
