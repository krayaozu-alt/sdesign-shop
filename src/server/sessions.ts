import 'server-only';
import { prisma } from '@/lib/prisma';
import {
  ENROLLMENT_STATUS,
  SESSION_SEUIL_PRESQUE_COMPLETE,
  SESSION_STATUS,
  SESSION_STATUTS_PUBLICS,
  type SessionStatus,
} from '@/lib/constants';

/**
 * REGLES DES SESSIONS DE FORMATION
 * --------------------------------
 * Une formation est permanente ; une session est une periode reelle pendant
 * laquelle elle est donnee. Tout ce qui est affiche au public — places
 * restantes, pastille de statut, possibilite de s'inscrire — est calcule ici,
 * a partir de la base. Aucun chiffre n'est ecrit en dur nulle part.
 */

/**
 * Une inscription occupe une place uniquement lorsqu'elle est CONFIRMEE ou
 * EN_COURS. Une demande EN_ATTENTE ne gele donc aucune place : elle attend la
 * confirmation de la boutique.
 */
export const STATUTS_OCCUPANT_UNE_PLACE: string[] = [
  ENROLLMENT_STATUS.CONFIRMEE,
  ENROLLMENT_STATUS.EN_COURS,
];

/** Filtre Prisma correspondant, reutilisable dans les `_count`. */
export const filtreInscriptionsOccupantes = { status: { in: STATUTS_OCCUPANT_UNE_PLACE } };

export type EtatSession = {
  capacite: number;
  occupees: number;
  restantes: number;
  complete: number;
  presqueComplete: boolean;
  /** Statut reellement affiche, remplissage pris en compte. */
  statut: SessionStatus;
  /** Vrai si le public peut voir cette session. */
  visiblePublic: boolean;
  /** Vrai si une inscription peut etre enregistree maintenant. */
  inscriptionPossible: boolean;
  /** Raison du refus, a afficher telle quelle a la cliente. */
  raisonRefus: string | null;
  /** Pastille prete a afficher. */
  pastille: { texte: string; ton: 'ouvert' | 'tension' | 'ferme' | 'neutre' };
};

type SessionMinimale = {
  capacity: number;
  status: string;
  startDate: Date;
  endDate: Date;
  registrationDeadline: Date | null;
};

/**
 * Etat complet d'une session, remplissage compris.
 *
 * `occupees` doit provenir d'un comptage filtre par `filtreInscriptionsOccupantes`.
 */
export function etatSession(session: SessionMinimale, occupees: number, maintenant = new Date()): EtatSession {
  const capacite = Math.max(0, session.capacity);
  const prises = Math.max(0, occupees);
  const restantes = Math.max(0, capacite - prises);
  const complete = capacite > 0 ? Math.min(100, Math.round((prises / capacite) * 100)) : 0;
  const presqueComplete = restantes > 0 && restantes <= SESSION_SEUIL_PRESQUE_COMPLETE;

  const statutSaisi = session.status as SessionStatus;
  const dateLimite = session.registrationDeadline ?? session.startDate;

  // Le statut affiche derive du statut saisi, corrige par le remplissage et
  // par le calendrier. L'administrateur n'a jamais a saisir « complete » :
  // c'est le nombre d'inscrites qui le determine.
  let statut: SessionStatus = statutSaisi;
  if (statutSaisi === SESSION_STATUS.INSCRIPTIONS_OUVERTES) {
    if (restantes === 0) statut = SESSION_STATUS.COMPLETE;
    else if (presqueComplete) statut = SESSION_STATUS.PRESQUE_COMPLETE;
  }
  if (
    (statutSaisi === SESSION_STATUS.INSCRIPTIONS_OUVERTES || statutSaisi === SESSION_STATUS.PROGRAMMEE) &&
    session.endDate < maintenant
  ) {
    statut = SESSION_STATUS.TERMINEE;
  }

  const visiblePublic = SESSION_STATUTS_PUBLICS.includes(statut);

  // Conditions d'inscription, evaluees dans l'ordre ou elles interessent la
  // cliente : d'abord l'ouverture, puis le calendrier, puis les places.
  let raisonRefus: string | null = null;
  if (statutSaisi !== SESSION_STATUS.INSCRIPTIONS_OUVERTES) {
    raisonRefus =
      statutSaisi === SESSION_STATUS.ANNULEE
        ? 'Cette session a été annulée.'
        : statutSaisi === SESSION_STATUS.TERMINEE || statut === SESSION_STATUS.TERMINEE
          ? 'Cette session est terminée.'
          : statutSaisi === SESSION_STATUS.EN_COURS
            ? 'Cette session a déjà commencé.'
            : 'Les inscriptions ne sont pas encore ouvertes pour cette session.';
  } else if (dateLimite < maintenant) {
    raisonRefus = 'La date limite d’inscription est dépassée.';
  } else if (restantes === 0) {
    raisonRefus = 'Cette session est complète.';
  }

  const pastille: EtatSession['pastille'] =
    statut === SESSION_STATUS.COMPLETE
      ? { texte: 'Complet', ton: 'ferme' }
      : statut === SESSION_STATUS.PRESQUE_COMPLETE
        ? { texte: `Plus que ${restantes} place${restantes > 1 ? 's' : ''}`, ton: 'tension' }
        : statut === SESSION_STATUS.INSCRIPTIONS_OUVERTES
          ? { texte: 'Inscriptions ouvertes', ton: 'ouvert' }
          : statut === SESSION_STATUS.EN_COURS
            ? { texte: 'En cours', ton: 'neutre' }
            : statut === SESSION_STATUS.PROGRAMMEE
              ? { texte: 'Bientôt', ton: 'neutre' }
              : statut === SESSION_STATUS.ANNULEE
                ? { texte: 'Annulée', ton: 'ferme' }
                : statut === SESSION_STATUS.TERMINEE
                  ? { texte: 'Terminée', ton: 'neutre' }
                  : { texte: 'Brouillon', ton: 'neutre' };

  return {
    capacite,
    occupees: prises,
    restantes,
    complete,
    presqueComplete,
    statut,
    visiblePublic,
    inscriptionPossible: raisonRefus === null,
    raisonRefus,
    pastille,
  };
}

