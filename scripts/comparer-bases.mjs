/**
 * Comparaison ligne a ligne entre l'export SQLite et la base PostgreSQL.
 *
 * Lit le fichier JSON produit par `exporter-donnees.mjs` (l'etat SQLite
 * d'origine) et le confronte a la base actuellement configuree. Pour chaque
 * table : nombre de lignes de part et d'autre, et verdict.
 *
 * Controle ensuite les valeurs metier qui ne doivent JAMAIS changer :
 * les 8 prix, les 2 telephones, les coordonnees GPS et le logo.
 *
 * Lecture seule. Aucune chaine de connexion n'est affichee.
 *
 *   node --env-file=.env scripts/comparer-bases.mjs sauvegardes/donnees-….json
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const fichier = process.argv.find((a) => a.endsWith('.json'));
if (!fichier) {
  console.error('Usage : node --env-file=.env scripts/comparer-bases.mjs <export.json>');
  process.exit(1);
}

const PRIX_OFFICIELS = {
  'Coiffe simple': 25000,
  'Coiffe sénégalais': 25000,
  'Coiffe nigérienne': 45000,
  Éventail: 35000,
  'Turban marié': 30000,
  'Turban à la machine': 60000,
  Voile: 40000,
  Maquillage: 25000,
};

const REGLAGES_OFFICIELS = {
  'shop.phone': '+226 76 51 88 11',
  'shop.phone2': '+226 62 71 30 19',
  'shop.latitude': '12.40567398071289',
  'shop.longitude': '-1.6069070100784302',
};

const prisma = new PrismaClient();
const { ordre, donnees } = JSON.parse(await readFile(fichier, 'utf8'));

const url = process.env.DATABASE_URL ?? '';
const moteur = /^postgres/i.test(url) ? 'PostgreSQL' : url.startsWith('file:') ? 'SQLite' : '(inconnu)';

console.log('=== COMPARAISON DES BASES ===\n');
console.log(`Source (export) : ${path.relative(process.cwd(), fichier)}`);
console.log(`Cible actuelle  : ${moteur}\n`);

/* ------------------------------------------------- 1. Comptage par table */

console.log('TABLE               SQLite   PostgreSQL   RESULTAT');
console.log('─'.repeat(56));

let differences = 0;
let totalSource = 0;
let totalCible = 0;

for (const modele of ordre) {
  const source = (donnees[modele] ?? []).length;
  const cible = await prisma[modele].count();
  totalSource += source;
  totalCible += cible;

  const ok = source === cible;
  if (!ok) differences += 1;

  console.log(
    `${modele.padEnd(18)} ${String(source).padStart(6)}   ${String(cible).padStart(10)}   ${
      ok ? 'OK' : `DIFFERENCE (${cible - source > 0 ? '+' : ''}${cible - source})`
    }`,
  );
}

console.log('─'.repeat(56));
console.log(
  `${'TOTAL'.padEnd(18)} ${String(totalSource).padStart(6)}   ${String(totalCible).padStart(10)}   ${
    totalSource === totalCible ? 'OK' : 'DIFFERENCE'
  }`,
);

/* --------------------------------------------- 2. Valeurs metier critiques */

console.log('\n\nPRIX DES 8 FORMATIONS');
console.log('─'.repeat(56));

let anomalies = 0;
const cours = await prisma.course.findMany({ orderBy: { sortOrder: 'asc' }, select: { name: true, price: true } });

for (const [nom, attendu] of Object.entries(PRIX_OFFICIELS)) {
  const trouve = cours.find((c) => c.name === nom);
  const ok = trouve?.price === attendu;
  if (!ok) anomalies += 1;
  const valeur = trouve ? `${trouve.price.toLocaleString('fr-FR')} FCFA` : 'FORMATION ABSENTE';
  console.log(`${ok ? 'OK    ' : 'ECHEC '} ${nom.padEnd(24)} ${valeur.padStart(16)}`);
}

const inattendues = cours.filter((c) => !(c.name in PRIX_OFFICIELS));
if (inattendues.length) {
  anomalies += 1;
  console.log(`ECHEC  formations inattendues : ${inattendues.map((c) => c.name).join(', ')}`);
}

