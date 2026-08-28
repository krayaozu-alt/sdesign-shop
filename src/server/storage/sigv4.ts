/**
 * Signature AWS Signature Version 4, calculée avec l'API Web Crypto.
 *
 * Ce module est volontairement séparé du fournisseur R2 et ne dépend ni de
 * Node, ni de `server-only` : il peut donc être exécuté tel quel par la suite
 * de tests (`scripts/verifier-sigv4.mjs`), qui le confronte aux vecteurs de
 * test officiels d'AWS. C'est la seule façon de vérifier cette signature sans
 * disposer d'un vrai compte Cloudflare.
 *
 * Fonctionne à l'identique sous Node 18+, sur un runtime edge et sur
 * Cloudflare Workers : `crypto.subtle` y est disponible partout.
 */

const encodeur = new TextEncoder();

export async function sha256Hex(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  const buffer = typeof data === 'string' ? encodeur.encode(data) : new Uint8Array(data as ArrayBuffer);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
  return hex(new Uint8Array(digest));
}

export async function hmac(cle: Uint8Array, message: string): Promise<Uint8Array> {
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    cle as unknown as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await globalThis.crypto.subtle.sign('HMAC', key, encodeur.encode(message));
  return new Uint8Array(signature);
}

export function hex(octets: Uint8Array): string {
  return Array.from(octets, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Encodage d'un segment de chemin conforme à AWS.
 * `encodeURIComponent` laisse passer ! ' ( ) * que la spécification exige
 * encodés ; on les complète pour éviter toute signature invalide sur un nom
 * de fichier exotique.
 */
export function encoderSegment(segment: string): string {
  return encodeURIComponent(segment).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** Horodatage AWS : 20260827T013600Z. */
export function amzDate(date: Date): string {
  return `${date.toISOString().replace(/[:-]|\.\d{3}/g, '')}`;
}

export type ParamsSignature = {
  methode: string;
  /** Chemin déjà encodé, commençant par « / ». */
  chemin: string;
  /** Chaîne de requête canonique, vide si aucune. */
  requete?: string;
  /** En-têtes à signer, noms en minuscules. Doit contenir « host ». */
  entetes: Record<string, string>;
  /** SHA-256 du corps, en hexadécimal. */
  payloadHash: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service: string;
  /** Horodatage AWS (voir `amzDate`). */
  date: string;
};

export type ResultatSignature = {
  authorization: string;
  canonicalRequest: string;
  stringToSign: string;
  signature: string;
  signedHeaders: string;
};

/** Calcule l'en-tête Authorization d'une requête SigV4. */
export async function signer(params: ParamsSignature): Promise<ResultatSignature> {
  const dateCourte = params.date.slice(0, 8);

  const noms = Object.keys(params.entetes).map((n) => n.toLowerCase()).sort();
  const valeurs = new Map(Object.entries(params.entetes).map(([n, v]) => [n.toLowerCase(), v.trim()]));

  const canonicalHeaders = noms.map((n) => `${n}:${valeurs.get(n)}\n`).join('');
  const signedHeaders = noms.join(';');

  const canonicalRequest = [
    params.methode,
    params.chemin,
    params.requete ?? '',
    canonicalHeaders,
    signedHeaders,
    params.payloadHash,
  ].join('\n');

  const scope = `${dateCourte}/${params.region}/${params.service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    params.date,
    scope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  let cle = await hmac(encodeur.encode(`AWS4${params.secretAccessKey}`), dateCourte);
  cle = await hmac(cle, params.region);
  cle = await hmac(cle, params.service);
  cle = await hmac(cle, 'aws4_request');
  const signature = hex(await hmac(cle, stringToSign));

  return {
    authorization:
      `AWS4-HMAC-SHA256 Credential=${params.accessKeyId}/${scope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    canonicalRequest,
    stringToSign,
    signature,
    signedHeaders,
  };
}
