'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarRange, ChevronLeft, ChevronRight, MapPin, Users } from 'lucide-react';
import { formatMoney } from '@/lib/format';

/**
 * Calendrier public des sessions.
 *
 * Deux rendus a partir des memes donnees :
 *   - grille mensuelle a partir de 768 px, ou chaque session apparait sur ses
 *     jours ;
 *   - liste chronologique en dessous, car une grille de 7 colonnes est
 *     illisible a 375 px.
 *
 * Les places et les statuts viennent tels quels du serveur : aucun calcul
 * n'est refait ici.
 */

export type SessionCalendrier = {
  slug: string;
  titre: string;
  formationNom: string;
  formationSlug: string;
  categorie: string;
  debut: string; // ISO
  fin: string; // ISO
  lieu: string | null;
  prix: number;
  restantes: number;
  capacite: number;
  inscriptionPossible: boolean;
  pastille: { texte: string; ton: 'ouvert' | 'tension' | 'ferme' | 'neutre' };
};

const TONS: Record<SessionCalendrier['pastille']['ton'], string> = {
  ouvert: 'border-emerald-400/30 bg-emerald-400/15 text-emerald-100',
  tension: 'border-amber-400/30 bg-amber-400/15 text-amber-100',
  ferme: 'border-red-400/30 bg-red-400/15 text-red-100',
  neutre: 'border-white/15 bg-white/10 text-cream-muted',
};

const PERIODES = [
  { cle: 'tout', libelle: 'Toutes' },
  { cle: 'semaine', libelle: 'Cette semaine' },
  { cle: 'semaine-prochaine', libelle: 'La semaine prochaine' },
  { cle: 'mois', libelle: 'Ce mois' },
  { cle: 'mois-suivant', libelle: 'Mois suivant' },
] as const;

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const aMinuit = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Lundi de la semaine contenant `d`. */
function lundi(d: Date): Date {
  const j = aMinuit(d);
  const decalage = (j.getDay() + 6) % 7;
  j.setDate(j.getDate() - decalage);
  return j;
}

function bornesPeriode(cle: string, maintenant: Date): { debut: Date; fin: Date } | null {
  const l = lundi(maintenant);
  switch (cle) {
    case 'semaine': {
      const fin = new Date(l);
      fin.setDate(fin.getDate() + 6);
      fin.setHours(23, 59, 59, 999);
      return { debut: l, fin };
    }
    case 'semaine-prochaine': {
      const debut = new Date(l);
      debut.setDate(debut.getDate() + 7);
      const fin = new Date(debut);
      fin.setDate(fin.getDate() + 6);
      fin.setHours(23, 59, 59, 999);
      return { debut, fin };
    }
    case 'mois':
      return {
        debut: new Date(maintenant.getFullYear(), maintenant.getMonth(), 1),
        fin: new Date(maintenant.getFullYear(), maintenant.getMonth() + 1, 0, 23, 59, 59, 999),
      };
    case 'mois-suivant':
      return {
        debut: new Date(maintenant.getFullYear(), maintenant.getMonth() + 1, 1),
        fin: new Date(maintenant.getFullYear(), maintenant.getMonth() + 2, 0, 23, 59, 59, 999),
      };
    default:
      return null;
  }
}

