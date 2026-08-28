'use client';

import { useEffect, useRef } from 'react';

/**
 * POUSSIERE D'OR
 * ==============
 *
 * Une poussiere doree flotte doucement dans l'air. Rien de plus.
 *
 * L'effet recherche est cinematographique, pas ludique : le regard ne doit
 * jamais etre attire par une particule en particulier. On percoit que l'image
 * est vivante sans savoir dire pourquoi.
 *
 * Trois choix expliquent tout le reste du fichier :
 *
 * 1. UN SEUL CANVAS. Des centaines d'elements du DOM animes coutent cher et
 *    saturent le fil principal. Ici, un seul noeud, redessine par
 *    `requestAnimationFrame`.
 *
 * 2. DES VIGNETTES PRE-DESSINEES. Un halo dore se dessine normalement avec
 *    `shadowBlur` ou un degrade radial — deux operations tres couteuses,
 *    repetees a chaque image pour chaque particule. On les dessine donc UNE
 *    fois dans de petits canvas hors ecran, puis on se contente de les copier.
 *    C'est ce qui permet de tenir 60 images par seconde.
 *
 * 3. DES ZONES PROTEGEES. Le visage, le titre et les boutons recoivent une
 *    attenuation : une particule qui les traverse s'efface progressivement au
 *    lieu de passer devant. Les grosses particules, elles, n'y entrent jamais.
 *
 * L'animation s'arrete d'elle-meme quand l'onglet passe en arriere-plan ou que
 * la section sort de l'ecran : aucun cycle processeur n'est depense pour une
 * image que personne ne regarde.
 */

/**
 * Element a preserver, designe par un selecteur CSS.
 *
 * On mesure la position REELLE de l'element plutot que de coder des fractions
 * en dur : la mise en page du HERO passe d'une colonne a deux selon la largeur,
 * et le visage ne se trouve pas au meme endroit dans les deux cas. Mesurer,
 * c'est etre juste partout, y compris aux largeurs qu'on n'a pas prevues.
 */
export type Protection = {
  /** Selecteur CSS, cherche a l'interieur du conteneur. */
  selecteur: string;
  /** 0 = aucune particule ne survit, 1 = aucune attenuation. Defaut : 0. */
  intensite?: number;
  /** Marge autour de l'element, en fraction de sa taille. Defaut : 0.1. */
  marge?: number;
};

type Props = {
  /** Elements que les particules ne doivent pas venir troubler. */
  protections?: Protection[];
  /** Densite generale. 1 = reglage nominal. */
  densite?: number;
  className?: string;
};

/** Rectangle mesure, en pixels, relatif au conteneur. */
type Zone = { cx: number; cy: number; demiL: number; demiH: number; intensite: number };

/* -------------------------------------------------------------------------- */
/*                              REGLAGES VISUELS                              */
/* -------------------------------------------------------------------------- */

/**
 * Les trois couches donnent la profondeur. Les valeurs sont volontairement
 * basses : c'est la lenteur qui fait le luxe.
 *
 *   part      : proportion des particules affectee a la couche
 *   rayon     : taille en pixels (avant densite d'ecran)
 *   montee    : vitesse verticale en pixels par seconde (negatif = vers le haut)
 *   derive    : amplitude du balancement horizontal, en pixels par seconde
 *   opacite   : opacite maximale atteinte au milieu de la vie
 *   flou      : rayon du halo, en multiples du rayon de la particule
 *   duree     : duree de vie en secondes [min, max]
 */
const COUCHES = [
  // Couche 1 — arriere-plan : tres fine, tres faible, legerement floue.
  { part: 0.55, rayon: [0.5, 1.1], montee: [-5, -12], derive: 3, opacite: [0.10, 0.26], flou: 2.6, duree: [14, 26] },
  // Couche 2 — milieu : la poussiere proprement dite.
  { part: 0.33, rayon: [1.0, 2.0], montee: [-8, -18], derive: 5, opacite: [0.20, 0.45], flou: 2.0, duree: [11, 20] },
  // Couche 3 — premier plan : rares, plus lumineuses, un vrai petit eclat.
  { part: 0.12, rayon: [1.8, 3.2], montee: [-12, -26], derive: 8, opacite: [0.32, 0.62], flou: 1.7, duree: [9, 16] },
] as const;

/** Or premium, or clair, champagne — la palette de la maison, rien d'autre. */
const TEINTES = [
  [201, 162, 39],
  [229, 199, 107],
  [240, 220, 168],
] as const;

