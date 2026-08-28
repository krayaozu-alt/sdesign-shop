import Link from 'next/link';
import { GraduationCap } from 'lucide-react';
import { PoussiereDoree } from '@/components/public/PoussiereDoree';

/**
 * HERO
 * ====
 *
 * Composition editoriale horizontale : la promesse a gauche, la femme a droite.
 * Derriere, une poussiere d'or flotte en continu.
 *
 * POURQUOI CETTE STRUCTURE, ET PAS UN CADRE A RATIO
 * -------------------------------------------------
 * La version precedente enfermait la photo dans une boite `aspect-[4/5]` dont
 * la largeur etait plafonnee par la colonne. Trois consequences, toutes
 * mauvaises :
 *
 *   1. la hauteur du hero devenait celle de cette boite (675 px) plus les
 *      marges — le hero passait a 910 px et se lisait comme une affiche
 *      verticale ;
 *   2. la photo fournie est en paysage (1,25:1) ; dans une boite portrait
 *      (0,8), `object-cover` en jetait 36 % de la largeur avant tout le reste ;
 *   3. un masque radial taillait ensuite ce qui restait en disque : la femme se
 *      lisait comme un petit medaillon, plus comme une figure.
 *
 * Ici, c'est le HERO qui impose sa hauteur, et la photo remplit la colonne
 * droite. Les bords sont estompes par des degrades LINEAIRES — un a la
 * verticale, un a l'horizontale, appliques sur deux elements imbriques plutot
 * que sur un seul (deux masques poses sur un meme element s'additionnent au
 * lieu de se croiser, et le rectangle reapparaitrait entier).
 */

type Props = {
  slogan: string;
  tagline: string;
  /** Photo du HERO. Tant qu'elle est absente, un visuel dore la remplace. */
  photoUrl: string | null;
};

/**
 * Met en or les mots forts du slogan.
 *
 * Le slogan est modifiable depuis l'administration : on ne peut donc pas
 * decouper la phrase a une position fixe. On accentue les mots choisis la ou
 * ils se trouvent, et si le slogan change du tout au tout, la phrase reste
 * simplement affichee en entier, sans casse.
 */
const MOTS_ACCENTUES = ['beauté', 'talent'];

function sloganEnMorceaux(slogan: string) {
  const motif = new RegExp(`(${MOTS_ACCENTUES.join('|')})`, 'gi');
  return slogan.split(motif).filter((m) => m !== '');
}

/** Ornement du filet dore, repris de la maquette. */
function FiletOrne() {
  return (
    <div className="my-4 flex items-center gap-3 sm:my-6" aria-hidden="true">
      <span className="h-px w-14 bg-gradient-to-r from-transparent to-gold-500/70 sm:w-20" />
      <span className="h-1.5 w-1.5 rotate-45 bg-gold-400/80" />
      <span className="h-2.5 w-2.5 rotate-45 border border-gold-400/70" />
      <span className="h-1.5 w-1.5 rotate-45 bg-gold-400/80" />
      <span className="h-px w-14 bg-gradient-to-l from-transparent to-gold-500/70 sm:w-20" />
    </div>
  );
}

/**
 * Motif africain en fond : losanges imbriques inspires des tissus tisses.
 *
 * Volontairement sous les 2,5 % d'opacite et sur une maille large : c'est une
 * texture qui donne de la profondeur, pas un decor. On doit la deviner en
 * s'approchant de l'ecran, jamais la remarquer en arrivant.
 */
function MotifAfricain() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.022]"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern id="hero-tissage" width="104" height="104" patternUnits="userSpaceOnUse">
          <path d="M52 0 L104 52 L52 104 L0 52 Z" fill="none" stroke="#E5C76B" strokeWidth="0.7" />
          <path d="M52 26 L78 52 L52 78 L26 52 Z" fill="none" stroke="#C9A227" strokeWidth="0.5" />
          <circle cx="52" cy="52" r="1.6" fill="#E5C76B" />
        </pattern>
        {/* La maille s'efface vers le bas et vers la gauche : elle ne doit
            jamais venir concurrencer le texte. */}
        <linearGradient id="hero-tissage-fondu" x1="0" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.7" />
          <stop offset="50%" stopColor="#fff" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="hero-tissage-masque">
          <rect width="100%" height="100%" fill="url(#hero-tissage-fondu)" />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="url(#hero-tissage)" mask="url(#hero-tissage-masque)" />
    </svg>
  );
}

