import 'server-only';
import { LocalStorageProvider } from '@/server/storage/local';
import { R2StorageProvider } from '@/server/storage/r2';
import type { StorageProvider } from '@/server/storage/types';

export * from '@/server/storage/types';

let instance: StorageProvider | null = null;

/**
 * Fournisseur de stockage actif.
 *
 *   STORAGE_DRIVER=r2     -> Cloudflare R2 (production)
 *   STORAGE_DRIVER=local  -> disque local (developpement)
 *   non defini            -> R2 s'il est completement configure, sinon local
 *
 * Le repli sur le stockage local n'a lieu qu'en developpement : en production,
 * un R2 mal configure doit echouer visiblement plutot que d'ecrire sur un
 * disque qui disparaitra au deploiement.
 */
export function getStorage(): StorageProvider {
  if (instance) return instance;

  const demande = (process.env.STORAGE_DRIVER ?? '').toLowerCase();
  const r2 = new R2StorageProvider();

  if (demande === 'r2') {
    instance = r2;
  } else if (demande === 'local') {
    instance = new LocalStorageProvider();
  } else {
    instance = r2.isConfigured() ? r2 : new LocalStorageProvider();
  }

  if (instance.name === 'local' && process.env.NODE_ENV === 'production') {
    console.warn(
      '[storage] Stockage LOCAL actif en production : les fichiers téléversés ne survivront pas au déploiement. ' +
        'Configurez R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME et R2_PUBLIC_URL.',
    );
  }
  return instance;
}

/** Etat du stockage, affiche dans Admin > Paramètres. */
export function storageStatus(): {
  driver: string;
  configured: boolean;
  production: boolean;
  manquantes: string[];
} {
  const s = getStorage();
  return {
    driver: s.name,
    configured: s.isConfigured(),
    production: process.env.NODE_ENV === 'production',
    manquantes: s instanceof R2StorageProvider ? s.manquantes() : [],
  };
}
