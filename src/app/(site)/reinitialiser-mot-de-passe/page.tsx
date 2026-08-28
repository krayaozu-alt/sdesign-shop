import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/layout/Logo';
import { ReinitialisationForm } from '@/components/forms/AccountForms';
import { getPendingVerification } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { resolveLogo } from '@/lib/brand';
import { OTP_DELAI_RENVOI_SECONDES, OTP_PURPOSES, OTP_VALIDITE_MINUTES, delaiAvantRenvoi } from '@/server/otp';

export const metadata: Metadata = { title: 'Réinitialiser le mot de passe' };
export const dynamic = 'force-dynamic';

export default async function ReinitialisationPage() {
  const pending = await getPendingVerification();
  if (!pending || pending.purpose !== OTP_PURPOSES.PASSWORD_RESET) redirect('/mot-de-passe-oublie');

  const [settings, delaiBase] = await Promise.all([
    getSettings(),
    delaiAvantRenvoi(pending.userId, OTP_PURPOSES.PASSWORD_RESET),
  ]);

  // Le compte a rebours est aussi calcule depuis l'emission du cookie : une
  // adresse inconnue affiche donc exactement le meme delai qu'un compte reel.
  const delaiCookie = Math.max(
    0,
    Math.ceil(OTP_DELAI_RENVOI_SECONDES - (Date.now() - pending.issuedAt) / 1000),
  );
  const delai = Math.max(delaiBase, delaiCookie);

  return (
    <div className="container-page flex justify-center py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Logo logoUrl={resolveLogo(settings['shop.logoUrl'])} name={settings['shop.name']} tagline={settings['shop.tagline']} />
        </div>
        <div className="surface p-6 sm:p-8">
          <h1 className="mb-1 font-display text-2xl text-cream">Nouveau mot de passe</h1>
          <p className="mb-6 text-sm text-cream-muted">
            Saisissez le code reçu par e-mail (valable {OTP_VALIDITE_MINUTES} minutes), puis choisissez votre nouveau mot de
            passe. L’ancien cessera immédiatement de fonctionner.
          </p>
          <ReinitialisationForm delaiRenvoi={delai} />
        </div>
      </div>
    </div>
  );
}