export function Hero({ slogan, tagline, photoUrl }: Props) {
  const morceaux = sloganEnMorceaux(slogan);

  return (
    <section className="relative isolate overflow-hidden">
      {/* --------------------------------------------------------- Fond */}
      {/* La lumiere vient de derriere la femme, a droite ; les bords tombent
          dans le noir de la charte. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-20 bg-night-950"
        style={{
          backgroundImage:
            // Trois nappes, du plus clair au plus sombre : une lumiere
            // aubergine derriere la femme, un rappel plus froid en haut a
            // gauche, et le noir de la charte partout ailleurs. Aucune valeur
            // ne monte assez haut pour virer au violet vif.
            // Nappe aubergine deliberement basse en intensite et decalee vers
            // la gauche de la femme : elle sert de lumiere rasante autour
            // d'elle, pas de tache violette derriere sa tete.
            'radial-gradient(54% 66% at 58% 46%, rgba(104,44,132,0.3) 0%, rgba(48,14,68,0.22) 44%, rgba(8,7,10,0) 76%),' +
            'radial-gradient(46% 54% at 6% 2%, rgba(64,18,88,0.16) 0%, rgba(8,7,10,0) 62%),' +
            'linear-gradient(180deg, rgba(24,6,30,0.26) 0%, rgba(8,7,10,0) 52%)',
        }}
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-20">
        <MotifAfricain />
      </div>

      {/* ------------------------------------------------ Poussiere d'or */}
      {/* Le canvas est un enfant DIRECT de la section : c'est ainsi qu'il peut
          mesurer le visage et le texte pour les preserver, et se dimensionner
          sur toute la hauteur du hero. L'envelopper dans un div le couperait de
          ces reperes. Il reste sous le contenu et ne capte aucun clic. */}
      <PoussiereDoree
        className="-z-10"
        protections={[
          // LE VISAGE : aucune particule, jamais, avec une large marge autour.
          { selecteur: '[data-hero-visage]', intensite: 0, marge: 0.35 },
          // Le corps et le turban : la poussiere passe, tres attenuee. Elle
          // doit flotter AUTOUR d'elle, pas s'arreter net au bord du cadre.
          { selecteur: '[data-hero-photo]', intensite: 0.4, marge: 0 },
          // Le titre, la description et les boutons : presque rien, pour que
          // l'oeil ne soit jamais tire pendant la lecture.
          { selecteur: '[data-hero-texte]', intensite: 0.1, marge: 0.04 },
        ]}
      />

      {/* La hauteur est pilotee par le HERO, pas par la photo : c'est ce qui
          empeche la composition de redevenir verticale. La photo s'adapte a la
          place disponible, jamais l'inverse.

          La bascule en deux colonnes se fait des 768 px (`md`), et non a
          1024 px. C'etait le vrai defaut de la version precedente : toute
          fenetre plus etroite que 1024 px — un portable dont la fenetre n'est
          pas maximisee, par exemple — retombait sur la mise en page empilee,
          photo au-dessus et texte dessous. D'ou l'impression d'affiche
          verticale avec un medaillon centre. */}
      {/* Fondu de sortie. La section se terminait par une lisiere franche : le
          decor aubergine s'arretait d'un trait et la femme etait coupee net.
          Ce degrade eteint les deux vers le noir de la page. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-24 sm:h-28"
        style={{ background: 'linear-gradient(to top, #08070A 0%, rgba(8,7,10,0.7) 45%, rgba(8,7,10,0) 100%)' }}
      />

      {/* La hauteur suit celle de la fenetre a partir de 1280 px. Le hero ne
          faisait que 56 % de la hauteur sur un ecran 1080 : il s'y lisait comme
          une bande, sans ampleur. Le `max()` garantit qu'il ne RETRECIT jamais
          sur les ecrans peu hauts — a 1366x768, 72 % ne feraient que 553 px. */}
      <div className="container-page relative py-7 md:flex md:min-h-[33rem] md:items-center md:py-10 lg:min-h-[35rem] xl:min-h-[max(38rem,72svh)] xl:py-12">
        {/* Deux colonnes, deux rangees : le titre et le bloc « description +
            boutons » occupent la colonne de gauche l'un sous l'autre, la photo
            occupe toute la colonne de droite. Ce decoupage en deux blocs de
            texte permet, sur telephone, d'intercaler la femme ENTRE le titre et
            la description — l'ordre de lecture demande. */}
        <div className="grid w-full items-center gap-5 sm:gap-6 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:grid-rows-[auto_auto] md:gap-x-6 md:gap-y-5 lg:gap-x-8">
          {/* ============================================ TITRE (gauche) */}
          <div
            data-hero-texte
            className="relative z-10 order-1 text-center md:order-none md:col-start-1 md:row-start-1 md:self-end md:text-left"
          >
            <p className="label-eyebrow text-gold-300">{tagline}</p>

            {/* Puissant mais maitrise : trois lignes au maximum sur grand
                ecran. Au-dela, le titre ecrase la description et deseequilibre
                la colonne. */}
            {/* La colonne de gauche fait environ 480 px des que le conteneur
                atteint sa largeur maximale. A 3,6 rem, « Révélez votre beauté, »
                ne tenait plus sur une ligne et la coupure tombait au milieu de
                la proposition. A 3 rem elle passe, et la phrase retrouve son
                rythme en trois lignes. */}
            <h1 className="mt-3 font-display text-[2rem] leading-[1.12] text-cream sm:text-[2.4rem] md:mt-4 md:text-[2rem] lg:text-[2.6rem] xl:text-[3rem]">
              {morceaux.map((m, i) =>
                MOTS_ACCENTUES.some((mot) => mot.toLowerCase() === m.toLowerCase()) ? (
                  <span key={i} className="gold-text">
                    {m}
                  </span>
                ) : (
                  <span key={i}>{m}</span>
                ),
              )}
            </h1>
          </div>

          {/* ================================ DESCRIPTION ET BOUTONS (gauche) */}
          <div
            data-hero-texte
            className="relative z-10 order-3 text-center md:order-none md:col-start-1 md:row-start-2 md:self-start md:text-left"
          >
            <div className="flex justify-center md:justify-start">
              <FiletOrne />
            </div>

            {/* Largeur bornee : au-dela d'une soixantaine de signes par ligne,
                une description perd en confort de lecture. */}
            <p className="mx-auto max-w-[31rem] text-[13px] leading-relaxed text-cream-muted sm:text-[15px] md:mx-0">
              S.DESIGN SHOP vous accompagne avec des formations professionnelles en coiffure, turban, maquillage et
              bien plus. Apprenez un métier, changez votre avenir.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row sm:justify-center md:flex-col lg:flex-row lg:justify-start">
              <Link
                href="/formations"
                className="btn-gold whitespace-nowrap px-6 py-3.5 text-[13px] sm:px-7 sm:text-sm md:px-4 md:text-[12.5px] lg:px-5 lg:text-[13px] xl:px-7 xl:text-sm"
              >
                <GraduationCap size={17} /> Découvrir nos formations
              </Link>
            </div>
          </div>

          {/* ============================================ LA FEMME (droite) */}
          {/* Sur telephone, la hauteur est exprimee en `svh` : elle suit la
              hauteur reellement disponible, barres du navigateur comprises. Sur
              grand ecran, la colonne prend toute la hauteur du hero et la femme
              occupe donc environ la moitie de la surface visible. */}
          {/* Hauteur de la colonne photo.

              Sous 500 px, elle suit la fenetre (`30svh`) : l'ecran est etroit,
              le conteneur reste presque carre et la photo passe entiere.

              Entre 500 et 767 px, ce meme reglage devenait faux. La colonne
              s'elargit avec l'ecran pendant que sa hauteur reste accrochee a la
              fenetre : a 600 px son rapport atteignait 2,37 contre 1,25 pour la
              photographie, et `object-cover` n'en laissait voir que 53 % — le
              menton, la main et l'epaule sortaient du cadre.

              La hauteur suit donc la LARGEUR dans cette plage, ce qui fige le
              rapport a 1,5 et redonne 83 % de la photo. Le `min()` garde un
              plafond a 60 % de la fenetre pour les ecrans peu hauts. A 767 px la
              valeur obtenue frole les 28rem que `md` reprend a 768 px : le
              passage a deux colonnes ne fait pas de saut. */}
          <div className="relative order-2 h-[30svh] min-h-[12.5rem] min-[500px]:h-[min(calc((100vw-2.5rem)/1.5),60svh)] md:order-none md:col-start-2 md:row-span-2 md:row-start-1 md:h-[28rem] md:min-h-0 lg:h-[30rem] xl:h-[max(33rem,calc(72svh-7rem))]">
            {/* Aucun element graphique circulaire ici : ni arc, ni anneau, ni
                nappe radiale. La photographie porte deja son propre trait dore,
                et en superposer un second dessinait un cercle presque complet
                autour de sa tete — l'effet medaillon qu'il fallait proscrire.
                La photo se suffit : elle se fond par ses masques lineaires. */}
            {photoUrl ? <PhotoDuHero url={photoUrl} /> : <VisuelDeSecours />}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * La photographie.
 *
 * Elle doit se lire comme une VRAIE photographie editoriale occupant le cote
 * droit, pas comme une image posee dans un cadre. D'ou trois choix :
 *
 * - sur grand ecran elle SAIGNE vers le haut et vers la droite : aucun fondu
 *   de ce cote, elle sort du champ. Estomper les quatre bords donnait une
 *   forme flottante — l'effet « vignette » qu'on ne veut pas ;
 * - elle ne s'estompe qu'a GAUCHE, vers la colonne de texte, et doucement en
 *   bas, vers la section suivante ;
 * - aucun degrade radial, nulle part.
 *
 * Deux elements imbriques, un masque lineaire chacun : le parent gere la
 * verticale, l'enfant l'horizontale. Les poser tous les deux sur un seul
 * element ne marcherait pas — deux couches de masque s'additionnent par
 * defaut, et le rectangle reapparaitrait entier.
 */
function PhotoDuHero({ url }: { url: string }) {
  return (
    <div
      data-hero-photo
      // A partir de `lg`, la photo deborde jusqu'au bord droit de l'ecran.
      // Le calcul reprend la geometrie du conteneur du site (max-w-6xl, soit
      // 1152 px, avec 24 px de marge interieure) : la valeur vaut exactement la
      // gouttiere de droite, et retombe sur la simple marge quand l'ecran est
      // plus etroit que le conteneur. Sans ce debordement, une bande vide de
      // 168 px restait a sa droite sur un ecran de 1440 px, et la femme ne
      // remplissait pas la partie droite du hero.
      // Verticale : sur telephone elle s'estompe en haut, sous le titre. Des
      // 768 px elle part du bord haut sans fondu — elle saigne hors du champ.
      className="absolute inset-0 -right-4 overflow-hidden sm:-right-6 [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,#000_6%,#000_80%,transparent_100%)] [mask-image:linear-gradient(to_bottom,transparent_0%,#000_6%,#000_80%,transparent_100%)] md:right-[calc(-1*max(24px,(100vw-1152px)/2+24px))] md:[-webkit-mask-image:linear-gradient(to_bottom,#000_0%,#000_89%,transparent_100%)] md:[mask-image:linear-gradient(to_bottom,#000_0%,#000_89%,transparent_100%)]"
    >
      <div
        // Horizontale : sur telephone un leger fondu des deux cotes. Des
        // 768 px, fondu UNIQUEMENT a gauche, vers le texte ; a droite elle sort
        // du champ, comme une photographie de magazine.
        className="absolute inset-0 [-webkit-mask-image:linear-gradient(to_right,transparent_0%,#000_20%,#000_100%)] [mask-image:linear-gradient(to_right,transparent_0%,#000_20%,#000_100%)] md:[-webkit-mask-image:linear-gradient(to_right,transparent_0%,#000_34%,#000_100%)] md:[mask-image:linear-gradient(to_right,transparent_0%,#000_34%,#000_100%)]"
      >
        {/* `object-position` a 36 % : la photo est en paysage et le sujet y est
            legerement a gauche. En montrant la tranche gauche de l'image, on
            decale la femme vers la droite de la colonne, comme sur la maquette,
            et son visage tombe dans le tiers superieur. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="Formatrice S.DESIGN SHOP portant un turban traditionnel et des bijoux dorés"
          /* Cadrage.
             `object-position` a 36 % : le sujet est legerement a gauche dans la
             photo ; en montrant la tranche gauche, on le decale vers la droite
             de la colonne et son visage tombe dans le tiers superieur.

             L'agrandissement de 28 % a partir de 768 px repond a un defaut
             mesure : le visage ne faisait que 14 % de la largeur d'ecran, contre
             environ 19 % sur la maquette de reference — elle etait presente mais
             lointaine. La photo comporte environ 25 % de noir vide sur ses cotes ;
             le zoom le fait sortir du cadre au lieu de l'afficher.

             L'origine est posee EN HAUT (`origin-[42%_top]`) et non au centre :
             le sommet du turban est deja au bord superieur de la photo, un zoom
             centre l'aurait coupe. Avec cette origine, le haut reste fixe — le
             turban demeure entier — et c'est le bas, deja fondu, qui sort du
             champ. Les 42 % horizontaux placent l'origine sur son visage, pour
             qu'il ne derive pas en grandissant. */
          className="h-full w-full origin-top-right object-cover object-[100%_top] md:scale-[1.3]"
          fetchPriority="high"
          decoding="async"
        />

        {/* Pas de vignettage radial ici.
            Une version precedente en superposait un : mesure faite, il eteignait
            la femme presque entierement au lieu de n'assombrir que les coins.
            Il n'apporte rien : les deux masques lineaires ci-dessus estompent
            deja les quatre bords, et le fond de la photo est un noir uni,
            pratiquement celui du hero. Une photo au fond clair serait elle aussi
            fondue par ces masques ; c'est d'ailleurs ce que recommande la fiche
            d'aide du champ, cote administration. */}
      </div>

      {/* Reperage du visage, pour le canvas uniquement — aucun rendu.
          Valeurs deduites du cadrage : dans la photo source le visage occupe la
          bande 31-54 % en largeur et 22-57 % en hauteur ; `object-cover` sur
          cette colonne n'en rogne que les bords, si bien qu'il retombe autour
          de 28-58 % / 20-59 % du cadre. La zone est prise large, et le canvas
          y ajoute encore 35 % de marge. */}
      <div
        data-hero-visage
        aria-hidden="true"
        className="pointer-events-none absolute left-[66%] top-[26%] h-[44%] w-[26%] md:left-[46%] md:top-[35%] md:h-[55%] md:w-[44%]"
      />
    </div>
  );
}

/**
 * Visuel affiche tant qu'aucune photo n'a ete televersee.
 *
 * Il ne doit jamais se lire comme une erreur ni comme un chantier : aucun
 * message d'attente, aucun cadre en pointilles. C'est un motif dore discret,
 * dans la meme langue graphique que le reste du hero — une visiteuse qui
 * arrive doit voir une composition finie.
 */
function VisuelDeSecours() {
  return (
    <div data-hero-photo className="absolute inset-0">
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-[44%] aspect-square w-[74%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            'radial-gradient(closest-side at 50% 38%, rgba(110,45,140,0.5) 0%, rgba(37,10,48,0.8) 55%, rgba(11,11,13,0.95) 100%)',
        }}
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        className="absolute left-1/2 top-[44%] aspect-square w-[74%] -translate-x-1/2 -translate-y-1/2"
      >
        <g stroke="#E5C76B" fill="none" strokeLinejoin="round" opacity="0.22">
          <path d="M50 18 L74 50 L50 82 L26 50 Z" strokeWidth="0.5" />
          <path d="M50 27 L67 50 L50 73 L33 50 Z" strokeWidth="0.4" opacity="0.8" />
          <path d="M50 36 L60 50 L50 64 L40 50 Z" strokeWidth="0.35" opacity="0.6" />
        </g>
        <g fill="#F0DCA8" opacity="0.38">
          <circle cx="50" cy="50" r="1.6" />
          <circle cx="50" cy="18" r="0.9" />
          <circle cx="50" cy="82" r="0.9" />
          <circle cx="26" cy="50" r="0.9" />
          <circle cx="74" cy="50" r="0.9" />
        </g>
      </svg>
      <span className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 font-display text-[4rem] leading-none text-gold-300/[0.16] sm:text-[5.5rem]">
        S
      </span>
    </div>
  );
}
