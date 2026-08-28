import 'server-only';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { cleAleatoire, type StorageProvider, type StorageResult } from '@/server/storage/types';

/**
 * Stockage sur le disque local, dans public/uploads.
 * Utilise en developpement uniquement : ce dossier n'est ni persistant ni
 * accessible en ecriture sur Cloudflare.
 */
export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local' as const;

  private get racine(): string {
    return path.join(process.cwd(), 'public', 'uploads');
  }

  isConfigured(): boolean {
    return true;
  }

  async put(params: {
    data: ArrayBuffer;
    contentType: string;
    extension: string;
    folder?: string;
    key?: string;
  }): Promise<StorageResult> {
    try {
      const cle = params.key ?? cleAleatoire(params.extension, params.folder);
      const destination = path.join(this.racine, cle);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, Buffer.from(params.data));
      return {
        ok: true,
        file: {
          url: `/uploads/${cle}`,
          key: cle,
          size: params.data.byteLength,
          contentType: params.contentType,
        },
      };
    } catch {
      return { ok: false, error: 'Échec de l’enregistrement du fichier sur le disque.' };
    }
  }

  async remove(key: string): Promise<boolean> {
    try {
      await unlink(path.join(this.racine, key.replace(/^\/?uploads\//, '')));
      return true;
    } catch {
      return false;
    }
  }
}
