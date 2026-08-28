/**
 * Diagnostic des variables d'environnement.
 *
 * Repond a une seule question par variable : CONFIGURE ou MANQUANT.
 * Lorsque la variable est presente, un controle de FORME est fait (prefixe
 * attendu, presence d'une arobase, absence de barre finale…) sans jamais
 * reveler le contenu.
 *
 * AUCUNE VALEUR N'EST AFFICHEE. Ni en clair, ni tronquee, ni masquee
 * partiellement : seules la longueur et la conformite apparaissent, et
 * uniquement pour les valeurs qui ne sont pas des secrets.
 *
 *   npm run diagnostic:env
 */

const CATEGORIES = [
  {
    titre: 'BASE DE DONNEES — PostgreSQL Neon',
    variables: [
      {
        nom: 'DATABASE_URL',
        secret: true,
        role: 'connexion groupee, utilisee par l’application',
        controles: [
          ['commence par postgresql://', (v) => /^postgres(ql)?:\/\//i.test(v)],
          ['hote en -pooler (connexion groupee)', (v) => /-pooler/.test(v)],
          ['sslmode=require', (v) => /sslmode=require/.test(v)],
          ['connect_timeout defini', (v) => /connect_timeout=\d+/.test(v)],
        ],
      },
      {
        nom: 'DATABASE_URL_UNPOOLED',
        secret: true,
        role: 'connexion directe, exigee par prisma migrate',
        controles: [
          ['commence par postgresql://', (v) => /^postgres(ql)?:\/\//i.test(v)],
          ['hote SANS -pooler (connexion directe)', (v) => !/-pooler/.test(v)],
          ['sslmode=require', (v) => /sslmode=require/.test(v)],
          ['connect_timeout defini', (v) => /connect_timeout=\d+/.test(v)],
        ],
      },
    ],
  },
  {
    titre: 'STOCKAGE — Cloudflare R2',
    variables: [
      {
        nom: 'R2_ACCOUNT_ID',
        secret: true,
        role: 'identifiant du compte Cloudflare',
        controles: [['32 caracteres hexadecimaux', (v) => /^[0-9a-f]{32}$/i.test(v)]],
      },
      {
        nom: 'R2_BUCKET_NAME',
        secret: false,
        role: 'nom du bucket',
        controles: [['nom de bucket valide', (v) => /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(v)]],
      },
      {
        nom: 'R2_ACCESS_KEY_ID',
        secret: true,
        role: 'cle d’acces du jeton R2',
        controles: [['32 caracteres hexadecimaux', (v) => /^[0-9a-f]{32}$/i.test(v)]],
      },
      {
        nom: 'R2_SECRET_ACCESS_KEY',
        secret: true,
        role: 'cle secrete du jeton R2',
        controles: [['64 caracteres hexadecimaux', (v) => /^[0-9a-f]{64}$/i.test(v)]],
      },
      {
        nom: 'R2_PUBLIC_URL',
        secret: false,
        role: 'domaine public du bucket',
        controles: [
          ['commence par https://', (v) => /^https:\/\//i.test(v)],
          // Erreur classique : coller l'endpoint S3 d'administration au lieu de
          // l'URL publique. L'endpoint exige une signature SigV4 sur chaque
          // requete ; un navigateur y recoit un refus. Les images seraient
          // ecrites mais jamais affichables.
          [
            "n'est PAS l'endpoint S3 (<compte>.r2.cloudflarestorage.com)",
            (v) => !/\.r2\.cloudflarestorage\.com/i.test(v),
          ],
          [
            'domaine public : r2.dev ou domaine personnalise',
            (v) => { try { const h = new URL(v).hostname; return h.endsWith('.r2.dev') || !h.endsWith('.cloudflarestorage.com'); } catch { return false; } },
          ],
          ['sans barre finale', (v) => !/\/$/.test(v)],
          ['sans chemin', (v) => { try { return new URL(v).pathname === '/'; } catch { return false; } }],
        ],
      },
    ],
  },
  {
    titre: 'MESSAGERIE — Brevo',
    variables: [
      {
        nom: 'BREVO_API_KEY',
        secret: true,
        role: 'cle API Brevo',
        controles: [['prefixe xkeysib-', (v) => /^xkeysib-/.test(v)]],
      },
      {
        nom: 'BREVO_SENDER_EMAIL',
        secret: false,
        role: 'adresse d’expedition (doit etre validee chez Brevo)',
        controles: [['adresse e-mail valide', (v) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v)]],
      },
      {
        nom: 'BREVO_SENDER_NAME',
        secret: false,
        role: 'nom affiche de l’expediteur',
        controles: [['non vide', (v) => v.trim().length > 0]],
      },
    ],
  },
  {
    titre: 'PILOTES — a basculer seulement apres validation',
    variables: [
      {
        nom: 'STORAGE_DRIVER',
        secret: false,
        role: 'local (developpement) ou r2 (production)',
        controles: [['valeur reconnue', (v) => ['local', 'r2'].includes(v.toLowerCase())]],
      },
      {
        nom: 'EMAIL_DRIVER',
        secret: false,
        role: 'dev (console) ou brevo (envoi reel)',
        controles: [['valeur reconnue', (v) => ['dev', 'brevo'].includes(v.toLowerCase())]],
      },
    ],
  },
];

/** Retire les guillemets eventuels laisses par le fichier .env. */
const lire = (nom) => (process.env[nom] ?? '').trim().replace(/^["']|["']$/g, '');

console.log('=== DIAGNOSTIC DES VARIABLES D’ENVIRONNEMENT ===\n');
console.log('Aucune valeur n’est affichee. Seules la presence et la conformite');
console.log('de forme sont controlees.\n');

let manquantes = 0;
let malformees = 0;
/** Variables presentes mais dont la forme est incorrecte : bloquantes aussi. */
const invalides = new Set();

for (const categorie of CATEGORIES) {
  console.log(`\n${categorie.titre}`);
  console.log('─'.repeat(66));

  for (const v of categorie.variables) {
    const valeur = lire(v.nom);

    if (!valeur) {
      manquantes += 1;
      console.log(`  MANQUANT   ${v.nom}`);
      console.log(`             ${v.role}`);
      continue;
    }

    const echecs = v.controles.filter(([, test]) => !test(valeur)).map(([libelle]) => libelle);
    if (echecs.length) {
      malformees += 1;
      invalides.add(v.nom);
    }

    const taille = v.secret ? `${valeur.length} caracteres` : `« ${valeur} »`;
    console.log(`  ${echecs.length ? 'A VERIFIER' : 'CONFIGURE '} ${v.nom}   ${taille}`);
    if (echecs.length) {
      for (const e of echecs) console.log(`             forme inattendue : ${e}`);
    }
  }
}

/* -------------------------------------------------- Verdict par service */

// Une variable presente mais mal formee est aussi bloquante qu'une absente :
// une URL publique invalide produirait des images inaffichables.
const groupe = (noms) => noms.every((n) => lire(n) && !invalides.has(n));

const r2 = groupe(['R2_ACCOUNT_ID', 'R2_BUCKET_NAME', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_PUBLIC_URL']);
const brevo = groupe(['BREVO_API_KEY', 'BREVO_SENDER_EMAIL']);
const postgres = groupe(['DATABASE_URL', 'DATABASE_URL_UNPOOLED']);

console.log('\n\nPRET A BASCULER ?');
console.log('─'.repeat(66));
console.log(`  PostgreSQL           ${postgres ? 'OUI — deja en service' : 'NON'}`);
console.log(`  STORAGE_DRIVER=r2    ${r2 ? 'OUI' : 'NON — variables R2 incompletes ou invalides'}`);
console.log(`  EMAIL_DRIVER=brevo   ${brevo ? 'OUI' : 'NON — variables Brevo incompletes ou invalides'}`);

console.log(`\n${manquantes} variable(s) manquante(s), ${malformees} de forme inattendue.`);
if (!r2 || !brevo) {
  console.log('\nAucune bascule ne doit etre appliquee tant que ces variables ne sont');
  console.log('pas renseignees ET verifiees par verifier-r2.mjs / verifier-brevo.mjs.');
}
process.exit(manquantes || malformees ? 1 : 0);
