'use client';

import { useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';

/**
 * Apercu du site public, dans un cadre a largeur reglable.
 *
 * Ce n'est pas une reconstitution : c'est la vraie page publique, chargee
 * telle quelle. Ce que l'administrateur voit ici est donc, au pixel pres, ce
 * que verra la cliente — y compris les brouillons qui, eux, n'y sont pas.
 */

const LARGEURS = [
  { cle: 375, libelle: '375 px', detail: 'iPhone SE' },
  { cle: 390, libelle: '390 px', detail: 'iPhone 14' },
  { cle: 412, libelle: '412 px', detail: 'Android' },
  { cle: 768, libelle: '768 px', detail: 'Tablette' },
  { cle: 1366, libelle: '1366 px', detail: 'Portable' },
  { cle: 1920, libelle: '1920 px', detail: 'Grand écran' },
] as const;

const PAGES = [
  { chemin: '/', libelle: 'Accueil' },
  { chemin: '/formations', libelle: 'Formations' },
  { chemin: '/calendrier-formations', libelle: 'Calendrier' },
  { chemin: '/prestations', libelle: 'Prestations' },
  { chemin: '/galerie', libelle: 'Galerie' },
  { chemin: '/contact', libelle: 'Contact' },
] as const;

export function ApercuSite() {
  const [largeur, setLargeur] = useState<number>(390);
  const [page, setPage] = useState<string>('/');
  const [cle, setCle] = useState(0);

  // Hauteur proportionnee : un mobile est haut, un grand ecran est large.
  const hauteur = largeur < 500 ? 780 : largeur < 900 ? 900 : 820;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {PAGES.map((p) => (
          <button
            key={p.chemin}
            type="button"
            onClick={() => setPage(p.chemin)}
            className={page === p.chemin ? 'btn-gold px-4 py-2 text-xs' : 'chip'}
          >
            {p.libelle}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {LARGEURS.map((l) => (
          <button
            key={l.cle}
            type="button"
            onClick={() => setLargeur(l.cle)}
            className={largeur === l.cle ? 'btn-gold px-3 py-2 text-xs' : 'chip'}
            title={l.detail}
          >
            {l.libelle}
          </button>
        ))}
        <button type="button" onClick={() => setCle((n) => n + 1)} className="chip" title="Recharger l’aperçu">
          <RefreshCw size={12} /> Recharger
        </button>
        <a href={page} target="_blank" rel="noreferrer" className="chip">
          <ExternalLink size={12} /> Ouvrir dans un onglet
        </a>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-plum-950/60 p-3">
        <div className="mx-auto" style={{ width: largeur, maxWidth: '100%' }}>
          <p className="mb-2 text-center text-xs text-cream-dim">
            {page} — {largeur} px
          </p>
          <iframe
            key={`${page}-${largeur}-${cle}`}
            src={page}
            title={`Aperçu ${page} en ${largeur} pixels`}
            className="w-full rounded-lg border border-white/10 bg-white"
            style={{ height: hauteur }}
          />
        </div>
      </div>

      <p className="text-xs text-cream-dim">
        Seules les annonces publiées et dans leur période de diffusion apparaissent ici. Un brouillon ou une annonce
        expirée reste invisible, exactement comme pour la cliente.
      </p>
    </div>
  );
}
