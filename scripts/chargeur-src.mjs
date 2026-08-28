/**
 * Chargeur de modules pour les bancs d'essai.
 *
 * Permet a un script Node d'importer le VRAI code du site plutot que d'en
 * reecrire une copie — une copie qui pourrait passer les tests alors que le
 * site, lui, echouerait. Deux obstacles a lever :
 *
 *   1. l'alias `@/...`, connu de TypeScript et de Next mais pas de Node ;
 *   2. `server-only`, dont le seul role est de lever une erreur des qu'il est
 *      charge hors d'un composant serveur React. Il est neutralise ici.
 *
 * Node 24 sait lire les fichiers .ts directement : aucune compilation.
 *
 *   node --env-file=.env --import ./scripts/chargeur-src.mjs mon-script.mjs
 */
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register(new URL('./chargeur-src-hook.mjs', import.meta.url), pathToFileURL('./'));
