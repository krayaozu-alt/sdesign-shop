/**
 * Verification de la signature AWS SigV4 utilisee pour Cloudflare R2.
 *
 * Ce script importe DIRECTEMENT le module de production
 * (src/server/storage/sigv4.ts, execute par Node grace au support natif de
 * TypeScript) : ce qui est verifie ici est exactement ce qui tournera en
 * production, et non une copie.
 *
 * Deux niveaux de controle :
 *   1. le vecteur de test officiel d'AWS (aws-sig-v4-test-suite) ;
 *   2. un controle differentiel contre une seconde implementation ecrite
 *      independamment avec node:crypto, sur la forme reelle de nos requetes
 *      R2 et sur 200 requetes tirees au hasard.
 *
 * C'est la seule verification serieuse possible sans compte Cloudflare reel.
 * Une fois les cles disponibles, utilisez scripts/verifier-r2.mjs.
 *
 *   node scripts/verifier-sigv4.mjs
 */
import { createHash, createHmac } from 'node:crypto';
import { amzDate, encoderSegment, sha256Hex, signer } from '../src/server/storage/sigv4.ts';

const VIDE = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const CLE = { accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY' };
const R2 = { region: 'auto', service: 's3', date: '20260827T013600Z' };

let echecs = 0;
const controle = (ok, libelle, detail) => {
  if (!ok) echecs++;
  console.log(`${ok ? 'OK   ' : 'ECHEC'} ${libelle}${detail ? `\n      ${detail}` : ''}`);
};

/* ------------------------------------------------ 1. Vecteur officiel AWS */

console.log('1. Vecteur de test officiel AWS (aws-sig-v4-test-suite)\n');

const officiel = await signer({
  methode: 'GET',
  chemin: '/',
  requete: '',
  entetes: { host: 'example.amazonaws.com', 'x-amz-date': '20150830T123600Z' },
  payloadHash: VIDE,
  ...CLE,
  region: 'us-east-1',
  service: 'service',
  date: '20150830T123600Z',
});
controle(
  officiel.signature === '5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31',
  'get-vanilla',
  officiel.signature,
);

/* ------------------------------------------- 2. Implementation de reference */

function referenceSigner(p) {
  const sha = (x) => createHash('sha256').update(x).digest('hex');
  const noms = Object.keys(p.entetes).map((n) => n.toLowerCase()).sort();
  const val = new Map(Object.entries(p.entetes).map(([n, v]) => [n.toLowerCase(), v.trim()]));
  const canonical = [
    p.methode,
    p.chemin,
    p.requete ?? '',
    noms.map((n) => `${n}:${val.get(n)}\n`).join(''),
    noms.join(';'),
    p.payloadHash,
  ].join('\n');
  const scope = `${p.date.slice(0, 8)}/${p.region}/${p.service}/aws4_request`;
  const sts = ['AWS4-HMAC-SHA256', p.date, scope, sha(canonical)].join('\n');
  let k = createHmac('sha256', `AWS4${p.secretAccessKey}`).update(p.date.slice(0, 8)).digest();
  k = createHmac('sha256', k).update(p.region).digest();
  k = createHmac('sha256', k).update(p.service).digest();
  k = createHmac('sha256', k).update('aws4_request').digest();
  return createHmac('sha256', k).update(sts).digest('hex');
}

console.log('\n2. Controle differentiel (Web Crypto contre node:crypto)\n');

const CAS = [
  {
    nom: 'PUT R2 — logo (forme reelle de l’application)',
    methode: 'PUT',
    chemin: '/sdesign-shop/marque/logo-officiel.jpg',
    entetes: {
      host: 'abc123.r2.cloudflarestorage.com',
      'x-amz-content-sha256': 'a'.repeat(64),
      'x-amz-date': R2.date,
      'content-type': 'image/jpeg',
    },
    payloadHash: 'a'.repeat(64),
  },
  {
    nom: 'DELETE R2 — suppression d’un objet',
    methode: 'DELETE',
    chemin: '/sdesign-shop/formations/photo-73kd92.webp',
    entetes: {
      host: 'abc123.r2.cloudflarestorage.com',
      'x-amz-content-sha256': VIDE,
      'x-amz-date': R2.date,
    },
    payloadHash: VIDE,
  },
  {
    nom: 'PUT — nom de fichier accentue et espaces',
    methode: 'PUT',
    chemin: `/sdesign-shop/${encoderSegment('turban marié (officiel).png')}`,
    entetes: {
      host: 'abc123.r2.cloudflarestorage.com',
      'x-amz-content-sha256': 'f'.repeat(64),
      'x-amz-date': R2.date,
      'content-type': 'image/png',
    },
    payloadHash: 'f'.repeat(64),
  },
];

for (const cas of CAS) {
  const params = { ...cas, ...R2, ...CLE };
  const nous = (await signer(params)).signature;
  const reference = referenceSigner(params);
  controle(nous === reference, cas.nom, nous === reference ? nous : `obtenu ${nous}\n      attendu ${reference}`);
}

let desaccords = 0;
for (let i = 0; i < 200; i += 1) {
  const params = {
    methode: ['PUT', 'DELETE', 'GET', 'HEAD'][i % 4],
    chemin: `/${encoderSegment(`seau-${i}`)}/${encoderSegment(`objet ${i}!'()*.bin`)}`,
    requete: i % 3 === 0 ? `x-id=${i}` : '',
    entetes: {
      host: `compte${i}.r2.cloudflarestorage.com`,
      'x-amz-date': R2.date,
      'x-amz-content-sha256': createHash('sha256').update(String(i)).digest('hex'),
      ...(i % 2 ? { 'content-type': 'application/octet-stream' } : {}),
      ...(i % 5 === 0 ? { 'X-Amz-Meta-Origine': ' valeur  espacee ' } : {}),
    },
    payloadHash: createHash('sha256').update(String(i)).digest('hex'),
    ...R2,
    ...CLE,
  };
  if ((await signer(params)).signature !== referenceSigner(params)) desaccords += 1;
}
controle(desaccords === 0, `200 requetes aleatoires : ${200 - desaccords}/200 identiques`);

/* ------------------------------------------------- 3. Fonctions auxiliaires */

console.log('\n3. Fonctions auxiliaires\n');
controle((await sha256Hex('')) === VIDE, 'SHA-256 d’un corps vide');
controle(
  encoderSegment("photo (1)*'!.jpg") === 'photo%20%281%29%2A%27%21.jpg',
  'Encodage de segment conforme a AWS',
  encoderSegment("photo (1)*'!.jpg"),
);
controle(
  amzDate(new Date('2026-08-27T01:36:00.123Z')) === '20260827T013600Z',
  'Horodatage AWS',
  amzDate(new Date('2026-08-27T01:36:00.123Z')),
);

console.log(`\n${echecs === 0 ? 'TOUS LES CONTROLES SONT PASSES' : `${echecs} ECHEC(S)`}`);
process.exit(echecs === 0 ? 0 : 1);
