import 'server-only';
import { amzDate, encoderSegment, sha256Hex, signer } from '@/server/storage/sigv4';
import { cleAleatoire, type StorageProvider, type StorageResult } from '@/server/storage/types';

/**
 * Stockage Cloudflare R2 via son API compatible S3.
 *
 * La signature AWS SigV4 est deleguee a `sigv4.ts`, verifie par
 * `scripts/verifier-sigv4.mjs` contre les vecteurs officiels d'AWS et contre
 * une seconde implementation independante. Aucune dependance ajoutee : le code
 * repose sur Web Crypto et fonctionne sous Node comme sur Cloudflare Workers.
 *
 * Variables d'environnement (voir .env.example) :
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *   R2_BUCKET_NAME, R2_PUBLIC_URL
 */

const REGION = 'auto';
const SERVICE = 's3';

export class R2StorageProvider implements StorageProvider {
  readonly name = 'r2' as const;

  private get conf() {
    return {
      accountId: process.env.R2_ACCOUNT_ID ?? '',
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
      // R2_BUCKET reste accepte pour ne pas casser une configuration existante.
      bucket: process.env.R2_BUCKET_NAME ?? process.env.R2_BUCKET ?? '',
      publicUrl: (process.env.R2_PUBLIC_URL ?? '').replace(/\/+$/, ''),
    };
  }

  isConfigured(): boolean {
    const c = this.conf;
    return Boolean(c.accountId && c.accessKeyId && c.secretAccessKey && c.bucket && c.publicUrl);
  }

  /** Liste des variables manquantes, pour un diagnostic clair dans l'administration. */
  manquantes(): string[] {
    const c = this.conf;
    const absentes: string[] = [];
    if (!c.accountId) absentes.push('R2_ACCOUNT_ID');
    if (!c.accessKeyId) absentes.push('R2_ACCESS_KEY_ID');
    if (!c.secretAccessKey) absentes.push('R2_SECRET_ACCESS_KEY');
    if (!c.bucket) absentes.push('R2_BUCKET_NAME');
    if (!c.publicUrl) absentes.push('R2_PUBLIC_URL');
    return absentes;
  }

  private async requeteSignee(
    methode: 'PUT' | 'DELETE' | 'HEAD',
    cle: string,
    corps: ArrayBuffer | null,
    contentType?: string,
  ): Promise<Response> {
    const c = this.conf;
    const host = `${c.accountId}.r2.cloudflarestorage.com`;
    const chemin = `/${c.bucket}/${cle.split('/').map(encoderSegment).join('/')}`;
    const date = amzDate(new Date());
    const payloadHash = await sha256Hex(corps ?? '');

    const entetes: Record<string, string> = {
      host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': date,
    };
    if (contentType) entetes['content-type'] = contentType;

    const { authorization } = await signer({
      methode,
      chemin,
      entetes,
      payloadHash,
      accessKeyId: c.accessKeyId,
      secretAccessKey: c.secretAccessKey,
      region: REGION,
      service: SERVICE,
      date,
    });

    return fetch(`https://${host}${chemin}`, {
      method: methode,
      headers: { ...entetes, Authorization: authorization },
      body: corps ?? undefined,
    });
  }

  async put(params: {
    data: ArrayBuffer;
    contentType: string;
    extension: string;
    folder?: string;
    /** Clé imposée (migration d'un fichier existant). Sinon clé aléatoire. */
    key?: string;
  }): Promise<StorageResult> {
    if (!this.isConfigured()) {
      return { ok: false, error: `Stockage R2 non configuré (${this.manquantes().join(', ')}).` };
    }
    const cle = params.key ?? cleAleatoire(params.extension, params.folder);
    try {
      const reponse = await this.requeteSignee('PUT', cle, params.data, params.contentType);
      if (!reponse.ok) {
        return { ok: false, error: `R2 a refusé le fichier (HTTP ${reponse.status}).` };
      }
      return {
        ok: true,
        file: {
          url: `${this.conf.publicUrl}/${cle}`,
          key: cle,
          size: params.data.byteLength,
          contentType: params.contentType,
        },
      };
    } catch {
      return { ok: false, error: 'Stockage R2 injoignable.' };
    }
  }

  async remove(key: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const reponse = await this.requeteSignee('DELETE', key, null);
      return reponse.ok || reponse.status === 404;
    } catch {
      return false;
    }
  }

  /**
   * Test de bout en bout des identifiants : ecrit un petit objet, verifie qu'il
   * est lisible depuis l'URL publique, puis le supprime. Utilise par
   * `scripts/verifier-r2.mjs` et par le diagnostic de l'administration.
   */
  async diagnostic(): Promise<{ ok: boolean; etapes: Array<{ etape: string; ok: boolean; detail: string }> }> {
    const etapes: Array<{ etape: string; ok: boolean; detail: string }> = [];
    const ajouter = (etape: string, ok: boolean, detail: string) => etapes.push({ etape, ok, detail });

    if (!this.isConfigured()) {
      ajouter('Configuration', false, `Variables manquantes : ${this.manquantes().join(', ')}`);
      return { ok: false, etapes };
    }
    ajouter('Configuration', true, `bucket « ${this.conf.bucket} », public ${this.conf.publicUrl}`);

    const contenu = new TextEncoder().encode(`diagnostic S.DESIGN SHOP ${new Date().toISOString()}`);
    const cle = `diagnostic/${Date.now().toString(36)}.txt`;

    const ecriture = await this.put({
      data: contenu.buffer.slice(0) as ArrayBuffer,
      contentType: 'text/plain',
      extension: '.txt',
      key: cle,
    });
    ajouter('Écriture (PUT signé)', ecriture.ok, ecriture.ok ? ecriture.file.url : ecriture.error);
    if (!ecriture.ok) return { ok: false, etapes };

    let lectureOk = false;
    let lectureDetail = '';
    try {
      const r = await fetch(ecriture.file.url, { cache: 'no-store' });
      lectureOk = r.ok;
      lectureDetail = r.ok
        ? `HTTP ${r.status}, ${(await r.text()).slice(0, 40)}…`
        : `HTTP ${r.status} — l'accès public du bucket n'est probablement pas activé.`;
    } catch {
      lectureDetail = 'URL publique injoignable.';
    }
    ajouter('Lecture publique', lectureOk, lectureDetail);

    const suppression = await this.remove(cle);
    ajouter('Suppression (DELETE signé)', suppression, suppression ? 'objet retiré' : 'échec de la suppression');

    return { ok: etapes.every((e) => e.ok), etapes };
  }
}
