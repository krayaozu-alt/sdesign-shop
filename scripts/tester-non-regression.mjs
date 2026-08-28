/**
 * BALAYAGE DE NON-REGRESSION
 *
 * Demande toutes les pages du site au serveur et verifie qu'aucune ne casse.
 * Les ecrans d'administration sont interroges avec une session ADMIN
 * temporaire, supprimee a la fin.
 *
 *   node --env-file=.env --import ./scripts/chargeur-src.mjs \
 *        scripts/tester-non-regression.mjs [http://127.0.0.1:3000]
 */
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';

const prisma = new PrismaClient();
const BASE = process.argv[2] ?? 'http://127.0.0.1:3000';
const EMAIL = 'test_nonregression_admin@example.invalid';

let ok = 0;
let ko = 0;

const PUBLIQUES = [
  '/', '/formations', '/prestations', '/galerie', '/contact',
  '/calendrier-formations', '/reservation', '/verifier', '/connexion',
  '/creer-compte', '/mot-de-passe-oublie',
];

const ADMIN = [
  '/admin', '/admin/inscriptions', '/admin/eleves', '/admin/clients',
  '/admin/formateurs', '/admin/formations', '/admin/sessions',
  '/admin/prestations', '/admin/reservations', '/admin/calendrier',
  '/admin/publications', '/admin/bannieres', '/admin/apercu',
  '/admin/paiements', '/admin/recus', '/admin/rapports',
  '/admin/certificats', '/admin/galerie', '/admin/notifications',
  '/admin/utilisateurs', '/admin/journal', '/admin/parametres',
];

async function verifier(chemin, cookie) {
  const r = await fetch(`${BASE}${chemin}`, { headers: cookie ? { cookie } : {}, redirect: 'manual' });
  const bon = r.status === 200;
  if (bon) ok += 1;
  else ko += 1;
  console.log(`  ${bon ? 'OK   ' : 'ECHEC'} ${chemin.padEnd(32)} HTTP ${r.status}`);
}

console.log('BALAYAGE DE NON-REGRESSION');
console.log('='.repeat(60));

console.log('\nPAGES PUBLIQUES');
for (const c of PUBLIQUES) await verifier(c, null);

await prisma.user.deleteMany({ where: { email: EMAIL } });
const admin = await prisma.user.create({
  data: {
    email: EMAIL,
    passwordHash: 'aucune-connexion-possible',
    fullName: 'TEST_NONREG_Admin',
    phone: '+22600000098',
    role: 'ADMIN',
    isActive: true,
    emailVerifiedAt: new Date(),
  },
});
const token = await new SignJWT({ userId: admin.id, role: 'ADMIN', fullName: admin.fullName })
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setExpirationTime(new Date(Date.now() + 1800_000))
  .sign(new TextEncoder().encode(process.env.AUTH_SECRET));

console.log('\nECRANS D’ADMINISTRATION');
for (const c of ADMIN) await verifier(c, `sds_session=${token}`);

await prisma.user.deleteMany({ where: { email: EMAIL } });
const restants = await prisma.user.count({ where: { fullName: { startsWith: 'TEST_' } } });
console.log(`\nComptes de test restants : ${restants}`);
if (restants > 0) ko += 1;

await prisma.$disconnect();
console.log('\n' + '='.repeat(60));
console.log(`RESULTAT : ${ok} page(s) OK, ${ko} en echec.`);
process.exit(ko === 0 ? 0 : 1);
