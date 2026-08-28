import type { MetadataRoute } from 'next';
import { appUrl } from '@/lib/qr';

/**
 * Regles d'indexation.
 *
 * Le principe est inverse de la liste blanche : tout le site public est
 * indexable, et l'on nomme explicitement les zones qui ne doivent jamais
 * apparaitre dans un moteur de recherche.
 *
 * Trois familles y figurent :
 *
 * - le back-office et l'espace personnel, qui exigent une session ;
 * - le parcours d'authentification (connexion, creation de compte, mots de
 *   passe, verification) : ces pages n'ont aucune valeur de recherche et leur
 *   indexation exposerait inutilement la surface d'authentification ;
 * - les documents nominatifs — recus et certificats — dont l'URL contient un
 *   numero. Ils restent accessibles a qui detient le lien (c'est le principe de
 *   la verification d'un certificat), mais ils ne doivent surtout pas etre
 *   moissonnes : ce sont des donnees personnelles.
 *
 * `/verifier` reste indexable : c'est le formulaire public de verification,
 * sans donnee nominative. Seul `/verifier/<code>` est ecarte.
 */
const ZONES_PRIVEES = [
  '/admin',
  '/espace',
  '/espace-client',
  '/connexion',
  '/creer-compte',
  '/mot-de-passe-oublie',
  '/reinitialiser-mot-de-passe',
  '/verification',
  '/acces-refuse',
  '/certificat/',
  '/recu/',
  '/verifier/',
  '/api/',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ZONES_PRIVEES.map((chemin) => `${chemin}${chemin.endsWith('/') ? '' : '/'}`),
    },
    sitemap: appUrl('/sitemap.xml'),
    host: appUrl('/').replace(/\/$/, ''),
  };
}
