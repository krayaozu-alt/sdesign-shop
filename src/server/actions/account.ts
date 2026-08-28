'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import {
  clearPendingVerification,
  createSession,
  getPendingVerification,
  hashPassword,
  setPendingVerification,
} from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { NOTIFICATION_TYPES, ROLES, type Role } from '@/lib/constants';
import { notify } from '@/lib/notifications';
import {
  inscriptionClienteSchema,
  motDePasseOublieSchema,
  otpSchema,
  reinitialisationSchema,
  zodToState,
  type ActionState,
} from '@/lib/validation';
import { getEmailProvider } from '@/server/email';
import {
  OTP_PURPOSES,
  OTP_VALIDITE_MINUTES,
  creerOtp,
  verifierOtp,
  type OtpPurpose,
} from '@/server/otp';

function formToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  formData.forEach((value, key) => {
    if (value instanceof File) return;
    out[key] = value;
  });
  return out;
}

/**
 * Inscription d'une cliente.
 *
 * Le compte est cree avec `emailVerified = false` et la session N'EST PAS
 * ouverte : un code de verification est envoye a l'adresse indiquee. Le lien
 * entre le navigateur et le compte passe par un cookie httpOnly.
 */
export async function inscriptionClienteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = inscriptionClienteSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodToState(parsed.error);
  const d = parsed.data;
  const fullName = `${d.firstName} ${d.lastName}`.trim();

  const existant = await prisma.user.findFirst({
    where: { OR: [{ email: d.email }, { phone: d.phone }] },
    select: { id: true, email: true, emailVerified: true },
  });

  if (existant) {
    // Un compte existe deja avec cette adresse ou ce numero.
    // Si l'adresse n'a jamais ete verifiee, on renvoie simplement un code :
    // cela evite de bloquer une inscription restee inachevee.
    if (existant.email === d.email && !existant.emailVerified) {
      const otp = await creerOtp(existant.id, OTP_PURPOSES.EMAIL_VERIFICATION);
      if (otp.ok) {
        await getEmailProvider().sendVerificationOtp({ email: d.email, nom: d.firstName }, otp.code, OTP_VALIDITE_MINUTES);
      }
      await setPendingVerification(existant.id, OTP_PURPOSES.EMAIL_VERIFICATION);
      redirect('/verification');
    }
    return { ok: false, message: 'Un compte existe déjà avec cette adresse e-mail ou ce numéro de téléphone.' };
  }

  const user = await prisma.user.create({
    data: {
      fullName,
      email: d.email,
      phone: d.phone,
      whatsapp: d.phone,
      passwordHash: await hashPassword(d.password),
      role: ROLES.CLIENTE,
      emailVerified: false,
      customer: { create: { fullName, phone: d.phone, whatsapp: d.phone, email: d.email } },
    },
  });

  const otp = await creerOtp(user.id, OTP_PURPOSES.EMAIL_VERIFICATION);
  if (otp.ok) {
    const envoi = await getEmailProvider().sendVerificationOtp(
      { email: d.email, nom: d.firstName },
      otp.code,
      OTP_VALIDITE_MINUTES,
    );
    if (!envoi.ok) {
      await logAudit({ userId: user.id, action: 'OTP_SEND_FAILED', entity: 'User', entityId: user.id });
    }
  }

  await logAudit({ userId: user.id, action: 'CREATE', entity: 'User', entityId: user.id, details: 'Inscription cliente' });
  await setPendingVerification(user.id, OTP_PURPOSES.EMAIL_VERIFICATION);
  redirect('/verification');
}

/** Vérification du code reçu par e-mail : le compte devient actif. */
export async function verifierEmailAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const pending = await getPendingVerification();
  if (!pending || pending.purpose !== OTP_PURPOSES.EMAIL_VERIFICATION) {
    return { ok: false, message: 'Session de vérification expirée. Recommencez votre inscription.' };
  }

  const parsed = otpSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodToState(parsed.error);

  const resultat = await verifierOtp(pending.userId, OTP_PURPOSES.EMAIL_VERIFICATION, parsed.data.code);
  if (!resultat.ok) return { ok: false, message: resultat.error };

  const user = await prisma.user.update({
    where: { id: pending.userId },
    data: { emailVerified: true, emailVerifiedAt: new Date() },
  });

  if (user.email) {
    await getEmailProvider().sendWelcomeEmail({ email: user.email, nom: user.fullName.split(' ')[0] });
  }
  await notify({
    userId: user.id,
    type: NOTIFICATION_TYPES.SYSTEME,
    title: 'Compte activé',
    message: 'Votre adresse e-mail a été vérifiée. Bienvenue chez S.DESIGN SHOP.',
    link: '/espace',
  });
  await logAudit({ userId: user.id, action: 'EMAIL_VERIFIED', entity: 'User', entityId: user.id });

  clearPendingVerification();
  await createSession({ userId: user.id, role: user.role as Role, fullName: user.fullName });
  redirect('/espace?bienvenue=1');
}

