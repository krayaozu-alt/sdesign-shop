import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Transforme un texte en slug URL (sans accents, minuscules, tirets). */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Parse un champ JSON stocke en String (objectives, requirements, payload). */
export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/** Convertit un textarea (une ligne = un element) en tableau JSON stockable. */
export function linesToJson(value: string | null | undefined): string {
  const lines = (value ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  return JSON.stringify(lines);
}

export function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/** Normalise un numero burkinabe pour lien WhatsApp (indicatif 226). */
export function whatsappLink(phone: string | null | undefined, message?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return null;
  const intl = digits.startsWith('226') ? digits : `226${digits}`;
  const base = `https://wa.me/${intl}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
