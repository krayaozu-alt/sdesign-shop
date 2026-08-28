/**
 * Cree (ou supprime) un jeu d'annonces temporaire pour la verification
 * visuelle du rendu aux differentes largeurs d'ecran.
 *
 * Rien de ceci n'est destine a rester : tout porte le prefixe TEST_ et
 * l'option `supprimer` remet la base exactement dans son etat initial.
 *
 *   node --env-file=.env scripts/contenu-demo-temporaire.mjs creer|supprimer
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const action = process.argv[2] ?? 'creer';
const P = 'TEST_VISUEL_';
const jours = (n) => new Date(Date.now() + n * 86400000);

if (action === 'supprimer') {
  const a = await prisma.post.deleteMany({ where: { title: { startsWith: P } } });
  const b = await prisma.banner.deleteMany({ where: { title: { startsWith: P } } });
  const c = await prisma.courseSession.deleteMany({ where: { title: { startsWith: P } } });
  console.log(`Supprime : ${a.count} publication(s), ${b.count} banniere(s), ${c.count} session(s).`);
} else {
  const formation = await prisma.course.findFirst({ orderBy: { sortOrder: 'asc' } });
  if (!formation) throw new Error('Aucune formation en base.');

  const session = await prisma.courseSession.create({
    data: {
      slug: 'test-visuel-session',
      courseId: formation.id,
      title: `${P}Session de septembre`,
      startDate: jours(9),
      endDate: jours(13),
      capacity: 8,
      status: 'INSCRIPTIONS_OUVERTES',
      location: 'Ouagadougou',
    },
  });

  await prisma.banner.create({
    data: {
      title: `${P}Bannière d’accueil`,
      subtitle: 'Nouvelle session',
      description: 'Les inscriptions sont ouvertes pour la prochaine session.',
      placement: 'HERO',
      status: 'PUBLIEE',
      sessionId: session.id,
    },
  });

  await prisma.post.create({
    data: {
      slug: 'test-visuel-publication',
      title: `${P}Publication`,
      subtitle: 'À découvrir',
      body: 'Texte de publication servant uniquement à vérifier la mise en page.',
      status: 'PUBLIEE',
      sessionId: session.id,
    },
  });

  console.log(`Cree : 1 session, 1 banniere HERO et 1 publication (formation « ${formation.name} »).`);
}

await prisma.$disconnect();