console.log('\n\nCONTACTS ET LOCALISATION');
console.log('─'.repeat(56));

const reglages = Object.fromEntries((await prisma.setting.findMany()).map((s) => [s.key, s.value]));

for (const [cle, attendu] of Object.entries(REGLAGES_OFFICIELS)) {
  const ok = reglages[cle] === attendu;
  if (!ok) anomalies += 1;
  console.log(`${ok ? 'OK    ' : 'ECHEC '} ${cle.padEnd(24)} ${reglages[cle] ?? 'ABSENT'}`);
}

const logoSource = (donnees.setting ?? []).find((s) => s.key === 'shop.logoUrl')?.value;
const logoCible = reglages['shop.logoUrl'];
const logoOk = Boolean(logoCible) && logoCible === logoSource;
if (!logoOk) anomalies += 1;
console.log(`${logoOk ? 'OK    ' : 'ECHEC '} ${'shop.logoUrl'.padEnd(24)} ${logoCible ?? 'ABSENT'}`);
if (!logoOk && logoSource) console.log(`       attendu : ${logoSource}`);

/* ------------------------------------------------------ 3. Comptes et liens */

console.log('\n\nCOMPTES ET RELATIONS');
console.log('─'.repeat(56));

const comptes = await prisma.user.findMany({ select: { role: true, fullName: true, email: true, passwordHash: true } });
for (const u of comptes) {
  const hachageOk = /^\$2[aby]\$\d{2}\$/.test(u.passwordHash) && u.passwordHash.length === 60;
  if (!hachageOk) anomalies += 1;
  console.log(
    `${hachageOk ? 'OK    ' : 'ECHEC '} ${u.role.padEnd(10)} ${(u.fullName ?? '').padEnd(24)} ${u.email ?? '—'}` +
      `  ${hachageOk ? 'hachage bcrypt intact' : 'HACHAGE INVALIDE'}`,
  );
}

const rolesSource = (donnees.user ?? []).map((u) => u.role).sort().join(',');
const rolesCible = comptes.map((u) => u.role).sort().join(',');
if (rolesSource !== rolesCible) {
  anomalies += 1;
  console.log(`ECHEC  roles : attendu [${rolesSource}], trouve [${rolesCible}]`);
}

// Les relations : une inscription doit retrouver son eleve ET sa formation.
const inscriptions = await prisma.enrollment.findMany({
  include: { student: { include: { user: { select: { fullName: true } } } }, course: { select: { name: true } } },
});
for (const e of inscriptions) {
  const ok = Boolean(e.student?.user && e.course);
  if (!ok) anomalies += 1;
  console.log(`${ok ? 'OK    ' : 'ECHEC '} inscription  ${e.student?.user?.fullName ?? '?'} → ${e.course?.name ?? '?'}`);
}

const rdv = await prisma.appointment.findMany({ include: { customer: true, service: true } });
for (const a of rdv) {
  const ok = Boolean(a.customer && a.service);
  if (!ok) anomalies += 1;
  console.log(`${ok ? 'OK    ' : 'ECHEC '} rendez-vous  ${a.customer?.fullName ?? '?'} → ${a.service?.name ?? '?'}`);
}

const photos = await prisma.courseImage.findMany({ include: { course: { select: { name: true } } } });
for (const i of photos) {
  const ok = Boolean(i.course);
  if (!ok) anomalies += 1;
  console.log(`${ok ? 'OK    ' : 'ECHEC '} photo        ${i.course?.name ?? '?'} → ${i.url.split('/').pop()}`);
}

/* --------------------------------------------------------------- Verdict */

console.log('\n' + '='.repeat(56));
if (!differences && !anomalies) {
  console.log('MIGRATION CONFORME — aucune difference, aucune anomalie.');
} else {
  console.log(`${differences} table(s) avec un ecart de lignes, ${anomalies} anomalie(s) metier.`);
}

await prisma.$disconnect();
process.exit(differences || anomalies ? 1 : 0);
