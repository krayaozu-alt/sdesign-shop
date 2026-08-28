import { z } from 'zod';
import {
  APPOINTMENT_STATUS_VALUES,
  ATTENDANCE_STATUS_VALUES,
  COURSE_STATUS_VALUES,
  ENROLLMENT_STATUS_VALUES,
  GALLERY_CATEGORY_VALUES,
  LEVEL_VALUES,
  PAYMENT_METHOD_VALUES,
  PAYMENT_PURPOSE_VALUES,
  PAYMENT_STATUS_VALUES,
  ROLE_VALUES,
  BANNER_PLACEMENT_VALUES,
  BANNER_STATUS_VALUES,
  POST_STATUS_VALUES,
  SESSION_STATUS_VALUES,
  WAITLIST_STATUS_VALUES,
} from '@/lib/constants';

const phoneRegex = /^[0-9 +().-]{8,20}$/;

export const phoneSchema = z
  .string()
  .trim()
  .min(8, 'Numéro de téléphone invalide')
  .regex(phoneRegex, 'Numéro de téléphone invalide');

export const optionalPhone = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => !v || phoneRegex.test(v), 'Numéro invalide');

export const optionalEmail = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => !v || z.string().email().safeParse(v).success, 'Email invalide');

const money = z.coerce.number().int('Montant invalide').min(0, 'Montant invalide').max(1_000_000_000);

/* --------------------------------------------------------------- COMPTES */

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(3, 'Nom complet requis').max(120),
    phone: phoneSchema,
    whatsapp: optionalPhone,
    email: optionalEmail,
    password: z.string().min(6, 'Mot de passe : 6 caractères minimum').max(100),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, 'Téléphone ou email requis'),
  password: z.string().min(1, 'Mot de passe requis'),
});

export const profileSchema = z.object({
  fullName: z.string().trim().min(3, 'Nom complet requis').max(120),
  phone: phoneSchema,
  whatsapp: optionalPhone,
  email: optionalEmail,
  address: z.string().trim().max(200).optional(),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
    password: z.string().min(6, '6 caractères minimum'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });

export const userSchema = z.object({
  id: z.string().optional(),
  fullName: z.string().trim().min(3, 'Nom complet requis'),
  phone: phoneSchema,
  whatsapp: optionalPhone,
  email: optionalEmail,
  role: z.enum(ROLE_VALUES),
  password: z.string().max(100).optional(),
  isActive: z.coerce.boolean().default(true),
});

/* ------------------------------------------------------------ FORMATIONS */

export const courseSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(3, 'Nom de la formation requis').max(120),
  category: z.string().trim().min(2, 'Catégorie requise'),
  shortDescription: z.string().trim().min(10, 'Description courte requise').max(300),
  description: z.string().trim().min(20, 'Description requise'),
  objectives: z.string().optional(),
  requirements: z.string().optional(),
  durationLabel: z.string().trim().min(2, 'Durée requise'),
  durationHours: z.coerce.number().int().min(0).max(5000).default(0),
  level: z.enum(LEVEL_VALUES),
  price: money,
  depositAmount: money.default(0),
  capacity: z.coerce.number().int().min(1, 'Au moins 1 place').max(500),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  trainerId: z.string().optional(),
  status: z.enum(COURSE_STATUS_VALUES),
  isFeatured: z.coerce.boolean().default(false),
  imageUrl: z.string().optional(),
});

/* --------------------------------------------- SESSIONS DE FORMATION */

/** Date au format AAAA-MM-JJ, ou chaine vide quand le champ est facultatif. */
const dateOptionnelle = z.string().trim().optional();

export const sessionSchema = z
  .object({
    id: z.string().optional(),
    courseId: z.string().min(1, 'Choisissez une formation'),
    title: z.string().trim().min(3, 'Intitulé requis').max(160),
    startDate: z.string().trim().min(1, 'Date de début requise'),
    startTime: z.string().trim().default('08:00'),
    endDate: z.string().trim().min(1, 'Date de fin requise'),
    endTime: z.string().trim().default('18:00'),
    registrationDeadline: dateOptionnelle,
    location: z.string().trim().max(160).optional(),
    capacity: z.coerce.number().int().min(1, 'Au moins 1 place').max(500),
    /**
     * Prix laisse vide = le prix officiel de la formation s'applique.
     * Ce n'est qu'en saisissant une valeur que l'administrateur le surcharge.
     */
    price: z
      .union([z.literal(''), money])
      .optional()
      .transform((v) => (v === '' || v === undefined ? null : Number(v))),
    trainerId: z.string().optional(),
    status: z.enum(SESSION_STATUS_VALUES),
    description: z.string().trim().max(2000).optional(),
    imageUrl: z.string().optional(),
  })
  .refine((d) => new Date(`${d.endDate}T${d.endTime || '23:59'}`) >= new Date(`${d.startDate}T${d.startTime || '00:00'}`), {
    message: 'La date de fin doit suivre la date de début',
    path: ['endDate'],
  })
  .refine((d) => !d.registrationDeadline || new Date(d.registrationDeadline) <= new Date(d.startDate), {
    message: 'La date limite d’inscription doit précéder le début de la session',
    path: ['registrationDeadline'],
  });

