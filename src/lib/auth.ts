import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import type { Role } from '@/lib/constants';
import { can, type Permission } from '@/lib/rbac';

export const SESSION_COOKIE = 'sds_session';
const SESSION_DAYS = 7;

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('AUTH_SECRET manquant ou trop court dans .env');
  }
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  userId: string;
  role: Role;
  fullName: string;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(secretKey());

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires,
  });
}

export function destroySession(): void {
  cookies().set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    if (!payload.userId || !payload.role) return null;
    return {
      userId: String(payload.userId),
      role: payload.role as Role,
      fullName: String(payload.fullName ?? ''),
    };
  } catch {
    return null;
  }
}

/** Utilisateur complet + profils lies (eleve / cliente / formateur). */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { student: true, customer: true, trainer: true },
  });
  if (!user || !user.isActive) return null;
  return user;
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser(redirectTo = '/connexion'): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(redirectTo);
  return user;
}

export async function requireRole(roles: Role[], redirectTo = '/connexion'): Promise<CurrentUser> {
  const user = await requireUser(redirectTo);
  if (!roles.includes(user.role as Role)) redirect('/acces-refuse');
  return user;
}

/**
 * Controle de permission au niveau de la page. Masquer un lien dans le menu ne
 * protege pas la donnee : chaque ecran du back-office verifie ici sa permission
 * avant toute lecture, en complement du controle des server actions.
 */
export async function requirePermission(permission: Permission, redirectTo = '/connexion'): Promise<CurrentUser> {
  const user = await requireUser(redirectTo);
  if (!can(user.role, permission)) redirect('/acces-refuse');
  return user;
}

/* -------------------------------------------- VERIFICATION EN COURS (OTP) */

const PENDING_COOKIE = 'sds_pending';
const PENDING_MINUTES = 30;

/**
 * Marque un compte comme « en attente de verification ».
 * Le lien entre le navigateur et le compte passe par un cookie signe et
 * httpOnly : ni l'identifiant, ni l'e-mail, ni le code ne transitent par l'URL.
 */
export async function setPendingVerification(userId: string, purpose: string): Promise<void> {
  const expires = new Date(Date.now() + PENDING_MINUTES * 60 * 1000);
  const token = await new SignJWT({ userId, purpose })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(secretKey());

  cookies().set(PENDING_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires,
  });
}

export type PendingVerification = {
  userId: string;
  purpose: string;
  /** Instant d'emission du cookie, en millisecondes. */
  issuedAt: number;
};

export async function getPendingVerification(): Promise<PendingVerification | null> {
  const token = cookies().get(PENDING_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    if (!payload.userId || !payload.purpose) return null;
    return {
      userId: String(payload.userId),
      purpose: String(payload.purpose),
      issuedAt: typeof payload.iat === 'number' ? payload.iat * 1000 : Date.now(),
    };
  } catch {
    return null;
  }
}

export function clearPendingVerification(): void {
  cookies().set(PENDING_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}
