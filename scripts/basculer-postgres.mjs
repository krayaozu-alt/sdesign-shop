/**
 * Bascule du schema Prisma de SQLite vers PostgreSQL (Neon).
 *
 * Le schema de S.DESIGN SHOP est portable : 22 modeles, aucun type natif
 * `@db.`, aucun champ Json, aucun enum Prisma. La bascule se limite au bloc
 * `datasource`.
 *
 * Cas Neon : la datasource recoit aussi `directUrl`. Neon expose deux chaines
 * de connexion — une groupee (« pooled », hote en -pooler) pour l'application,
 * et une directe pour les migrations. `prisma migrate` exige la directe.
 *
 * Ce script NE TOUCHE PAS aux donnees. Il ne fait que modifier
 * prisma/schema.prisma, apres avoir sauvegarde le fichier et la base SQLite.
 * La reprise des donnees est assuree par exporter-donnees.mjs puis
 * importer-donnees.mjs.
 *
 * Aucune chaine de connexion n'est jamais affichee : elles contiennent le
 * mot de passe de la base.
 *
 *   node scripts/basculer-postgres.mjs              # simulation
 *   node scripts/basculer-postgres.mjs --appliquer
 *   node scripts/basculer-postgres.mjs --revenir --appliquer   # retour SQLite
 */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const APPLIQUER = process.argv.includes('--appliquer');
const REVENIR = process.argv.includes('--revenir');
const CIBLE = REVENIR ? 'sqlite' : 'postgresql';

const SCHEMA = path.join(process.cwd(), 'prisma', 'schema.prisma');
const BASE_SQLITE = path.join(process.cwd(), 'prisma', 'sdesign.db');
const SAUVEGARDES = path.join(process.cwd(), 'sauvegardes');

const horodatage = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);

console.log(`=== BASCULE PRISMA VERS ${CIBLE.toUpperCase()} ===\n`);

const source = await readFile(SCHEMA, 'utf8');
const blocActuel = source.match(/datasource db \{[\s\S]*?\n\}/)?.[0];
const actuel = blocActuel?.match(/provider\s*=\s*"(sqlite|postgresql)"/)?.[1];

if (!blocActuel || !actuel) {
  console.error('Bloc datasource introuvable dans prisma/schema.prisma. Aucune modification.');
  process.exit(1);
}

console.log(`Provider actuel : ${actuel}`);
console.log(`Provider cible  : ${CIBLE}\n`);

if (actuel === CIBLE) {
  console.log('Le schema est deja dans cet etat. Rien a faire.');
  process.exit(0);
}

const url = process.env.DATABASE_URL ?? '';
const direct = process.env.DATABASE_URL_UNPOOLED ?? '';
const estPostgres = (v) => /^postgres(ql)?:\/\//i.test(v);

console.log('Ce qui va changer, dans le bloc datasource UNIQUEMENT :');
if (CIBLE === 'postgresql') {
  console.log('    provider  = "postgresql"');
  console.log('    url       = env("DATABASE_URL")           <- connexion groupee (pooled)');
  console.log('    directUrl = env("DATABASE_URL_UNPOOLED")  <- connexion directe, pour les migrations');
} else {
  console.log('    provider = "sqlite"');
  console.log('    url      = env("DATABASE_URL")');
  console.log('    (directUrl retire : non supporte par SQLite)');
}
console.log('\n  Les 22 modeles, leurs champs, relations, index et valeurs par defaut');
console.log('  ne sont PAS touches. Aucune donnee n’est lue, copiee ni supprimee.\n');

let bloquant = false;

if (CIBLE === 'postgresql') {
  // Les chaines contiennent le mot de passe : on ne decrit que leur nature.
  const resume = (v) => (!v ? 'ABSENTE' : estPostgres(v) ? 'renseignee (PostgreSQL)' : 'renseignee mais PAS PostgreSQL');
  console.log('Variables d’environnement :');
  console.log(`  DATABASE_URL           ${resume(url)}${url && /-pooler/.test(url) ? ' · groupee' : url && estPostgres(url) ? ' · directe' : ''}`);
  console.log(`  DATABASE_URL_UNPOOLED  ${resume(direct)}${direct && /-pooler/.test(direct) ? ' · groupee (ATTENTION : il faut la directe)' : direct && estPostgres(direct) ? ' · directe' : ''}`);
  console.log();

  if (!estPostgres(url)) {
    bloquant = true;
    console.log('BLOQUANT : DATABASE_URL ne pointe pas vers PostgreSQL.');
    console.log('  Renseignez la chaine Neon dans .env avant d’appliquer.\n');
  }
  if (!direct) {
    bloquant = true;
    console.log('BLOQUANT : DATABASE_URL_UNPOOLED est absente.');
    console.log('  `prisma migrate` exige la connexion DIRECTE (hote SANS -pooler).');
    console.log('  Si Neon ne vous donne qu’une chaine, mettez la meme valeur dans les deux.\n');
  }
}

console.log('Etapes a executer ENSUITE, dans cet ordre :');
if (CIBLE === 'postgresql') {
  console.log('  1. npx prisma migrate dev --name init-postgres');
  console.log('  2. npx prisma generate');
  console.log('  3. node --env-file=.env scripts/importer-donnees.mjs sauvegardes/donnees-….json --appliquer');
  console.log('     (NE PAS lancer db:seed : il creerait des doublons)');
} else {
  console.log('  1. npx prisma db push');
  console.log('  2. npx prisma generate');
  console.log('  3. restaurer prisma/sdesign.db depuis sauvegardes/ si necessaire');
}
console.log();

if (!APPLIQUER) {
  console.log('SIMULATION — aucun fichier modifie.');
  console.log('Relancez avec --appliquer pour effectuer la bascule.');
  process.exit(0);
}

if (bloquant) {
  console.error('Bascule annulee : corrigez les points BLOQUANT ci-dessus.');
  process.exit(1);
}

// Sauvegardes avant toute ecriture.
await mkdir(SAUVEGARDES, { recursive: true });
const schemaSauve = path.join(SAUVEGARDES, `schema-${horodatage}.prisma`);
await copyFile(SCHEMA, schemaSauve);
console.log(`Sauvegarde du schema : ${path.relative(process.cwd(), schemaSauve)}`);

if (existsSync(BASE_SQLITE)) {
  const baseSauve = path.join(SAUVEGARDES, `sdesign-${horodatage}.db`);
  await copyFile(BASE_SQLITE, baseSauve);
  console.log(`Sauvegarde de la base : ${path.relative(process.cwd(), baseSauve)}`);
}

const bloc =
  CIBLE === 'postgresql'
    ? `datasource db {
  provider  = "postgresql"
  // Connexion groupee (Neon : hote en -pooler), utilisee par l'application.
  url       = env("DATABASE_URL")
  // Connexion directe, exigee par prisma migrate et prisma db push.
  directUrl = env("DATABASE_URL_UNPOOLED")
}`
    : `datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}`;

await writeFile(SCHEMA, source.replace(/datasource db \{[\s\S]*?\n\}/, bloc), 'utf8');

console.log(`\nprisma/schema.prisma bascule vers « ${CIBLE} ».`);
console.log('La base SQLite n’a PAS ete supprimee.');
console.log('Executez maintenant les etapes listees ci-dessus.');