/** Nouvel envoi du code de vérification (protégé par un délai anti-spam). */
export async function renvoyerCodeAction(_prev: ActionState): Promise<ActionState> {
  const pending = await getPendingVerification();
  if (!pending) return { ok: false, message: 'Session de vérification expirée. Recommencez votre inscription.' };

  const neutre: ActionState = { ok: true, message: 'Un nouveau code vient de vous être envoyé.' };

  const user = await prisma.user.findUnique({ where: { id: pending.userId }, select: { email: true, fullName: true } });
  if (!user?.email) {
    // Identifiant leurre : on répond comme pour un compte réel.
    return pending.purpose === OTP_PURPOSES.PASSWORD_RESET
      ? neutre
      : { ok: false, message: 'Aucune adresse e-mail associée à ce compte.' };
  }

  const otp = await creerOtp(pending.userId, pending.purpose as OtpPurpose);
  if (!otp.ok) return { ok: false, message: otp.error };

  const envoi =
    pending.purpose === OTP_PURPOSES.PASSWORD_RESET
      ? await getEmailProvider().sendPasswordResetOtp(
          { email: user.email, nom: user.fullName.split(' ')[0] },
          otp.code,
          OTP_VALIDITE_MINUTES,
        )
      : await getEmailProvider().sendVerificationOtp(
          { email: user.email, nom: user.fullName.split(' ')[0] },
          otp.code,
          OTP_VALIDITE_MINUTES,
        );

  if (!envoi.ok) return { ok: false, message: envoi.error };
  return neutre;
}

/**
 * Demande de réinitialisation de mot de passe.
 * La réponse est identique que l'adresse existe ou non : cela empêche
 * l'énumération des comptes.
 */
export async function motDePasseOublieAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = motDePasseOublieSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodToState(parsed.error);

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, email: true, fullName: true, isActive: true },
  });

  if (user?.email && user.isActive) {
    const otp = await creerOtp(user.id, OTP_PURPOSES.PASSWORD_RESET);
    if (otp.ok) {
      await getEmailProvider().sendPasswordResetOtp(
        { email: user.email, nom: user.fullName.split(' ')[0] },
        otp.code,
        OTP_VALIDITE_MINUTES,
      );
    }
    await setPendingVerification(user.id, OTP_PURPOSES.PASSWORD_RESET);
  } else {
    // Adresse inconnue ou compte desactive : on suit exactement le meme
    // chemin, avec un identifiant leurre. Sans cela, la seule difference de
    // navigation (redirection ou non) suffirait a savoir si un compte existe.
    await setPendingVerification(`inconnu-${globalThis.crypto.randomUUID()}`, OTP_PURPOSES.PASSWORD_RESET);
  }

  redirect('/reinitialiser-mot-de-passe');
}

/** Définition d'un nouveau mot de passe après vérification du code. */
export async function reinitialiserMotDePasseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const pending = await getPendingVerification();
  if (!pending || pending.purpose !== OTP_PURPOSES.PASSWORD_RESET) {
    return { ok: false, message: 'Demande expirée. Recommencez la procédure de mot de passe oublié.' };
  }

  const parsed = reinitialisationSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodToState(parsed.error);

  const resultat = await verifierOtp(pending.userId, OTP_PURPOSES.PASSWORD_RESET, parsed.data.code);
  if (!resultat.ok) {
    // Message volontairement identique pour un code faux, expire, deja utilise
    // ou inexistant : le detail renseignerait sur l'existence du compte.
    return { ok: false, message: 'Code incorrect ou expiré. Demandez un nouveau code si nécessaire.' };
  }

  const user = await prisma.user.update({
    where: { id: pending.userId },
    data: { passwordHash: await hashPassword(parsed.data.password) },
  });

  // Tout code encore actif est neutralisé : l'ancien mot de passe ne vaut plus.
  await prisma.otpCode.updateMany({ where: { userId: user.id, consumedAt: null }, data: { consumedAt: new Date() } });

  await notify({
    userId: user.id,
    type: NOTIFICATION_TYPES.SYSTEME,
    title: 'Mot de passe modifié',
    message:
      'Votre mot de passe vient d’être réinitialisé. Si vous n’êtes pas à l’origine de cette action, contactez immédiatement la boutique.',
    link: '/espace/profil',
  });
  await logAudit({ userId: user.id, action: 'PASSWORD_RESET', entity: 'User', entityId: user.id });

  clearPendingVerification();
  // Le cookie de verification vient d'etre supprime : la page de saisie n'est
  // plus accessible. On conduit donc directement a l'ecran de connexion.
  redirect('/connexion?motdepasse=modifie');
}
