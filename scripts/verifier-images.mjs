/**
 * Controle de toutes les images referencees en base.
 *
 * Parcourt le logo, les photos des formations, la galerie, les prestations et
 * les avatars, puis verifie que CHAQUE URL repond reellement en HTTP 200 et
 * renvoie bien une image. A executer apres la migration vers R2, et apres
 * chaque mise en production.
 *
 * Verifie aussi que chaque photo de formation reste associee a la bonne
 * formation : le nom de fichier doit contenir le nom de la formation.
 *
 *   node --env-file=.env scripts/verifier-images.mjs
 *   node --env-file=.env scripts/verifier-images.mjs https://sdesignshop.com
 *
 * L'argument sert de base pour les URL relatives (« /uploads/… ») ; par defaut
 * NEXT_PUBLIC_APP_URL, sinon http://localhost:3000.
 */
import { PrismaClient } from '@prisma/client';

const BASE = (process.argv[2] || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
const prisma = new PrismaClient();

/** Retire les accents et la ponctuation, pour comparer un nom a un fichier. */
function normaliser(texte) {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const cibles = [];

const logo = await prisma.setting.findUnique({ where: { key: 'shop.logoUrl' } });
if (logo?.value) cibles.push({ categorie: 'Logo officiel', libelle: 'shop.logoUrl', url: logo.value });

for (const c of await prisma.course.findMany({ orderBy: { sortOrder: 'asc' } })) {
  if (c.imageUrl) cibles.push({ categorie: 'Photo de formation', libelle: c.name, url: c.imageUrl, attendu: c.name });
}

for (const i of await prisma.courseImage.findMany({ include: { course: { select: { name: true } } } })) {
  cibles.push({ categorie: 'Galerie formation', libelle: i.course.name, url: i.url, attendu: i.course.name });
}

for (const s of await prisma.service.findMany()) {
  if (s.imageUrl) cibles.push({ categorie: 'Prestation', libelle: s.name, url: s.imageUrl });
}

for (const g of await prisma.galleryItem.findMany().catch(() => [])) {
  // GalleryItem stocke l'URL dans « url », et non « imageUrl ».
  if (g.url) cibles.push({ categorie: 'Galerie publique', libelle: g.title ?? g.id, url: g.url });
}

for (const u of await prisma.user.findMany({ where: { avatarUrl: { not: null } } })) {
  cibles.push({ categorie: 'Avatar', libelle: u.fullName, url: u.avatarUrl });
}

console.log('=== CONTROLE DES IMAGES ===\n');
console.log(`Base pour les URL relatives : ${BASE}`);
console.log(`Images referencees en base   : ${cibles.length}\n`);

const surR2 = cibles.filter((c) => /^https?:\/\//i.test(c.url)).length;
const locales = cibles.length - surR2;
console.log(`  ${surR2} URL absolue(s) — stockage distant`);
console.log(`  ${locales} URL relative(s) — encore en local\n`);

let echecs = 0;
let mauvaisesAssociations = 0;

for (const cible of cibles) {
  const url = /^https?:\/\//i.test(cible.url) ? cible.url : `${BASE}${cible.url}`;

  let etat = '';
  let ok = false;
  try {
    // HEAD d'abord ; certains hebergeurs ne le gerent pas, on retombe sur GET.
    let reponse = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    if (reponse.status === 405 || reponse.status === 501) {
      reponse = await fetch(url, { method: 'GET', cache: 'no-store' });
    }
    const type = reponse.headers.get('content-type') ?? '';
    ok = reponse.ok && type.startsWith('image/');
    etat = reponse.ok ? `HTTP ${reponse.status}, ${type || 'type inconnu'}` : `HTTP ${reponse.status}`;
  } catch (erreur) {
    etat = `injoignable (${erreur.message})`;
  }

  if (!ok) echecs += 1;
  console.log(`${ok ? 'OK   ' : 'ECHEC'} ${cible.categorie.padEnd(18)} ${cible.libelle.padEnd(24)} ${etat}`);
  if (!ok) console.log(`      ${url}`);

  // Controle d'association : le fichier doit porter le nom de la formation.
  if (cible.attendu) {
    const nomFichier = normaliser(decodeURIComponent(url.split('/').pop() ?? ''));
    const nomFormation = normaliser(cible.attendu);
    if (!nomFichier.includes(nomFormation)) {
      mauvaisesAssociations += 1;
      console.log(`      ATTENTION : le fichier ne porte pas le nom « ${cible.attendu} » — verifiez l’association.`);
    }
  }
}

console.log(`\n${cibles.length - echecs}/${cibles.length} image(s) accessible(s).`);
if (mauvaisesAssociations) {
  console.log(`${mauvaisesAssociations} association(s) photo/formation a verifier manuellement.`);
}
if (locales && /^https?:/i.test(BASE) && !BASE.includes('localhost')) {
  console.log(`\n${locales} image(s) pointent encore vers public/uploads : lancez scripts/migrer-vers-r2.mjs.`);
}

await prisma.$disconnect();
process.exit(echecs || mauvaisesAssociations ? 1 : 0);
