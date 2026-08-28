import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/layout/Logo';
import { VerificationEmailForm } from '@/components/forms/AccountForms';
import { getPendingVerification } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSettings } from '@/lib/settings';
import { resolveLogo } from '@/lib/brand';
import { OTP_PURPOSES, OTP_VALIDITE_MINUTES, delaiAvantRenvoi } from '@/server/otp';
import { emailStatus } from '@/server/email';

export const metadata: Metadata = { title: 'Vérification de votre adresse e-mail' };
export const dynamic = 'force-dynamic';

/** Masque l'adresse : le rappel visuel suffit, sans l'exposer en clair. */
function masquer(email: string): string {
  const [nom, domaine] = email.split('@');
  if (!domaine) return email;
  const visible = nom.slice(0, 2);
  return `${visible}${'•'.repeat(Math.max(nom.length - 2, 1))}@${domaine}`;
}

export default async function VerificationPage() {
  const pending = await getPendingVerification();
  if (!pending || pending.purpose !== OTP_PURPOSES.EMAIL_VERIFICATION) redirect('/creer-compte');

  const user = await prisma.user.findUnique({
    where: { id: pending.userId },
    select: { email: true, emailVerified: true },
  });
  if (!user) redirect('/creer-compte');
  if (user.emailVerified) redirect('/connexion');

  const [settings, delai] = await Promise.all([
    getSettings(),
    delaiAvantRenvoi(pending.userId, OTP_PURPOSES.EMAIL_VERIFICATION),
  ]);

  // Si la messagerie n'est pas operationnelle, aucun code n'a pu partir.
  // Sans ce signal, la cliente resterait devant un formulaire vide sans
  // comprendre pourquoi, et l'exploitant ne verrait jamais la panne.
  const messagerie = emailStatus();
  const envoiImpossible = !messagerie.configured;

  return (
    <div className="container-page flex justify-center py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Logo logoUrl={resolveLogo(settings['shop.logoUrl'])} name={settings['shop.name']} tagline={settings['shop.tagline']} />
        </div>
        <div className="surface p-6 sm:p-8">
          <h1 className="mb-1 font-display text-2xl text-cream">Vérification de votre adresse e-mail</h1>
          <p className="mb-6 text-sm text-cream-muted">
            {envoiImpossible ? (
              <>
                Votre compte est enregistré au nom de{' '}
                <span className="text-gold-300">{user.email ? masquer(user.email) : 'votre adresse'}</span>.
              </>
            ) : (
              <>
                Un code à 6 chiffres a été envoyé à{' '}
                <span className="text-gold-300">{user.email ? masquer(user.email) : 'votre adresse'}</span>. Il reste
                valable {OTP_VALIDITE_MINUTES} minutes.
              </>
            )}
          </p>
          {envoiImpossible ? (
            <div
              className="mb-5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"
              role="alert"
            >
              <p className="mb-1 font-medium">L’envoi des e-mails est momentanément indisponible.</p>
              <p>
                Votre compte a bien été créé, mais le code n’a pas pu être expédié. Contactez la boutique au{' '}
                <a href={`tel:${settings['shop.phone']}`} className="text-gold-300 underline underline-offset-2">
                  {settings['shop.phone']}
                </a>{' '}
                pour faire activer votre compte.
              </p>
            </div>
          ) : null}
          <VerificationEmailForm delaiRenvoi={delai} />
        </div>
        <p className="mt-6 text-center text-xs text-cream-dim">
          Pensez à vérifier vos courriers indésirables si le message tarde à arriver.
        </p>
      </div>
    </div>
  );
}
