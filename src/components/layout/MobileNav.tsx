'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, CalendarRange, CreditCard, GraduationCap, Home, LayoutDashboard, Sparkles, User } from 'lucide-react';
import { cn } from '@/lib/utils';

type Onglet = {
  href: string;
  label: string;
  icon: typeof Home;
  match: (p: string) => boolean;
};

/** Barre du site public : decouverte et reservation. */
const PUBLIC: Onglet[] = [
  { href: '/', label: 'Accueil', icon: Home, match: (p) => p === '/' },
  { href: '/formations', label: 'Formations', icon: GraduationCap, match: (p) => p.startsWith('/formations') },
  { href: '/prestations', label: 'Prestations', icon: Sparkles, match: (p) => p.startsWith('/prestations') },
  { href: '/reservation', label: 'Réserver', icon: CalendarDays, match: (p) => p.startsWith('/reservation') },
  { href: '/calendrier-formations', label: 'Calendrier', icon: CalendarRange, match: (p) => p.startsWith('/calendrier') },
];

/** Barre de l'espace personnel : suivi de la cliente / eleve. */
const ESPACE: Onglet[] = [
  { href: '/espace', label: 'Accueil', icon: LayoutDashboard, match: (p) => p === '/espace' },
  {
    href: '/espace/formations',
    label: 'Formations',
    icon: GraduationCap,
    match: (p) => p.startsWith('/espace/formations') || p.startsWith('/espace/eleve'),
  },
  {
    href: '/espace/rendez-vous',
    label: 'Rendez-vous',
    icon: CalendarDays,
    match: (p) => p.startsWith('/espace/rendez-vous'),
  },
  { href: '/espace/paiements', label: 'Paiements', icon: CreditCard, match: (p) => p.startsWith('/espace/paiements') },
  { href: '/espace/profil', label: 'Profil', icon: User, match: (p) => p.startsWith('/espace/profil') },
];

export function MobileNav() {
  const pathname = usePathname();
  const dansEspace = pathname === '/espace' || pathname.startsWith('/espace/');
  const onglets = dansEspace ? ESPACE : PUBLIC;

  return (
    <nav
      aria-label={dansEspace ? 'Navigation de mon espace' : 'Navigation principale'}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-night-950/95 backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)]">
        {onglets.map((tab) => {
          const Icon = tab.icon;
          const actif = tab.match(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={actif ? 'page' : undefined}
              className={cn(
                'relative flex flex-1 flex-col items-center gap-1 px-1 py-2.5 text-[10px] transition',
                actif ? 'text-gold-300' : 'text-cream-dim',
              )}
            >
              {actif ? <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-gold-gradient" /> : null}
              <span
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-xl transition',
                  actif ? 'bg-gold-500/15' : '',
                )}
              >
                <Icon size={18} />
              </span>
              <span className="leading-none">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
