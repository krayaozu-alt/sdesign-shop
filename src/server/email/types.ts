/**
 * Contrat d'envoi d'e-mails de S.DESIGN SHOP.
 *
 * Aucun SMTP local : les fournisseurs communiquent par API HTTP, ce qui
 * fonctionne aussi bien depuis un serveur Node que depuis Cloudflare Workers.
 */
export type EmailResult = { ok: true } | { ok: false; error: string };

export type Destinataire = { email: string; nom?: string };

export interface EmailProvider {
  readonly name: 'dev' | 'brevo';
  isConfigured(): boolean;
  /** Code de vérification à 6 chiffres pour activer un compte. */
  sendVerificationOtp(to: Destinataire, code: string, expireMinutes: number): Promise<EmailResult>;
  /** Message de bienvenue après activation du compte. */
  sendWelcomeEmail(to: Destinataire): Promise<EmailResult>;
  /** Code à 6 chiffres pour réinitialiser un mot de passe. */
  sendPasswordResetOtp(to: Destinataire, code: string, expireMinutes: number): Promise<EmailResult>;
}

/**
 * Expediteur des messages transactionnels.
 * L'adresse doit etre validee dans Brevo (expediteur ou domaine authentifie),
 * faute de quoi les messages partent en indesirables ou sont refuses.
 * EMAIL_FROM / EMAIL_FROM_NAME restent acceptes pour compatibilite.
 */
export const EXPEDITEUR = {
  get email(): string {
    return process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_FROM || 'contact@sdesignshop.com';
  },
  get nom(): string {
    return process.env.BREVO_SENDER_NAME || process.env.EMAIL_FROM_NAME || 'S.DESIGN SHOP';
  },
  /** Vrai lorsque l'expediteur a ete explicitement configure. */
  get defini(): boolean {
    return Boolean(process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_FROM);
  },
};

/**
 * Palette officielle S.DESIGN SHOP, appliquee aux messages transactionnels.
 * Les couleurs sont ecrites en dur : les clients de messagerie n'appliquent
 * ni feuille de style externe, ni variable CSS.
 */
const MARQUE = {
  fond: '#0B0B0D',       // noir
  carte: '#1C0722',      // aubergine profond
  or: '#C9A227',         // or
  orClair: '#E5C76B',
  creme: '#FAF8F4',
  texte: '#C9C3CD',
  discret: '#A9A5A0',
  bordure: 'rgba(201,162,39,.25)',
};

/**
 * Gabarit HTML des messages transactionnels.
 *
 * Structure en tableaux et styles en ligne : c'est la seule mise en forme que
 * les clients de messagerie rendent de facon fiable. Le pied reprend la
 * signature de la marque, comme sur les documents imprimes.
 */
export function gabarit(titre: string, corps: string): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titre}</title></head>
<body style="margin:0;background:${MARQUE.fond};padding:24px;font-family:Georgia,'Times New Roman',serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:${MARQUE.carte};border:1px solid ${MARQUE.bordure};border-radius:16px">

<tr><td align="center" style="padding:32px 32px 0">
<div style="font-size:22px;letter-spacing:.18em;color:${MARQUE.or};font-weight:700;font-family:Georgia,serif">S.DESIGN SHOP</div>
<div style="font-size:10px;letter-spacing:.28em;color:${MARQUE.discret};margin-top:8px;font-family:Arial,sans-serif">CRÉATION · FORMATION · ÉLÉGANCE</div>
<div style="height:1px;background:${MARQUE.bordure};margin:24px 0 0"></div>
</td></tr>

<tr><td style="padding:24px 32px 0;color:${MARQUE.creme};font-size:18px;font-weight:600">${titre}</td></tr>
<tr><td style="padding:14px 32px 0;color:${MARQUE.texte};font-size:15px;line-height:1.65;font-family:Arial,sans-serif">${corps}</td></tr>

<tr><td style="padding:28px 32px 32px">
<div style="height:1px;background:rgba(255,255,255,.08);margin-bottom:20px"></div>
<div style="color:${MARQUE.or};font-size:14px;letter-spacing:.12em;font-weight:700">S.DESIGN SHOP</div>
<div style="color:${MARQUE.discret};font-size:11px;letter-spacing:.16em;margin-top:6px;font-family:Arial,sans-serif">Création | Formation | Élégance</div>
</td></tr>

</table></td></tr></table></body></html>`;
}

/** Encadre mettant le code en valeur. */
export function blocCode(code: string, expireMinutes: number): string {
  return `<div style="margin:22px 0;padding:20px;background:rgba(201,162,39,.12);border:1px solid rgba(201,162,39,.35);border-radius:12px;text-align:center">
<div style="font-size:34px;letter-spacing:.35em;color:${MARQUE.orClair};font-weight:700;font-family:Georgia,serif">${code}</div>
</div>
<p style="margin:0 0 12px">Ce code est valable pendant <strong style="color:${MARQUE.creme}">${expireMinutes} minutes</strong>.</p>`;
}

/**
 * Version texte brut du message.
 *
 * Un message transactionnel sans alternative texte est penalise par les
 * filtres anti-spam, et illisible pour qui refuse le HTML. Elle reprend mot
 * pour mot le contenu de la version HTML.
 */
export function versionTexte(lignes: string[]): string {
  return [...lignes, '', 'S.DESIGN SHOP', 'Création | Formation | Élégance'].join('\n');
}