export const waitlistSchema = z.object({
  sessionId: z.string().min(1),
  fullName: z.string().trim().min(2, 'Nom requis').max(120),
  phone: phoneSchema,
  email: z.string().trim().toLowerCase().email('Adresse e-mail invalide').optional().or(z.literal('')),
  notes: z.string().trim().max(500).optional(),
});

export const waitlistStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(WAITLIST_STATUS_VALUES),
});

/* ------------------------------------------------------------ MARKETING */

export const postSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(3, 'Titre requis').max(160),
  subtitle: z.string().trim().max(200).optional(),
  body: z.string().trim().min(10, 'Texte requis'),
  courseId: z.string().optional(),
  sessionId: z.string().optional(),
  price: z
    .union([z.literal(''), money])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : Number(v))),
  ctaLabel: z.string().trim().max(60).optional(),
  ctaUrl: z.string().trim().max(500).optional(),
  status: z.enum(POST_STATUS_VALUES),
  publishedAt: dateOptionnelle,
  expiresAt: dateOptionnelle,
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  imageUrl: z.string().optional(),
});

export const bannerSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(3, 'Titre requis').max(160),
  subtitle: z.string().trim().max(200).optional(),
  description: z.string().trim().max(400).optional(),
  price: z
    .union([z.literal(''), money])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : Number(v))),
  placement: z.enum(BANNER_PLACEMENT_VALUES),
  courseId: z.string().optional(),
  sessionId: z.string().optional(),
  ctaLabel: z.string().trim().max(60).optional(),
  ctaUrl: z.string().trim().max(500).optional(),
  status: z.enum(BANNER_STATUS_VALUES),
  startsAt: dateOptionnelle,
  endsAt: dateOptionnelle,
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  imageUrl: z.string().optional(),
});

export const moduleSchema = z.object({
  id: z.string().optional(),
  courseId: z.string().min(1),
  title: z.string().trim().min(3, 'Titre requis'),
  description: z.string().trim().optional(),
  orderIndex: z.coerce.number().int().min(0).default(0),
  durationHours: z.coerce.number().int().min(0).max(500).default(0),
});

/** Parcours public d'inscription a une formation. */
export const enrollmentPublicSchema = z.object({
  courseId: z.string().min(1, 'Formation requise'),
  /** Session visee. Vide = demande sur la formation, sans date precise. */
  sessionId: z.string().optional(),
  fullName: z.string().trim().min(3, 'Nom complet requis').max(120),
  phone: phoneSchema,
  whatsapp: optionalPhone,
  email: optionalEmail,
  desiredDate: z.string().optional(),
  depositAmount: money.default(0),
  paymentMethod: z.enum(PAYMENT_METHOD_VALUES).default('ESPECES'),
  notes: z.string().trim().max(500).optional(),
});

export const enrollmentAdminSchema = z.object({
  id: z.string().optional(),
  studentId: z.string().min(1, 'Élève requis'),
  courseId: z.string().min(1, 'Formation requise'),
  sessionId: z.string().optional(),
  status: z.enum(ENROLLMENT_STATUS_VALUES),
  progress: z.coerce.number().int().min(0).max(100).default(0),
  amountDue: money,
  notes: z.string().trim().max(500).optional(),
});

export const attendanceSchema = z.object({
  enrollmentId: z.string().min(1),
  date: z.string().min(1, 'Date requise'),
  status: z.enum(ATTENDANCE_STATUS_VALUES),
  note: z.string().trim().max(200).optional(),
});

/* ------------------------------------------------------------ PRESTATIONS */

export const serviceSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(3, 'Nom requis').max(120),
  category: z.string().trim().min(2, 'Catégorie requise'),
  description: z.string().trim().min(10, 'Description requise'),
  price: money,
  durationMinutes: z.coerce.number().int().min(5, 'Durée minimale 5 min').max(1440),
  isAvailable: z.coerce.boolean().default(true),
  isFeatured: z.coerce.boolean().default(false),
  imageUrl: z.string().optional(),
});

