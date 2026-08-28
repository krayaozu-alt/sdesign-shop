import 'server-only';
import {
  EXPEDITEUR,
  blocCode,
  gabarit,
  versionTexte,
  type Destinataire,
  type EmailProvider,
  type EmailResult,
} from '@/server/email/types';

/**
 * Envoi via l'API HTTP Brevo (ex-Sendinblue).
 *
 * Actif uniquement si BREVO_API_KEY est renseignee : aucune cle n'est codee
 * dans le projet. La cle ne quitte jamais le serveur — ce module porte
 * `server-only`, et rien de ce qu'il manipule n'est transmis au navigateur.
 *
 * Aucun code de verification n'est jamais journalise : en cas d'echec, seul le
 * code HTTP est rapporte, jamais le corps de la reponse ni le contenu envoye.
 */
export class BrevoEmailProvider implements EmailProvider {
  readonly name = 'brevo' as const;

  isConfigured(): boolean {
    return Boolean(process.env.BREVO_API_KEY);
  }

  /** Variables absentes, pour un diagnostic lisible dans l'administration. */
  manquantes(): string[] {
    const absentes: string[] = [];
    if (!process.env.BREVO_API_KEY) absentes.push('BREVO_API_KEY');
    if (!EXPEDITEUR.defini) absentes.push('BREVO_SENDER_EMAIL');
    return absentes;
  }

  private async envoyer(to: Destinataire, sujet: string, html: string, texte: string): Promise<EmailResult> {
    const cle = process.env.BREVO_API_KEY;
    if (!cle) return { ok: false, error: 'BREVO_API_KEY absente.' };

    try {
      const reponse = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': cle, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          sender: { email: EXPEDITEUR.email, name: EXPEDITEUR.nom },
          to: [{ email: to.email, ...(to.nom ? { name: to.nom } : {}) }],
          subject: sujet,
          htmlContent: html,
          textContent: texte,
        }),
      });

      if (!reponse.ok) {
        // Le corps de la réponse peut contenir l'adresse : on ne journalise
        // que le code HTTP, jamais le contenu du message ni le code OTP.
        return { ok: false, error: `Brevo a refusé l'envoi (HTTP ${reponse.status}).` };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'Service d’e-mail injoignable.' };
    }
  }

  sendVerificationOtp(to: Destinataire, code: string, expireMinutes: number) {
    const prenom = to.nom ? ` ${to.nom}` : '';
    return this.envoyer(
      to,
      'Votre code de vérification S.DESIGN SHOP',
      gabarit(
        'Vérification de votre adresse e-mail',
        `<p style="margin:0 0 14px">Bonjour${prenom},</p>
         <p style="margin:0 0 14px">Merci d’avoir créé votre compte S.DESIGN SHOP.</p>
         <p style="margin:0">Votre code de vérification est :</p>
         ${blocCode(code, expireMinutes)}
         <p style="margin:0">Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.</p>`,
      ),
      versionTexte([
        `Bonjour${prenom},`,
        '',
        'Merci d’avoir créé votre compte S.DESIGN SHOP.',
        '',
        'Votre code de vérification est :',
        '',
        code,
        '',
        `Ce code est valable pendant ${expireMinutes} minutes.`,
        '',
        'Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.',
      ]),
    );
  }

  sendWelcomeEmail(to: Destinataire) {
    const prenom = to.nom ? ` ${to.nom}` : '';
    return this.envoyer(
      to,
      'Bienvenue chez S.DESIGN SHOP',
      gabarit(
        'Votre compte est activé',
        `<p style="margin:0 0 14px">Bonjour${prenom},</p>
         <p style="margin:0">Votre compte S.DESIGN SHOP est désormais actif. Vous pouvez suivre vos formations,
         vos rendez-vous, vos paiements et vos certificats depuis votre espace personnel.</p>`,
      ),
      versionTexte([
        `Bonjour${prenom},`,
        '',
        'Votre compte S.DESIGN SHOP est désormais actif. Vous pouvez suivre vos formations,',
        'vos rendez-vous, vos paiements et vos certificats depuis votre espace personnel.',
      ]),
    );
  }

  sendPasswordResetOtp(to: Destinataire, code: string, expireMinutes: number) {
    const prenom = to.nom ? ` ${to.nom}` : '';
    return this.envoyer(
      to,
      'Réinitialisation de votre mot de passe S.DESIGN SHOP',
      gabarit(
        'Réinitialisation de votre mot de passe',
        `<p style="margin:0 0 14px">Bonjour${prenom},</p>
         <p style="margin:0">Voici le code permettant de définir un nouveau mot de passe :</p>
         ${blocCode(code, expireMinutes)}
         <p style="margin:0">Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail :
         votre mot de passe actuel reste valable.</p>`,
      ),
      versionTexte([
        `Bonjour${prenom},`,
        '',
        'Voici le code permettant de définir un nouveau mot de passe :',
        '',
        code,
        '',
        `Ce code est valable pendant ${expireMinutes} minutes.`,
        '',
        'Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail :',
        'votre mot de passe actuel reste valable.',
      ]),
    );
  }
}
