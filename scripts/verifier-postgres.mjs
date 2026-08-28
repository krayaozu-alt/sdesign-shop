/**
 * Controle des deux chaines de connexion PostgreSQL (Neon).
 *
 * Verifie leur forme, leur coherence entre elles, et la joignabilite reelle
 * des deux points d'entree en TCP + TLS. L'authentification, elle, sera testee
 * par `prisma migrate`.
 *
 * AUCUN SECRET N'EST AFFICHE : ni le mot de passe, ni l'identifiant complet du
 * point d'entree. Seules des formes masquees apparaissent.
 *
 *   node --env-file=.env scripts/verifier-postgres.mjs
 */
import { connect } from 'node:net';
import { connect as connectTls } from 'node:tls';

const CHAINES = [
  { variable: 'DATABASE_URL', role: 'application', attenduGroupee: true },
  { variable: 'DATABASE_URL_UNPOOLED', role: 'migrations Prisma', attenduGroupee: false },
];

/** ep-cool-name-a1b2c3d4-pooler.eu-central-1.aws.neon.tech -> ep-****-pooler.eu-central-1.aws.neon.tech */
function masquerHote(hote) {
  const parties = hote.split('.');
  const premier = parties[0] ?? '';
  const suffixe = premier.endsWith('-pooler') ? '-pooler' : '';
  const debut = premier.slice(0, 3);
  return [`${debut}${'*'.repeat(6)}${suffixe}`, ...parties.slice(1)].join('.');
}

