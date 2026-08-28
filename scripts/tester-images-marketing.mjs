/**
 * BANC D'ESSAI — VISUELS DES ANNONCES SUR CLOUDFLARE R2 (Bloc 3)
 *
 * Prouve, sur le VRAI bucket, qu'aucun objet n'est laisse a l'abandon quand un
 * visuel est remplace ou supprime, et qu'aucun objet encore affiche quelque
 * part n'est efface. La preuve est faite par requete HTTP publique sur
 * l'objet : 200 = encore la, 404 = bien parti.
 *
 * Le point delicat : une publication dupliquee partage le visuel de
 * l'originale. Supprimer l'originale ne doit PAS casser la copie.
 *
 * Les objets et lignes crees ici sont tous supprimes a la fin.
 *
 *   node --env-file=.env --import ./scripts/chargeur-src.mjs \
 *        scripts/tester-images-marketing.mjs
 */
import { deflateSync } from 'node:zlib';
import { PrismaClient } from '@prisma/client';
import { saveUpload, retirerAncienFichier, verifierEcriture, urlEncoreReferencee } from '@/server/uploads';
import { getStorage } from '@/server/storage';

const prisma = new PrismaClient();
const PREFIXE = 'TEST_BLOC3_IMG_';

let reussis = 0;
let echoues = 0;
const creees = { posts: [], banners: [] };
const objets = [];

function verifier(intitule, condition, detail = '') {
  if (condition) {
    reussis += 1;
    console.log(`  OK    ${intitule}${detail ? ` — ${detail}` : ''}`);
  } else {
    echoues += 1;
    console.log(`  ECHEC ${intitule}${detail ? ` — ${detail}` : ''}`);
  }
}

