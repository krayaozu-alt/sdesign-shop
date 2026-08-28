'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Devoile son contenu quand il entre dans l'ecran.
 *
 * Deux precautions valent d'etre expliquees :
 *
 * - Le contenu n'est masque QUE si le JavaScript s'execute. La classe
 *   `.apparait` est posee par le script, jamais dans le HTML servi. Si le
 *   script echoue ou n'est pas charge, le texte reste simplement visible : on
 *   ne cache jamais un contenu qu'on n'est pas certain de pouvoir reveler.
 *
 * - L'observateur se debranche des le premier passage. Une section deja
 *   apparue n'a plus rien a observer, et rien ne doit disparaitre lorsqu'on
 *   remonte la page.
 */
export function ApparitionAuDefilement({
  children,
  delai = 0,
  className,
}: {
  children: ReactNode;
  /** Retard en millisecondes, pour decaler les elements d'une meme rangee. */
  delai?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Mouvement reduit : on ne masque rien, il n'y a donc rien a reveler.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (typeof IntersectionObserver === 'undefined') return;

    el.classList.add('apparait');
    if (delai) el.style.transitionDelay = `${delai}ms`;

    const observateur = new IntersectionObserver(
      (entrees) => {
        for (const e of entrees) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('est-visible');
          observateur.unobserve(e.target);
        }
      },
      // Declenche un peu avant que l'element touche le bas de l'ecran, pour que
      // l'apparition soit deja finie quand le regard y arrive.
      { rootMargin: '0px 0px -12% 0px', threshold: 0.05 },
    );
    observateur.observe(el);

    return () => observateur.disconnect();
  }, [delai]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
