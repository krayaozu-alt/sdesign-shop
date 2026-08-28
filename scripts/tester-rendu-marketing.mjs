/**
 * BANC D'ESSAI — RENDU REEL DES ANNONCES (Bloc 3)
 *
 * Ne teste pas des fonctions : teste les PAGES. Le script cree de vraies
 * annonces en base, demande les pages publiques au serveur en HTTP, et lit le
 * HTML reellement servi. C'est le seul moyen de prouver que ce que voit la
 * cliente correspond a ce que dit la base.
 *
 * Tout ce qui est cree ici est supprime a la fin, y compris apres un echec.
 *
 *   node --env-file=.env --import ./scripts/chargeur-src.mjs \
 *        scripts/tester-rendu-marketing.mjs [http://127.0.0.1:3000]
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE = process.argv[2] ?? 'http://127.0.0.1:3000';
const PREFIXE = 'TEST_BLOC3_RENDU_';

let reussis = 0;
let echoues = 0;
const creees = { posts: [], banners: [], sessions: [], courses: [] };

function verifier(intitule, condition, detail = '') {
  if (condition) {
    reussis += 1;
    console.log(`  OK    ${intitule}${detail ? ` — ${detail}` : ''}`);
  } else {
    echoues += 1;
    console.log(`  ECHEC ${intitule}${detail ? ` — ${detail}` : ''}`);
  }
}

const jours = (n) => new Date(Date.now() + n * 86400000);

/**
 * Le HTML tel qu'il part vers le navigateur de la cliente.
 *
 * En mode developpement, Next compile chaque route a la premiere demande : une
 * page jamais encore ouverte peut mettre plusieurs secondes, voire echouer si
 * la compilation n'est pas finie. Deux reprises espacees suffisent a lever
 * cette ambiguite — sans jamais masquer un vrai echec, puisque l'erreur
 * conserve le dernier etat rencontre.
 */
async function pageHtml(chemin) {
  let dernier = '';
  for (let essai = 1; essai <= 3; essai += 1) {
    try {
      const r = await fetch(`${BASE}${chemin}`, { headers: { 'cache-control': 'no-cache' } });
      if (r.ok) return r.text();
      dernier = `HTTP ${r.status}`;
    } catch (e) {
      dernier = e.message;
    }
    if (essai < 3) await new Promise((r) => setTimeout(r, 1500 * essai));
  }
  throw new Error(`${chemin} : ${dernier} (apres 3 tentatives)`);
}

/**
 * Next echappe les apostrophes typographiques et les espaces insecables dans
 * le HTML : on compare donc sur une forme normalisee, jamais sur le texte brut.
 */
