/**
 * Inventaire des fichiers de public/uploads, confronte aux URL de la base.
 *
 * Pour chaque fichier : nom, taille, type MIME, empreinte SHA-256, et
 * l'usage exact qui en est fait en base (logo, photo principale d'une
 * formation, image de galerie…).
 *
 * Signale aussi :
 *   - les fichiers presents sur le disque mais references nulle part ;
 *   - les URL en base qui pointent vers un fichier absent du disque.
 *
 * Lecture seule : ce script ne modifie rien.
 *
 *   node --env-file=.env scripts/inventaire-fichiers.mjs
 */
import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const RACINE = path.join(process.cwd(), 'public', 'uploads');

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
};

/** Reconnait un vrai fichier image par ses octets d'en-tete, pas par son nom. */
function typeReel(octets) {
  if (octets[0] === 0xff && octets[1] === 0xd8 && octets[2] === 0xff) return 'image/jpeg';
  if (octets[0] === 0x89 && octets[1] === 0x50 && octets[2] === 0x4e && octets[3] === 0x47) return 'image/png';
  if (octets.slice(0, 4).toString('ascii') === 'RIFF' && octets.slice(8, 12).toString('ascii') === 'WEBP')
    return 'image/webp';
  if (octets.slice(0, 3).toString('ascii') === 'GIF') return 'image/gif';
  if (octets.slice(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  const debut = octets.slice(0, 256).toString('utf8');
  if (/<svg[\s>]/i.test(debut) || /<\?xml/i.test(debut)) return 'image/svg+xml';
  return null;
}

const prisma = new PrismaClient();

/* ------------------------------------------------ Usages declares en base */

const usages = new Map(); // nom de fichier -> [usages]
const ajouter = (url, usage) => {
  if (typeof url !== 'string' || !url) return;
  const nom = url.replace(/^\/uploads\//, '').replace(/^https?:\/\/[^/]+\//, '');
  if (!usages.has(nom)) usages.set(nom, []);
  usages.get(nom).push({ ...usage, url });
};

const logo = await prisma.setting.findUnique({ where: { key: 'shop.logoUrl' } });
if (logo?.value) ajouter(logo.value, { type: 'Logo officiel', cible: 'shop.logoUrl', table: 'settings' });

for (const c of await prisma.course.findMany({ orderBy: { sortOrder: 'asc' } })) {
  if (c.imageUrl) ajouter(c.imageUrl, { type: 'Photo principale', cible: c.name, table: 'courses', id: c.id });
}
for (const i of await prisma.courseImage.findMany({ include: { course: { select: { name: true } } } })) {
  ajouter(i.url, { type: 'Image de galerie', cible: i.course.name, table: 'course_images', id: i.id });
}
for (const s of await prisma.service.findMany()) {
  if (s.imageUrl) ajouter(s.imageUrl, { type: 'Photo prestation', cible: s.name, table: 'services', id: s.id });
}
for (const g of await prisma.galleryItem.findMany().catch(() => [])) {
  // GalleryItem stocke l'URL dans « url », et non « imageUrl ».
  if (g.url) ajouter(g.url, { type: 'Galerie publique', cible: g.title ?? g.id, table: 'gallery', id: g.id });
}
for (const u of await prisma.user.findMany({ where: { avatarUrl: { not: null } } })) {
  ajouter(u.avatarUrl, { type: 'Avatar', cible: u.fullName, table: 'users', id: u.id });
}

/* ------------------------------------------------------ Fichiers du disque */

let fichiers = [];
try {
  fichiers = (await readdir(RACINE)).filter((f) => f !== '.gitkeep');
} catch {
  console.error('Dossier public/uploads introuvable.');
  process.exit(1);
}

console.log('=== INVENTAIRE DE public/uploads ===\n');
console.log(`Fichiers sur le disque      : ${fichiers.length}`);
console.log(`Fichiers references en base : ${usages.size}`);
console.log(`Lignes de base concernees   : ${[...usages.values()].reduce((n, u) => n + u.length, 0)}\n`);

const inventaire = [];
let orphelins = 0;

for (const nom of fichiers.sort()) {
  const chemin = path.join(RACINE, nom);
  const infos = await stat(chemin);
  const octets = await readFile(chemin);
  const sha = createHash('sha256').update(octets).digest('hex');
  const extension = path.extname(nom).toLowerCase();
  const mimeAnnonce = MIME[extension] ?? '(extension inconnue)';
  const mimeReel = typeReel(octets);
  const coherent = mimeReel === mimeAnnonce;
  const u = usages.get(nom) ?? [];
  if (!u.length) orphelins += 1;

  inventaire.push({ nom, taille: infos.size, sha, mime: mimeAnnonce, usages: u });

  console.log(`── ${nom}`);
  console.log(`   taille    ${infos.size.toLocaleString('fr-FR')} octets (${(infos.size / 1024).toFixed(0)} Ko)`);
  console.log(`   type MIME ${mimeAnnonce}${coherent ? ' — confirme par les octets d’en-tete' : `  ATTENTION : les octets indiquent ${mimeReel ?? 'un type inconnu'}`}`);
  console.log(`   SHA-256   ${sha}`);
  if (u.length) {
    for (const x of u) console.log(`   usage     ${x.type} → ${x.cible}   [${x.table}]`);
  } else {
    console.log('   usage     AUCUN — fichier non reference en base');
  }
  console.log();
}

/* ------------------------------------------- URL pointant dans le vide */

const surDisque = new Set(fichiers);
const manquants = [...usages.entries()].filter(([nom]) => !surDisque.has(nom));

console.log('─'.repeat(70));
if (manquants.length) {
  console.log('\nURL EN BASE SANS FICHIER SUR LE DISQUE :');
  for (const [nom, u] of manquants) {
    console.log(`  ${nom}`);
    for (const x of u) console.log(`     ${x.type} → ${x.cible}  [${x.table}]`);
  }
} else {
  console.log('\nToutes les URL de la base correspondent a un fichier present.');
}

if (orphelins) {
  console.log(`\n${orphelins} fichier(s) sur le disque ne sont references nulle part.`);
  console.log('Ils ne seront PAS migres : la migration suit les URL de la base.');
}

/* ------------------------------------ Formations volontairement sans photo */

const sansPhoto = await prisma.course.findMany({
  where: { imageUrl: null },
  select: { name: true },
  orderBy: { sortOrder: 'asc' },
});
if (sansPhoto.length) {
  console.log(`\nFORMATIONS SANS PHOTO (restent « Photo a venir ») : ${sansPhoto.length}`);
  for (const c of sansPhoto) console.log(`  ${c.name}`);
}

console.log(`\n${inventaire.length} fichier(s) inventorie(s), ${manquants.length} URL orpheline(s).`);

await prisma.$disconnect();
process.exit(manquants.length ? 1 : 0);
