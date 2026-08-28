'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  CalendarClock,
  CalendarRange,
  CalendarDays,
  CreditCard,
  FileText,
  GraduationCap,
  Images,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Settings,
  Sparkles,
  Megaphone,
  Monitor,
  Newspaper,
  Store,
  UserCog,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { Logo } from '@/components/layout/Logo';
import { cn } from '@/lib/utils';
import type { Permission } from '@/lib/rbac';

type Item = { href: string; label: string; icon: typeof LayoutDashboard; permission: Permission };

const NAV: { group: string; items: Item[] }[] = [
  {
    group: 'Aperçu',
    items: [{ href: '/admin', label: 'Tableau de bord', icon: LayoutDashboard, permission: 'dashboard.view' }],
  },
  {
    group: 'Gestion',
    items: [
      { href: '/admin/inscriptions', label: 'Inscriptions', icon: GraduationCap, permission: 'students.manage' },
      { href: '/admin/eleves', label: 'Élèves', icon: Users, permission: 'students.manage' },
      { href: '/admin/clients', label: 'Clientes', icon: UserRound, permission: 'customers.manage' },
      { href: '/admin/formateurs', label: 'Formateurs', icon: UserCog, permission: 'trainers.manage' },
      { href: '/admin/formations', label: 'Formations', icon: BookOpen, permission: 'courses.manage' },
      { href: '/admin/sessions', label: 'Sessions', icon: CalendarClock, permission: 'sessions.manage' },
      { href: '/admin/prestations', label: 'Prestations', icon: Sparkles, permission: 'services.manage' },
      { href: '/admin/reservations', label: 'Rendez-vous', icon: CalendarDays, permission: 'appointments.manage' },
      { href: '/admin/calendrier', label: 'Calendrier', icon: CalendarRange, permission: 'appointments.manage' },
    ],
  },
  {
    group: 'Marketing',
    items: [
      { href: '/admin/publications', label: 'Publications', icon: Newspaper, permission: 'marketing.manage' },
      { href: '/admin/bannieres', label: 'Bannières', icon: Megaphone, permission: 'marketing.manage' },
      { href: '/admin/apercu', label: 'Aperçu du site', icon: Monitor, permission: 'marketing.manage' },
    ],
  },
  {
    group: 'Finances',
    items: [
      { href: '/admin/paiements', label: 'Paiements', icon: CreditCard, permission: 'payments.manage' },
      { href: '/admin/recus', label: 'Reçus', icon: Receipt, permission: 'receipts.manage' },
      { href: '/admin/rapports', label: 'Rapports', icon: BarChart3, permission: 'reports.view' },
    ],
  },
  {
    group: 'Documents',
    items: [
      { href: '/admin/certificats', label: 'Certificats', icon: Award, permission: 'certificates.manage' },
      { href: '/admin/galerie', label: 'Galerie', icon: Images, permission: 'gallery.manage' },
    ],
  },
  {
    group: 'Communication',
    items: [{ href: '/admin/notifications', label: 'Notifications', icon: Bell, permission: 'notifications.manage' }],
  },
  {
    group: 'Système',
    items: [
      { href: '/admin/utilisateurs', label: 'Utilisateurs', icon: UserCog, permission: 'users.manage' },
      { href: '/admin/journal', label: 'Journal d’activité', icon: FileText, permission: 'settings.manage' },
      { href: '/admin/parametres', label: 'Paramètres', icon: Settings, permission: 'settings.manage' },
    ],
  },
];

export function AdminShell({
  children,
  user,
  permissions,
  shopName,
  logoUrl,
  unread,
}: {
  children: React.ReactNode;
  user: { fullName: string; role: string };
  permissions: Permission[];
  shopName: string;
  logoUrl: string | null;
  unread: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const allowed = new Set(permissions);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/10 px-5 py-5">
        <Link href="/">
          <Logo logoUrl={logoUrl} name={shopName} size="sm" />
        </Link>
        <p className="mt-2 text-center text-[10px] uppercase tracking-[0.25em] text-gold-300/70">Back-office</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV.map((section) => {
          const items = section.items.filter((i) => allowed.has(i.permission));
          if (items.length === 0) return null;
          return (
            <div key={section.group} className="mb-4">
              <p className="mb-1.5 px-3 text-[10px] uppercase tracking-[0.22em] text-cream-dim">{section.group}</p>
              {items.map((item) => {
                const Icon = item.icon;
                const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
                      active
                        ? 'bg-gold-500/12 text-gold-200'
                        : 'text-cream-muted hover:bg-white/5 hover:text-cream',
                    )}
                  >
                    <Icon size={16} className="shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {item.href === '/admin/notifications' && unread > 0 ? (
                      <span className="ml-auto rounded-full bg-gold-gradient px-1.5 text-[10px] font-bold text-night-900">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-500/15 text-xs font-bold text-gold-300">
            {user.fullName
              .split(/\s+/)
              .slice(0, 2)
              .map((m) => m[0]?.toUpperCase() ?? '')
              .join('')}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm text-cream">{user.fullName}</p>
            <p className="truncate text-xs text-cream-dim">{user.role}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <Link href="/espace/profil" className="btn-ghost px-2 py-2 text-[11px]">
            <UserRound size={12} /> Profil
          </Link>
          <Link href="/" className="btn-ghost px-2 py-2 text-[11px]">
            <Store size={12} /> Site
          </Link>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="btn-ghost w-full px-2 py-2 text-[11px]">
              <LogOut size={12} /> Sortir
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="admin-theme min-h-dvh lg:flex">
      <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-night-900/60 lg:block">{sidebar}</aside>

      <div
        className={cn(
          'fixed inset-0 z-50 transition-opacity lg:hidden',
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        <div className="absolute inset-0 bg-night-950/80 backdrop-blur-sm" onClick={() => setOpen(false)} />
        <aside
          className={cn(
            'absolute left-0 top-0 h-full w-72 max-w-[85%] border-r border-white/10 bg-night-900 transition-transform',
            open ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fermer"
            className="absolute right-3 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5"
          >
            <X size={16} />
          </button>
          {sidebar}
        </aside>
      </div>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-white/10 bg-night-950/85 px-4 backdrop-blur-xl lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Ouvrir le menu"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5"
          >
            <Menu size={18} />
          </button>
          <Link href="/admin" aria-label={shopName} className="flex items-center gap-2">
            <Logo logoUrl={logoUrl} name={shopName} size="xs" />
            <span className="text-[10px] uppercase tracking-[0.2em] text-gold-300/70">Back-office</span>
          </Link>
          <Link
            href="/admin/notifications"
            className="relative ml-auto flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5"
          >
            <Bell size={16} />
            {unread > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-gradient px-1 text-[9px] font-bold text-night-900">
                {unread > 9 ? '9+' : unread}
              </span>
            ) : null}
          </Link>
        </header>

        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
