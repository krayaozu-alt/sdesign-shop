/**
 * Verification de bout en bout de Cloudflare R2, avec de vraies cles.
 *
 * Ecrit un objet de test, verifie qu'il est lisible depuis l'URL publique,
 * puis le supprime. Utilise le module de signature de production
 * (src/server/storage/sigv4.ts), deja valide par scripts/verifier-sigv4.mjs.
 *
 *   node --env-file=.env scripts/verifier-r2.mjs
 *
 * Aucune donnee metier n'est touchee : seul un fichier temporaire
 * « diagnostic/... » est cree puis efface.
 */
import { createHash } from 'node:crypto';
import { amzDate, encoderSegment, signer } from '../src/server/storage/sigv4.ts';

const CONF = {
  accountId: process.env.R2_ACCOUNT_ID ?? '',
  accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  bucket: process.env.R2_BUCKET_NAME ?? process.env.R2_BUCKET ?? '',
  publicUrl: (process.env.R2_PUBLIC_URL ?? '').replace(/\/+$/, ''),
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
  console.error(`Variables manquantes : ${absentes.join(', ')}`);
  process.exit(1);
}

async function requete(methode, cle, corps, contentType) {
  const host = `${CONF.accountId}.r2.cloudflarestorage.com`;
  const chemin = `/${CONF.bucket}/${cle.split('/').map(encoderSegment).join('/')}`;
  const date = amzDate(new Date());
  const payloadHash = createHash('sha256')
    .update(corps ?? Buffer.alloc(0))
    .digest('hex');

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

console.log('=== VERIFICATION CLOUDFLARE R2 ===\n');
console.log(`Compte   : ${CONF.accountId.slice(0, 6)}…`);
console.log(`Bucket   : ${CONF.bucket}`);
console.log(`Publique : ${CONF.publicUrl}\n`);

let echecs = 0;
const etape = (ok, libelle, detail) => {
  if (!ok) echecs += 1;
  console.log(`${ok ? 'OK   ' : 'ECHEC'} ${libelle}${detail ? `\n      ${detail}` : ''}`);
};

// Chemin et contenu fixes : facilement identifiables dans le bucket, et le
// controle de lecture peut comparer le contenu octet pour octet.
const cle = '__sdesign-test__/healthcheck.txt';
const contenu = Buffer.from('SDesign-Shop-R2-TEST', 'utf8');

// 1. Ecriture signee
let reponse;
try {
  reponse = await requete('PUT', cle, contenu, 'text/plain; charset=utf-8');
  etape(
    reponse.ok,
    'Ecriture (PUT signe)',
    reponse.ok ? cle : `HTTP ${reponse.status} — ${(await reponse.text()).slice(0, 200)}`,
  );
} catch (e) {
  etape(false, 'Ecriture (PUT signe)', `endpoint injoignable : ${e.message}`);
}

if (!echecs) {
  // 2. Lecture publique
  const url = `${CONF.publicUrl}/${cle}`;
  try {
    const lecture = await fetch(url, { cache: 'no-store' });
    const texte = lecture.ok ? await lecture.text() : '';
    etape(
      lecture.ok && texte === contenu.toString('utf8'),
      'Lecture depuis l’URL publique',
      lecture.ok
        ? `contenu identique (${texte.length} octets)`
        : `HTTP ${lecture.status} — l’acces public du bucket n’est probablement pas active`,
    );
  } catch (e) {
    etape(false, 'Lecture depuis l’URL publique', `injoignable : ${e.message}`);
  }

  // 3. Suppression
  try {
    const suppression = await requete('DELETE', cle, null);
    etape(suppression.ok || suppression.status === 404, 'Suppression (DELETE signe)', `HTTP ${suppression.status}`);
  } catch (e) {
    etape(false, 'Suppression (DELETE signe)', e.message);
  }
}

console.log(
  `\n${echecs === 0 ? 'R2 EST OPERATIONNEL — vous pouvez lancer scripts/migrer-vers-r2.mjs' : `${echecs} ECHEC(S)`}`,
);
process.exit(echecs === 0 ? 0 : 1);