/** Prix applicable : celui de la session s'il est defini, sinon celui de la formation. */
export function prixSession(session: { price: number | null }, formation: { price: number }): number {
  return session.price ?? formation.price;
}

/**
 * Verifie qu'une inscription peut etre enregistree sur cette session.
 *
 * Relit systematiquement l'etat depuis la base : deux clientes peuvent viser
 * la derniere place en meme temps, et seule une lecture au moment de l'ecriture
 * empeche la surreservation.
 */
export async function verifierPlaceDisponible(
  sessionId: string,
): Promise<{ ok: true; etat: EtatSession } | { ok: false; error: string }> {
  const session = await prisma.courseSession.findUnique({
    where: { id: sessionId },
    select: {
      capacity: true,
      status: true,
      startDate: true,
      endDate: true,
      registrationDeadline: true,
      _count: { select: { enrollments: { where: filtreInscriptionsOccupantes } } },
    },
  });

  if (!session) return { ok: false, error: 'Session introuvable.' };

  const etat = etatSession(session, session._count.enrollments);
  if (!etat.inscriptionPossible) return { ok: false, error: etat.raisonRefus ?? 'Inscription impossible.' };
  return { ok: true, etat };
}

/** Sessions visibles du public, triees par date de debut. */
export async function prochainesSessions(limite = 6, maintenant = new Date()) {
  const brutes = await prisma.courseSession.findMany({
    where: {
      status: { in: SESSION_STATUTS_PUBLICS },
      endDate: { gte: maintenant },
    },
    orderBy: { startDate: 'asc' },
    take: limite,
    include: {
      course: { select: { id: true, name: true, slug: true, price: true, imageUrl: true, category: true } },
      trainer: { select: { fullName: true } },
      _count: { select: { enrollments: { where: filtreInscriptionsOccupantes } } },
    },
  });

  return brutes.map((s) => ({
    ...s,
    etat: etatSession(s, s._count.enrollments, maintenant),
    prix: prixSession(s, s.course),
    photo: s.imageUrl ?? s.course.imageUrl,
  }));
}

export type SessionPublique = Awaited<ReturnType<typeof prochainesSessions>>[number];

/* ========================================================================== */
/*                          LECTURES POUR LE SITE PUBLIC                      */
/* ========================================================================== */

const INCLUDE_PUBLIC = {
  course: {
    select: { id: true, name: true, slug: true, price: true, imageUrl: true, category: true, durationLabel: true },
  },
  trainer: { select: { fullName: true } },
  _count: { select: { enrollments: { where: filtreInscriptionsOccupantes } } },
} as const;

/** Ajoute l'etat calcule, le prix applicable et la photo a afficher. */
function enrichir<T extends { imageUrl: string | null; price: number | null; capacity: number; status: string; startDate: Date; endDate: Date; registrationDeadline: Date | null; course: { price: number; imageUrl: string | null }; _count: { enrollments: number } }>(
  session: T,
  maintenant: Date,
) {
  return {
    ...session,
    etat: etatSession(session, session._count.enrollments, maintenant),
    prix: prixSession(session, session.course),
    photo: session.imageUrl ?? session.course.imageUrl,
  };
}

/**
 * Sessions d'une periode donnee, pour le calendrier public.
 * Une session est retenue des lors qu'elle CHEVAUCHE la periode : une session
 * du 28 aout au 4 septembre apparait donc en aout comme en septembre.
 */
export async function sessionsEntre(debut: Date, fin: Date, maintenant = new Date()) {
  const brutes = await prisma.courseSession.findMany({
    where: {
      status: { in: SESSION_STATUTS_PUBLICS },
      startDate: { lte: fin },
      endDate: { gte: debut },
    },
    orderBy: { startDate: 'asc' },
    include: INCLUDE_PUBLIC,
  });
  return brutes.map((s) => enrichir(s, maintenant));
}

/** Une session publique par son slug. Renvoie null si elle n'est pas visible. */
export async function sessionParSlug(slug: string, maintenant = new Date()) {
  const session = await prisma.courseSession.findUnique({
    where: { slug },
    include: {
      ...INCLUDE_PUBLIC,
      course: {
        select: {
          id: true, name: true, slug: true, price: true, imageUrl: true, category: true,
          durationLabel: true, shortDescription: true, level: true,
        },
      },
    },
  });
  if (!session) return null;

  const enrichie = enrichir(session, maintenant);
  // Un brouillon ou une session annulee ne doit pas etre consultable par le
  // public, meme si quelqu'un en connait l'adresse.
  return enrichie.etat.visiblePublic ? enrichie : null;
}

/** Catégories réellement représentées parmi les sessions visibles. */
export async function categoriesDesSessions(maintenant = new Date()): Promise<string[]> {
  const lignes = await prisma.courseSession.findMany({
    where: { status: { in: SESSION_STATUTS_PUBLICS }, endDate: { gte: maintenant } },
    select: { course: { select: { category: true } } },
    distinct: ['courseId'],
  });
  const uniques = Array.from(new Set(lignes.map((l) => l.course.category)));
  return uniques.sort((a, b) => a.localeCompare(b, 'fr'));
}

export type SessionDetail = NonNullable<Awaited<ReturnType<typeof sessionParSlug>>>;
