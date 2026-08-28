import 'server-only';
import { prisma } from '@/lib/prisma';
import { getStorage } from '@/server/storage';
import { TAILLE_MAX_OCTETS, TYPES_AUTORISES } from '@/server/storage/types';

export type UploadResult =
  | { ok: true; url: string; key: string; sha256: string }
  | { ok: false; error: string };

/**
 * Enregistrement d'un fichier televerse.
 *
 * Point d'entree unique de toute l'application : les server actions appellent
 * uniquement cette fonction et n'utilisent que l'URL retournee. Le fournisseur
 * reel (disque local en developpement, Cloudflare R2 en production) est choisi
 * par `getStorage()` — passer de l'un a l'autre ne demande aucune modification
 * ici ni ailleurs.
 *
 * L'empreinte SHA-256 du contenu envoye est retournee : elle permet de
 * verifier ensuite que l'objet ecrit est bien identique a l'original.
 *
 * Retourne `null` quand aucun fichier n'a ete envoye (champ laisse vide).
 */
export async function saveUpload(
  file: File | null | undefined,
  options?: { folder?: string },
): Promise<UploadResult | null> {
  if (!file || typeof file === 'string') return null;
  if (!file.size) return null;
  if (file.size > TAILLE_MAX_OCTETS) {
    return { ok: false, error: 'Fichier trop volumineux (6 Mo maximum).' };
  }

  const extension = TYPES_AUTORISES[file.type];
  if (!extension) {
    return { ok: false, error: 'Format non autorisé (JPG, PNG, WEBP, GIF, SVG, MP4, WEBM, PDF).' };
  }

  const octets = await file.arrayBuffer();
  const sha256 = await empreinte(octets);

  const resultat = await getStorage().put({
    data: octets,
    contentType: file.type,
    extension,
    folder: options?.folder,
  });

  if (!resultat.ok) return { ok: false, error: resultat.error };
  return { ok: true, url: resultat.file.url, key: resultat.file.key, sha256 };
}

/** Suppression d'un fichier a partir de son URL publique. Jamais bloquante. */
export async function removeUpload(url: string | null | undefined): Promise<boolean> {
  if (!url) return false;
  return getStorage().remove(cleDepuisUrl(url));
}

/* ========================================================================== */
/*                          REMPLACEMENT D'UN FICHIER                         */
/* ========================================================================== */

/**
 * Ordre imperatif lors d'un remplacement :
 *
 *   ancien fichier conserve
 *     -> nouveau fichier ecrit
 *     -> nouveau fichier VERIFIE (lisible, empreinte identique)
 *     -> reference mise a jour en base
 *     -> SEULEMENT ALORS, ancien fichier supprime
 *
 * L'ordre inverse (supprimer puis reecrire) rendrait l'image inaccessible a la
 * moindre erreur. Ici, tout echec laisse l'ancien fichier en place et la base
 * intacte : au pire un objet neuf reste inutilise, ce qui est sans consequence
 * pour les visiteurs.
 */

const TENTATIVES_VERIFICATION = 3;
const ATTENTE_MS = 400;

