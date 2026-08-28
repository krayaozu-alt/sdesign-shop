'use client';

import { useEffect, useState } from 'react';
import { Check, Link2, Share2 } from 'lucide-react';

/**
 * Partage d'une session.
 *
 * Utilise le partage natif du systeme lorsqu'il existe (mobile, et une partie
 * des navigateurs de bureau) ; sinon copie l'adresse dans le presse-papiers.
 * L'URL passee est l'adresse publique reelle de la session, celle dont
 * l'apercu social est renseigne par `generateMetadata`.
 */
export function PartageSession({ url, titre, texte }: { url: string; titre: string; texte: string }) {
  const [copie, setCopie] = useState(false);
  // Detecte apres le montage : le rendu serveur ne connait pas le navigateur,
  // et une difference entre les deux provoquerait une erreur d'hydratation.
  const [partageNatif, setPartageNatif] = useState(false);
  useEffect(() => {
    setPartageNatif(typeof navigator !== 'undefined' && 'share' in navigator);
  }, []);

  async function partager() {
    if (partageNatif) {
      try {
        await navigator.share({ title: titre, text: texte, url });
        return;
      } catch {
        // Partage refuse ou annule : on retombe sur la copie du lien.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopie(true);
      setTimeout(() => setCopie(false), 2500);
    } catch {
      // Presse-papiers indisponible : rien de plus a proposer ici.
    }
  }

  return (
    <button type="button" onClick={partager} className="btn-ghost w-full justify-center px-4 py-2 text-xs">
      {copie ? (
        <>
          <Check size={14} /> Lien copié
        </>
      ) : (
        <>
          {partageNatif ? <Share2 size={14} /> : <Link2 size={14} />}
          Partager cette session
        </>
      )}
    </button>
  );
}
