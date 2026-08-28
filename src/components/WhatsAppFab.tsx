'use client';

import { usePathname } from 'next/navigation';
import { MessageCircle } from 'lucide-react';

/**
 * Bouton WhatsApp flottant, affiche uniquement sur les pages publiques
 * strategiques : accueil, formations (liste et detail), prestations,
 * reservation et contact. Il est masque dans les espaces prives et le
 * back-office pour ne pas gener la saisie.
 */
const VISIBLE_ON = [
  (p: string) => p === '/',
  (p: string) => p.startsWith('/formations'),
  (p: string) => p.startsWith('/prestations'),
  (p: string) => p.startsWith('/reservation'),
  (p: string) => p.startsWith('/contact'),
];

export function WhatsAppFab({ href }: { href: string | null }) {
  const pathname = usePathname();
  if (!href) return null;
  if (!VISIBLE_ON.some((match) => match(pathname))) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Nous écrire sur WhatsApp"
      /* Emprise sur telephone.
         Le bouton flotte : il recouvrira toujours quelque chose au defilement,
         c'est le principe. Ce qui n'etait pas acceptable, c'est qu'au repos il
         masquait un chiffre de la rangee de compteurs de l'accueil.

         Le remonter ne reglait rien — il venait alors mordre sur « Decouvrir
         nos formations », donc sur l'action principale, ce qui est pire. Il n'y
         a de toute facon aucun creneau libre sur cet ecran : la barre de
         navigation occupe les 71 px du bas et le contenu court jusque sous elle.

         La reponse tient donc a la largeur. Sans texte, `px-3` donne un disque
         de 44 px au lieu d'une pastille de 52 : ancre a droite, il se decale
         d'autant et laisse le chiffre entierement lisible. Des `sm`, le libelle
         reapparait et la pastille retrouve son format. */
      className="group fixed bottom-24 right-4 z-40 flex items-center gap-2 rounded-pill bg-[#25D366] px-3 py-3 text-sm font-semibold text-[#0B3D24] shadow-lift transition hover:brightness-110 active:scale-95 sm:px-4 lg:bottom-6 lg:right-6"
    >
      <MessageCircle size={20} />
      <span className="hidden sm:inline">WhatsApp</span>
    </a>
  );
}
