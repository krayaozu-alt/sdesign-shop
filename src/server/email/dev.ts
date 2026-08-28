import 'server-only';
import type { Destinataire, EmailProvider, EmailResult } from '@/server/email/types';

/**
 * Fournisseur de DEVELOPPEMENT.
 *
 * Aucun e-mail n'est reellement envoye : le code est affiche dans la console du
 * serveur pour permettre les tests locaux.
 *
 * Garde-fou : en production ce fournisseur REFUSE d'envoyer et n'affiche jamais
 * de code. Un OTP ne doit jamais apparaitre dans les journaux d'un serveur de
 * production.
 */
export class DevEmailProvider implements EmailProvider {
  readonly name = 'dev' as const;

  isConfigured(): boolean {
    return process.env.NODE_ENV !== 'production';
  }

  private trace(sujet: string, to: Destinataire, code?: string): EmailResult {
    if (process.env.NODE_ENV === 'production') {
      return {
        ok: false,
        error: "Aucun fournisseur d'e-mail configuré. Renseignez BREVO_API_KEY pour activer les envois.",
      };
    }
    console.info(
      `\n[e-mail · MODE TEST] ${sujet}\n  destinataire : ${to.email}` +
        (code ? `\n  code         : ${code}   (développement uniquement)` : '') +
        '\n',
    );
    return { ok: true };
  }

  async sendVerificationOtp(to: Destinataire, code: string): Promise<EmailResult> {
    return this.trace('Vérification de l’adresse e-mail', to, code);
  }

  async sendWelcomeEmail(to: Destinataire): Promise<EmailResult> {
    return this.trace('Bienvenue chez S.DESIGN SHOP', to);
  }

  async sendPasswordResetOtp(to: Destinataire, code: string): Promise<EmailResult> {
    return this.trace('Réinitialisation du mot de passe', to, code);
  }
}
