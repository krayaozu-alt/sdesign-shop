/**
 * BANC D'ESSAI — PUBLICATIONS ET BANNIERES (Bloc 3)
 *
 * Teste les regles de diffusion sur la VRAIE base PostgreSQL, avec les
 * fonctions reellement utilisees par le site : aucune reimplementation, aucun
 * jeu de donnees simule.
 *
 * Toutes les donnees creees ici portent le prefixe TEST_ et sont supprimees a
 * la fin, y compris en cas d'echec. Les donnees reelles ne sont jamais
 * touchees : le nettoyage ne cible que les identifiants crees dans ce script.
 *
 *   node --env-file=.env scripts/tester-marketing.mjs
 */
import { PrismaClient } from '@prisma/client';
import {
  publicationsActives,
  bannieresActives,
  compteursMarketing,
  etatDiffusion,
} from '@/server/marketing';

const prisma = new PrismaClient();
const PREFIXE = 'TEST_BLOC3_';

let reussis = 0;
let echoues = 0;
const creees = { posts: [], banners: [], sessions: [], courses: [], users: [] };

function verifier(intitule, condition, detail = '') {
  if (condition) {
    reussis += 1;
    console.log(`  OK   ${intitule}${detail ? ` — ${detail}` : ''}`);
  } else {
    echoues += 1;
    console.log(`  ECHEC ${intitule}${detail ? ` — ${detail}` : ''}`);
  }
}

const jours = (n) => new Date(Date.now() + n * 86400000);

/** Une publication est-elle servie au public ? */
async function publiee(id) {
  const liste = await publicationsActives(50);
  return liste.some((p) => p.id === id);
}
async function banniereServie(placement, id) {
  const liste = await bannieresActives(placement, 50);
  return liste.some((b) => b.id === id);
}

