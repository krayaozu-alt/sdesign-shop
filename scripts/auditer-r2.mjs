/**
 * Audit du bucket R2 face aux references de la base.
 *
 * Repond a deux questions :
 *   - un objet du bucket n'est-il plus reference nulle part ? (ORPHELIN)
 *   - une URL en base pointe-t-elle vers un objet absent ?    (REFERENCE CASSEE)
 *
 * Le bucket doit contenir exactement les fichiers reellement utilises : ni
 * plus, ni moins. Une reference cassee affiche une image manquante sur le
 * site ; un orphelin reste publiquement accessible et continue d'etre facture.
 *
 * Par defaut, lecture seule. `--nettoyer` supprime les orphelins — et
 * uniquement eux : un fichier encore reference n'est jamais touche.
 *
 *   npm run auditer:r2
 *   node --env-file=.env scripts/auditer-r2.mjs --nettoyer
 */
import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { amzDate, encoderSegment, signer } from '../src/server/storage/sigv4.ts';

const NETTOYER = process.argv.includes('--nettoyer');

const CONF = {
  accountId: process.env.R2_ACCOUNT_ID ?? '',
  accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  bucket: process.env.R2_BUCKET_NAME ?? process.env.R2_BUCKET ?? '',
};

const absentes = Object.entries(CONF).filter(([, v]) => !v).map(([k]) => k);
if (absentes.length) {
  console.error(`Configuration R2 incomplete (${absentes.join(', ')}).`);
  process.exit(1);
}

async function s3(methode, cle = '', requete = '') {
  const host = `${CONF.accountId}.r2.cloudflarestorage.com`;
  const chemin = cle ? `/${CONF.bucket}/${cle.split('/').map(encoderSegment).join('/')}` : `/${CONF.bucket}`;
  const date = amzDate(new Date());
  const payloadHash = createHash('sha256').update(Buffer.alloc(0)).digest('hex');
  const entetes = { host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': date };
  const { authorization } = await signer({
    methode, chemin, requete, entetes, payloadHash,
    accessKeyId: CONF.accessKeyId, secretAccessKey: CONF.secretAccessKey,
    region: 'auto', service: 's3', date,
  });
  return fetch(`https://${host}${chemin}${requete ? `?${requete}` : ''}`, {
    method: methode,
    headers: { ...entetes, Authorization: authorization },
  });
}

/** Liste complete du bucket, en suivant la pagination. */
async function listerBucket() {
  const objets = [];
  let suite = '';
  do {
    const requete = `list-type=2${suite ? `&continuation-token=${encodeURIComponent(suite)}` : ''}`;
    const xml = await (await s3('GET', '', requete)).text();
    for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>[\s\S]*?<Size>(\d+)<\/Size>/g)) {
      objets.push({ cle: m[1], taille: Number(m[2]) });
    }
    suite = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1] ?? '';
  } while (suite);
  return objets;
}

const prisma = new PrismaClient();

