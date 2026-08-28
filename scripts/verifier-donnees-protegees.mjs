/**
 * Controle des donnees que le proprietaire a declarees intangibles :
 * prix des formations, numeros de telephone, coordonnees GPS.
 *
 * Ce script ne modifie rien : il compare l'etat de la base aux valeurs
 * officielles et signale tout ecart.
 *
 *   node --env-file=.env scripts/verifier-donnees-protegees.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
let ok = 0;
let ko = 0;

function verifier(intitule, attendu, obtenu) {
  const bon = String(attendu) === String(obtenu);
  if (bon) ok += 1; else ko += 1;
  console.log(`  ${bon ? 'OK   ' : 'ECART'} ${intitule.padEnd(34)} ${bon ? obtenu : `attendu ${attendu}, trouve ${obtenu}`}`);
}

const PRIX = {
  'Coiffe simple': 25000,
  'Coiffe sénégalais': 25000,
  'Coiffe nigérienne': 45000,
  'Éventail': 35000,
  'Turban marié': 30000,
  'Turban à la machine': 60000,
  'Voile': 40000,
  'Maquillage': 25000,
};

console.log('CONTROLE DES DONNEES PROTEGEES');
console.log('='.repeat(66));

console.log('\nPRIX DES FORMATIONS (FCFA)');
const formations = await prisma.course.findMany({ select: { name: true, price: true } });
for (const [nom, prix] of Object.entries(PRIX)) {
  const trouvee = formations.find((f) => f.name === nom);
  verifier(nom, prix, trouvee ? trouvee.price : 'formation absente');
}

console.log('\nCOORDONNEES');
const reglages = Object.fromEntries(
  (await prisma.setting.findMany({ select: { key: true, value: true } })).map((s) => [s.key, s.value]),
);
verifier('shop.whatsapp', '+226 76 51 88 11', reglages['shop.whatsapp']);
// Deux numeros distincts : le premier sert aussi a WhatsApp, le second est
// une ligne d'appel supplementaire.
verifier('shop.phone (appel + WhatsApp)', '+226 76 51 88 11', reglages['shop.phone']);
verifier('shop.phone2 (2e ligne d’appel)', '+226 62 71 30 19', reglages['shop.phone2']);
verifier('shop.email', 'contact@sdesignshop.com', reglages['shop.email']);
verifier('shop.latitude', '12.40567398071289', reglages['shop.latitude']);
verifier('shop.longitude', '-1.6069070100784302', reglages['shop.longitude']);

console.log('\nMENTIONS SENSIBLES');
verifier('shop.district (lieu uniquement)', 'Marcoussi', reglages['shop.district']);
// « Marcoussi » est un quartier : il ne doit jamais servir de signature.
const sensibles = [reglages['shop.slogan'], reglages['shop.tagline'], reglages['shop.name']].join(' ');
const propre = !/marcoussi/i.test(sensibles);
console.log(`  ${propre ? 'OK   ' : 'ECART'} « Marcoussi » absent du nom, du slogan et de la signature`);
if (propre) ok += 1; else ko += 1;

console.log('\nLOGO');
const logo = reglages['shop.logoUrl'] ?? '';
const surR2 = /^https?:\/\//i.test(logo);
console.log(`  ${surR2 ? 'OK   ' : 'ECART'} logo servi depuis le stockage distant : ${surR2 ? 'oui' : 'non'}`);
if (!surR2) ko += 1; else ok += 1;

await prisma.$disconnect();
console.log('\n' + '='.repeat(66));
console.log(`RESULTAT : ${ok} conforme(s), ${ko} ecart(s).`);
process.exit(ko === 0 ? 0 : 1);