/** Cle de l'objet chez le fournisseur, deduite de son URL publique. */
function cleDepuisUrl(url: string): string {
  return url.replace(/^https?:\/\/[^/]+\//, '').replace(/^\/?uploads\//, '');
}

async function empreinte(donnees: ArrayBuffer): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', donnees);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export type VerificationEcriture = { ok: true } | { ok: false; error: string };

/**
 * Confirme que l'objet fraichement ecrit est reellement lisible a son URL
 * publique ET que son contenu est intact.
 *
 * C'est le chemin qu'empruntera le navigateur : le seul qui prouve que l'image
 * s'affichera. Quelques tentatives espacees absorbent le court delai de
 * propagation possible derriere un CDN.
 */
export async function verifierEcriture(url: string, sha256Attendu: string): Promise<VerificationEcriture> {
  // En stockage local, l'URL est relative : rien a verifier par le reseau, le
  // fichier vient d'etre ecrit sur le disque par le fournisseur lui-meme.
  if (!/^https?:\/\//i.test(url)) return { ok: true };

  let dernierEtat = '';
  for (let tentative = 1; tentative <= TENTATIVES_VERIFICATION; tentative += 1) {
    try {
      const reponse = await fetch(url, { cache: 'no-store' });
      if (reponse.ok) {
        const recu = await reponse.arrayBuffer();
        const shaRecu = await empreinte(recu);
        if (shaRecu === sha256Attendu) return { ok: true };
        return { ok: false, error: 'Le fichier enregistré ne correspond pas à celui envoyé.' };
      }
      dernierEtat = `HTTP ${reponse.status}`;
    } catch {
      dernierEtat = 'stockage injoignable';
    }
    if (tentative < TENTATIVES_VERIFICATION) {
      await new Promise((resoudre) => setTimeout(resoudre, ATTENTE_MS * tentative));
    }
  }
  return { ok: false, error: `Le fichier envoyé n’est pas lisible (${dernierEtat}).` };
}

/**
 * Vrai si l'URL est encore utilisee quelque part en base.
 *
 * Indispensable : plusieurs lignes peuvent partager le meme fichier. Une photo
 * de formation, par exemple, est referencee a la fois par `courses.imageUrl` et
 * par une ligne `course_images`. Supprimer l'objet sans ce controle laisserait
 * l'autre reference pointer dans le vide.
 */
export async function urlEncoreReferencee(url: string): Promise<boolean> {
  const comptes = await Promise.all([
    // TOUT reglage pointant sur ce fichier compte, pas seulement le logo :
    // le logo et la photo du hero peuvent parfaitement etre le meme fichier.
    // Ne regarder qu'une seule cle reviendrait a supprimer une image encore
    // affichee ailleurs sur le site.
    prisma.setting.count({ where: { value: url } }),
    prisma.course.count({ where: { imageUrl: url } }),
    prisma.courseImage.count({ where: { url } }),
    prisma.service.count({ where: { imageUrl: url } }),
    prisma.galleryItem.count({ where: { url } }).catch(() => 0),
    prisma.trainer.count({ where: { photoUrl: url } }),
    prisma.user.count({ where: { avatarUrl: url } }),
    // Sessions, publications et bannieres : une publication dupliquee partage
    // volontairement le visuel de l'originale. Sans ce comptage, supprimer
    // l'originale effacerait l'image encore affichee par la copie.
    prisma.courseSession.count({ where: { imageUrl: url } }),
    prisma.post.count({ where: { imageUrl: url } }),
    prisma.post.count({ where: { images: { contains: url } } }),
    prisma.banner.count({ where: { imageUrl: url } }),
  ]);
  return comptes.reduce((total, n) => total + n, 0) > 0;
}

export type Remplacement = { supprime: boolean; raison: string };

/**
 * Retire l'ancien fichier, APRES que la base a ete mise a jour.
 *
 * A n'appeler qu'une fois la nouvelle URL enregistree. La fonction refuse de
 * supprimer si l'ancienne URL est encore utilisee ailleurs, ou si elle est
 * identique a la nouvelle. Elle ne leve jamais d'exception : un echec de
 * suppression laisse un objet inutilise, ce qui n'a aucun effet visible.
 */
export async function retirerAncienFichier(
  ancienneUrl: string | null | undefined,
  nouvelleUrl: string,
): Promise<Remplacement> {
  if (!ancienneUrl?.trim()) return { supprime: false, raison: 'aucun fichier precedent' };
  if (ancienneUrl === nouvelleUrl) return { supprime: false, raison: 'meme fichier' };

  // Ne jamais retirer un fichier livre avec le projet : seuls les fichiers
  // televerses, qui portent une cle generee, sont concernes.
  if (!ancienneUrl.startsWith('/uploads/') && !/^https?:\/\//i.test(ancienneUrl)) {
    return { supprime: false, raison: 'fichier hors stockage applicatif' };
  }

  try {
    if (await urlEncoreReferencee(ancienneUrl)) {
      return { supprime: false, raison: 'encore reference ailleurs en base' };
    }
  } catch {
    // Dans le doute, on conserve : un objet en trop est preferable a une
    // reference cassee.
    return { supprime: false, raison: 'controle des references impossible' };
  }

  const retire = await removeUpload(ancienneUrl);
  return { supprime: retire, raison: retire ? 'retire du stockage' : 'suppression refusee par le stockage' };
}
