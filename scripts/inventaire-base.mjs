/**
 * Inventaire des lignes de la base, table par table.
 * Aucune donnee personnelle n'est affichee : seulement des comptes.
 *
 *   node --env-file=.env scripts/inventaire-base.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const MODELES = [
  'user', 'customer', 'student', 'trainer',
  'course', 'courseSession', 'courseModule', 'courseImage', 'enrollment',
  'service', 'appointment', 'payment', 'receipt', 'certificate',
  'galleryItem', 'testimonial', 'post', 'banner', 'setting',
  'notification', 'auditLog', 'waitlist', 'favorite',
];

let total = 0;
for (const m of MODELES) {
  try {
    const n = await prisma[m].count();
    total += n;
    console.log(`${m.padEnd(18)} ${String(n).padStart(5)}`);
  } catch {
    console.log(`${m.padEnd(18)}     ?`);
  }
}
console.log('-'.repeat(24));
console.log(`${'TOTAL'.padEnd(18)} ${String(total).padStart(5)}`);

const restes = await Promise.all([
  prisma.user.count({ where: { fullName: { startsWith: 'TEST_' } } }),
  prisma.course.count({ where: { name: { startsWith: 'TEST_' } } }),
  prisma.courseSession.count({ where: { title: { startsWith: 'TEST_' } } }),
  prisma.post.count({ where: { title: { startsWith: 'TEST_' } } }),
  prisma.banner.count({ where: { title: { startsWith: 'TEST_' } } }),
]);
console.log(`\nLignes de test restantes (prefixe TEST_) : ${restes.reduce((a, b) => a + b, 0)}`);

await prisma.$disconnect();
