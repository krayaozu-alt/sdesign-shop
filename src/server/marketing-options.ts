import 'server-only';
import { prisma } from '@/lib/prisma';
import { etatSession, filtreInscriptionsOccupantes, prixSession } from '@/server/sessions';

/**
 * Listes proposees dans les formulaires marketing.
 *
 * Les sessions sont envoyees au formulaire avec leurs dates, leur prix et
 * leurs places : l'apercu peut ainsi montrer l'annonce exacte des la selection,
 * sans aller-retour serveur et sans qu'aucun chiffre ne soit saisi a la main.
 */
export async function optionsMarketing() {
  const [formations, sessions] = await Promise.all([
    prisma.course.findMany({
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, price: true, imageUrl: true },
    }),
    prisma.courseSession.findMany({
      orderBy: { startDate: 'desc' },
      take: 100,
      include: {
        course: { select: { id: true, name: true, price: true, imageUrl: true } },
        _count: { select: { enrollments: { where: filtreInscriptionsOccupantes } } },
      },
    }),
  ]);

  return {
    formations,
    sessions: sessions.map((s) => {
      const etat = etatSession(s, s._count.enrollments);
      return {
        id: s.id,
        title: s.title,
        courseId: s.courseId,
        courseName: s.course.name,
        debut: s.startDate.toISOString(),
        fin: s.endDate.toISOString(),
        prix: prixSession(s, s.course),
        restantes: etat.restantes,
        photo: s.imageUrl ?? s.course.imageUrl ?? null,
        pastille: etat.pastille,
      };
    }),
  };
}
