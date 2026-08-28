/**
 * Constantes metier de S.DESIGN SHOP.
 * SQLite ne supportant pas les enums Prisma, ces objets font foi pour les
 * valeurs autorisees en base. Ils sont utilises par Zod pour la validation.
 */

export const ROLES = {
  ADMIN: 'ADMIN',
  FORMATEUR: 'FORMATEUR',
  EMPLOYE: 'EMPLOYE',
  ELEVE: 'ELEVE',
  CLIENTE: 'CLIENTE',
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];
export const ROLE_VALUES = Object.values(ROLES) as [Role, ...Role[]];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrateur',
  FORMATEUR: 'Formateur',
  EMPLOYE: 'Employé',
  ELEVE: 'Élève',
  CLIENTE: 'Cliente',
};

export const COURSE_STATUS = {
  BROUILLON: 'BROUILLON',
  OUVERTE: 'OUVERTE',
  COMPLETE: 'COMPLETE',
  EN_COURS: 'EN_COURS',
  TERMINEE: 'TERMINEE',
  ARCHIVEE: 'ARCHIVEE',
} as const;
export type CourseStatus = (typeof COURSE_STATUS)[keyof typeof COURSE_STATUS];
export const COURSE_STATUS_VALUES = Object.values(COURSE_STATUS) as [CourseStatus, ...CourseStatus[]];
export const COURSE_STATUS_LABELS: Record<CourseStatus, string> = {
  BROUILLON: 'Brouillon',
  OUVERTE: 'Inscriptions ouvertes',
  COMPLETE: 'Complète',
  EN_COURS: 'En cours',
  TERMINEE: 'Terminée',
  ARCHIVEE: 'Archivée',
};

export const LEVELS = {
  DEBUTANT: 'DEBUTANT',
  INTERMEDIAIRE: 'INTERMEDIAIRE',
  AVANCE: 'AVANCE',
  TOUS: 'TOUS',
} as const;
export type Level = (typeof LEVELS)[keyof typeof LEVELS];
export const LEVEL_VALUES = Object.values(LEVELS) as [Level, ...Level[]];
export const LEVEL_LABELS: Record<Level, string> = {
  DEBUTANT: 'Débutant',
  INTERMEDIAIRE: 'Intermédiaire',
  AVANCE: 'Avancé',
  TOUS: 'Tous niveaux',
};

export const ENROLLMENT_STATUS = {
  EN_ATTENTE: 'EN_ATTENTE',
  CONFIRMEE: 'CONFIRMEE',
  EN_COURS: 'EN_COURS',
  TERMINEE: 'TERMINEE',
  ABANDONNEE: 'ABANDONNEE',
  ANNULEE: 'ANNULEE',
} as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUS)[keyof typeof ENROLLMENT_STATUS];
export const ENROLLMENT_STATUS_VALUES = Object.values(ENROLLMENT_STATUS) as [
  EnrollmentStatus,
  ...EnrollmentStatus[],
];
export const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  EN_ATTENTE: 'En attente',
  CONFIRMEE: 'Confirmée',
  EN_COURS: 'En cours',
  TERMINEE: 'Terminée',
  ABANDONNEE: 'Abandonnée',
  ANNULEE: 'Annulée',
};

export const APPOINTMENT_STATUS = {
  EN_ATTENTE: 'EN_ATTENTE',
  CONFIRME: 'CONFIRME',
  TERMINE: 'TERMINE',
  ANNULE: 'ANNULE',
  ABSENT: 'ABSENT',
} as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUS)[keyof typeof APPOINTMENT_STATUS];
export const APPOINTMENT_STATUS_VALUES = Object.values(APPOINTMENT_STATUS) as [
  AppointmentStatus,
  ...AppointmentStatus[],
];
export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  EN_ATTENTE: 'En attente',
  CONFIRME: 'Confirmé',
  TERMINE: 'Terminé',
  ANNULE: 'Annulé',
  ABSENT: 'Absent',
};

export const ATTENDANCE_STATUS = {
  PRESENT: 'PRESENT',
  ABSENT: 'ABSENT',
  RETARD: 'RETARD',
  EXCUSE: 'EXCUSE',
} as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUS)[keyof typeof ATTENDANCE_STATUS];
export const ATTENDANCE_STATUS_VALUES = Object.values(ATTENDANCE_STATUS) as [
  AttendanceStatus,
  ...AttendanceStatus[],
];
export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: 'Présent',
  ABSENT: 'Absent',
  RETARD: 'Retard',
  EXCUSE: 'Excusé',
};

export const PAYMENT_METHODS = {
  ESPECES: 'ESPECES',
  ORANGE_MONEY: 'ORANGE_MONEY',
  MOOV_MONEY: 'MOOV_MONEY',
  WAVE: 'WAVE',
  VIREMENT: 'VIREMENT',
  AUTRE: 'AUTRE',
} as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];
export const PAYMENT_METHOD_VALUES = Object.values(PAYMENT_METHODS) as [PaymentMethod, ...PaymentMethod[]];
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  ESPECES: 'Espèces',
  ORANGE_MONEY: 'Orange Money',
  MOOV_MONEY: 'Moov Money',
  WAVE: 'Wave',
  VIREMENT: 'Virement bancaire',
  AUTRE: 'Autre',
};

