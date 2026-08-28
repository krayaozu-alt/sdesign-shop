import 'server-only';
import { BrevoEmailProvider } from '@/server/email/brevo';
import { DevEmailProvider } from '@/server/email/dev';
import type { EmailProvider } from '@/server/email/types';

export * from '@/server/email/types';

let instance: EmailProvider | null = null;

/**
 * Fournisseur d'e-mail actif.
 *
 *   EMAIL_DRIVER=brevo -> API Brevo (production)
 *   EMAIL_DRIVER=dev   -> mode test, code affiche en console
 *   non defini         -> Brevo si BREVO_API_KEY existe, sinon mode test
 */
export function getEmailProvider(): EmailProvider {
  if (instance) return instance;

  const demande = (process.env.EMAIL_DRIVER ?? '').toLowerCase();
  const brevo = new BrevoEmailProvider();

  if (demande === 'brevo') instance = brevo;
  else if (demande === 'dev') instance = new DevEmailProvider();
  else instance = brevo.isConfigured() ? brevo : new DevEmailProvider();

  return instance;
}

/** Etat de la messagerie, affiche dans Admin > Paramètres. */
export function emailStatus(): { driver: string; configured: boolean; manquantes: string[] } {
  const p = getEmailProvider();
  return {
    driver: p.name,
    configured: p.isConfigured(),
    manquantes: p instanceof BrevoEmailProvider ? p.manquantes() : [],
  };
}
