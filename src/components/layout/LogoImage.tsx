'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Affichage du logo officiel televerse.
 *
 * - `object-contain` + hauteur imposee : le ratio d'origine est toujours conserve.
 * - Plaque claire arrondie : le logo officiel est fourni sur fond blanc (JPEG),
 *   il est donc pose sur une plaque pour rester net sur les fonds sombres du
 *   site et du back-office. Un PNG transparent s'y integre aussi sans probleme.
 * - En cas d'echec de chargement, on retombe sur le nom en texte discret :
 *   jamais sur un logo invente.
 */
export function LogoImage({
  src,
  alt,
  heightClass,
  className,
}: {
  src: string;
  alt: string;
  heightClass: string;
  className?: string;
}) {
  const [erreur, setErreur] = useState(false);

  if (erreur) {
    return (
      <span className={cn('font-display tracking-wide text-cream', className)} aria-label={alt}>
        {alt}
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-center justify-center rounded-xl bg-white/95 p-1.5 shadow-card', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onError={() => setErreur(true)}
        className={cn(heightClass, 'w-auto max-w-full object-contain')}
      />
    </span>
  );
}
