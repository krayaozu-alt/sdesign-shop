/**
 * PROVISIONNEMENT DU COMPTE ADMINISTRATEUR
 *
 * Cree le compte administrateur, ou remet a jour celui qui existe deja, a
 * partir de trois variables d'environnement :
 *
 *   ADMIN_EMAIL     adresse de connexion
 *   ADMIN_PHONE     numero de connexion
 *   ADMIN_PASSWORD  mot de passe en clair, jamais conserve
 *
 * Le mot de passe n'est lu qu'en memoire, hache avec bcrypt (cout 10, comme
 * partout ailleurs dans l'application) puis oublie. Il n'est ecrit ni dans la
 * base, ni dans les journaux, ni dans la sortie de ce script.
 *
 * Pourquoi un script plutot qu'une graine : la graine (`prisma/seed.ts`) sert a
 * monter un jeu de demonstration complet et se relance rarement. Le mot de
 * passe de l'administratrice, lui, doit pouvoir etre change seul, a tout
 * moment, sans toucher au reste des donnees.
 *
 * Recherche du compte existant : par telephone OU par adresse — les deux sont
 * uniques en base et l'ecran de connexion accepte l'un ou l'autre. Si les deux
 * pointent sur deux comptes differents, le script s'arrete plutot que de
 * choisir a votre place.
 *
 *   node --env-file=.env scripts/provisionner-admin.mjs
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const LONGUEUR_MINIMALE = 12;

function echouer(message, detail) {
  console.error(`\nERREUR : ${message}`);
  if (detail) console.error(detail);
  process.exit(1);
}

const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
const phone = (process.env.ADMIN_PHONE ?? '').trim();
const motDePasse = process.env.ADMIN_PASSWORD ?? '';

/* ------------------------------------------------------------ Validation */

const absentes = [];
if (!email) absentes.push('ADMIN_EMAIL');
if (!phone) absentes.push('ADMIN_PHONE');
if (!motDePasse) absentes.push('ADMIN_PASSWORD');
if (absentes.length) {
  echouer(
    `variable(s) manquante(s) : ${absentes.join(', ')}`,
    "Ajoutez-les dans .env puis relancez. Aucun identifiant n'est ecrit en dur dans le code.",
  );
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  echouer('ADMIN_EMAIL ne ressemble pas a une adresse valide.');
}

// Meme regle que `phoneSchema` (src/lib/validation.ts) : chiffres, espaces et
// ponctuation courante. Le numero est enregistre TEL QUEL, car l'ecran de
// connexion le compare caractere pour caractere.
if (!/^[0-9 +().-]{8,20}$/.test(phone)) {
  echouer('ADMIN_PHONE invalide (8 a 20 caracteres : chiffres, espaces, + ( ) . -).');
}

if (motDePasse.length < LONGUEUR_MINIMALE) {
  echouer(`ADMIN_PASSWORD trop court : ${LONGUEUR_MINIMALE} caracteres minimum.`);
}
if (!/[a-z]/.test(motDePasse) || !/[A-Z]/.test(motDePasse) || !/[0-9]/.test(motDePasse)) {
  echouer('ADMIN_PASSWORD doit contenir au moins une minuscule, une majuscule et un chiffre.');
}

/* --------------------------------------------------------- Provisionnement */

console.log('PROVISIONNEMENT DU COMPTE ADMINISTRATEUR');
console.log('='.repeat(60));
console.log(`  adresse   : ${email}`);
console.log(`  telephone : ${phone}`);
console.log(`  mot de passe : ${motDePasse.length} caracteres [jamais affiche]`);
console.log();

const parTelephone = await prisma.user.findUnique({ where: { phone } });
const parEmail = await prisma.user.findUnique({ where: { email } });

if (parTelephone && parEmail && parTelephone.id !== parEmail.id) {
  echouer(
    'ce telephone et cette adresse appartiennent a deux comptes differents.',
    `  telephone -> ${parTelephone.fullName} (${parTelephone.role})\n` +
      `  adresse   -> ${parEmail.fullName} (${parEmail.role})\n` +
      'Choisissez des identifiants qui designent un seul compte, ou corrigez la base depuis Admin > Utilisateurs.',
  );
}

const existant = parTelephone ?? parEmail;
const passwordHash = await bcrypt.hash(motDePasse, 10);

let compte;
if (existant) {
  const ancienRole = existant.role;
  compte = await prisma.user.update({
    where: { id: existant.id },
    data: {
      email,
      phone,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
      // L'administratrice se provisionne hors ligne : lui imposer le parcours
      // de verification par code la bloquerait hors de son propre back-office.
      emailVerified: true,
      emailVerifiedAt: existant.emailVerifiedAt ?? new Date(),
    },
  });
  console.log(`  Compte existant mis a jour : ${compte.fullName}`);
  if (ancienRole !== 'ADMIN') console.log(`  Role eleve : ${ancienRole} -> ADMIN`);
  console.log('  Mot de passe remplace.');
} else {
  compte = await prisma.user.create({
    data: {
      fullName: 'Administrateur S.DESIGN SHOP',
      email,
      phone,
      whatsapp: phone,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });
  console.log(`  Compte cree : ${compte.fullName}`);
}

await prisma.auditLog.create({
  data: {
    userId: compte.id,
    action: 'UPDATE',
    entity: 'User',
    entityId: compte.id,
    details: 'Provisionnement administrateur par script (mot de passe renouvele)',
  },
}).catch(() => {});

/* ------------------------------------------------------------ Verification */

const relu = await prisma.user.findUnique({
  where: { id: compte.id },
  select: { role: true, isActive: true, passwordHash: true, email: true, phone: true },
});

const controles = [
  ['role ADMIN', relu.role === 'ADMIN'],
  ['compte actif', relu.isActive === true],
  ['mot de passe hache (bcrypt)', /^\$2[aby]\$/.test(relu.passwordHash)],
  ['mot de passe absent en clair', !relu.passwordHash.includes(motDePasse)],
  ['connexion par adresse', relu.email === email],
  ['connexion par telephone', relu.phone === phone],
  ['le hachage verifie le mot de passe', await bcrypt.compare(motDePasse, relu.passwordHash)],
];

console.log('\nCONTROLES');
let echecs = 0;
for (const [intitule, ok] of controles) {
  console.log(`  ${ok ? 'OK   ' : 'ECHEC'} ${intitule}`);
  if (!ok) echecs += 1;
}

const admins = await prisma.user.count({ where: { role: 'ADMIN', isActive: true } });
console.log(`\n  Administrateurs actifs en base : ${admins}`);

await prisma.$disconnect();

console.log('\n' + '='.repeat(60));
if (echecs === 0) {
  console.log('Compte administrateur pret. Connectez-vous sur /connexion.');
  console.log('Retirez ADMIN_PASSWORD de .env une fois la connexion verifiee.');
} else {
  console.log(`${echecs} controle(s) en echec.`);
}
process.exit(echecs === 0 ? 0 : 1);