export function CalendrierSessions({
  sessions,
  categories,
}: {
  sessions: SessionCalendrier[];
  categories: string[];
}) {
  const maintenant = useMemo(() => new Date(), []);
  const [mois, setMois] = useState(() => new Date(maintenant.getFullYear(), maintenant.getMonth(), 1));
  const [categorie, setCategorie] = useState('tout');
  const [periode, setPeriode] = useState<string>('tout');

  const filtrees = useMemo(() => {
    const bornes = bornesPeriode(periode, maintenant);
    return sessions.filter((s) => {
      if (categorie !== 'tout' && s.categorie !== categorie) return false;
      if (!bornes) return true;
      // Une session est retenue des lors qu'elle chevauche la periode.
      return new Date(s.debut) <= bornes.fin && new Date(s.fin) >= bornes.debut;
    });
  }, [sessions, categorie, periode, maintenant]);

  // Grille du mois affiché, commençant un lundi.
  const grille = useMemo(() => {
    const premier = new Date(mois.getFullYear(), mois.getMonth(), 1);
    const debut = lundi(premier);
    const cases: { jour: Date; duMois: boolean; sessions: SessionCalendrier[] }[] = [];
    for (let i = 0; i < 42; i += 1) {
      const jour = new Date(debut);
      jour.setDate(jour.getDate() + i);
      const finJour = new Date(jour);
      finJour.setHours(23, 59, 59, 999);
      cases.push({
        jour,
        duMois: jour.getMonth() === mois.getMonth(),
        sessions: filtrees.filter((s) => new Date(s.debut) <= finJour && new Date(s.fin) >= jour),
      });
    }
    return cases;
  }, [mois, filtrees]);

  const titreMois = mois.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  // La liste ne montre que ce qui reste a venir. La grille mensuelle, elle,
  // conserve les sessions passees : c'est normal d'en voir en revenant sur un
  // mois ecoule. Mais une liste titree « a venir » ne doit rien contenir de
  // termine.
  const listeTriee = filtrees
    .filter((s) => new Date(s.fin) >= aMinuit(maintenant))
    .sort((a, b) => new Date(a.debut).getTime() - new Date(b.debut).getTime());

  return (
    <div>
      {/* Filtres */}
      <div className="mb-6 space-y-2">
        <div className="scroll -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <button type="button" onClick={() => setCategorie('tout')} className={categorie === 'tout' ? 'btn-gold shrink-0 px-4 py-2 text-xs' : 'chip shrink-0'}>
            Toutes
          </button>
          {categories.map((c) => (
            <button key={c} type="button" onClick={() => setCategorie(c)} className={categorie === c ? 'btn-gold shrink-0 px-4 py-2 text-xs' : 'chip shrink-0'}>
              {c}
            </button>
          ))}
        </div>
        <div className="scroll -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {PERIODES.map((p) => (
            <button key={p.cle} type="button" onClick={() => setPeriode(p.cle)} className={periode === p.cle ? 'btn-gold shrink-0 px-4 py-2 text-xs' : 'chip shrink-0'}>
              {p.libelle}
            </button>
          ))}
        </div>
      </div>

      {/* Grille mensuelle — desktop et tablette uniquement */}
      <div className="hidden md:block">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMois(new Date(mois.getFullYear(), mois.getMonth() - 1, 1))}
            className="btn-ghost px-3 py-2 text-xs"
            aria-label="Mois précédent"
          >
            <ChevronLeft size={15} />
          </button>
          <h2 className="font-display text-xl capitalize text-cream">{titreMois}</h2>
          <button
            type="button"
            onClick={() => setMois(new Date(mois.getFullYear(), mois.getMonth() + 1, 1))}
            className="btn-ghost px-3 py-2 text-xs"
            aria-label="Mois suivant"
          >
            <ChevronRight size={15} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10">
          {JOURS.map((j) => (
            <div key={j} className="bg-plum-900/80 px-2 py-2 text-center text-[11px] uppercase tracking-wider text-cream-dim">
              {j}
            </div>
          ))}
          {grille.map(({ jour, duMois, sessions: duJour }) => {
            const aujourdhui = aMinuit(jour).getTime() === aMinuit(maintenant).getTime();
            return (
              <div
                key={jour.toISOString()}
                className={`min-h-[92px] bg-plum-950/70 p-1.5 ${duMois ? '' : 'opacity-40'} ${aujourdhui ? 'ring-1 ring-inset ring-gold-400/50' : ''}`}
              >
                <div className={`mb-1 text-xs ${aujourdhui ? 'font-semibold text-gold-300' : 'text-cream-dim'}`}>
                  {jour.getDate()}
                </div>
                <div className="space-y-1">
                  {duJour.slice(0, 3).map((s) => (
                    <Link
                      key={s.slug}
                      href={`/sessions/${s.slug}`}
                      className={`block truncate rounded border px-1.5 py-1 text-[11px] leading-tight transition hover:brightness-125 ${TONS[s.pastille.ton]}`}
                      title={`${s.formationNom} — ${s.titre}`}
                    >
                      {s.formationNom}
                    </Link>
                  ))}
                  {duJour.length > 3 ? (
                    <p className="px-1 text-[10px] text-cream-dim">+ {duJour.length - 3} autre(s)</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Liste chronologique — seule vue sur mobile, complement sur desktop */}
      <div className="md:mt-10">
        <h2 className="mb-3 font-display text-lg text-cream md:text-xl">
          {periode === 'tout' ? 'Toutes les sessions à venir' : PERIODES.find((p) => p.cle === periode)?.libelle}
        </h2>

        {listeTriee.length === 0 ? (
          <div className="surface p-6 text-center">
            <p className="text-sm text-cream-muted">Aucune session ne correspond à cette sélection.</p>
          </div>
        ) : (
          <ol className="space-y-3">
            {listeTriee.map((s) => {
              const debut = new Date(s.debut);
              const fin = new Date(s.fin);
              return (
                <li key={s.slug} className="surface flex gap-4 p-4">
                  <div className="shrink-0 text-center">
                    <p className="font-display text-2xl leading-none text-gold-300">{debut.getDate()}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-wider text-cream-dim">
                      {debut.toLocaleDateString('fr-FR', { month: 'short' })}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Link href={`/sessions/${s.slug}`} className="font-display text-base text-cream hover:text-gold-200">
                        {s.formationNom}
                      </Link>
                      <span className={`chip ${TONS[s.pastille.ton]}`}>{s.pastille.texte}</span>
                    </div>
                    <p className="mb-2 truncate text-xs text-cream-muted">{s.titre}</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="chip">
                        <CalendarRange size={11} />
                        {debut.getDate()} → {fin.getDate()} {fin.toLocaleDateString('fr-FR', { month: 'short' })}
                      </span>
                      <span className="chip text-gold-300">{formatMoney(s.prix)}</span>
                      <span className={`chip ${s.restantes === 0 ? 'text-red-200' : s.restantes <= 3 ? 'text-amber-200' : 'text-emerald-200'}`}>
                        <Users size={11} />
                        {s.restantes === 0 ? 'Complet' : `${s.restantes} place${s.restantes > 1 ? 's' : ''}`}
                      </span>
                      {s.lieu ? (
                        <span className="chip">
                          <MapPin size={11} /> {s.lieu}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="hidden shrink-0 self-center sm:block">
                    <Link
                      href={s.inscriptionPossible ? `/formations/${s.formationSlug}/inscription?session=${s.slug}` : `/sessions/${s.slug}`}
                      className={s.inscriptionPossible ? 'btn-gold px-4 py-2 text-xs' : 'btn-outline px-4 py-2 text-xs'}
                    >
                      {s.inscriptionPossible ? 'S’inscrire' : 'Détail'}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