export const PAYMENT_STATUS = {
  EN_ATTENTE: 'EN_ATTENTE',
  PAYE: 'PAYE',
  ANNULE: 'ANNULE',
  REMBOURSE: 'REMBOURSE',
} as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];
export const PAYMENT_STATUS_VALUES = Object.values(PAYMENT_STATUS) as [PaymentStatus, ...PaymentStatus[]];
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  EN_ATTENTE: 'En attente',
  PAYE: 'Payé',
  ANNULE: 'Annulé',
  REMBOURSE: 'Remboursé',
};

export const PAYMENT_PURPOSE = {
  FORMATION: 'FORMATION',
  PRESTATION: 'PRESTATION',
  AUTRE: 'AUTRE',
} as const;
export type PaymentPurpose = (typeof PAYMENT_PURPOSE)[keyof typeof PAYMENT_PURPOSE];
export const PAYMENT_PURPOSE_VALUES = Object.values(PAYMENT_PURPOSE) as [PaymentPurpose, ...PaymentPurpose[]];

export const COURSE_CATEGORIES = [
  'Coiffure',
  'Coiffe',
  'Turban',
  'Voile',
  'Maquillage',
  'Onglerie',
  'Manucure - Pédicure',
  'Décoration',
  'Éventail',
] as const;

export const SERVICE_CATEGORIES = [
  'Coiffures',
  'Maquillage',
  'Onglerie',
  'Manucure',
  'Pédicure',
  'Turban mariée',
  'Voiles',
  'Éventails',
  'Décoration',
] as const;

/* ------------------------------------------------ SESSIONS DE FORMATION */

/**
 * Statuts d'une session.
 *
 * PRESQUE_COMPLETE et COMPLETE ne sont pas saisis a la main : ils sont deduits
 * du remplissage reel par `etatSession()` (voir src/server/sessions.ts).
 * L'administrateur choisit les autres.
 */
export const SESSION_STATUS = {
  BROUILLON: 'BROUILLON',
  PROGRAMMEE: 'PROGRAMMEE',
  INSCRIPTIONS_OUVERTES: 'INSCRIPTIONS_OUVERTES',
  PRESQUE_COMPLETE: 'PRESQUE_COMPLETE',
  COMPLETE: 'COMPLETE',
  EN_COURS: 'EN_COURS',
  TERMINEE: 'TERMINEE',
  ANNULEE: 'ANNULEE',
} as const;
export type SessionStatus = (typeof SESSION_STATUS)[keyof typeof SESSION_STATUS];
export const SESSION_STATUS_VALUES = Object.values(SESSION_STATUS) as [SessionStatus, ...SessionStatus[]];
export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  BROUILLON: 'Brouillon',
  PROGRAMMEE: 'Programmée',
  INSCRIPTIONS_OUVERTES: 'Inscriptions ouvertes',
  PRESQUE_COMPLETE: 'Presque complète',
  COMPLETE: 'Complète',
  EN_COURS: 'En cours',
  TERMINEE: 'Terminée',
  ANNULEE: 'Annulée',
};

/** Statuts que l'administrateur peut choisir lui-meme. */
export const SESSION_STATUS_MANUELS: SessionStatus[] = [
  SESSION_STATUS.BROUILLON,
  SESSION_STATUS.PROGRAMMEE,
  SESSION_STATUS.INSCRIPTIONS_OUVERTES,
  SESSION_STATUS.EN_COURS,
  SESSION_STATUS.TERMINEE,
  SESSION_STATUS.ANNULEE,
];

/** Une session n'est visible du public qu'a partir de ces statuts. */
export const SESSION_STATUTS_PUBLICS: SessionStatus[] = [
  SESSION_STATUS.PROGRAMMEE,
  SESSION_STATUS.INSCRIPTIONS_OUVERTES,
  SESSION_STATUS.PRESQUE_COMPLETE,
  SESSION_STATUS.COMPLETE,
  SESSION_STATUS.EN_COURS,
];

/** Seuil a partir duquel une session est signalee « presque complete ». */
export const SESSION_SEUIL_PRESQUE_COMPLETE = 3;

/* ------------------------------------------------------ LISTE D'ATTENTE */

export const WAITLIST_STATUS = {
  EN_ATTENTE: 'EN_ATTENTE',
  PREVENUE: 'PREVENUE',
  INSCRITE: 'INSCRITE',
  ANNULEE: 'ANNULEE',
} as const;
export type WaitlistStatus = (typeof WAITLIST_STATUS)[keyof typeof WAITLIST_STATUS];
export const WAITLIST_STATUS_VALUES = Object.values(WAITLIST_STATUS) as [WaitlistStatus, ...WaitlistStatus[]];
export const WAITLIST_STATUS_LABELS: Record<WaitlistStatus, string> = {
  EN_ATTENTE: 'En attente',
  PREVENUE: 'Prévenue',
  INSCRITE: 'Inscrite',
  ANNULEE: 'Annulée',
};

