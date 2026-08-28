'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export type EspaceLien = {
  href: string;
  label: string;
  badge?: number;
  exact?: boolean;
};

/** Navigation horizontale de l'espace personnel, avec onglet actif souligne d'or. */
export function EspaceNav({ liens }: { liens: EspaceLien[] }) {
  const pathname = usePathname();

  return (
    <nav className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex gap-1 border-b border-white/8 pb-px">
        {liens.map((l) => {
          const actif = l.exact ? pathname === l.href : pathname === l.href || pathname.startsWith(`${l.href}/`);
          return (
            <li key={l.href} className="shrink-0">
              <Link
                href={l.href}
                aria-current={actif ? 'page' : undefined}
                className={cn(
                  'relative flex items-center gap-2 whitespace-nowrap px-4 py-3 text-sm transition',
                  actif ? 'text-gold-300' : 'text-cream-muted hover:text-cream',
                )}
              >
                {l.label}
                {l.badge && l.badge > 0 ? (
                  <span className="rounded-full bg-gold-gradient px-1.5 text-[10px] font-bold text-night-950">
                    {l.badge > 9 ? '9+' : l.badge}
                  </span>
                ) : null}
                {actif ? (
                  <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-gold-gradient" />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
