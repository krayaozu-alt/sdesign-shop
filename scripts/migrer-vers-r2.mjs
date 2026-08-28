/**
 * Migration des fichiers locaux vers Cloudflare R2.
 *
 * Deroulement strict, en deux phases separees :
 *
 *   PHASE 1  televersement de chaque fichier, puis RELECTURE depuis l'URL
 *            publique et comparaison de l'empreinte SHA-256, de la taille et
 *            du type MIME. Rien n'est ecrit en base a ce stade.
 *
 *   PHASE 2  mise a jour des URL en base — uniquement si TOUS les fichiers
 *            ont ete verifies avec succes. Un seul echec annule la phase 2.
 *
 * Cet ordre est deliberé : une URL ne doit jamais etre reecrite vers un objet
 * dont on n'a pas prouve qu'il est lisible et intact.
 *
 * Les fichiers locaux ne sont JAMAIS supprimes.
 *
 *   node --env-file=.env scripts/migrer-vers-r2.mjs            # simulation
 *   node --env-file=.env scripts/migrer-vers-r2.mjs --appliquer
 *
 * Idempotent : les URL deja migrees sont ignorees.
 */
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { amzDate, encoderSegment, signer } from '../src/server/storage/sigv4.ts';

const APPLIQUER = process.argv.includes('--appliquer');
const RACINE = path.join(process.cwd(), 'public', 'uploads');

const CONF = {
  accountId: process.env.R2_ACCOUNT_ID ?? '',
  accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  bucket: process.env.R2_BUCKET_NAME ?? process.env.R2_BUCKET ?? '',
  publicUrl: (process.env.R2_PUBLIC_URL ?? '').replace(/\/+$/, ''),
};

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

const absentes = Object.entries({
  R2_ACCOUNT_ID: CONF.accountId,
  R2_ACCESS_KEY_ID: CONF.accessKeyId,
  R2_SECRET_ACCESS_KEY: CONF.secretAccessKey,
  R2_BUCKET_NAME: CONF.bucket,
  R2_PUBLIC_URL: CONF.publicUrl,
})
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (absentes.length) {
  console.error(`Variables R2 manquantes : ${absentes.join(', ')}`);
  process.exit(1);
}

if (/\.r2\.cloudflarestorage\.com/i.test(CONF.publicUrl)) {
  console.error("R2_PUBLIC_URL pointe vers l'endpoint S3, qui n'est pas lisible publiquement.");
  console.error('Utilisez le sous-domaine r2.dev ou un domaine personnalise.');
  process.exit(1);
}