/**
 * Densite : une particule pour environ 9 000 pixels de surface, plafonnee
 * selon l'appareil. Un telephone a un processeur graphique plus modeste et un
 * ecran plus petit : y verser autant de poussiere qu'un grand ecran serait a la
 * fois inutile a l'oeil et couteux pour la batterie.
 */
const SURFACE_PAR_PARTICULE = 9000;
const PLAFONDS = {
  bureau: 180,
  tablette: 110,
  mobile: 55,
  /** Mouvement reduit : quelques eclats immobiles, rien de plus. */
  mouvementReduit: 14,
} as const;

type Particule = {
  couche: number;
  x: number;
  y: number;
  rayon: number;
  montee: number;
  derive: number;
  /** Phase du balancement horizontal : chaque particule oscille a son rythme. */
  phase: number;
  vitessePhase: number;
  opacite: number;
  age: number;
  duree: number;
  /** Phase du scintillement, tres lent. */
  scintillement: number;
  vitesseScintillement: number;
  teinte: number;
};

/* -------------------------------------------------------------------------- */

const auHasard = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * Dessine une fois pour toutes la vignette d'une particule : un point dore
 * entoure d'un halo. Recopier cette vignette coute presque rien, alors que la
 * redessiner a chaque image coute enormement.
 */
