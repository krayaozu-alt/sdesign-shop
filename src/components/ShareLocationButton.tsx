'use client';

import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';

/**
 * Partage de la localisation.
 * Utilise le partage natif du telephone quand il existe (Android / iOS),
 * sinon copie le lien dans le presse-papiers. Aucun echec silencieux :
 * l'etat du bouton indique toujours ce qui s'est passe.
 */
export function ShareLocationButton({ url, nom, adresse }: { url: string; nom: string; adresse: string }) {
  const [etat, setEtat] = useState<'pret' | 'copie' | 'echec'>('pret');

  async function partager() {
    const texte = `${nom} — ${adresse}`;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: nom, text: texte, url });
        return;
      }
      await navigator.clipboard.writeText(`${texte}\n${url}`);
      setEtat('copie');
      setTimeout(() => setEtat('pret'), 2500);
    } catch {
      // L'utilisateur a annule le partage natif, ou le presse-papiers est bloque.
      setEtat('echec');
      setTimeout(() => setEtat('pret'), 2500);
    }
  }

  return (
    <button type="button" onClick={partager} className="btn-ghost px-4 py-2.5 text-xs">
      {etat === 'copie' ? <Check size={14} /> : <Share2 size={14} />}
      {etat === 'copie' ? 'Lien copié' : etat === 'echec' ? 'Copie impossible' : 'Partager la localisation'}
    </button>
  );
}
