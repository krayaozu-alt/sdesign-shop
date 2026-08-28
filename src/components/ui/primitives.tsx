import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ CARTE */

export function Card({
  children,
  className,
  strong = false,
}: {
  children: ReactNode;
  className?: string;
  strong?: boolean;
}) {
  return <div className={cn(strong ? 'surface-strong' : 'surface', 'p-5', className)}>{children}</div>;
}

export function SectionHeader({
  eyebrow,
  title,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-5 flex items-end justify-between gap-4', className)}>
      <div>
        {eyebrow ? <p className="label-eyebrow mb-1">{eyebrow}</p> : null}
        <h2 className="section-title">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function SeeAllLink({ href, label = 'Voir tout' }: { href: string; label?: string }) {
  return (
    <Link href={href} className="shrink-0 text-sm font-medium text-gold-300 hover:text-gold-200">
      {label} →
    </Link>
  );
}

/* ------------------------------------------------------------------ BADGE */

const TONES = {
  gold: 'border-gold-500/40 bg-gold-500/12 text-gold-200',
  green: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  amber: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  red: 'border-red-400/30 bg-red-400/10 text-red-200',
  violet: 'border-plum-200/30 bg-plum-300/15 text-plum-200',
  neutral: 'border-white/12 bg-white/5 text-cream-muted',
} as const;

export type Tone = keyof typeof TONES;

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill border px-2.5 py-1 text-[11px] font-medium',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Couleur associee a un statut metier (formations, RDV, paiements...). */
export function toneForStatus(status: string): Tone {
  switch (status) {
    case 'OUVERTE':
    case 'CONFIRME':
    case 'CONFIRMEE':
    case 'PAYE':
    case 'PRESENT':
    case 'VALIDE':
    case 'TERMINE':
    case 'TERMINEE':
      return 'green';
    case 'EN_ATTENTE':
    case 'PLANIFIEE':
    case 'RETARD':
      return 'amber';
    case 'ANNULE':
    case 'ANNULEE':
    case 'ABANDONNEE':
    case 'ABSENT':
    case 'REVOQUE':
    case 'ECHEC':
      return 'red';
    case 'EN_COURS':
      return 'violet';
    default:
      return 'neutral';
  }
}

/* --------------------------------------------------------------- PROGRESS */

export function Progress({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-pill bg-white/10', className)}>
      <div
        className="h-full rounded-pill bg-gold-gradient transition-all duration-700"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function ProgressLabelled({ value, label }: { value: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-cream-muted">{label ?? 'Progression'}</span>
        <span className="font-semibold text-gold-300">{pct} %</span>
      </div>
      <Progress value={pct} />
    </div>
  );
}

/* ----------------------------------------------------------------- STATS */

export function StatTile({
  label,
  value,
  hint,
  icon,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  href?: string;
}) {
  const body = (
    <div className="surface h-full p-4 transition-colors hover:border-gold-500/30">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-cream-muted">{label}</span>
        {icon ? <span className="text-gold-400">{icon}</span> : null}
      </div>
      <p className="font-display text-2xl text-cream">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-cream-dim">{hint}</p> : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

/* ----------------------------------------------------------------- MEDIA */

/**
 * Vignette : affiche la photo televersee si elle existe, sinon un degrade
 * signature avec l'initiale - jamais d'image externe cassee.
 */
export function Media({
  src,
  alt,
  className,
  ratio = 'aspect-[4/3]',
  label,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  ratio?: string;
  label?: string;
}) {
  return (
    <div className={cn('relative overflow-hidden rounded-xl media-fallback', ratio, className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        // Aucune photo televersee : vignette de marque, jamais une image
        // empruntee qui pourrait representer une autre technique.
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-3 text-center">
          <span className="font-script text-3xl leading-none text-gold-300/70">
            {(label ?? alt).charAt(0).toUpperCase()}
          </span>
          <span className="line-clamp-2 text-[10px] uppercase tracking-[0.18em] text-cream-dim">{label ?? alt}</span>
          <span className="mt-1 text-[9px] text-cream-dim/70">Photo à venir</span>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-night-950/70 via-transparent to-transparent" />
    </div>
  );
}

/* ------------------------------------------------------------ ETAT VIDE */

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="surface flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      {icon ? <div className="text-gold-400/70">{icon}</div> : null}
      <h3 className="font-display text-lg text-cream">{title}</h3>
      {description ? <p className="max-w-md text-sm text-cream-muted">{description}</p> : null}
      {action}
    </div>
  );
}

/* --------------------------------------------------------------- TABLEAU */

export function DataTable({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="surface overflow-x-auto p-0">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-cream-dim">
            {head.map((h) => (
              <th key={h} className="whitespace-nowrap px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.06]">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn('px-4 py-3 align-middle text-cream-muted', className)}>{children}</td>;
}