export const appointmentPublicSchema = z.object({
  serviceId: z.string().min(1, 'Prestation requise'),
  date: z.string().min(1, 'Date requise'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Heure requise'),
  fullName: z.string().trim().min(3, 'Nom complet requis').max(120),
  phone: phoneSchema,
  whatsapp: optionalPhone,
  email: optionalEmail,
  notes: z.string().trim().max(500).optional(),
});

export const appointmentAdminSchema = z.object({
  id: z.string().optional(),
  customerId: z.string().min(1, 'Cliente requise'),
  serviceId: z.string().min(1, 'Prestation requise'),
  staffUserId: z.string().optional(),
  scheduledAt: z.string().min(1, 'Date et heure requises'),
  durationMinutes: z.coerce.number().int().min(5).max(1440),
  status: z.enum(APPOINTMENT_STATUS_VALUES),
  amountDue: money,
  notes: z.string().trim().max(500).optional(),
});

/* ---------------------------------------------------------------- CLIENTS */

export const customerSchema = z.object({
  id: z.string().optional(),
  fullName: z.string().trim().min(3, 'Nom complet requis').max(120),
  phone: phoneSchema,
  whatsapp: optionalPhone,
  email: optionalEmail,
  address: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const studentSchema = z.object({
  id: z.string().optional(),
  fullName: z.string().trim().min(3, 'Nom complet requis').max(120),
  phone: phoneSchema,
  whatsapp: optionalPhone,
  email: optionalEmail,
  birthDate: z.string().optional(),
  address: z.string().trim().max(200).optional(),
  emergencyContact: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
  password: z.string().max(100).optional(),
});

export const trainerSchema = z.object({
  id: z.string().optional(),
  fullName: z.string().trim().min(3, 'Nom complet requis').max(120),
  speciality: z.string().trim().min(2, 'Spécialité requise').max(120),
  phone: optionalPhone,
  whatsapp: optionalPhone,
  bio: z.string().trim().max(1000).optional(),
  availability: z.string().trim().max(200).optional(),
  photoUrl: z.string().optional(),
  isActive: z.coerce.boolean().default(true),
});

/* --------------------------------------------------------------- FINANCES */

export const paymentSchema = z.object({
  amount: money.refine((v) => v > 0, 'Le montant doit être supérieur à 0'),
  method: z.enum(PAYMENT_METHOD_VALUES),
  status: z.enum(PAYMENT_STATUS_VALUES).default('PAYE'),
  purpose: z.enum(PAYMENT_PURPOSE_VALUES).default('FORMATION'),
  label: z.string().trim().min(2, 'Libellé requis').max(160),
  providerRef: z.string().trim().max(80).optional(),
  paidAt: z.string().optional(),
  customerId: z.string().optional(),
  studentId: z.string().optional(),
  enrollmentId: z.string().optional(),
  appointmentId: z.string().optional(),
  notes: z.string().trim().max(500).optional(),
});

/* ---------------------------------------------------------------- CONTENU */

export const gallerySchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(2, 'Titre requis').max(120),
  description: z.string().trim().max(500).optional(),
  category: z.enum(GALLERY_CATEGORY_VALUES),
  mediaType: z.enum(['IMAGE', 'VIDEO']).default('IMAGE'),
  url: z.string().trim().min(1, 'Média requis'),
  isPublished: z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const testimonialSchema = z.object({
  id: z.string().optional(),
  authorName: z.string().trim().min(2, 'Nom requis').max(120),
  role: z.string().trim().max(80).default('Cliente'),
  message: z.string().trim().min(10, 'Témoignage requis').max(600),
  rating: z.coerce.number().int().min(1).max(5).default(5),
  isPublished: z.coerce.boolean().default(true),
});

export const certificateSchema = z.object({
  enrollmentId: z.string().min(1),
  mention: z.string().trim().max(60).default('Satisfaisant'),
  signedBy: z.string().trim().max(120).optional(),
});

/** Resultat standard des server actions consommees par useActionState. */
export type ActionState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string[]>;
  data?: Record<string, unknown>;
};

export const EMPTY_ACTION_STATE: ActionState = { ok: false };

/** Convertit une erreur Zod en ActionState exploitable par les formulaires. */
export function zodToState(error: z.ZodError): ActionState {
  return {
    ok: false,
    message: 'Veuillez corriger les champs signalés.',
    errors: error.flatten().fieldErrors as Record<string, string[]>,
  };
}

/* ------------------------------------------- COMPTES CLIENTES & VERIFICATION */

/** Mot de passe : au moins 8 caractères, une lettre et un chiffre. */
export const motDePasseSchema = z
  .string()
  .min(8, 'Mot de passe : 8 caractères minimum')
  .max(100)
  .refine((v) => /[A-Za-zÀ-ÿ]/.test(v), 'Le mot de passe doit contenir au moins une lettre')
  .refine((v) => /\d/.test(v), 'Le mot de passe doit contenir au moins un chiffre');

/** Inscription cliente : e-mail obligatoire et vérifié par code OTP. */
export const inscriptionClienteSchema = z
  .object({
    firstName: z.string().trim().min(2, 'Prénom requis').max(60),
    lastName: z.string().trim().min(2, 'Nom requis').max(60),
    email: z.string().trim().toLowerCase().email('Adresse e-mail invalide'),
    phone: phoneSchema,
    password: motDePasseSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });

export const otpSchema = z.object({
  code: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => v.length === 6, 'Le code comporte 6 chiffres'),
});

export const motDePasseOublieSchema = z.object({
  email: z.string().trim().toLowerCase().email('Adresse e-mail invalide'),
});

export const reinitialisationSchema = z
  .object({
    code: z
      .string()
      .trim()
      .transform((v) => v.replace(/\D/g, ''))
      .refine((v) => v.length === 6, 'Le code comporte 6 chiffres'),
    password: motDePasseSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });
