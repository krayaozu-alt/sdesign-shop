/**
 * Contrat de stockage des fichiers de S.DESIGN SHOP.
 *
 * Le reste de l'application ne connait QUE l'URL publique retournee ici :
 * changer de fournisseur (disque local -> Cloudflare R2) ne demande aucune
 * modification des server actions, des pages ou de la base de donnees.
 */
export type StoredFile = {
  /** URL publique utilisable directement dans une balise <img src>. */
  url: string;
  /** Cle interne du fichier chez le fournisseur (chemin ou objet R2). */
  key: string;
  size: number;
  contentType: string;
};

export type StorageResult = { ok: true; file: StoredFile } | { ok: false; error: string };

export interface StorageProvider {
  /** Identifiant lisible du fournisseur, affiche dans l'administration. */
  readonly name: 'local' | 'r2';
  /** Vrai quand la configuration necessaire est presente. */
  isConfigured(): boolean;
  /**
   * Enregistre un fichier et retourne son URL publique.
   * `key` force le nom de l'objet : reserve a la migration de fichiers
   * existants, les televersements normaux tirent une cle aleatoire.
   */
  put(params: {
    data: ArrayBuffer;
    contentType: string;
    extension: string;
    folder?: string;
    key?: string;
  }): Promise<StorageResult>;
  /** Supprime un fichier a partir de sa cle. Ne doit jamais lever d'exception. */
  remove(key: string): Promise<boolean>;
}

/** Types de fichiers acceptes, avec leur extension normalisee. */
export const TYPES_AUTORISES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'application/pdf': '.pdf',
};

export const TAILLE_MAX_OCTETS = 6 * 1024 * 1024; // 6 Mo

/** Nom de fichier aleatoire : aucun nom fourni par le client n'est reutilise. */
export function cleAleatoire(extension: string, folder?: string): string {
  const octets = new Uint8Array(8);
  globalThis.crypto.getRandomValues(octets);
  const suffixe = Array.from(octets, (b) => b.toString(16).padStart(2, '0')).join('');
  const nom = `${Date.now().toString(36)}-${suffixe}${extension}`;
  return folder ? `${folder}/${nom}` : nom;
}
