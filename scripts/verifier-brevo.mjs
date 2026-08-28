/**
 * Verification de la messagerie Brevo, avec une vraie cle API.
 *
 * Controle le compte, l'expediteur declare, puis envoie un message de test a
 * l'adresse indiquee. Aucun code OTP reel n'est genere ni affiche.
 *
 *   node --env-file=.env scripts/verifier-brevo.mjs vous@exemple.com
 */
const destinataire = process.argv[2];
const CLE = process.env.BREVO_API_KEY ?? '';
const EXPEDITEUR = {
  email: process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_FROM || '',
  nom: process.env.BREVO_SENDER_NAME || process.env.EMAIL_FROM_NAME || 'S.DESIGN SHOP',
};

if (!CLE) {
  console.error('BREVO_API_KEY absente. Renseignez-la dans .env.');
  process.exit(1);
}
if (!EXPEDITEUR.email) {
  console.error('BREVO_SENDER_EMAIL absente. Renseignez-la dans .env.');
  process.exit(1);
}

console.log('=== VERIFICATION BREVO ===\n');
console.log(`Expediteur : ${EXPEDITEUR.nom} <${EXPEDITEUR.email}>`);
console.log(`Cle API    : ${CLE.slice(0, 8)}…${' '.repeat(4)}(jamais affichee en entier)\n`);

let echecs = 0;
const etape = (ok, libelle, detail) => {
  if (!ok) echecs += 1;
  console.log(`${ok ? 'OK   ' : 'ECHEC'} ${libelle}${detail ? `\n      ${detail}` : ''}`);
};

const entetes = { 'api-key': CLE, accept: 'application/json', 'content-type': 'application/json' };

// 1. La cle est-elle valide ?
try {
  const r = await fetch('https://api.brevo.com/v3/account', { headers: entetes });
  if (r.ok) {
    const compte = await r.json();
    etape(true, 'Cle API valide', `compte « ${compte.companyName ?? compte.email ?? 'sans nom'} »`);
  } else {
    etape(false, 'Cle API valide', `HTTP ${r.status} — cle refusee par Brevo`);
  }
} catch (e) {
  etape(false, 'Cle API valide', `API injoignable : ${e.message}`);
}

// 2. L'expediteur est-il valide chez Brevo ?
if (!echecs) {
  try {
    const r = await fetch('https://api.brevo.com/v3/senders', { headers: entetes });
    if (r.ok) {
      const { senders = [] } = await r.json();
      const trouve = senders.find((s) => s.email?.toLowerCase() === EXPEDITEUR.email.toLowerCase());
      etape(
        Boolean(trouve?.active),
        'Expediteur declare et valide',
        trouve
          ? trouve.active
            ? `« ${trouve.name} » actif`
            : 'expediteur present mais NON valide — confirmez le lien recu par e-mail'
          : `${EXPEDITEUR.email} absent de la liste des expediteurs Brevo.\n      ` +
            `Expediteurs connus : ${senders.map((s) => s.email).join(', ') || 'aucun'}`,
      );
    } else {
      etape(false, 'Expediteur declare et valide', `HTTP ${r.status}`);
    }
  } catch (e) {
    etape(false, 'Expediteur declare et valide', e.message);
  }
}

// 3. Envoi reel
if (!destinataire) {
  console.log('\nAucune adresse fournie : envoi de test non effectue.');
  console.log('Relancez avec :  node --env-file=.env scripts/verifier-brevo.mjs vous@exemple.com');
} else if (!echecs) {
  try {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: entetes,
      body: JSON.stringify({
        sender: { email: EXPEDITEUR.email, name: EXPEDITEUR.nom },
        to: [{ email: destinataire }],
        subject: 'Test technique S.DESIGN SHOP',
        htmlContent:
          '<p>Ce message confirme que la messagerie transactionnelle de S.DESIGN SHOP fonctionne.</p>' +
          '<p>Aucun code de verification n’est contenu dans ce test.</p>',
      }),
    });
    if (r.ok) {
      const { messageId } = await r.json().catch(() => ({}));
      etape(true, `Envoi reel vers ${destinataire}`, `messageId ${messageId ?? '(non renvoye)'}`);
      console.log('\n      Verifiez la boite de reception ET le dossier indesirables.');
    } else {
      etape(false, `Envoi reel vers ${destinataire}`, `HTTP ${r.status} — ${(await r.text()).slice(0, 200)}`);
    }
  } catch (e) {
    etape(false, `Envoi reel vers ${destinataire}`, e.message);
  }
}

console.log(`\n${echecs === 0 ? 'BREVO EST OPERATIONNEL' : `${echecs} ECHEC(S)`}`);
process.exit(echecs === 0 ? 0 : 1);