async function main() {
  console.log('BANC D’ESSAI — PUBLICATIONS ET BANNIERES');
  console.log('='.repeat(72));

  const avant = await compteursMarketing();
  console.log(`\nEtat initial : ${avant.publications} publication(s) et ${avant.bannieres} banniere(s) en ligne.`);

  /* ---------------------------------------------------- Support de test */
  // Une formation et une session de test, pour verifier le rattachement.
  const formation = await prisma.course.create({
    data: {
      slug: `${PREFIXE}formation`.toLowerCase().replace(/_/g, '-'),
      name: `${PREFIXE}Formation`,
      category: 'Test',
      level: 'DEBUTANT',
      price: 33000,
      durationLabel: '10 heures',
      durationHours: 10,
      shortDescription: 'Support de test, supprime a la fin.',
      description: 'Support de test, supprime a la fin.',
      status: 'OUVERTE',
    },
  });
  creees.courses.push(formation.id);

  const session = await prisma.courseSession.create({
    data: {
      slug: `${PREFIXE}session`.toLowerCase().replace(/_/g, '-'),
      courseId: formation.id,
      title: `${PREFIXE}Session`,
      startDate: jours(10),
      endDate: jours(14),
      capacity: 5,
      status: 'INSCRIPTIONS_OUVERTES',
      location: 'Test',
    },
  });
  creees.sessions.push(session.id);
  console.log('Support cree : 1 formation et 1 session de test.\n');

  /* ------------------------------------------- 1. Cycle d'une publication */
  console.log('1. CYCLE DE VIE D’UNE PUBLICATION');

  const post = await prisma.post.create({
    data: {
      slug: `${PREFIXE}publication`.toLowerCase().replace(/_/g, '-'),
      title: `${PREFIXE}Publication`,
      body: 'Texte de test.',
      status: 'BROUILLON',
      sessionId: session.id,
    },
  });
  creees.posts.push(post.id);

  verifier('Un brouillon n’est pas visible du public', !(await publiee(post.id)));

  await prisma.post.update({ where: { id: post.id }, data: { status: 'PROGRAMMEE' } });
  verifier('Une publication programmee n’est pas visible', !(await publiee(post.id)));

  await prisma.post.update({ where: { id: post.id }, data: { status: 'PUBLIEE' } });
  verifier('Une publication publiee sans fenetre est visible', await publiee(post.id));

  await prisma.post.update({ where: { id: post.id }, data: { publishedAt: jours(3) } });
  verifier('Publiee mais datee dans le futur : invisible', !(await publiee(post.id)));

  await prisma.post.update({ where: { id: post.id }, data: { publishedAt: jours(-3), expiresAt: jours(-1) } });
  verifier('Publiee mais expiree : invisible', !(await publiee(post.id)));

  await prisma.post.update({ where: { id: post.id }, data: { publishedAt: jours(-3), expiresAt: jours(3) } });
  verifier('Dans sa fenetre de diffusion : visible', await publiee(post.id));

  await prisma.post.update({ where: { id: post.id }, data: { status: 'ARCHIVEE' } });
  verifier('Archivee : invisible meme dans la fenetre', !(await publiee(post.id)));

  await prisma.post.update({ where: { id: post.id }, data: { status: 'PUBLIEE' } });

  /* -------------------------------- 2. Donnees vivantes de la session liee */
  console.log('\n2. DONNEES REPRISES DE LA SESSION LIEE');

  const [servie] = (await publicationsActives(50)).filter((p) => p.id === post.id);
  verifier('La publication est bien servie', Boolean(servie));
  verifier('Le prix vient de la formation liee', servie?.prix === 33000, `prix = ${servie?.prix}`);
  verifier(
    'Les dates viennent de la session liee',
    servie?.sessionPeriode?.debut?.getTime() === session.startDate.getTime(),
  );
  verifier('Les places viennent du calcul reel', servie?.sessionEtat?.restantes === 5, `restantes = ${servie?.sessionEtat?.restantes}`);
  verifier(
    'Le bouton pointe vers l’inscription a cette session',
    servie?.lien === `/formations/${formation.slug}/inscription?session=${session.slug}`,
    servie?.lien,
  );

  // Une inscription reelle doit faire baisser les places affichees.
  // Un eleve est rattache a un compte : il faut donc creer les deux.
  const compte = await prisma.user.create({
    data: {
      email: `${PREFIXE}eleve@example.invalid`.toLowerCase(),
      passwordHash: 'test-non-utilisable',
      fullName: `${PREFIXE}Eleve`,
      phone: '+22600000000',
      role: 'ELEVE',
    },
  });
  creees.users.push(compte.id);
  const eleve = await prisma.student.create({
    data: { userId: compte.id, matricule: `${PREFIXE}MAT` },
  });
  const inscription = await prisma.enrollment.create({
    data: {
      reference: `${PREFIXE}REF`,
      studentId: eleve.id,
      courseId: formation.id,
      sessionId: session.id,
      status: 'CONFIRMEE',
      amountDue: 33000,
    },
  });
  const [apresInscription] = (await publicationsActives(50)).filter((p) => p.id === post.id);
  verifier(
    'Une inscription reelle met l’annonce a jour toute seule',
    apresInscription?.sessionEtat?.restantes === 4,
    `restantes = ${apresInscription?.sessionEtat?.restantes}`,
  );
  await prisma.enrollment.delete({ where: { id: inscription.id } });
  await prisma.student.delete({ where: { id: eleve.id } });
  await prisma.user.delete({ where: { id: compte.id } });
  creees.users.pop();

  // Un prix propre a la publication doit primer sur celui de la formation.
  await prisma.post.update({ where: { id: post.id }, data: { price: 20000 } });
  const [avecPrix] = (await publicationsActives(50)).filter((p) => p.id === post.id);
  verifier('Un prix saisi sur l’annonce prime', avecPrix?.prix === 20000, `prix = ${avecPrix?.prix}`);
  await prisma.post.update({ where: { id: post.id }, data: { price: null } });

  // Session fermee : le bouton doit renvoyer vers la page de la session, et
  // surtout pas vers un formulaire d'inscription qui refuserait la cliente.
  await prisma.courseSession.update({ where: { id: session.id }, data: { status: 'ANNULEE' } });
  const [fermee] = (await publicationsActives(50)).filter((p) => p.id === post.id);
  verifier(
    'Session fermee : le bouton renvoie vers la page de la session',
    fermee?.lien === `/sessions/${session.slug}`,
    fermee?.lien,
  );
  verifier('Session fermee : le bouton ne propose plus « S’inscrire »', fermee?.libelleBouton === 'En savoir plus');
  await prisma.courseSession.update({ where: { id: session.id }, data: { status: 'INSCRIPTIONS_OUVERTES' } });

  /* ------------------------------------------------ 3. Cycle d'une banniere */
  console.log('\n3. CYCLE DE VIE D’UNE BANNIERE');

  const banner = await prisma.banner.create({
    data: {
      title: `${PREFIXE}Banniere`,
      subtitle: 'Sous-titre de test',
      placement: 'HERO',
      status: 'BROUILLON',
      sessionId: session.id,
    },
  });
  creees.banners.push(banner.id);

  verifier('Un brouillon de banniere n’est pas servi', !(await banniereServie('HERO', banner.id)));

  await prisma.banner.update({ where: { id: banner.id }, data: { status: 'PUBLIEE' } });
  verifier('Une banniere publiee est servie sur son emplacement', await banniereServie('HERO', banner.id));
  verifier('Elle n’apparait PAS sur un autre emplacement', !(await banniereServie('ACCUEIL', banner.id)));

  await prisma.banner.update({ where: { id: banner.id }, data: { startsAt: jours(2) } });
  verifier('Banniere datee dans le futur : invisible', !(await banniereServie('HERO', banner.id)));

  await prisma.banner.update({ where: { id: banner.id }, data: { startsAt: jours(-2), endsAt: jours(-1) } });
  verifier('Banniere expiree : invisible', !(await banniereServie('HERO', banner.id)));

  await prisma.banner.update({ where: { id: banner.id }, data: { startsAt: jours(-2), endsAt: jours(5) } });
  verifier('Banniere dans sa fenetre : visible', await banniereServie('HERO', banner.id));

  /* -------------------------------------------- 4. Priorite de « A la une » */
  console.log('\n4. PRIORITE DE « A LA UNE »');

  const heroActives = await bannieresActives('HERO', 1);
  const pubsActives = await publicationsActives(6);
  verifier(
    'Une banniere HERO existe : c’est elle qui passe en premier',
    heroActives.length > 0 && heroActives[0].id === banner.id,
  );
  verifier('La publication reste disponible pour la suite de la page', pubsActives.some((p) => p.id === post.id));

  await prisma.banner.update({ where: { id: banner.id }, data: { status: 'BROUILLON' } });
  const sansHero = await bannieresActives('HERO', 1);
  verifier(
    'Sans banniere HERO, la place revient a la publication',
    sansHero.length === 0 && (await publicationsActives(6)).length > 0,
  );
  await prisma.banner.update({ where: { id: banner.id }, data: { status: 'PUBLIEE' } });

  /* ------------------------------------------------- 5. Etats d'affichage */
  console.log('\n5. ETATS AFFICHES A L’ADMINISTRATEUR');

  verifier(
    'Brouillon : « Brouillon »',
    etatDiffusion({ status: 'BROUILLON', debut: null, fin: null }).libelle === 'Brouillon',
  );
  verifier(
    'Publiee et en cours : « En ligne »',
    etatDiffusion({ status: 'PUBLIEE', debut: jours(-1), fin: jours(1) }).enLigne === true,
  );
  verifier(
    'Publiee mais future : signalee en attente',
    etatDiffusion({ status: 'PUBLIEE', debut: jours(5), fin: null }).enLigne === false,
  );
  verifier(
    'Publiee mais expiree : signalee expiree',
    etatDiffusion({ status: 'PUBLIEE', debut: null, fin: jours(-5) }).enLigne === false,
  );

  /* --------------------------------------------------------- 6. Compteurs */
  console.log('\n6. COMPTEURS DU TABLEAU DE BORD');
  const pendant = await compteursMarketing();
  verifier(
    'Le compteur de publications a augmente de 1',
    pendant.publications === avant.publications + 1,
    `${avant.publications} -> ${pendant.publications}`,
  );
  verifier(
    'Le compteur de bannieres a augmente de 1',
    pendant.bannieres === avant.bannieres + 1,
    `${avant.bannieres} -> ${pendant.bannieres}`,
  );
}

