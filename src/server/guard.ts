import 'server-only';
import { getCurrentUser, type CurrentUser } from '@/lib/auth';
import { can, type Permission } from '@/lib/rbac';
import type { ActionState } from '@/lib/validation';

export type GuardResult = { user: CurrentUser } | { error: ActionState };

/**
 * Verification d'autorisation utilisee par toutes les server actions du
 * back-office. Elle ne redirige pas : elle renvoie un ActionState affichable
 * dans le formulaire appelant.
 */
export async function guard(permission: Permission): Promise<GuardResult> {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return { error: { ok: false, message: 'Session expirée. Reconnectez-vous.' } };
  if (!can(user.role, permission)) {
    return { error: { ok: false, message: 'Vous n’avez pas les droits nécessaires pour cette action.' } };
  }
  return { user };
}

export function isDenied(result: GuardResult): result is { error: ActionState } {
  return 'error' in result;
}

/** Convertit un FormData en objet simple pour Zod. */
export function formToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  formData.forEach((value, key) => {
    if (value instanceof File) return;
    out[key] = value;
  });
  return out;
}

/** Les cases a cocher absentes doivent valoir false et non undefined. */
export function withCheckboxes(obj: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out = { ...obj };
  for (const key of keys) out[key] = obj[key] === 'true' || obj[key] === 'on' || obj[key] === true;
  return out;
}
