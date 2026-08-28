import { LogoImage } from '@/components/layout/LogoImage';
import { cn } from '@/lib/utils';

// Le logo officiel est une composition carree contenant le nom et la baseline :
// il lui faut plus de hauteur qu'un logotype horizontal pour rester lisible.
const HAUTEURS = {
  xs: 'h-8',
  sm: 'h-11',
  md: 'h-16',
  lg: 'h-32 sm:h-40',
} as const;

const TITRES = {
  xs: 'text-base',
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-4xl sm:text-5xl',
} as const;

/**
 * Identite visuelle S.DESIGN SHOP.
 *
 * Si un logo officiel est disponible (fichier du projet ou televersement admin),
 * il est affiche tel quel, sans deformation (object-contain) et sans baseline
 * ajoutee : le logo porte deja sa propre signature. Sinon, le logotype
 * typographique de secours prend le relais.
 */
export function Logo({
  logoUrl,
  name = 'S.DESIGN SHOP',
  tagline,
  size = 'md',
  className,
}: {
  logoUrl?: string | null;
  name?: string;
  tagline?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}) {
  if (logoUrl) {
    return (
      <div className={cn('flex flex-col items-center', className)}>
        <LogoImage src={logoUrl} alt={name} heightClass={HAUTEURS[size]} />
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col items-center leading-none', className)}>
      <span className={cn('font-script font-semibold gold-text', TITRES[size])}>
        S.<span className="italic">Design</span>
      </span>
      <span
        className={cn(
          'mt-0.5 tracking-[0.42em] text-gold-300/90',
          size === 'lg' ? 'text-sm' : size === 'md' ? 'text-[10px]' : 'text-[8px]',
        )}
      >
        SHOP
      </span>
      {tagline ? (
        <span className="mt-1.5 text-[10px] uppercase tracking-[0.22em] text-cream-muted">{tagline}</span>
      ) : null}
    </div>
  );
}
