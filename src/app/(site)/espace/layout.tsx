import Link from 'next/link';
import { Logo } from '@/components/layout/Logo';
import { EspaceNav, type EspaceLien } from '@/components/espace/EspaceNav';
import { requireUser } from '@/lib/auth';
import { resolveLogo } from '@/lib/brand';
import { ROLE_LABELS, type Role } from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import { isStaff } from '@/lib/rbac';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function EspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [settings, unread] = await Promise.all([
    getSettings(),
    prisma.notification.count({ where: { userId: user.id, isRead: false } }).catch(() => 0),
  ]);

  const prenom = user.fullName.trim().split(/\s+/)[0] || user.fullName;

  const liens: EspaceLien[] = [
    { href: '/espace', label: 'Accueil', exact: true },
    { href: '/espace/formations', label: 'Mes formations' },
    { href: '/espace/prochaines-formations', label: 'Prochaines formations' },
    ...(user.student ? [{ href: '/espace/eleve', label: 'Ma progression' } as EspaceLien] : []),
    { href: '/espace/rendez-vous', label: 'Mes rendez-vous' },
    { href: '/espace/paiements', label: 'Mes paiements' },
    { href: '/espace/certificats', label: 'Mes certificats' },
    { href: '/espace/notifications', label: 'Notifications', badge: unread },
    { href: '/espace/profil', label: 'Mon profil' },
  ];

  return (
    <div className="container-page py-6">
      {/* En-tete de l'espace : logo officiel + accueil personnalise */}
      <header className="surface mb-5 flex flex-col items-center gap-4 p-6 text-center sm:flex-row sm:text-left">
        <Logo logoUrl={resolveLogo(settings['shop.logoUrl'])} name={settings['shop.name']} size="sm" />
        <div className="hidden h-12 w-px bg-white/10 sm:block" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl text-cream sm:text-3xl">Bonjour, {prenom} 👋</h1>
          <p className="mt-1 text-sm text-cream-muted">Bienvenue dans votre espace {settings['shop.name']}.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="chip border-gold-500/30 text-gold-200">{ROLE_LABELS[user.role as Role] ?? user.role}</span>
          {isStaff(user.role) ? (
            <Link href="/admin" className="btn-outline px-4 py-2 text-xs">
              Back-office
            </Link>
          ) : null}
        </div>
      </header>

      <EspaceNav liens={liens} />

      {children}
    </div>
  );
}
