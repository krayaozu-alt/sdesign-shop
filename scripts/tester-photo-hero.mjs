/**
 * BANC D'ESSAI — PHOTO DU HERO SUR R2
 *
 * Prouve, sur le vrai bucket, que la photo du hero suit exactement le meme
 * circuit securise que le logo :
 *
 *   envoi -> verification SHA-256 -> ecriture du reglage -> retrait de
 *   l'ancien fichier, et uniquement s'il n'est plus reference nulle part.
 *
 * Le cas le plus delicat est teste explicitement : lorsqu'un MEME fichier sert
 * a la fois de logo et de photo du hero, remplacer l'un ne doit surtout pas
 * effacer l'autre.
 *
 * Le reglage reel est releve au debut et restaure a la fin : la configuration
 * de la boutique ressort inchangee.
 *
 *   node --env-file=.env --import ./scripts/chargeur-src.mjs \
 *        scripts/tester-photo-hero.mjs
 */
import { deflateSync } from 'node:zlib';
import { PrismaClient } from '@prisma/client';
import { saveUpload, verifierEcriture, retirerAncienFichier, urlEncoreReferencee } from '@/server/uploads';
import { getStorage } from '@/server/storage';

const prisma = new PrismaClient();
const stockage = getStorage();

let reussis = 0;
let echoues = 0;
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

/** PNG minuscule genere ici : aucune image reelle n'est utilisee comme cobaye. */
function png(teinte) {
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b) => {
    let c = 0xffffffff;
    for (const o of b) c = table[(c ^ o) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const bloc = (type, d) => {
    const t = Buffer.from(type, 'ascii');
    const l = Buffer.alloc(4);
    l.writeUInt32BE(d.length);
    const s = Buffer.alloc(4);
    s.writeUInt32BE(crc(Buffer.concat([t, d])));
    return Buffer.concat([l, t, d, s]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloc('IHDR', ihdr),
    bloc('IDAT', deflateSync(Buffer.from([0, teinte, teinte, teinte]))),
    bloc('IEND', Buffer.alloc(0)),
  ]);
}

/** Verite du bucket, sans passer par le cache de bordure Cloudflare. */
async function dansLeBucket(url) {
  const cle = url.replace(/^https?:\/\/[^/]+\//, '');
  return (await stockage.requeteSignee('HEAD', cle, null)).status;
}

async function envoyer(nom, teinte) {
  const r = await saveUpload(new File([png(teinte)], nom, { type: 'image/png' }));
  if (!r?.ok) throw new Error(r?.error ?? 'envoi impossible');
  objets.push(r.url);
  const controle = await verifierEcriture(r.url, r.sha256);
  if (!controle.ok) throw new Error(controle.error);
  return r.url;
}

const lireReglage = async (cle) => (await prisma.setting.findUnique({ where: { key: cle } }))?.value ?? '';
async function ecrireReglage(cle, valeur) {
  await prisma.setting.upsert({
    where: { key: cle },
    update: { value: valeur },
    create: { key: cle, value: valeur, label: cle, group: 'IDENTITE', type: 'IMAGE' },
  });
}

// Etat reel, releve avant tout et restaure a la fin.
const logoInitial = await lireReglage('shop.logoUrl');
const heroInitial = await lireReglage('hero.imageUrl');

async function main() {
  console.log('BANC D’ESSAI — PHOTO DU HERO');
  console.log('='.repeat(70));
  console.log(`Logo reel conserve : ${logoInitial ? 'oui' : '(aucun)'}`);
  console.log(`Photo hero reelle  : ${heroInitial ? 'oui' : '(aucune)'}\n`);

  /* --------------------------------------------- 1. Premiere photo */
  console.log('1. ENVOI D’UNE PREMIERE PHOTO');
  const a = await envoyer('test-hero-a.png', 0xd0);
  verifier('Le fichier est bien ecrit dans le bucket', (await dansLeBucket(a)) === 200);
  await ecrireReglage('hero.imageUrl', a);
  verifier('Le reglage reconnait le fichier comme reference', await urlEncoreReferencee(a));

  /* ------------------------------------------------ 2. Remplacement */
  console.log('\n2. REMPLACEMENT DE LA PHOTO');
  const b = await envoyer('test-hero-b.png', 0x40);
  await ecrireReglage('hero.imageUrl', b);
  const r1 = await retirerAncienFichier(a, b);
  verifier('L’ancienne photo est retiree', r1.supprime, r1.raison);
  verifier('L’ancienne a quitte le bucket', (await dansLeBucket(a)) === 404);
  verifier('La nouvelle est bien en place', (await dansLeBucket(b)) === 200);

  /* ------------------- 3. Meme fichier pour le logo ET pour le hero */
  console.log('\n3. MEME FICHIER POUR LE LOGO ET POUR LE HERO');
  await ecrireReglage('shop.logoUrl', b); // le logo pointe sur la meme image
  const c = await envoyer('test-hero-c.png', 0x90);
  await ecrireReglage('shop.logoUrl', c); // on remplace le logo
  const r2 = await retirerAncienFichier(b, c);
  verifier(
    'Remplacer le logo ne supprime PAS la photo du hero',
    !r2.supprime,
    r2.raison,
  );
  verifier('La photo du hero est toujours lisible', (await dansLeBucket(b)) === 200);

  /* ------------------------------- 4. Retrait du dernier porteur */
  console.log('\n4. PLUS AUCUN REGLAGE NE POINTE SUR LE FICHIER');
  await ecrireReglage('hero.imageUrl', '');
  const r3 = await retirerAncienFichier(b, '');
  verifier('Le fichier est cette fois retire', r3.supprime, r3.raison);
  verifier('Il a quitte le bucket : aucun orphelin', (await dansLeBucket(b)) === 404);
}

async function restaurer() {
  console.log('\nRESTAURATION');
  await ecrireReglage('shop.logoUrl', logoInitial);
  await ecrireReglage('hero.imageUrl', heroInitial);
  const logo = await lireReglage('shop.logoUrl');
  const hero = await lireReglage('hero.imageUrl');
  verifier('Le logo reel est remis en place', logo === logoInitial);
  verifier('Le reglage de la photo du hero est remis en place', hero === heroInitial);

  // Le logo reel ne doit surtout pas avoir ete touche sur le bucket.
  if (logoInitial) {
    verifier('Le fichier du logo reel est intact sur le bucket', (await dansLeBucket(logoInitial)) === 200);
  }

  let restants = 0;
  for (const url of objets) {
    if ((await dansLeBucket(url).catch(() => 0)) === 200) {
      await retirerAncienFichier(url, '');
      if ((await dansLeBucket(url).catch(() => 0)) === 200) restants += 1;
    }
  }
  console.log(`  Objets de test restants sur R2 : ${restants}`);
  if (restants > 0) echoues += 1;
}

try {
  await main();
} catch (e) {
  echoues += 1;
  console.error('\nERREUR :', e.message);
} finally {
  await restaurer();
  await prisma.$disconnect();
}

console.log('\n' + '='.repeat(70));
console.log(`RESULTAT : ${reussis} test(s) reussi(s), ${echoues} echec(s).`);
process.exit(echoues === 0 ? 0 : 1);
