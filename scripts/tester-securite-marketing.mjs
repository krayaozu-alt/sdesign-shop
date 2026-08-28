/**
 * BANC D'ESSAI — SECURITE DES ECRANS MARKETING (Bloc 3)
 *
 * Verifie, en interrogeant le VRAI serveur en HTTP, qu'un role sans la
 * permission `marketing.manage` ne peut pas atteindre les ecrans de
 * publication — meme en tapant l'adresse directement, sans passer par le menu.
 * Masquer un lien ne protege rien : c'est la reponse du serveur qui compte.
 *
 * Les comptes de test sont crees ici, avec un mot de passe inutilisable
 * (empreinte volontairement invalide), puis supprimes a la fin.
 *
 *   node --env-file=.env --import ./scripts/chargeur-src.mjs \
 *        scripts/tester-securite-marketing.mjs [http://127.0.0.1:3000]
 */
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';

const prisma = new PrismaClient();
const BASE = process.argv[2] ?? 'http://127.0.0.1:3000';
const PREFIXE = 'TEST_BLOC3_SEC_';

let reussis = 0;
let echoues = 0;
const comptes = [];

function verifier(intitule, condition, detail = '') {
  if (condition) {
    reussis += 1;
    console.log(`  OK    ${intitule}${detail ? ` — ${detail}` : ''}`);
  } else {
    echoues += 1;
    console.log(`  ECHEC ${intitule}${detail ? ` — ${detail}` : ''}`);
  }
}

/** Fabrique un cookie de session avec la meme cle et le meme format que l'application. */
async function cookieDeSession(user) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) throw new Error('AUTH_SECRET manquant ou trop court dans .env');
  const token = await new SignJWT({ userId: user.id, role: user.role, fullName: user.fullName })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(new Date(Date.now() + 3600_000))
    .sign(new TextEncoder().encode(secret));
  return `sds_session=${token}`;
}

/** Suit la reponse SANS suivre les redirections, pour voir la decision du serveur. */
async function demander(chemin, cookie) {
  const r = await fetch(`${BASE}${chemin}`, {
    headers: cookie ? { cookie } : {},
    redirect: 'manual',
  });
  return { statut: r.status, destination: r.headers.get('location') ?? '' };
}

const ROLES = [
  { role: 'CLIENTE', autorise: false },
  { role: 'ELEVE', autorise: false },
  { role: 'FORMATEUR', autorise: false },
  { role: 'EMPLOYE', autorise: false },
  { role: 'ADMIN', autorise: true },
];

const ECRANS = ['/admin/publications', '/admin/bannieres', '/admin/apercu'];

async function main() {
  console.log('BANC D’ESSAI — SECURITE DES ECRANS MARKETING');
  console.log('='.repeat(72));
  console.log(`Serveur interroge : ${BASE}\n`);

  // Le serveur repond-il ?
  const accueil = await demander('/', null);
  if (accueil.statut >= 500) throw new Error(`Le serveur repond ${accueil.statut} sur l’accueil.`);

  /* ------------------------------------------------- 1. Visiteur anonyme */
  console.log('1. VISITEUR NON CONNECTE');
  for (const ecran of ECRANS) {
    const r = await demander(ecran, null);
    verifier(
      `${ecran} : renvoye vers la connexion`,
      r.statut >= 300 && r.statut < 400 && r.destination.includes('/connexion'),
      `HTTP ${r.statut} -> ${r.destination || '(aucune)'}`,
    );
  }

  /* ------------------------------------------------------- 2. Par role */
  for (const [index, { role, autorise }] of ROLES.entries()) {
    console.log(`\n2. ROLE ${role} — ${autorise ? 'doit accéder' : 'ne doit PAS accéder'}`);

    const user = await prisma.user.create({
      data: {
        email: `${PREFIXE}${role}@example.invalid`.toLowerCase(),
        // Empreinte volontairement invalide : ce compte ne peut pas servir a
        // se connecter par le formulaire, seulement a ce test.
        passwordHash: 'aucune-connexion-possible',
        fullName: `${PREFIXE}${role}`,
        phone: `+2260000000${index}`,
        role,
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });
    comptes.push(user.id);
    const cookie = await cookieDeSession(user);

    for (const ecran of ECRANS) {
      const r = await demander(ecran, cookie);
      if (autorise) {
        verifier(`${ecran} : accessible`, r.statut === 200, `HTTP ${r.statut}`);
      } else {
        const refuse = r.statut >= 300 && r.statut < 400 && r.destination.includes('/acces-refuse');
        verifier(`${ecran} : accès refusé`, refuse, `HTTP ${r.statut} -> ${r.destination || '(aucune)'}`);
      }
    }
  }
}

async function nettoyer() {
  console.log('\nNETTOYAGE');
  for (const id of comptes) await prisma.user.delete({ where: { id } }).catch(() => {});
  const restants = await prisma.user.count({ where: { fullName: { startsWith: PREFIXE } } });
  console.log(`  Comptes de test restants : ${restants}`);
  if (restants > 0) {
    console.log('  ATTENTION : du residu subsiste.');
    echoues += 1;
  }
}

try {
  await main();
} catch (e) {
  echoues += 1;
  console.error('\nERREUR :', e.message);
} finally {
  await nettoyer();
  await prisma.$disconnect();
}

console.log('\n' + '='.repeat(72));
console.log(`RESULTAT : ${reussis} test(s) reussi(s), ${echoues} echec(s).`);
process.exit(echoues === 0 ? 0 : 1);
