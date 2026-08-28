import 'server-only';
import { prisma } from '@/lib/prisma';
import { POST_STATUS, type BannerPlacement } from '@/lib/constants';
import { etatSession, filtreInscriptionsOccupantes, prixSession } from '@/server/sessions';

/**
 * PUBLICATIONS ET BANNIERES
 * -------------------------
 * Une meme regle de diffusion pour les deux : un contenu n'est visible du
 * public que s'il est PUBLIE et que la date du jour tombe dans sa fenetre.
 *
 *   avant la date de debut  -> invisible
 *   dans la fenetre         -> visible
 *   apres la date de fin    -> invisible
 *
 * L'administrateur n'a donc jamais a supprimer une annonce perimee : elle
 * disparait d'elle-meme. Un BROUILLON, une PROGRAMMEE ou une ARCHIVEE ne sont
 * jamais servis au public, quelle que soit leur fenetre.
 */

/** Fenetre de diffusion, exprimee en filtre Prisma. */
function fenetreOuverte(maintenant: Date, champDebut: string, champFin: string) {
  return {
    status: POST_STATUS.PUBLIEE,
    AND: [
      { OR: [{ [champDebut]: null }, { [champDebut]: { lte: maintenant } }] },
      { OR: [{ [champFin]: null }, { [champFin]: { gte: maintenant } }] },
    ],
  };
}

/**
 * Etat de diffusion d'un contenu, pour l'affichage cote administration.
 * Distingue « publiee mais pas encore commencee » de « publiee et en ligne ».
 */
export type EtatDiffusion = {
  enLigne: boolean;
  libelle: string;
  ton: 'ouvert' | 'tension' | 'ferme' | 'neutre';
};

export function etatDiffusion(
  contenu: { status: string; debut: Date | null; fin: Date | null },
  maintenant = new Date(),
): EtatDiffusion {
  if (contenu.status === POST_STATUS.BROUILLON) return { enLigne: false, libelle: 'Brouillon', ton: 'neutre' };
  if (contenu.status === POST_STATUS.ARCHIVEE) return { enLigne: false, libelle: 'Archivée', ton: 'ferme' };
  if (contenu.status === POST_STATUS.PROGRAMMEE) return { enLigne: false, libelle: 'Programmée', ton: 'neutre' };

  // Statut PUBLIEE : c'est la fenetre qui decide.
  if (contenu.debut && contenu.debut > maintenant) {
    return { enLigne: false, libelle: `En attente du ${contenu.debut.toLocaleDateString('fr-FR')}`, ton: 'neutre' };
  }
  if (contenu.fin && contenu.fin < maintenant) {
    return { enLigne: false, libelle: `Expirée le ${contenu.fin.toLocaleDateString('fr-FR')}`, ton: 'ferme' };
  }
  return { enLigne: true, libelle: 'En ligne', ton: 'ouvert' };
}

/* -------------------------------------------------------- Session rattachee */

const INCLUDE_LIENS = {
  course: { select: { id: true, name: true, slug: true, price: true, imageUrl: true } },
  session: {
    select: {
      id: true,
      slug: true,
      title: true,
      startDate: true,
      endDate: true,
      registrationDeadline: true,
      capacity: true,
      status: true,
      price: true,
      imageUrl: true,
      course: { select: { name: true, slug: true, price: true, imageUrl: true } },
      _count: { select: { enrollments: { where: filtreInscriptionsOccupantes } } },
    },
  },
} as const;

type AvecLiens = {
  imageUrl: string | null;
  price: number | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  course: { name: string; slug: string; price: number; imageUrl: string | null } | null;
  session: {
    slug: string;
    title: string;
    startDate: Date;
    endDate: Date;
    registrationDeadline: Date | null;
    capacity: number;
    status: string;
    price: number | null;
    imageUrl: string | null;
    course: { name: string; slug: string; price: number; imageUrl: string | null };
    _count: { enrollments: number };
  } | null;
};

/**
 * Complete un contenu marketing avec les donnees vivantes de la session liee.
 *
 * Les dates, le prix et les places ne sont JAMAIS recopies dans le texte de la
 * publication : ils sont relus ici a chaque affichage. Une place qui se libere
 * met donc l'annonce a jour toute seule.
 */
export function avecDonneesLiees<T extends AvecLiens>(contenu: T, maintenant = new Date()) {
  const session = contenu.session;
  const etat = session ? etatSession(session, session._count.enrollments, maintenant) : null;
  const prixSessionLiee = session ? prixSession(session, session.course) : null;

  // Photo : celle du contenu d'abord, puis celle de la session, puis celle de
  // la formation. On ne laisse jamais une annonce sans visuel s'il en existe un.
  const photo = contenu.imageUrl ?? session?.imageUrl ?? session?.course.imageUrl ?? contenu.course?.imageUrl ?? null;

  // Prix : celui saisi sur l'annonce prime, sinon celui de la session, sinon
  // celui de la formation.
  const prix = contenu.price ?? prixSessionLiee ?? contenu.course?.price ?? null;

  // Destination du bouton : la session si elle existe, sinon la formation,
  // sinon le lien libre saisi par l'administrateur.
  const lien =
    contenu.ctaUrl?.trim() ||
    (session
      ? etat?.inscriptionPossible
        ? `/formations/${session.course.slug}/inscription?session=${session.slug}`
        : `/sessions/${session.slug}`
      : contenu.course
        ? `/formations/${contenu.course.slug}`
        : null);

  return {
    ...contenu,
    photo,
    prix,
    lien,
    libelleBouton: contenu.ctaLabel?.trim() || (session && etat?.inscriptionPossible ? 'S’inscrire' : 'En savoir plus'),
    sessionEtat: etat,
    sessionPeriode: session ? { debut: session.startDate, fin: session.endDate } : null,
    formationNom: session?.course.name ?? contenu.course?.name ?? null,
  };
}

/* ------------------------------------------------------------ Lectures */

/** Publications reellement diffusables, triees par ordre puis par date. */
export async function publicationsActives(limite = 6, maintenant = new Date()) {
  const brutes = await prisma.post.findMany({
    where: fenetreOuverte(maintenant, 'publishedAt', 'expiresAt'),
    orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: limite,
    include: INCLUDE_LIENS,
  });
  return brutes.map((p) => avecDonneesLiees(p, maintenant));
}

/** Bannieres diffusables d'un emplacement donne. */
export async function bannieresActives(placement: BannerPlacement, limite = 3, maintenant = new Date()) {
  const brutes = await prisma.banner.findMany({
    where: { placement, ...fenetreOuverte(maintenant, 'startsAt', 'endsAt') },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    take: limite,
    include: INCLUDE_LIENS,
  });
  return brutes.map((b) => avecDonneesLiees(b, maintenant));
}

export type PublicationActive = Awaited<ReturnType<typeof publicationsActives>>[number];
export type BanniereActive = Awaited<ReturnType<typeof bannieresActives>>[number];

/** Compteurs du tableau de bord. */
export async function compteursMarketing(maintenant = new Date()) {
  const [publications, bannieres] = await Promise.all([
    prisma.post.count({ where: fenetreOuverte(maintenant, 'publishedAt', 'expiresAt') }),
    prisma.banner.count({ where: fenetreOuverte(maintenant, 'startsAt', 'endsAt') }),
  ]);
  return { publications, bannieres };
}
