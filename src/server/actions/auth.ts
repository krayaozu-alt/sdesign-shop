'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import {
  createSession,
  destroySession,
  getCurrentUser,
  hashPassword,
  setPendingVerification,
  verifyPassword,
} from '@/lib/auth';
import { ROLES, type Role } from '@/lib/constants';
import { getEmailProvider } from '@/server/email';
import { OTP_PURPOSES, OTP_VALIDITE_MINUTES, creerOtp } from '@/server/otp';
import { homePathFor } from '@/lib/rbac';
import { logAudit } from '@/lib/audit';
import {
  loginSchema,
  passwordChangeSchema,
  profileSchema,
  zodToState,
  type ActionState,
} from '@/lib/validation';

function formToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  formData.forEach((value, key) => {
    out[key] = typeof value === 'string' ? value : value;
  });
  return out;
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodToState(parsed.error);
  const { identifier, password } = parsed.data;

  const user = await prisma.user.findFirst({
    where: { OR: [{ phone: identifier }, { email: identifier.toLowerCase() }] },
  });

  const invalid: ActionState = { ok: false, message: 'Identifiants incorrects.' };
  if (!user) return invalid;
  if (!user.isActive) return { ok: false, message: 'Ce compte est désactivé. Contactez la direction.' };
  if (!(await verifyPassword(password, user.passwordHash))) return invalid;

  // Un compte cliente dont l'adresse n'a jamais ete verifiee ne peut pas ouvrir
  // de session : on relance la verification au lieu de connecter la personne.
  if (user.role === ROLES.CLIENTE && user.email && !user.emailVerified) {
    const otp = await creerOtp(user.id, OTP_PURPOSES.EMAIL_VERIFICATION);
    if (otp.ok) {
      await getEmailProvider().sendVerificationOtp(
        { email: user.email, nom: user.fullName.split(' ')[0] },
        otp.code,
        OTP_VALIDITE_MINUTES,
      );
    }
    await setPendingVerification(user.id, OTP_PURPOSES.EMAIL_VERIFICATION);
    redirect('/verification');
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession({ userId: user.id, role: user.role as Role, fullName: user.fullName });
  await logAudit({ userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id });
  redirect(homePathFor(user.role));
}

export async function logoutAction(): Promise<void> {
  destroySession();
  redirect('/');
}

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: 'Session expirée, reconnectez-vous.' };

  const parsed = profileSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodToState(parsed.error);
  const { fullName, phone, whatsapp, email, address } = parsed.data;

  const clash = await prisma.user.findFirst({
    where: { id: { not: user.id }, OR: [{ phone }, ...(email ? [{ email }] : [])] },
    select: { id: true },
  });
  if (clash) return { ok: false, message: 'Ce téléphone ou cet email est déjà utilisé.' };

  await prisma.user.update({
    where: { id: user.id },
    data: { fullName, phone, whatsapp: whatsapp ?? null, email: email ?? null },
  });

  if (user.customer) {
    await prisma.customer.update({
      where: { id: user.customer.id },
      data: { fullName, phone, whatsapp: whatsapp ?? null, email: email ?? null, address: address ?? null },
    });
  }
  if (user.student && address !== undefined) {
    await prisma.student.update({ where: { id: user.student.id }, data: { address: address ?? null } });
  }

  await logAudit({ userId: user.id, action: 'UPDATE', entity: 'User', entityId: user.id, details: 'Profil' });
  revalidatePath('/espace');
  return { ok: true, message: 'Profil mis à jour.' };
}

export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: 'Session expirée, reconnectez-vous.' };

  const parsed = passwordChangeSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodToState(parsed.error);

  if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
    return { ok: false, message: 'Mot de passe actuel incorrect.' };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.password) },
  });
  await logAudit({ userId: user.id, action: 'UPDATE', entity: 'User', entityId: user.id, details: 'Mot de passe' });
  return { ok: true, message: 'Mot de passe modifié.' };
}