/** Requete signee vers l'endpoint S3 de R2. */
async function requeteSignee(methode, cle, corps, contentType) {
  const host = `${CONF.accountId}.r2.cloudflarestorage.com`;
  const chemin = `/${CONF.bucket}/${cle.split('/').map(encoderSegment).join('/')}`;
  const date = amzDate(new Date());
  const payloadHash = createHash('sha256').update(corps ?? Buffer.alloc(0)).digest('hex');

  const entetes = { host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': date };
  if (contentType) entetes['content-type'] = contentType;

  const { authorization } = await signer({
    methode,
    chemin,
    requete: '',
    entetes,
    payloadHash,
    accessKeyId: CONF.accessKeyId,
    secretAccessKey: CONF.secretAccessKey,
    region: 'auto',
    service: 's3',
    date,
  });

  return fetch(`https://${host}${chemin}`, {
    method: methode,
    headers: { ...entetes, Authorization: authorization },
    body: corps ?? undefined,
  });
}

const prisma = new PrismaClient();

/** Toutes les colonnes de la base qui contiennent une URL de fichier. */
const CIBLES = [
  {
    libelle: 'Logo de la boutique',
    async lire() {
      const s = await prisma.setting.findUnique({ where: { key: 'shop.logoUrl' } });
      return s?.value ? [{ id: 'shop.logoUrl', url: s.value }] : [];
    },
    ecrire: (id, url) => prisma.setting.update({ where: { key: id }, data: { value: url } }),
  },
  {
    libelle: 'Photo principale de formation',
    async lire() {
      const r = await prisma.course.findMany({ where: { imageUrl: { not: null } }, select: { id: true, imageUrl: true, name: true } });
      return r.map((x) => ({ id: x.id, url: x.imageUrl, contexte: x.name }));
    },
    ecrire: (id, url) => prisma.course.update({ where: { id }, data: { imageUrl: url } }),
  },
  {
    libelle: 'Image de galerie',
    async lire() {
      const r = await prisma.courseImage.findMany({ include: { course: { select: { name: true } } } });
      return r.map((x) => ({ id: x.id, url: x.url, contexte: x.course.name }));
    },
    ecrire: (id, url) => prisma.courseImage.update({ where: { id }, data: { url } }),
  },
  {
    libelle: 'Photo de prestation',
    async lire() {
      const r = await prisma.service.findMany({ where: { imageUrl: { not: null } }, select: { id: true, imageUrl: true, name: true } });
      return r.map((x) => ({ id: x.id, url: x.imageUrl, contexte: x.name }));
    },
    ecrire: (id, url) => prisma.service.update({ where: { id }, data: { imageUrl: url } }),
  },
  {
    libelle: 'Galerie publique',
    async lire() {
      // GalleryItem stocke l'URL dans « url », et non « imageUrl ».
      const r = await prisma.galleryItem.findMany().catch(() => []);
      return r.filter((x) => x.url).map((x) => ({ id: x.id, url: x.url, contexte: x.title ?? x.id }));
    },
    ecrire: (id, url) => prisma.galleryItem.update({ where: { id }, data: { url } }),
  },
  {
    libelle: 'Avatar',
    async lire() {
      const r = await prisma.user.findMany({ where: { avatarUrl: { not: null } }, select: { id: true, avatarUrl: true, fullName: true } });
      return r.map((x) => ({ id: x.id, url: x.avatarUrl, contexte: x.fullName }));
    },
    ecrire: (id, url) => prisma.user.update({ where: { id }, data: { avatarUrl: url } }),
  },
];

const estLocale = (url) => typeof url === 'string' && url.startsWith('/uploads/');

console.log(APPLIQUER ? '=== MIGRATION VERS R2 ===\n' : '=== SIMULATION (aucune ecriture) ===\n');
console.log(`Bucket   : ${CONF.bucket}`);
console.log(`Publique : ${CONF.publicUrl}\n`);

/* -------------------------------------------------------- Recensement */

const aMigrer = [];
for (const cible of CIBLES) {
  for (const ligne of await cible.lire()) {
    if (estLocale(ligne.url)) aMigrer.push({ cible, ...ligne });
  }
}

if (!aMigrer.length) {
  console.log('Aucune URL locale en base : rien a migrer.');
  await prisma.$disconnect();
  process.exit(0);
}

const fichiersUniques = [...new Set(aMigrer.map((x) => x.url.replace(/^\/uploads\//, '')))];
console.log(`${aMigrer.length} URL locale(s) en base, portant sur ${fichiersUniques.length} fichier(s) distinct(s).\n`);

/* ------------------------------------ PHASE 1 : televersement + verification */

console.log('PHASE 1 — televersement et verification\n');

const resultats = new Map(); // nom -> { url, shaLocal, shaR2, taille, mime, ok }
let echecs = 0;

for (const nom of fichiersUniques) {
  const extension = path.extname(nom).toLowerCase();
  const contentType = MIME[extension];

  if (!contentType) {
    console.log(`ECHEC  ${nom} — extension non geree (${extension})`);
    echecs += 1;
    continue;
  }

  let contenu;
  try {
    contenu = await readFile(path.join(RACINE, nom));
  } catch {
    console.log(`ECHEC  ${nom} — introuvable sur le disque`);
    echecs += 1;
    continue;
  }

  const shaLocal = createHash('sha256').update(contenu).digest('hex');
  const urlPublique = `${CONF.publicUrl}/${nom}`;

  if (!APPLIQUER) {
    console.log(`SIMULE ${nom}`);
    console.log(`       ${(contenu.length / 1024).toFixed(0)} Ko · ${contentType}`);
    console.log(`       SHA local ${shaLocal}`);
    console.log(`       -> ${urlPublique}\n`);
    resultats.set(nom, { url: urlPublique, ok: true });
    continue;
  }

  // Televersement
  try {
    const r = await requeteSignee('PUT', nom, contenu, contentType);
    if (!r.ok) {
      console.log(`ECHEC  ${nom} — televersement refuse (HTTP ${r.status})`);
      echecs += 1;
      continue;
    }
  } catch (e) {
    console.log(`ECHEC  ${nom} — R2 injoignable (${e.message})`);
    echecs += 1;
    continue;
  }

  // Relecture depuis l'URL PUBLIQUE : c'est le chemin qu'empruntera le
  // navigateur, donc le seul qui prouve reellement que l'image s'affichera.
  let shaR2 = null;
  let tailleR2 = null;
  let mimeR2 = null;
  try {
    const lecture = await fetch(urlPublique, { cache: 'no-store' });
    if (!lecture.ok) {
      console.log(`ECHEC  ${nom} — relecture publique HTTP ${lecture.status}`);
      echecs += 1;
      continue;
    }
    const recu = Buffer.from(await lecture.arrayBuffer());
    shaR2 = createHash('sha256').update(recu).digest('hex');
    tailleR2 = recu.length;
    mimeR2 = lecture.headers.get('content-type') ?? '';
  } catch (e) {
    console.log(`ECHEC  ${nom} — relecture impossible (${e.message})`);
    echecs += 1;
    continue;
  }

  const shaOk = shaLocal === shaR2;
  const tailleOk = tailleR2 === contenu.length;
  const mimeOk = mimeR2.startsWith(contentType);
  const ok = shaOk && tailleOk && mimeOk;
  if (!ok) echecs += 1;

  console.log(`${ok ? 'OK    ' : 'ECHEC '} ${nom}`);
  console.log(`       SHA-256  local ${shaLocal}`);
  console.log(`                R2    ${shaR2}  ${shaOk ? 'identique' : 'DIFFERENT'}`);
  console.log(`       taille   ${contenu.length} / ${tailleR2} octets  ${tailleOk ? 'identique' : 'DIFFERENTE'}`);
  console.log(`       type     ${mimeR2}  ${mimeOk ? 'conforme' : `attendu ${contentType}`}`);
  console.log(`       url      ${urlPublique}\n`);

  resultats.set(nom, { url: urlPublique, shaLocal, shaR2, taille: tailleR2, mime: mimeR2, ok });
}

/* ------------------------------------------ PHASE 2 : mise a jour de la base */

if (echecs) {
  console.log('─'.repeat(70));
  console.log(`\n${echecs} echec(s) en phase 1. LA BASE N'A PAS ETE MODIFIEE.`);
  console.log('Corrigez la cause avant de relancer. Les fichiers locaux sont intacts.');
  await prisma.$disconnect();
  process.exit(1);
}

if (!APPLIQUER) {
  console.log('─'.repeat(70));
  console.log('\nSimulation terminee. Relancez avec --appliquer pour televerser reellement.');
  await prisma.$disconnect();
  process.exit(0);
}

console.log('─'.repeat(70));
console.log('\nPHASE 2 — mise a jour des URL en base\n');

let misesAJour = 0;
for (const item of aMigrer) {
  const nom = item.url.replace(/^\/uploads\//, '');
  const resultat = resultats.get(nom);
  if (!resultat?.ok) continue;

  await item.cible.ecrire(item.id, resultat.url);
  misesAJour += 1;
  console.log(`  ${item.cible.libelle.padEnd(30)} ${item.contexte ?? item.id}`);
  console.log(`     ${item.url}  ->  ${resultat.url}`);
}

await prisma.auditLog.create({
  data: {
    action: 'MIGRATE',
    entity: 'Storage',
    entityId: 'public/uploads',
    details: `Migration vers R2 : ${fichiersUniques.length} fichier(s), ${misesAJour} URL mise(s) a jour.`,
  },
});

console.log(`\n${fichiersUniques.length} fichier(s) migre(s) et verifie(s), ${misesAJour} URL mise(s) a jour.`);
console.log('Les fichiers locaux ont ete CONSERVES dans public/uploads.');
console.log('\nEtape suivante : passer STORAGE_DRIVER=r2, puis');
console.log('  node --env-file=.env scripts/verifier-images.mjs');

await prisma.$disconnect();
