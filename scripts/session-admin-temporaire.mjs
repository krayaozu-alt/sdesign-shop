/**
 * Ouvre (ou ferme) un compte ADMIN temporaire pour la verification visuelle.
 *
 * Le compte porte une empreinte de mot de passe volontairement invalide : il
 * est donc impossible de s'en servir pour se connecter par le formulaire. Seul
 * le jeton imprime ici permet d'ouvrir une session, et il expire en une heure.
 *
 *   node --env-file=.env --import ./scripts/chargeur-src.mjs \
 *        scripts/session-admin-temporaire.mjs ouvrir|fermer
 */
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';

const prisma = new PrismaClient();
const action = process.argv[2] ?? 'ouvrir';
const EMAIL = 'test_bloc3_visuel_admin@example.invalid';
const NOM = 'TEST_BLOC3_VISUEL_Admin';

if (action === 'fermer') {
  const r = await prisma.user.deleteMany({ where: { email: EMAIL } });
  console.log(`Compte temporaire supprime : ${r.count}`);
  const restants = await prisma.user.count({ where: { fullName: { startsWith: 'TEST_BLOC3_' } } });
  console.log(`Comptes de test restants : ${restants}`);
} else {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  const user = await prisma.user.create({
    data: {
      email: EMAIL,
      passwordHash: 'aucune-connexion-possible',
      fullName: NOM,
      phone: '+22600000099',
      role: 'ADMIN',
      isActive: true,
      emailVerifiedAt: new Date(),
    },
  });
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) throw new Error('AUTH_SECRET manquant ou trop court dans .env');
  const token = await new SignJWT({ userId: user.id, role: 'ADMIN', fullName: NOM })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(new Date(Date.now() + 3600_000))
    .sign(new TextEncoder().encode(secret));
  console.log(token);
}

await prisma.$disconnect();
