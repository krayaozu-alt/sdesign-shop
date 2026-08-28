/**
 * DIAGNOSTIC — un objet supprime est-il vraiment parti du bucket ?
 *
 * Un objet peut rester lisible sur l'URL publique alors qu'il n'est plus dans
 * le bucket : Cloudflare le sert alors depuis son cache de bordure. Ce script
 * distingue les deux en interrogeant :
 *   - l'URL publique (passe par le cache Cloudflare) ;
 *   - l'API S3 du bucket, avec une requete HEAD signee (jamais mise en cache).
 *
 * Aucune cle n'est affichee.
 *
 *   node --env-file=.env --import ./scripts/chargeur-src.mjs \
 *        scripts/diagnostic-suppression-r2.mjs
 */
import { deflateSync } from 'node:zlib';
import { saveUpload, removeUpload } from '@/server/uploads';
import { getStorage } from '@/server/storage';

function pngMinuscule() {
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
    bloc('IDAT', deflateSync(Buffer.from([0, 200, 30, 90]))),
    bloc('IEND', Buffer.alloc(0)),
  ]);
}

async function etatPublic(url) {
  const r = await fetch(url, { cache: 'no-store', headers: { 'cache-control': 'no-cache' } });
  return {
    statut: r.status,
    cfCache: r.headers.get('cf-cache-status') ?? '(absent)',
    age: r.headers.get('age') ?? '-',
  };
}

/** HEAD signee sur l'API S3 du bucket : la verite, sans cache CDN. */
async function etatBucket(cle) {
  const stockage = getStorage();
  const reponse = await stockage.requeteSignee('HEAD', cle, null);
  return { statut: reponse.status };
}

const stockage = getStorage();
if (typeof stockage.requeteSignee !== 'function') {
  console.log('Ce diagnostic exige le fournisseur R2 (requeteSignee absent). Stockage actif :', stockage.constructor.name);
  process.exit(1);
}

const fichier = new File([pngMinuscule()], 'diagnostic-suppression.png', { type: 'image/png' });
const envoi = await saveUpload(fichier);
if (!envoi?.ok) throw new Error(envoi?.error ?? 'televersement impossible');
const { url, key } = envoi;

console.log('DIAGNOSTIC — SUPPRESSION SUR R2');
console.log('='.repeat(72));
console.log(`Objet de test cree (cle masquee) : ${key.slice(0, 6)}…\n`);

console.log('Avant suppression :');
console.log('  URL publique :', JSON.stringify(await etatPublic(url)));
console.log('  API bucket   :', JSON.stringify(await etatBucket(key)));

const retire = await removeUpload(url);
console.log(`\nremoveUpload() a renvoye : ${retire}`);

console.log('\nApres suppression :');
const apresPublic = await etatPublic(url);
const apresBucket = await etatBucket(key);
console.log('  URL publique :', JSON.stringify(apresPublic));
console.log('  API bucket   :', JSON.stringify(apresBucket));

console.log('\nCONCLUSION');
if (apresBucket.statut === 404 && apresPublic.statut === 200) {
  console.log('  L’objet EST supprime du bucket. L’URL publique repond encore 200 :');
  console.log('  c’est le cache de bordure Cloudflare qui sert une copie. Aucun orphelin.');
} else if (apresBucket.statut === 404 && apresPublic.statut === 404) {
  console.log('  L’objet est supprime du bucket et n’est plus servi. Rien a signaler.');
} else if (apresBucket.statut === 200) {
  console.log('  DEFAUT REEL : l’objet est toujours dans le bucket apres suppression.');
} else {
  console.log(`  Situation inattendue : bucket ${apresBucket.statut}, public ${apresPublic.statut}.`);
}
