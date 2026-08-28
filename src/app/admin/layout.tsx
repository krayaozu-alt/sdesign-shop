import { AdminShell } from '@/components/layout/AdminShell';
import { requireRole } from '@/lib/auth';
import { ROLE_LABELS, type Role } from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import { PERMISSIONS, STAFF_ROLES, can, type Permission } from '@/lib/rbac';
import { getSettings } from '@/lib/settings';
import { resolveLogo } from '@/lib/brand';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(STAFF_ROLES);
  const settings = await getSettings();
  const unread = await prisma.notification.count({ where: { userId: user.id, isRead: false } }).catch(() => 0);

  const permissions = PERMISSIONS.filter((p) => can(user.role, p)) as Permission[];

  return (
    <AdminShell
      user={{ fullName: user.fullName, role: ROLE_LABELS[user.role as Role] ?? user.role }}
      permissions={permissions}
      shopName={settings['shop.name']}
      logoUrl={resolveLogo(settings['shop.logoUrl'])}
      unread={unread}
    >
      {children}
    </AdminShell>
  );
}