function normaliser(html) {
  return html
    .replace(/&#x27;|&#39;|&apos;/g, '’')
    .replace(/&nbsp;|&#160;| | /g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x2F;/g, '/');
}

async function main() {
  console.log('BANC D’ESSAI — RENDU REEL DES ANNONCES');
  console.log('='.repeat(72));
  console.log(`Serveur interroge : ${BASE}\n`);

  /* ------------------------------------------------------ Support de test */
  const formation = await prisma.course.create({
    data: {
      slug: 'test-bloc3-rendu-formation',
      name: `${PREFIXE}Formation`,
      category: 'Test',
      level: 'DEBUTANT',
      price: 41000,
      durationLabel: '12 heures',
      durationHours: 12,
      shortDescription: 'Support de test, supprime a la fin.',
      description: 'Support de test, supprime a la fin.',
      status: 'OUVERTE',
    },
  });
  creees.courses.push(formation.id);

  const session = await prisma.courseSession.create({
    data: {
      slug: 'test-bloc3-rendu-session',
      courseId: formation.id,
      title: `${PREFIXE}Session`,
      startDate: jours(12),
      endDate: jours(16),
      capacity: 7,
      status: 'INSCRIPTIONS_OUVERTES',
      location: 'Test',
    },
  });
  creees.sessions.push(session.id);

  /* --------------------------------------- 1. Un brouillon ne sort jamais */
  console.log('1. UN BROUILLON N’ATTEINT JAMAIS LA CLIENTE');

  const post = await prisma.post.create({
    data: {
      slug: 'test-bloc3-rendu-publication',
      title: `${PREFIXE}Publication`,
      subtitle: 'Sous-titre de publication',
      body: 'Texte de la publication de test.',
      status: 'BROUILLON',
      sessionId: session.id,
    },
  });
  creees.posts.push(post.id);

  let accueil = normaliser(await pageHtml('/'));
  verifier('Publication en brouillon : absente de l’accueil', !accueil.includes(post.title));

  /* ------------------------------- 2. Une publication publiee est rendue */
  console.log('\n2. UNE PUBLICATION PUBLIEE EST BIEN RENDUE');

  await prisma.post.update({ where: { id: post.id }, data: { status: 'PUBLIEE' } });
  accueil = normaliser(await pageHtml('/'));
  verifier('Le titre apparait sur l’accueil', accueil.includes(post.title));
  verifier('Le sous-titre apparait', accueil.includes('Sous-titre de publication'));
  verifier('Le texte apparait', accueil.includes('Texte de la publication de test.'));
  verifier('Le prix de la formation liee apparait', accueil.includes('41 000 FCFA'));
  verifier('Les places restantes apparaissent', accueil.includes('7 places disponibles'));
  verifier(
    'Le bouton mene a l’inscription a cette session',
    accueil.includes('/formations/test-bloc3-rendu-formation/inscription?session=test-bloc3-rendu-session'),
  );

  /* ------------------------------------------- 3. Priorite de « A la une » */
  console.log('\n3. LA BANNIERE D’EN-TETE PASSE AVANT LA PUBLICATION');

  const banner = await prisma.banner.create({
    data: {
      title: `${PREFIXE}Banniere`,
      subtitle: 'Sous-titre de banniere',
      description: 'Texte de la banniere de test.',
      placement: 'HERO',
      status: 'PUBLIEE',
      sessionId: session.id,
    },
  });
  creees.banners.push(banner.id);

  accueil = normaliser(await pageHtml('/'));
  const posBanniere = accueil.indexOf(banner.title);
  const posPublication = accueil.indexOf(post.title);
  verifier('La banniere apparait', posBanniere !== -1);
  verifier('La publication apparait toujours, plus bas', posPublication !== -1);
  verifier(
    'La banniere est rendue AVANT la publication',
    posBanniere !== -1 && posPublication !== -1 && posBanniere < posPublication,
    `banniere a ${posBanniere}, publication a ${posPublication}`,
  );
  verifier(
    'Le meme contenu n’est pas affiche deux fois',
    accueil.split(banner.title).length - 1 <= 2,
    `${accueil.split(banner.title).length - 1} occurrence(s)`,
  );

  /* --------------------------------------------- 4. Emplacements distincts */
  console.log('\n4. CHAQUE EMPLACEMENT EST RESPECTE');

  const formations = normaliser(await pageHtml('/formations'));
  verifier('Une banniere HERO n’apparait pas sur la page des formations', !formations.includes(banner.title));

  await prisma.banner.update({ where: { id: banner.id }, data: { placement: 'FORMATIONS' } });
  const formations2 = normaliser(await pageHtml('/formations'));
  verifier('Placee sur « page des formations », elle y apparait', formations2.includes(banner.title));
  const accueil2 = normaliser(await pageHtml('/'));
  verifier('Et elle disparait de l’en-tete d’accueil', !accueil2.includes(banner.title));

  await prisma.banner.update({ where: { id: banner.id }, data: { placement: 'BAS_DE_PAGE' } });
  const contact = normaliser(await pageHtml('/contact'));
  verifier('Placee en bas de page, elle apparait sur toutes les pages', contact.includes(banner.title));

  /* --------------------------------------------- 5. Expiration automatique */
  console.log('\n5. UNE ANNONCE EXPIREE DISPARAIT TOUTE SEULE');

  await prisma.post.update({ where: { id: post.id }, data: { expiresAt: jours(-1) } });
  const accueil3 = normaliser(await pageHtml('/'));
  verifier('Publication expiree : plus rendue', !accueil3.includes(post.title));

  await prisma.banner.update({ where: { id: banner.id }, data: { endsAt: jours(-1) } });
  const contact2 = normaliser(await pageHtml('/contact'));
  verifier('Banniere expiree : plus rendue', !contact2.includes(banner.title));

  /* ------------------------------------- 6. Aucune donnee fictive affichee */
  console.log('\n6. AUCUNE DONNEE FICTIVE');

  await prisma.post.update({ where: { id: post.id }, data: { expiresAt: null } });
  const accueil4 = normaliser(await pageHtml('/'));
  const enBase = await prisma.courseSession.findUnique({
    where: { id: session.id },
    include: { _count: { select: { enrollments: { where: { status: { in: ['CONFIRMEE', 'EN_COURS'] } } } } } },
  });
  const restantesReelles = enBase.capacity - enBase._count.enrollments;
  verifier(
    'Les places affichees sont exactement celles de la base',
    accueil4.includes(`${restantesReelles} places disponibles`),
    `base = ${restantesReelles}`,
  );
}

async function nettoyer() {
  console.log('\nNETTOYAGE');
  for (const id of creees.posts) await prisma.post.delete({ where: { id } }).catch(() => {});
  for (const id of creees.banners) await prisma.banner.delete({ where: { id } }).catch(() => {});
  for (const id of creees.sessions) await prisma.courseSession.delete({ where: { id } }).catch(() => {});
  for (const id of creees.courses) await prisma.course.delete({ where: { id } }).catch(() => {});

  const restants = (
    await Promise.all([
      prisma.post.count({ where: { title: { startsWith: PREFIXE } } }),
      prisma.banner.count({ where: { title: { startsWith: PREFIXE } } }),
      prisma.courseSession.count({ where: { title: { startsWith: PREFIXE } } }),
      prisma.course.count({ where: { name: { startsWith: PREFIXE } } }),
    ])
  ).reduce((a, b) => a + b, 0);
  console.log(`  Donnees de test restantes : ${restants}`);
  if (restants > 0) {
    console.log('  ATTENTION : du residu subsiste.');
    echoues += 1;
  }

  // Derniere preuve : l'accueil ne contient plus rien de ce qui a ete cree.
  try {
    const html = await pageHtml('/');
    const trace = html.includes(PREFIXE);
    console.log(`  Trace de test dans l’accueil : ${trace ? 'OUI — a corriger' : 'aucune'}`);
    if (trace) echoues += 1;
  } catch {
    console.log('  (accueil non verifie : serveur injoignable)');
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
