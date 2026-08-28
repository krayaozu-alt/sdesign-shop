import { ROLES, type Role } from '@/lib/constants';

/**
 * Matrice de permissions. Chaque action du back-office est rattachee a une
 * permission ; les server actions verifient la permission avant toute ecriture.
 */
export const PERMISSIONS = [
  'dashboard.view',
  'customers.manage',
  'students.manage',
  'courses.manage',
  'services.manage',
  'appointments.manage',
  'payments.manage',
  'receipts.manage',
  'certificates.manage',
  'trainers.manage',
  'gallery.manage',
  'notifications.manage',
  'reports.view',
  'settings.manage',
  'users.manage',
  'attendance.manage',
  'sessions.manage',
  'marketing.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const MATRIX: Record<Role, Permission[] | 'ALL'> = {
  [ROLES.ADMIN]: 'ALL',
  [ROLES.FORMATEUR]: [
    'dashboard.view',
    'students.manage',
    'courses.manage',
    'sessions.manage',
    'attendance.manage',
    'certificates.manage',
    'gallery.manage',
  ],
  [ROLES.EMPLOYE]: [
    'dashboard.view',
    'customers.manage',
    'sessions.manage',
    'appointments.manage',
    'services.manage',
    'payments.manage',
    'receipts.manage',
    'gallery.manage',
  ],
  [ROLES.ELEVE]: [],
  [ROLES.CLIENTE]: [],
};

export function can(role: Role | string | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  const allowed = MATRIX[role as Role];
  if (!allowed) return false;
  if (allowed === 'ALL') return true;
  return allowed.includes(permission);
}

/** Roles autorises a ouvrir le back-office. */
export const STAFF_ROLES: Role[] = [ROLES.ADMIN, ROLES.FORMATEUR, ROLES.EMPLOYE];

export function isStaff(role: Role | string | undefined | null): boolean {
  return !!role && STAFF_ROLES.includes(role as Role);
}

/** Page d'accueil apres connexion selon le role. */
export function homePathFor(role: Role | string): string {
  if (isStaff(role)) return '/admin';
  if (role === ROLES.ELEVE) return '/espace/eleve';
  return '/espace';
}
