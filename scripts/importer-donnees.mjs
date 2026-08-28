/**
 * Import des donnees exportees, vers la base PostgreSQL.
 *
 * A executer APRES `prisma migrate deploy` sur la base PostgreSQL vide.
 * Reprend le fichier produit par `scripts/exporter-donnees.mjs`, dans l'ordre
 * de dependance, sans jamais supprimer quoi que ce soit.
 *
 *   node --env-file=.env scripts/importer-donnees.mjs sauvegardes/donnees-….json
 *   node --env-file=.env scripts/importer-donnees.mjs sauvegardes/donnees-….json --appliquer
 *
 * Le script refuse d'ecrire dans une base qui contient deja des donnees, sauf
 * --forcer : c'est la protection contre un double import qui creerait des
 * doublons de formations et de prestations.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const arguments_ = process.argv.slice(2);
const APPLIQUER = arguments_.includes('--appliquer');
const FORCER = arguments_.includes('--forcer');
const fichier = arguments_.find((a) => !a.startsWith('--'));

if (!fichier) {
  console.error('Usage : node --env-file=.env scripts/importer-donnees.mjs <fichier.json> [--appliquer]');
  process.exit(1);
}

const prisma = new PrismaClient();
const url = process.env.DATABASE_URL ?? '';

console.log(APPLIQUER ? '=== IMPORT DES DONNEES ===\n' : '=== SIMULATION (aucune ecriture) ===\n');
console.log(`Fichier : ${path.relative(process.cwd(), fichier)}`);
console.log(`Cible   : ${/^postgres/i.test(url) ? 'PostgreSQL' : url.startsWith('file:') ? 'SQLite' : '(inconnue)'}\n`);

if (APPLIQUER && !/^postgres/i.test(url) && !FORCER) {
  console.error('DATABASE_URL ne pointe pas vers PostgreSQL. Import annule.');
  console.error('Ajoutez --forcer si vous importez volontairement ailleurs.');
  await prisma.$disconnect();
  process.exit(1);
}

const { ordre, donnees, total } = JSON.parse(await readFile(fichier, 'utf8'));

// La base cible doit etre vide : un second import creerait des doublons.
const dejaPresent = [];
for (const modele of ordre) {
  const n = await prisma[modele].count();
  if (n > 0) dejaPresent.push(`${modele} (${n})`);
}

if (dejaPresent.length) {
  console.log('La base cible contient deja des donnees :');
  console.log(`  ${dejaPresent.join(', ')}\n`);
  if (APPLIQUER && !FORCER) {
    console.error('Import annule pour eviter des doublons. Ajoutez --forcer si c’est voulu.');
    await prisma.$disconnect();
    process.exit(1);
  }
}

let inserees = 0;
let echecs = 0;

for (const modele of ordre) {
  const lignes = donnees[modele] ?? [];
  if (!lignes.length) continue;

  if (!APPLIQUER) {
    console.log(`SIMULE  ${modele.padEnd(16)} ${String(lignes.length).padStart(4)} ligne(s)`);
    inserees += lignes.length;
    continue;
  }

  // Les dates sont serialisees en chaines ISO : Prisma attend des objets Date.
  const converties = lignes.map((ligne) =>
    Object.fromEntries(
      Object.entries(ligne).map(([cle, valeur]) => [
        cle,
        typeof valeur === 'string' && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(valeur) ? new Date(valeur) : valeur,
      ]),
    ),
  );

  try {
    // Insertion ligne par ligne : une erreur isolee n'interrompt pas le reste
    // et se voit immediatement dans le journal.
    for (const ligne of converties) {
      await prisma[modele].create({ data: ligne });
      inserees += 1;
    }
    console.log(`IMPORTE ${modele.padEnd(16)} ${String(converties.length).padStart(4)} ligne(s)`);
  } catch (erreur) {
    echecs += 1;
    console.log(`ECHEC   ${modele.padEnd(16)} ${erreur.message.split('\n')[0]}`);
  }
}

console.log(`\n${inserees}/${total} ligne(s) ${APPLIQUER ? 'inserees' : 'a inserer'}, ${echecs} echec(s).`);

if (!APPLIQUER) {
  console.log('\nSimulation terminee. Relancez avec --appliquer pour ecrire reellement.');
} else if (!echecs) {
  console.log('\nImport termine. Verifiez ensuite :');
  console.log('  - les 8 formations et leurs prix,');
  console.log('  - le logo et les coordonnees GPS dans Admin > Parametres,');
  console.log('  - la connexion administrateur.');
}

await prisma.$disconnect();
process.exit(echecs ? 1 : 0);
