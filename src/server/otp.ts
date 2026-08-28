import 'server-only';
import { prisma } from '@/lib/prisma';

/**
 * Codes de vérification à usage unique.
 *
 * Choix de sécurité :
 * - code de 6 chiffres tiré du CSPRNG (`crypto.getRandomValues`), sans biais ;
 * - stockage d'une empreinte **HMAC-SHA256** clé par AUTH_SECRET : une fuite de
 *   la base ne permet pas de retrouver les codes par force brute, la clé
 *   n'y figurant pas ;
 * - validité 10 minutes, usage unique, 5 tentatives maximum ;
 * - délai anti-spam de 60 s entre deux envois, 5 envois par heure au plus ;
 * - le code en clair n'existe qu'en mémoire, le temps de l'envoi de l'e-mail.
 */

export const OTP_PURPOSES = {
  EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
  PASSWORD_RESET: 'PASSWORD_RESET',
} as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[keyof typeof OTP_PURPOSES];

export const OTP_VALIDITE_MINUTES = 10;
export const OTP_TENTATIVES_MAX = 5;
export const OTP_DELAI_RENVOI_SECONDES = 60;
export const OTP_ENVOIS_MAX_PAR_HEURE = 5;

const encodeur = new TextEncoder();

/** Code à 6 chiffres, tirage uniforme (rejet des valeurs qui biaiseraient le modulo). */
export function genererCode(): string {
  const max = 1_000_000;
  const limite = Math.floor(0xffffffff / max) * max;
  const buffer = new Uint32Array(1);
  let valeur = 0;
  do {
    globalThis.crypto.getRandomValues(buffer);
    valeur = buffer[0];
  } while (valeur >= limite);
  return String(valeur % max).padStart(6, '0');
}

async function empreinte(code: string, purpose: string, userId: string): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) throw new Error('AUTH_SECRET manquant ou trop court');
  const cle = await globalThis.crypto.subtle.importKey(
    'raw',
    encodeur.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  // Le contexte (utilisateur + usage) est signé avec le code : une empreinte
  // ne peut pas être rejouée pour un autre compte ou un autre usage.
  const signature = await globalThis.crypto.subtle.sign('HMAC', cle, encodeur.encode(`${userId}:${purpose}:${code}`));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Comparaison à temps constant, pour ne pas exposer d'information par la durée. */
function egalConstant(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

export type CreationOtp =
  | { ok: true; code: string; expiresAt: Date }
  | { ok: false; error: string; retryAfterSeconds?: number };

/**
 * Crée un nouveau code et invalide les précédents du même usage.
 * Retourne le code en clair : à transmettre immédiatement au fournisseur
 * d'e-mail, jamais à stocker ni à journaliser.
 */
export async function creerOtp(userId: string, purpose: OtpPurpose): Promise<CreationOtp> {
  const maintenant = new Date();
  const ilYAUneHeure = new Date(maintenant.getTime() - 60 * 60 * 1000);

  const recents = await prisma.otpCode.findMany({
    where: { userId, purpose, createdAt: { gte: ilYAUneHeure } },
    orderBy: { createdAt: 'desc' },
  });

  if (recents.length >= OTP_ENVOIS_MAX_PAR_HEURE) {
    return { ok: false, error: 'Trop de demandes de code. Réessayez dans une heure.' };
  }

  const dernier = recents[0];
  if (dernier) {
    const ecoule = (maintenant.getTime() - dernier.createdAt.getTime()) / 1000;
    if (ecoule < OTP_DELAI_RENVOI_SECONDES) {
      const reste = Math.ceil(OTP_DELAI_RENVOI_SECONDES - ecoule);
      return { ok: false, error: `Patientez ${reste} seconde(s) avant de demander un nouveau code.`, retryAfterSeconds: reste };
    }
  }

  // Un seul code actif à la fois : les précédents sont neutralisés.
  await prisma.otpCode.updateMany({
    where: { userId, purpose, consumedAt: null },
    data: { consumedAt: maintenant },
  });

  const code = genererCode();
  const expiresAt = new Date(maintenant.getTime() + OTP_VALIDITE_MINUTES * 60 * 1000);
  await prisma.otpCode.create({
    data: { userId, purpose, codeHash: await empreinte(code, purpose, userId), expiresAt },
  });

  return { ok: true, code, expiresAt };
}

export type VerificationOtp = { ok: true } | { ok: false; error: string };

/** Vérifie un code : expiration, usage unique et nombre de tentatives. */
export async function verifierOtp(userId: string, purpose: OtpPurpose, code: string): Promise<VerificationOtp> {
  const propre = code.replace(/\D/g, '');
  if (propre.length !== 6) return { ok: false, error: 'Le code doit comporter 6 chiffres.' };

  const actif = await prisma.otpCode.findFirst({
    where: { userId, purpose, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!actif) return { ok: false, error: 'Aucun code en cours. Demandez un nouveau code.' };

  if (actif.expiresAt.getTime() < Date.now()) {
    await prisma.otpCode.update({ where: { id: actif.id }, data: { consumedAt: new Date() } });
    return { ok: false, error: 'Ce code a expiré. Demandez un nouveau code.' };
  }

  if (actif.attempts >= OTP_TENTATIVES_MAX) {
    await prisma.otpCode.update({ where: { id: actif.id }, data: { consumedAt: new Date() } });
    return { ok: false, error: 'Trop de tentatives. Demandez un nouveau code.' };
  }

  const attendu = await empreinte(propre, purpose, userId);
  if (!egalConstant(attendu, actif.codeHash)) {
    const tentatives = actif.attempts + 1;
    await prisma.otpCode.update({ where: { id: actif.id }, data: { attempts: tentatives } });
    const restantes = OTP_TENTATIVES_MAX - tentatives;
    return {
      ok: false,
      error: restantes > 0 ? `Code incorrect. ${restantes} tentative(s) restante(s).` : 'Trop de tentatives. Demandez un nouveau code.',
    };
  }

  await prisma.otpCode.update({ where: { id: actif.id }, data: { consumedAt: new Date() } });
  return { ok: true };
}

/** Secondes restantes avant de pouvoir demander un nouveau code. */
export async function delaiAvantRenvoi(userId: string, purpose: OtpPurpose): Promise<number> {
  const dernier = await prisma.otpCode.findFirst({ where: { userId, purpose }, orderBy: { createdAt: 'desc' } });
  if (!dernier) return 0;
  const ecoule = (Date.now() - dernier.createdAt.getTime()) / 1000;
  return Math.max(0, Math.ceil(OTP_DELAI_RENVOI_SECONDES - ecoule));
}
