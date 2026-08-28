import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { appUrl } from '@/lib/qr';

export const dynamic = 'force-dynamic';

/**
 * Plan du site.
 *
 * Il ne liste que des pages publiques et indexables. Les zones privees
 * (back-office, espace personnel, authentification) et les documents nominatifs
 * (recus, certificats) en sont absents par construction : ils ne sont jamais
 * ajoutes ici, et `robots.ts` les interdit en plus.
 *
 * Les fiches sont lues dans la base a chaque requete, en lecture seule. Une
 * formation ou une prestation ajoutee depuis l'administration apparait donc
 * dans le plan sans redeploiement. Seules les sessions reellement a venir sont
 * listees : une date passee n'a plus rien a proposer.
 *
 * Si la base est injoignable, on renvoie les pages fixes plutot qu'une erreur :
 * un plan partiel vaut mieux qu'un plan absent.
 */
type Entree = MetadataRoute.Sitemap[number];

const PAGES_FIXES: Array<{ chemin: string; priorite: number; frequence: Entree['changeFrequency'] }> = [
  { chemin: '/', priorite: 1, frequence: 'weekly' },
  { chemin: '/formations', priorite: 0.9, frequence: 'weekly' },
  { chemin: '/prestations', priorite: 0.9, frequence: 'weekly' },
  { chemin: '/calendrier-formations', priorite: 0.9, frequence: 'daily' },
  { chemin: '/galerie', priorite: 0.8, frequence: 'weekly' },
  { chemin: '/reservation', priorite: 0.7, frequence: 'monthly' },
  { chemin: '/contact', priorite: 0.7, frequence: 'monthly' },
  { chemin: '/verifier', priorite: 0.4, frequence: 'yearly' },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const maintenant = new Date();

  const fixes: MetadataRoute.Sitemap = PAGES_FIXES.map(({ chemin, priorite, frequence }) => ({
    url: appUrl(chemin),
    lastModified: maintenant,
    changeFrequency: frequence,
    priority: priorite,
  }));

  const [formations, prestations, sessions] = await Promise.all([
    prisma.course.findMany({ select: { slug: true, updatedAt: true } }).catch(() => []),
    prisma.service.findMany({
      where: { isAvailable: true },
      select: { slug: true, updatedAt: true },
    }).catch(() => []),
    prisma.courseSession.findMany({
      where: { startDate: { gte: maintenant } },
      select: { slug: true, updatedAt: true },
    }).catch(() => []),
  ]);

  const fiches: MetadataRoute.Sitemap = [
    ...formations.map((f) => ({
      url: appUrl(`/formations/${f.slug}`),
      lastModified: f.updatedAt,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    ...prestations.map((p) => ({
      url: appUrl(`/prestations/${p.slug}`),
      lastModified: p.updatedAt,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    ...sessions.map((s) => ({
      url: appUrl(`/sessions/${s.slug}`),
      lastModified: s.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
  ];

  return [...fixes, ...fiches];
}
