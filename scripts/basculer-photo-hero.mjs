/**
 * Vide ou restaure le reglage de la photo du hero, SANS toucher au fichier.
 * Sert a verifier le visuel de secours sans avoir a re-televerser la photo.
 *
 *   node --env-file=.env scripts/basculer-photo-hero.mjs vider|restaurer
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const CLE = 'hero.imageUrl';
const MEMO = 'hero.imageUrl.memo';

const action = process.argv[2] ?? 'vider';
const lire = async (k) => (await prisma.setting.findUnique({ where: { key: k } }))?.value ?? '';
const ecrire = async (k, v) =>
  prisma.setting.upsert({
    where: { key: k },
    update: { value: v },
    create: { key: k, value: v, label: k, group: 'IDENTITE', type: 'TEXT' },
  });

if (action === 'vider') {
  const actuelle = await lire(CLE);
  await ecrire(MEMO, actuelle);
  await ecrire(CLE, '');
  console.log(`Reglage vide. Fichier conserve, memorise dans ${MEMO}.`);
} else {
  const memo = await lire(MEMO);
  await ecrire(CLE, memo);
  await prisma.setting.deleteMany({ where: { key: MEMO } });
  console.log(`Reglage restaure : ${memo ? 'photo remise en place' : '(aucune photo memorisee)'}`);
}
await prisma.$disconnect();