/* ------------------------------------------------------------ MARKETING */

export const POST_STATUS = {
  BROUILLON: 'BROUILLON',
  PROGRAMMEE: 'PROGRAMMEE',
  PUBLIEE: 'PUBLIEE',
  ARCHIVEE: 'ARCHIVEE',
} as const;
export type PostStatus = (typeof POST_STATUS)[keyof typeof POST_STATUS];
export const POST_STATUS_VALUES = Object.values(POST_STATUS) as [PostStatus, ...PostStatus[]];
export const POST_STATUS_LABELS: Record<PostStatus, string> = {
  BROUILLON: 'Brouillon',
  PROGRAMMEE: 'Programmée',
  PUBLIEE: 'Publiée',
  ARCHIVEE: 'Archivée',
};

export const BANNER_PLACEMENTS = {
  HERO: 'HERO',
  ACCUEIL: 'ACCUEIL',
  MILIEU: 'MILIEU',
  FORMATIONS: 'FORMATIONS',
  BAS_DE_PAGE: 'BAS_DE_PAGE',
} as const;
export type BannerPlacement = (typeof BANNER_PLACEMENTS)[keyof typeof BANNER_PLACEMENTS];
export const BANNER_PLACEMENT_VALUES = Object.values(BANNER_PLACEMENTS) as [BannerPlacement, ...BannerPlacement[]];
export const BANNER_PLACEMENT_LABELS: Record<BannerPlacement, string> = {
  HERO: 'En-tête d’accueil',
  ACCUEIL: 'Accueil, sous l’en-tête',
  MILIEU: 'Milieu de page',
  FORMATIONS: 'Page des formations',
  BAS_DE_PAGE: 'Bas de page',
};

/**
 * Les bannieres suivent exactement le meme cycle de vie que les publications :
 * un seul comportement a comprendre pour l'administrateur, et une seule regle
 * de visibilite a maintenir dans le code.
 */
export const BANNER_STATUS = POST_STATUS;
export type BannerStatus = PostStatus;
export const BANNER_STATUS_VALUES = POST_STATUS_VALUES;
export const BANNER_STATUS_LABELS = POST_STATUS_LABELS;

export const GALLERY_CATEGORIES = {
  COIFFURE: 'COIFFURE',
  COIFFE_SENEGALAIS: 'COIFFE_SENEGALAIS',
  COIFFE_NIGERIENNE: 'COIFFE_NIGERIENNE',
  TURBAN: 'TURBAN',
  MARIAGE: 'MARIAGE',
  VOILE: 'VOILE',
  MAQUILLAGE: 'MAQUILLAGE',
  EVENTAIL: 'EVENTAIL',
  FORMATION: 'FORMATION',
  AVANT_APRES: 'AVANT_APRES',
} as const;
export type GalleryCategory = (typeof GALLERY_CATEGORIES)[keyof typeof GALLERY_CATEGORIES];
export const GALLERY_CATEGORY_VALUES = Object.values(GALLERY_CATEGORIES) as [GalleryCategory, ...GalleryCategory[]];
export const GALLERY_CATEGORY_LABELS: Record<GalleryCategory, string> = {
  COIFFURE: 'Coiffure',
  COIFFE_SENEGALAIS: 'Coiffe sénégalais',
  COIFFE_NIGERIENNE: 'Coiffe nigérienne',
  TURBAN: 'Turban',
  MARIAGE: 'Mariage',
  VOILE: 'Voile',
  MAQUILLAGE: 'Maquillage',
  EVENTAIL: 'Éventail',
  FORMATION: 'Formation',
  AVANT_APRES: 'Avant / Après',
};

export const NOTIFICATION_TYPES = {
  RESERVATION_NOUVELLE: 'RESERVATION_NOUVELLE',
  RESERVATION_CONFIRMEE: 'RESERVATION_CONFIRMEE',
  RAPPEL_RDV: 'RAPPEL_RDV',
  INSCRIPTION: 'INSCRIPTION',
  PAIEMENT: 'PAIEMENT',
  SOLDE: 'SOLDE',
  DEBUT_FORMATION: 'DEBUT_FORMATION',
  CERTIFICAT: 'CERTIFICAT',
  SYSTEME: 'SYSTEME',
} as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export const NOTIFICATION_CHANNELS = {
  APP: 'APP',
  WHATSAPP: 'WHATSAPP',
  SMS: 'SMS',
  EMAIL: 'EMAIL',
} as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[keyof typeof NOTIFICATION_CHANNELS];

export const APPOINTMENT_SOURCES = {
  SITE: 'SITE',
  TELEPHONE: 'TELEPHONE',
  WHATSAPP: 'WHATSAPP',
  SUR_PLACE: 'SUR_PLACE',
} as const;

/** Creneaux horaires proposes a la reservation (modifiable en parametres). */
export const DEFAULT_TIME_SLOTS = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
];