function analyser(brut) {
  const u = new URL(brut);
  const parametres = u.searchParams;
  return {
    protocole: u.protocol.replace(':', ''),
    hote: u.hostname,
    port: u.port || '5432',
    base: u.pathname.replace(/^\//, ''),
    utilisateur: u.username,
    motDePasse: u.password,
    groupee: /-pooler/.test(u.hostname),
    sslmode: parametres.get('sslmode'),
    connectTimeout: parametres.get('connect_timeout'),
  };
}

/** Ouverture TCP puis negociation TLS avec SNI : prouve que le point d'entree repond. */
function joindre(hote, port, delai = 15000) {
  return new Promise((resoudre) => {
    const debut = Date.now();
    const prise = connect({ host: hote, port: Number(port) }, () => {
      const ms = Date.now() - debut;
      prise.destroy();
      // Deuxieme temps : verifier que le certificat TLS repond bien pour cet hote.
      const tls = connectTls({ host: hote, port: Number(port), servername: hote, timeout: delai }, () => {
        const expire = tls.getPeerCertificate?.()?.valid_to;
        tls.destroy();
        resoudre({ ok: true, ms, tls: true, certificat: expire ?? null });
      });
      tls.on('error', () => {
        // Postgres attend un message SSLRequest avant TLS : un refus ici est
        // normal et ne remet pas en cause la joignabilite TCP.
        tls.destroy();
        resoudre({ ok: true, ms, tls: false, certificat: null });
      });
      tls.setTimeout(delai, () => {
        tls.destroy();
        resoudre({ ok: true, ms, tls: false, certificat: null });
      });
    });
    prise.setTimeout(delai, () => {
      prise.destroy();
      resoudre({ ok: false, erreur: `pas de reponse en ${delai / 1000} s` });
    });
    prise.on('error', (e) => {
      prise.destroy();
      resoudre({ ok: false, erreur: e.code ?? e.message });
    });
  });
}

console.log('=== CONTROLE DES CONNEXIONS POSTGRESQL ===\n');

let echecs = 0;
let avertissements = 0;
const analysees = [];

for (const { variable, role, attenduGroupee } of CHAINES) {
  const brut = process.env[variable];
  console.log(`── ${variable}  (${role})`);

  if (!brut) {
    echecs += 1;
    console.log('   ECHEC  variable absente\n');
    continue;
  }

  let a;
  try {
    a = analyser(brut);
  } catch {
    echecs += 1;
    console.log('   ECHEC  chaine illisible (format attendu : postgresql://…)\n');
    continue;
  }
  analysees.push({ variable, ...a });

  const ligne = (ok, libelle, detail) => {
    if (!ok) echecs += 1;
    console.log(`   ${ok ? 'OK    ' : 'ECHEC '} ${libelle.padEnd(22)} ${detail}`);
  };
  const note = (ok, libelle, detail) => {
    if (!ok) avertissements += 1;
    console.log(`   ${ok ? 'OK    ' : 'NOTE  '} ${libelle.padEnd(22)} ${detail}`);
  };

  ligne(/^postgres(ql)?$/.test(a.protocole), 'Protocole', a.protocole);
  ligne(Boolean(a.utilisateur), 'Utilisateur', a.utilisateur ? 'present' : 'ABSENT');
  ligne(Boolean(a.motDePasse), 'Mot de passe', a.motDePasse ? `present (${a.motDePasse.length} caracteres)` : 'ABSENT');
  ligne(Boolean(a.base), 'Base', a.base || 'ABSENTE');
  console.log(`   ·      ${'Hote'.padEnd(22)} ${masquerHote(a.hote)}:${a.port}`);

  ligne(
    a.groupee === attenduGroupee,
    'Type de connexion',
    a.groupee
      ? attenduGroupee
        ? 'groupee (-pooler) — conforme'
        : 'GROUPEE alors que la DIRECTE est requise'
      : attenduGroupee
        ? 'directe alors que la GROUPEE est attendue'
        : 'directe — conforme',
  );

  note(a.sslmode === 'require', 'sslmode', a.sslmode ?? 'absent (recommande : require)');
  note(Boolean(a.connectTimeout), 'connect_timeout', a.connectTimeout ?? 'absent (recommande : 15)');

  const r = await joindre(a.hote, a.port);
  if (r.ok) {
    console.log(`   OK     ${'Joignabilite'.padEnd(22)} TCP etabli en ${r.ms} ms${r.tls ? `, TLS valide jusqu'au ${r.certificat}` : ''}`);
  } else {
    echecs += 1;
    console.log(`   ECHEC  ${'Joignabilite'.padEnd(22)} ${r.erreur}`);
  }
  console.log();
}

/* --------------------------------------------------- Coherence entre les deux */

if (analysees.length === 2) {
  const [app, mig] = analysees;
  console.log('── Coherence entre les deux chaines');

  const memeBase = app.base === mig.base;
  if (!memeBase) echecs += 1;
  console.log(`   ${memeBase ? 'OK    ' : 'ECHEC '} ${'Meme base'.padEnd(22)} ${memeBase ? app.base : `${app.base} ≠ ${mig.base}`}`);

  const memeUtilisateur = app.utilisateur === mig.utilisateur;
  if (!memeUtilisateur) avertissements += 1;
  console.log(`   ${memeUtilisateur ? 'OK    ' : 'NOTE  '} ${'Meme utilisateur'.padEnd(22)} ${memeUtilisateur ? 'oui' : 'utilisateurs differents'}`);

  const memeProjet = app.hote.replace('-pooler', '') === mig.hote.replace('-pooler', '');
  if (!memeProjet) echecs += 1;
  console.log(
    `   ${memeProjet ? 'OK    ' : 'ECHEC '} ${'Meme point d’entree'.padEnd(22)} ${
      memeProjet ? 'oui, aux -pooler pres' : 'LES DEUX CHAINES POINTENT VERS DES ENDPOINTS DIFFERENTS'
    }`,
  );

  if (app.hote === mig.hote) {
    avertissements += 1;
    console.log(`   NOTE   ${'Chaines identiques'.padEnd(22)} pas de connexion groupee ; fonctionnel, mais sans pooling`);
  }
  console.log();
}

console.log('='.repeat(52));
if (echecs) {
  console.log(`${echecs} echec(s), ${avertissements} remarque(s). Corrigez avant de migrer.`);
} else {
  console.log(`Connexions conformes et joignables. ${avertissements} remarque(s) sans gravite.`);
  console.log("L'authentification sera verifiee par `prisma migrate`.");
}
process.exit(echecs ? 1 : 0);