/** Nettoyage : uniquement les identifiants crees ci-dessus. */
async function nettoyer() {
  console.log('\nNETTOYAGE');
  for (const id of creees.posts) await prisma.post.delete({ where: { id } }).catch(() => {});
  for (const id of creees.banners) await prisma.banner.delete({ where: { id } }).catch(() => {});
  for (const id of creees.sessions) await prisma.courseSession.delete({ where: { id } }).catch(() => {});
  for (const id of creees.courses) await prisma.course.delete({ where: { id } }).catch(() => {});
  for (const id of creees.users) await prisma.user.delete({ where: { id } }).catch(() => {});

  const restants = await Promise.all([
    prisma.post.count({ where: { title: { startsWith: PREFIXE } } }),
    prisma.banner.count({ where: { title: { startsWith: PREFIXE } } }),
    prisma.courseSession.count({ where: { title: { startsWith: PREFIXE } } }),
    prisma.course.count({ where: { name: { startsWith: PREFIXE } } }),
    prisma.user.count({ where: { fullName: { startsWith: PREFIXE } } }),
  ]);
  const total = restants.reduce((a, b) => a + b, 0);
  console.log(`  Donnees de test restantes : ${total}`);
  if (total > 0) {
    console.log('  ATTENTION : du residu subsiste, verifier manuellement.');
    echoues += 1;
  }

  const apres = await compteursMarketing();
  console.log(`  Etat final : ${apres.publications} publication(s) et ${apres.bannieres} banniere(s) en ligne.`);
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
