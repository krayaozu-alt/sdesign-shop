/** Crochets de resolution — voir `chargeur-src.mjs`. */
import { existsSync, statSync } from 'node:fs';
import { dirname, resolve as resoudreChemin } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RACINE = resoudreChemin(dirname(fileURLToPath(import.meta.url)), '..');
const EXTENSIONS = ['', '.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.tsx', '/index.js'];

/** Un dossier porte parfois le meme nom qu'un module : seul un fichier convient. */
const estFichier = (chemin) => existsSync(chemin) && statSync(chemin).isFile();

/** `server-only` et `client-only` ne servent qu'a Next : ils deviennent vides. */
const NEUTRALISES = new Set(['server-only', 'client-only']);
const VIDE = pathToFileURL(resoudreChemin(RACINE, 'scripts', 'module-vide.mjs')).href;

export async function resolve(specifier, context, next) {
  if (NEUTRALISES.has(specifier)) return { url: VIDE, shortCircuit: true, format: 'module' };

  if (specifier.startsWith('@/')) {
    const base = resoudreChemin(RACINE, 'src', specifier.slice(2));
    for (const ext of EXTENSIONS) {
      const candidat = base + ext;
      if (estFichier(candidat)) return { url: pathToFileURL(candidat).href, shortCircuit: true };
    }
    throw new Error(`Alias non resolu : ${specifier}`);
  }

  // Import relatif sans extension depuis un fichier .ts (usage TypeScript).
  if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
    const base = resoudreChemin(dirname(fileURLToPath(context.parentURL)), specifier);
    if (!estFichier(base)) {
      for (const ext of EXTENSIONS.slice(1)) {
        const candidat = base + ext;
        if (estFichier(candidat)) return { url: pathToFileURL(candidat).href, shortCircuit: true };
      }
    }
  }

  return next(specifier, context);
}
