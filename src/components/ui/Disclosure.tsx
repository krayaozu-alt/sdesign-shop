import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Panneau depliant base sur <details> : aucun etat client a gerer, le
 * formulaire reste utilisable meme si JavaScript n'est pas encore charge.
 */
export function Disclosure({
  label,
  children,
  open = false,
  variant = 'gold',
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  open?: boolean;
  variant?: 'gold' | 'ghost' | 'row';
  className?: string;
}) {
  return (
    <details open={open} className={cn('group', className)}>
      <summary
        className={cn(
          'flex cursor-pointer list-none items-center justify-center gap-2 rounded-pill px-5 py-3 text-sm font-semibold transition',
          variant === 'gold' && 'bg-gold-gradient text-night-900 shadow-gold hover:brightness-110',
          variant === 'ghost' && 'border border-white/10 bg-white/5 text-cream hover:bg-white/10',
          variant === 'row' && 'justify-start rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-cream-muted hover:text-cream',
        )}
      >
        {label}
        <ChevronDown size={15} className="transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