function vignette(rayon: number, flou: number, teinte: readonly [number, number, number], echelle: number) {
  const rayonTotal = Math.max(2, rayon * flou * echelle);
  const taille = Math.ceil(rayonTotal * 2) + 2;
  const c = document.createElement('canvas');
  c.width = taille;
  c.height = taille;
  const ctx = c.getContext('2d');
  if (!ctx) return c;

  const centre = taille / 2;
  const [r, v, b] = teinte;
  const degrade = ctx.createRadialGradient(centre, centre, 0, centre, centre, rayonTotal);
  degrade.addColorStop(0, `rgba(${r},${v},${b},1)`);
  degrade.addColorStop(0.22, `rgba(${r},${v},${b},0.75)`);
  degrade.addColorStop(0.55, `rgba(${r},${v},${b},0.18)`);
  degrade.addColorStop(1, `rgba(${r},${v},${b},0)`);
  ctx.fillStyle = degrade;
  ctx.beginPath();
  ctx.arc(centre, centre, rayonTotal, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

export function PoussiereDoree({ protections = [], densite = 1, className }: Props) {
  const refCanvas = useRef<HTMLCanvasElement>(null);
  // Lu par reference : changer ce tableau ne doit pas relancer l'animation.
  const refProtections = useRef(protections);
  refProtections.current = protections;

  useEffect(() => {
    const canvas = refCanvas.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    /* ------------------------------------------------------- Accessibilite */
    const requeteMouvement = window.matchMedia('(prefers-reduced-motion: reduce)');
    const requeteMobile = window.matchMedia('(max-width: 767px)');
    const requeteTablette = window.matchMedia('(min-width: 768px) and (max-width: 1279px)');

    let particules: Particule[] = [];
    let vignettes: HTMLCanvasElement[][] = [];
    let largeur = 0;
    let hauteur = 0;
    let echelle = 1;
    let image = 0;
    let derniereDate = 0;
    let visible = true;
    let ongletVisible = true;

    let zonesMesurees: Zone[] = [];

    /**
     * Releve la position reelle des elements a preserver.
     * Appele au montage et a chaque redimensionnement, jamais a chaque image :
     * `getBoundingClientRect` force un recalcul de mise en page, hors de
     * question de le payer 60 fois par seconde.
     */
    function mesurerZones() {
      const base = parent!.getBoundingClientRect();
      zonesMesurees = [];
      for (const prot of refProtections.current) {
        // `querySelectorAll` et non `querySelector` : un meme selecteur peut
        // designer plusieurs blocs. Le texte du hero, par exemple, est scinde
        // en deux (le titre d'un cote, la description et les boutons de
        // l'autre) pour que l'ordre de lecture change sur telephone. Ne
        // proteger que le premier laisserait les particules passer sur l'autre.
        // `forEach` plutot que `for...of` : la cible de compilation du projet
        // ne permet pas d'iterer directement sur une NodeList.
        parent!.querySelectorAll(prot.selecteur).forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return;
          const marge = prot.marge ?? 0.1;
          zonesMesurees.push({
            cx: r.left - base.left + r.width / 2,
            cy: r.top - base.top + r.height / 2,
            demiL: (r.width / 2) * (1 + marge),
            demiH: (r.height / 2) * (1 + marge),
            intensite: prot.intensite ?? 0,
          });
        });
      }
    }

    /**
     * Attenuation appliquee a une particule selon sa position.
     * Le fondu au bord de chaque zone evite toute frontiere visible : une
     * particule s'eteint en approchant, elle ne disparait pas d'un coup.
     */
    function attenuation(x: number, y: number): number {
      let facteur = 1;
      for (const z of zonesMesurees) {
        const dx = Math.abs(x - z.cx) / z.demiL;
        const dy = Math.abs(y - z.cy) / z.demiH;
        const d = Math.max(dx, dy);
        if (d >= 1.45) continue;
        // L'attenuation est PLEINE sur toute la zone (d <= 1) et ne se relache
        // qu'au-dela de son bord. Faire commencer le fondu a l'interieur
        // laisserait passer des particules dans les coins de la zone — donc
        // sur le pourtour du visage, ce qu'on refuse.
        const fondu = Math.min(1, Math.max(0, (d - 1) / 0.45));
        facteur = Math.min(facteur, z.intensite + (1 - z.intensite) * fondu);
        if (facteur === 0) return 0;
      }
      return facteur;
    }

    /** Naissance — ou renaissance — d'une particule. */
    function semer(p: Particule, premiereFois: boolean) {
      const c = COUCHES[p.couche];
      p.x = Math.random() * largeur;
      // A la premiere image, on repartit sur toute la hauteur : sinon toutes
      // les particules entreraient par le bas en meme temps.
      p.y = premiereFois ? Math.random() * hauteur : hauteur + auHasard(10, 80);
      p.rayon = auHasard(c.rayon[0], c.rayon[1]);
      p.montee = auHasard(c.montee[0], c.montee[1]);
      p.derive = auHasard(-c.derive, c.derive);
      p.phase = Math.random() * Math.PI * 2;
      p.vitessePhase = auHasard(0.06, 0.22);
      p.opacite = auHasard(c.opacite[0], c.opacite[1]);
      p.duree = auHasard(c.duree[0], c.duree[1]);
      p.age = premiereFois ? Math.random() * p.duree : 0;
      p.scintillement = Math.random() * Math.PI * 2;
      p.vitesseScintillement = auHasard(0.25, 0.7);
      p.teinte = Math.floor(Math.random() * TEINTES.length);
    }

    function construire() {
      const rect = parent!.getBoundingClientRect();
      largeur = Math.max(1, Math.round(rect.width));
      hauteur = Math.max(1, Math.round(rect.height));
      // Au-dela de 2, le gain visuel est nul et le cout de remplissage double.
      echelle = Math.min(window.devicePixelRatio || 1, 2);

      canvas!.width = Math.round(largeur * echelle);
      canvas!.height = Math.round(hauteur * echelle);
      canvas!.style.width = `${largeur}px`;
      canvas!.style.height = `${hauteur}px`;

      const plafond = requeteMobile.matches
        ? PLAFONDS.mobile
        : requeteTablette.matches
          ? PLAFONDS.tablette
          : PLAFONDS.bureau;
      let nombre = Math.min(plafond, Math.round(((largeur * hauteur) / SURFACE_PAR_PARTICULE) * densite));
      if (requeteMouvement.matches) nombre = Math.min(PLAFONDS.mouvementReduit, nombre);

      // Vignettes : une par couche et par teinte, a la taille maximale de la
      // couche. Les particules plus petites sont simplement dessinees reduites.
      vignettes = COUCHES.map((c) =>
        TEINTES.map((t) => vignette(c.rayon[1], c.flou, t, echelle)),
      );

      mesurerZones();

      particules = [];
      for (let i = 0; i < nombre; i += 1) {
        // Repartition entre les couches, dans l'ordre des proportions.
        const tirage = Math.random();
        let couche = 0;
        let cumul = 0;
        for (let k = 0; k < COUCHES.length; k += 1) {
          cumul += COUCHES[k].part;
          if (tirage <= cumul) {
            couche = k;
            break;
          }
        }
        const p: Particule = {
          couche,
          x: 0, y: 0, rayon: 1, montee: 0, derive: 0,
          phase: 0, vitessePhase: 0, opacite: 0, age: 0, duree: 1,
          scintillement: 0, vitesseScintillement: 0, teinte: 0,
        };
        semer(p, true);
        particules.push(p);
      }
    }

    function dessiner(maintenant: number) {
      image = requestAnimationFrame(dessiner);
      if (!visible || !ongletVisible) return;

      // Delta borne : apres un onglet en arriere-plan, un delta enorme ferait
      // sauter toutes les particules d'un coup.
      const delta = derniereDate ? Math.min((maintenant - derniereDate) / 1000, 0.05) : 0.016;
      derniereDate = maintenant;

      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      ctx!.globalCompositeOperation = 'lighter';

      const fige = requeteMouvement.matches;

      for (const p of particules) {
        if (!fige) {
          p.age += delta;
          if (p.age >= p.duree) semer(p, false);

          p.phase += p.vitessePhase * delta;
          p.scintillement += p.vitesseScintillement * delta;

          p.y += p.montee * delta;
          // Le balancement combine deux sinusoides de periodes differentes :
          // la trajectoire change doucement de direction sans jamais se repeter
          // de facon perceptible.
          p.x += (Math.sin(p.phase) * 0.75 + Math.sin(p.phase * 0.41) * 0.25) * p.derive * delta;

          if (p.y < -60) semer(p, false);
          if (p.x < -40) p.x = largeur + 20;
          if (p.x > largeur + 40) p.x = -20;
        }

        // Fondu d'apparition et de disparition : aucune particule ne surgit ni
        // ne s'eteint brutalement, ce qui rend la boucle invisible.
        const t = p.age / p.duree;
        const fondu = Math.min(1, t / 0.18) * Math.min(1, (1 - t) / 0.22);

        // Scintillement tres retenu : 15 % d'amplitude, pas davantage.
        const eclat = fige ? 1 : 0.85 + Math.sin(p.scintillement) * 0.15;

        const alpha = p.opacite * fondu * eclat * attenuation(p.x, p.y);
        if (alpha <= 0.004) continue;

        const vignetteCouche = vignettes[p.couche][p.teinte];
        const cote = (p.rayon / COUCHES[p.couche].rayon[1]) * vignetteCouche.width;

        ctx!.globalAlpha = alpha;
        ctx!.drawImage(
          vignetteCouche,
          p.x * echelle - cote / 2,
          p.y * echelle - cote / 2,
          cote,
          cote,
        );
      }

      ctx!.globalAlpha = 1;
      ctx!.globalCompositeOperation = 'source-over';
    }

    /* --------------------------------------------------------- Cycle de vie */

    const surRedimensionnement = new ResizeObserver(() => {
      construire();
    });
    surRedimensionnement.observe(parent);

    // Hors ecran : on cesse de dessiner. L'animation reprend a l'identique.
    const surVisibilite = new IntersectionObserver(
      (entrees) => {
        visible = entrees[0]?.isIntersecting ?? true;
        if (visible) derniereDate = 0;
      },
      { rootMargin: '120px' },
    );
    surVisibilite.observe(parent);

    const surOnglet = () => {
      ongletVisible = document.visibilityState === 'visible';
      if (ongletVisible) derniereDate = 0;
    };
    document.addEventListener('visibilitychange', surOnglet);

    // Un changement de reglage systeme (mouvement reduit, passage en mobile)
    // doit reconstruire immediatement, sans rechargement de page.
    const surReglages = () => construire();
    requeteMouvement.addEventListener('change', surReglages);
    requeteMobile.addEventListener('change', surReglages);
    requeteTablette.addEventListener('change', surReglages);

    construire();
    image = requestAnimationFrame(dessiner);

    return () => {
      cancelAnimationFrame(image);
      surRedimensionnement.disconnect();
      surVisibilite.disconnect();
      document.removeEventListener('visibilitychange', surOnglet);
      requeteMouvement.removeEventListener('change', surReglages);
      requeteMobile.removeEventListener('change', surReglages);
      requeteTablette.removeEventListener('change', surReglages);
      // On relache explicitement les vignettes : sans cela, un changement de
      // page laisserait plusieurs canvas hors ecran en memoire.
      vignettes = [];
      particules = [];
    };
  }, [densite]);

  return (
    <canvas
      ref={refCanvas}
      aria-hidden="true"
      // Purement decoratif : ne doit jamais intercepter un clic sur un bouton.
      className={`pointer-events-none absolute inset-0 select-none ${className ?? ''}`}
    />
  );
}
