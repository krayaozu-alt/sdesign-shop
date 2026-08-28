'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Bell,
  CalendarDays,
  CalendarRange,
  GraduationCap,
  Home,
  Images,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Phone,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { Logo } from '@/components/layout/Logo';
import { cn } from '@/lib/utils';

export type HeaderUser = {
  fullName: string;
  role: string;
  isStaff: boolean;
  homePath: string;
  unread: number;
} | null;

const PRIMARY_LINKS = [
  { href: '/', label: 'Accueil', icon: Home },
  { href: '/formations', label: 'Formations', icon: GraduationCap },
  { href: '/calendrier-formations', label: 'Calendrier', icon: CalendarRange },
  { href: '/prestations', label: 'Prestations', icon: Sparkles },
  { href: '/reservation', label: 'Réservation', icon: CalendarDays },
  { href: '/galerie', label: 'Galerie', icon: Images },
  { href: '/contact', label: 'Contact', icon: Phone },
];

export function SiteHeader({
  user,
  logoUrl,
  shopName,
}: {
  user: HeaderUser;
  logoUrl?: string | null;
  shopName: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/8 bg-night-950/80 backdrop-blur-xl">
        <div className="container-page flex h-16 items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Ouvrir le menu"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-cream transition hover:border-gold-500/40"
          >
            <Menu size={18} />
          </button>

          <Link href="/" aria-label={shopName}>
            <Logo logoUrl={logoUrl} name={shopName} size="sm" />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {PRIMARY_LINKS.slice(1).map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  'rounded-pill px-3 py-2 text-sm transition',
                  pathname === l.href ? 'bg-gold-500/12 text-gold-200' : 'text-cream-muted hover:text-cream',
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <Link
                href="/espace/notifications"
                aria-label="Notifications"
                className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-cream transition hover:border-gold-500/40"
              >
                <Bell size={18} />
                {user.unread > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-gradient px-1 text-[10px] font-bold text-night-900">
                    {user.unread > 9 ? '9+' : user.unread}
                  </span>
                ) : null}
              </Link>
            ) : (
              <Link href="/connexion" className="btn-outline hidden px-4 py-2 text-xs sm:inline-flex">
                <LogIn size={14} /> Connexion
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Tiroir de navigation */}
      <div
        className={cn(
          'fixed inset-0 z-50 transition-opacity duration-300',
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        <div className="absolute inset-0 bg-night-950/80 backdrop-blur-sm" onClick={() => setOpen(false)} />
        <aside
          className={cn(
            'absolute left-0 top-0 flex h-full w-[82%] max-w-sm flex-col border-r border-white/10 bg-night-900 transition-transform duration-300',
            open ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <Logo logoUrl={logoUrl} name={shopName} size="sm" />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer le menu"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5"
            >
              <X size={16} />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            {PRIMARY_LINKS.map((l) => {
              const Icon = l.icon;
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    'mb-1 flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition',
                    active ? 'bg-gold-500/12 text-gold-200' : 'text-cream-muted hover:bg-white/5 hover:text-cream',
                  )}
                >
                  <Icon size={18} />
                  {l.label}
                </Link>
              );
            })}

            <div className="my-4 gold-rule" />

            {user ? (
              <>
                <Link
                  href={user.homePath}
                  className="mb-1 flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-cream-muted hover:bg-white/5 hover:text-cream"
                >
                  {user.isStaff ? <LayoutDashboard size={18} /> : <User size={18} />}
                  {user.isStaff ? 'Tableau de bord' : 'Mon espace'}
                </Link>
                <form action="/api/auth/logout" method="post">
                  <button
                    type="submit"
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-cream-muted hover:bg-white/5 hover:text-cream"
                  >
                    <LogOut size={18} /> Déconnexion
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link
                  href="/connexion"
                  className="mb-1 flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-cream-muted hover:bg-white/5 hover:text-cream"
                >
                  <LogIn size={18} /> Connexion
                </Link>
                <Link
                  href="/creer-compte"
                  className="mb-1 flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-cream-muted hover:bg-white/5 hover:text-cream"
                >
                  <User size={18} /> Créer un compte
                </Link>
              </>
            )}
          </nav>

          {user ? (
            <div className="border-t border-white/10 px-5 py-4">
              <p className="text-sm text-cream">{user.fullName}</p>
              <p className="text-xs text-cream-dim">{user.role}</p>
            </div>
          ) : null}
        </aside>
      </div>
    </>
  );
}