/** PNG minimal valide, genere ici : aucune image reelle du commerce n'est utilisee. */
function pngDeTest(octetCouleur) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const o of buf) c = crcTable[(c ^ o) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const bloc = (type, donnees) => {
    const t = Buffer.from(type, 'ascii');
    const longueur = Buffer.alloc(4);
    longueur.writeUInt32BE(donnees.length);
    const sommeCorps = Buffer.concat([t, donnees]);
    const somme = Buffer.alloc(4);
    somme.writeUInt32BE(crc(sommeCorps));
    return Buffer.concat([longueur, sommeCorps, somme]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 2; // couleur RVB
  const brut = Buffer.from([0x00, octetCouleur, octetCouleur, octetCouleur]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloc('IHDR', ihdr),
    bloc('IDAT', deflateSync(brut)),
    bloc('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Un objet est-il encore DANS LE BUCKET ?
 *
 * On interroge l'API S3 par une requete HEAD signee, et non l'URL publique :
 * apres une suppression, Cloudflare continue de servir une copie depuis son
 * cache de bordure pendant un moment. L'URL publique repondrait donc 200 pour
 * un objet pourtant bien supprime — et masquerait la vraie reponse.
 */
const stockage = getStorage();
async function dansLeBucket(url) {
  const cle = url.replace(/^https?:\/\/[^/]+\//, '');
  const r = await stockage.requeteSignee('HEAD', cle, null);
  return r.status;
}

/** Etat vu par le navigateur de la cliente, cache CDN compris. */
async function vuDuPublic(url) {
  const r = await fetch(url, { method: 'GET', cache: 'no-store' });
  return { statut: r.status, cache: r.headers.get('cf-cache-status') ?? '(absent)' };
}

async function televerser(nom, couleur) {
  const octets = pngDeTest(couleur);
  const fichier = new File([octets], nom, { type: 'image/png' });
  const r = await saveUpload(fichier);
  if (!r?.ok) throw new Error(`Televersement impossible : ${r?.error ?? 'aucun fichier'}`);
  objets.push(r.url);
  const controle = await verifierEcriture(r.url, r.sha256);
  if (!controle.ok) throw new Error(`Verification impossible : ${controle.error}`);
  return r.url;
}

async function main() {
  console.log('BANC D’ESSAI — VISUELS DES ANNONCES SUR R2');
  console.log('='.repeat(72));

  /* ------------------------------------------------ 1. Envoi et lecture */
  console.log('\n1. ENVOI D’UN VISUEL');
  const urlA = await televerser(`${PREFIXE}a.png`, 0xff);
  verifier('L’objet est publiquement lisible apres envoi', (await vuDuPublic(urlA)).statut === 200);

  const post = await prisma.post.create({
    data: {
      slug: 'test-bloc3-img-publication',
      title: `${PREFIXE}Publication`,
      body: 'Texte de test.',
      status: 'BROUILLON',
      imageUrl: urlA,
    },
  });
  creees.posts.push(post.id);
  verifier('La base reconnait l’objet comme reference', await urlEncoreReferencee(urlA));

  /* ------------------------------------------------- 2. Remplacement */
  console.log('\n2. REMPLACEMENT DU VISUEL');
  const urlB = await televerser(`${PREFIXE}b.png`, 0x11);
  // Ordre impose : envoyer, verifier, ecrire en base, PUIS retirer l'ancien.
  await prisma.post.update({ where: { id: post.id }, data: { imageUrl: urlB } });
  const remplacement = await retirerAncienFichier(urlA, urlB);
  verifier('L’ancien objet est retire', remplacement.supprime, remplacement.raison);
  verifier('L’ancien objet a quitte le bucket', (await dansLeBucket(urlA)) === 404);
  verifier('Le nouvel objet est bien dans le bucket', (await dansLeBucket(urlB)) === 200);

  /* --------------------------- 3. Visuel partage par une duplication */
  console.log('\n3. VISUEL PARTAGE AVEC UNE COPIE');
  const copie = await prisma.post.create({
    data: {
      slug: 'test-bloc3-img-publication-copie',
      title: `${PREFIXE}Publication (copie)`,
      body: 'Texte de test.',
      status: 'BROUILLON',
      imageUrl: urlB, // la duplication partage volontairement le meme objet
    },
  });
  creees.posts.push(copie.id);

  const supprimee = await prisma.post.delete({ where: { id: post.id } });
  creees.posts = creees.posts.filter((id) => id !== post.id);
  const tentative = await retirerAncienFichier(supprimee.imageUrl, '');
  verifier(
    'Supprimer l’originale ne touche pas le visuel de la copie',
    !tentative.supprime,
    tentative.raison,
  );
  verifier('Le visuel de la copie est toujours dans le bucket', (await dansLeBucket(urlB)) === 200);

  /* ---------------------------------- 4. Suppression du dernier porteur */
  console.log('\n4. SUPPRESSION DE LA DERNIERE ANNONCE QUI PORTE LE VISUEL');
  const derniere = await prisma.post.delete({ where: { id: copie.id } });
  creees.posts = creees.posts.filter((id) => id !== copie.id);
  const retrait = await retirerAncienFichier(derniere.imageUrl, '');
  verifier('Le visuel est cette fois retire', retrait.supprime, retrait.raison);
  verifier('L’objet a quitte le bucket : aucun orphelin', (await dansLeBucket(urlB)) === 404);

  // Information, pas verdict : Cloudflare peut encore servir une copie depuis
  // son cache de bordure. L'objet n'est plus dans le bucket pour autant.
  const vuApres = await vuDuPublic(urlB);
  console.log(
    `  INFO  Vu du navigateur juste apres suppression : HTTP ${vuApres.statut} (cache Cloudflare : ${vuApres.cache})`,
  );

  /* --------------------------------- 5. Meme regle pour les bannieres */
  console.log('\n5. MEME REGLE POUR UNE BANNIERE');
  const urlC = await televerser(`${PREFIXE}c.png`, 0x77);
  const banner = await prisma.banner.create({
    data: {
      title: `${PREFIXE}Banniere`,
      placement: 'HERO',
      status: 'BROUILLON',
      imageUrl: urlC,
    },
  });
  creees.banners.push(banner.id);
  verifier('Le visuel de banniere est reconnu comme reference', await urlEncoreReferencee(urlC));

  // Retrait du visuel sans supprimer la banniere.
  await prisma.banner.update({ where: { id: banner.id }, data: { imageUrl: null } });
  const retraitBanniere = await retirerAncienFichier(urlC, '');
  verifier('Retirer le visuel d’une banniere retire l’objet', retraitBanniere.supprime, retraitBanniere.raison);
  verifier('L’objet de la banniere a quitte le bucket', (await dansLeBucket(urlC)) === 404);
}

async function nettoyer() {
  console.log('\nNETTOYAGE');
  for (const id of creees.posts) await prisma.post.delete({ where: { id } }).catch(() => {});
  for (const id of creees.banners) await prisma.banner.delete({ where: { id } }).catch(() => {});

  // Aucun objet de test ne doit rester sur R2, meme apres un echec.
  let restants = 0;
  for (const url of objets) {
    const statut = await dansLeBucket(url).catch(() => 0);
    if (statut === 200) {
      await retirerAncienFichier(url, '');
      const apres = await dansLeBucket(url).catch(() => 0);
      if (apres === 200) restants += 1;
    }
  }
  console.log(`  Objets de test restants sur R2 : ${restants}`);
  if (restants > 0) {
    console.log('  ATTENTION : du residu subsiste sur le bucket.');
    echoues += 1;
  }

  const lignes = await Promise.all([
    prisma.post.count({ where: { title: { startsWith: PREFIXE } } }),
    prisma.banner.count({ where: { title: { startsWith: PREFIXE } } }),
  ]);
  console.log(`  Lignes de test restantes : ${lignes.reduce((a, b) => a + b, 0)}`);
  if (lignes.reduce((a, b) => a + b, 0) > 0) echoues += 1;
}

try {
  await main();
} catch (e) {
  echoues += 1;
  console.error('\nERREUR :', e.message);
} finally {
  await nettoyer();
  await prisma.$disconnect();
}

console.log('\n' + '='.repeat(72));
console.log(`RESULTAT : ${reussis} test(s) reussi(s), ${echoues} echec(s).`);
process.exit(echoues === 0 ? 0 : 1);
