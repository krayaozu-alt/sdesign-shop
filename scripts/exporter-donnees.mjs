/**
 * Export complet de la base vers un fichier JSON.
 *
 * A executer AVANT la bascule vers PostgreSQL, pendant que le schema est
 * encore en `sqlite`. Le fichier produit est ensuite relu par
 * `scripts/importer-donnees.mjs` une fois PostgreSQL en place.
 *
 * Lecture seule : ce script ne modifie ni ne supprime rien.
 *
 *   node --env-file=.env scripts/exporter-donnees.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

/**
 * Ordre de dependance : un modele n'apparait qu'apres ceux dont il depend.
 * Cet ordre est reutilise tel quel a l'import, ou il garantit qu'aucune cle
 * etrangere ne pointe vers une ligne pas encore inseree.
 */
export const ORDRE = [
  'setting',
  'user',
  'student',
  'customer',
  'trainer',
  'course',
  'courseImage',
  'courseModule',
  'courseSession',
  'service',
  'enrollment',
  'moduleProgress',
  'attendance',
  'appointment',
  'payment',
  'receipt',
  'certificate',
  'galleryItem',
  'testimonial',
  'notification',
  'auditLog',
  'otpCode',
];

const prisma = new PrismaClient();

const destination = path.join(process.cwd(), 'sauvegardes');
await mkdir(destination, { recursive: true });

const horodatage = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
const fichier = path.join(destination, `donnees-${horodatage}.json`);

console.log('=== EXPORT DES DONNEES ===\n');

const donnees = {};
let total = 0;

for (const modele of ORDRE) {
  const lignes = await prisma[modele].findMany();
  donnees[modele] = lignes;
  total += lignes.length;
  console.log(`  ${modele.padEnd(16)} ${String(lignes.length).padStart(4)} ligne(s)`);
}

// Controles de coherence : ce sont les donnees qui ne doivent JAMAIS changer.
const reglages = Object.fromEntries(donnees.setting.map((s) => [s.key, s.value]));
const controles = [
  ['Formations', donnees.course.length === 8, `${donnees.course.length} (attendu 8)`],
  ['Comptes', donnees.user.length > 0, `${donnees.user.length}`],
  ['Logo', Boolean(reglages['shop.logoUrl']), reglages['shop.logoUrl'] ?? 'ABSENT'],
  ['Latitude', reglages['shop.latitude'] === '12.40567398071289', reglages['shop.latitude'] ?? 'ABSENTE'],
  ['Longitude', reglages['shop.longitude'] === '-1.6069070100784302', reglages['shop.longitude'] ?? 'ABSENTE'],
  ['Telephone 1', reglages['shop.phone'] === '+226 76 51 88 11', reglages['shop.phone'] ?? 'ABSENT'],
  ['Telephone 2', reglages['shop.phone2'] === '+226 62 71 30 19', reglages['shop.phone2'] ?? 'ABSENT'],
];

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

const prixFaux = donnees.course.filter((c) => PRIX_OFFICIELS[c.name] !== c.price);
controles.push([
  'Prix officiels',
  prixFaux.length === 0,
  prixFaux.length ? prixFaux.map((c) => `${c.name}=${c.price}`).join(', ') : 'les 8 prix sont conformes',
]);

console.log('\nControles :');
let alerte = false;
for (const [libelle, ok, detail] of controles) {
  if (!ok) alerte = true;
  console.log(`  ${ok ? 'OK   ' : 'ALERTE'} ${libelle.padEnd(16)} ${detail}`);
}

await writeFile(
  fichier,
  JSON.stringify({ genereLe: new Date().toISOString(), ordre: ORDRE, total, donnees }, null, 2),
  'utf8',
);

console.log(`\n${total} ligne(s) exportee(s) vers ${path.relative(process.cwd(), fichier)}`);
if (alerte) {
  console.log('\nDes controles ont echoue : verifiez la base AVANT de migrer.');
}

await prisma.$disconnect();
process.exit(alerte ? 1 : 0);