/** Toutes les URL de fichier presentes en base, ramenees a leur cle d'objet. */
async function referencesEnBase() {
  const cles = new Map(); // cle -> [origines]
  const ajouter = (url, origine) => {
    if (typeof url !== 'string' || !url.trim()) return;
    const cle = url.replace(/^https?:\/\/[^/]+\//, '').replace(/^\/?uploads\//, '');
    if (!cles.has(cle)) cles.set(cle, []);
    cles.get(cle).push(origine);
  };

  // TOUS les reglages de type IMAGE, pas seulement le logo : la photo du hero
  // en fait partie. Ce recensement doit couvrir exactement le meme terrain que
  // `urlEncoreReferencee` dans src/server/uploads.ts — sinon l'audit declare
  // orphelin un fichier que l'application, elle, refuse de supprimer, et un
  // nettoyage fonde sur cet audit effacerait une image encore affichee.
  const domainePublic = (process.env.R2_PUBLIC_URL ?? '').replace(/\/+$/, '');
  for (const r of await prisma.setting.findMany({ select: { key: true, value: true, type: true } })) {
    if (typeof r.value !== 'string' || !r.value.trim()) continue;
    // Un reglage ne designe un fichier que s'il est de type IMAGE ou s'il
    // pointe sur le domaine du stockage. Sans ce filtre, les liens Facebook,
    // TikTok ou Google Maps — qui sont aussi des URL — seraient pris pour des
    // objets manquants et signales a tort comme references cassees.
    const estFichier = r.type === 'IMAGE' || (domainePublic && r.value.startsWith(`${domainePublic}/`));
    if (estFichier) ajouter(r.value, `réglage ${r.key}`);
  }
  for (const c of await prisma.course.findMany({ select: { imageUrl: true, name: true } })) ajouter(c.imageUrl, `formation ${c.name}`);
  for (const i of await prisma.courseImage.findMany({ include: { course: { select: { name: true } } } })) ajouter(i.url, `galerie ${i.course.name}`);
  for (const s of await prisma.service.findMany({ select: { imageUrl: true, name: true } })) ajouter(s.imageUrl, `prestation ${s.name}`);
  for (const g of await prisma.galleryItem.findMany({ select: { url: true, title: true } }).catch(() => [])) ajouter(g.url, `galerie publique ${g.title}`);
  for (const t of await prisma.trainer.findMany({ select: { photoUrl: true, fullName: true } })) ajouter(t.photoUrl, `formateur ${t.fullName}`);
  for (const u of await prisma.user.findMany({ select: { avatarUrl: true, fullName: true } })) ajouter(u.avatarUrl, `avatar ${u.fullName}`);
  for (const s of await prisma.courseSession.findMany({ select: { imageUrl: true, title: true } })) ajouter(s.imageUrl, `session ${s.title}`);
  for (const p of await prisma.post.findMany({ select: { imageUrl: true, images: true, title: true } })) {
    ajouter(p.imageUrl, `publication ${p.title}`);
    // `images` est un tableau JSON stocke en texte : on le lit prudemment.
    try {
      const liste = JSON.parse(p.images ?? '[]');
      if (Array.isArray(liste)) for (const u of liste) ajouter(u, `publication ${p.title} (galerie)`);
    } catch {
      /* champ mal forme : on l'ignore plutot que d'interrompre l'audit */
    }
  }
  for (const b of await prisma.banner.findMany({ select: { imageUrl: true, title: true } })) ajouter(b.imageUrl, `bannière ${b.title}`);
  return cles;
}

const [objets, references] = await Promise.all([listerBucket(), referencesEnBase()]);

const orphelins = objets.filter((o) => !references.has(o.cle));
const cassees = [...references.entries()].filter(([cle]) => !objets.some((o) => o.cle === cle));

console.log('=== AUDIT DU BUCKET R2 ===\n');
console.log(`  bucket                  : ${CONF.bucket}`);
console.log(`  objets stockes          : ${objets.length}`);
console.log(`  cles referencees en base: ${references.size}\n`);

for (const o of objets.sort((a, b) => a.cle.localeCompare(b.cle))) {
  const usages = references.get(o.cle);
  console.log(`  ${usages ? 'UTILISE ' : 'ORPHELIN'} ${String(o.taille).padStart(7)} o  ${o.cle}`);
  if (usages) console.log(`            ${usages.join(', ')}`);
}

if (cassees.length) {
  console.log('\n  REFERENCES CASSEES — la base pointe vers des objets absents :');
  for (const [cle, usages] of cassees) console.log(`    ${cle}  <- ${usages.join(', ')}`);
}

console.log(`\n  orphelins          : ${orphelins.length}`);
console.log(`  references cassees : ${cassees.length}`);

if (orphelins.length && NETTOYER) {
  console.log('\n  Suppression des orphelins :');
  for (const o of orphelins) {
    const r = await s3('DELETE', o.cle);
    console.log(`    ${r.ok || r.status === 404 ? 'OK   ' : 'ECHEC'} ${o.cle}  HTTP ${r.status}`);
  }
} else if (orphelins.length) {
  console.log('\n  Relancez avec --nettoyer pour les supprimer.');
}

if (!orphelins.length && !cassees.length) {
  console.log('\n  Le bucket contient exactement les fichiers utilises.');
}

await prisma.$disconnect();
process.exit(cassees.length || (orphelins.length && !NETTOYER) ? 1 : 0);
