import type { Metadata } from 'next';
import { Logo } from '@/components/layout/Logo';
import { MotDePasseOublieForm } from '@/components/forms/AccountForms';
import { getSettings } from '@/lib/settings';
import { resolveLogo } from '@/lib/brand';

export const metadata: Metadata = { title: 'Mot de passe oublié' };
export const dynamic = 'force-dynamic';

export default async function MotDePasseOubliePage() {
  const settings = await getSettings();

  return (
    <div className="container-page flex justify-center py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Logo logoUrl={resolveLogo(settings['shop.logoUrl'])} name={settings['shop.name']} tagline={settings['shop.tagline']} />
        </div>
        <div className="surface p-6 sm:p-8">
          <h1 className="mb-1 font-display text-2xl text-cream">Mot de passe oublié</h1>
          <p className="mb-6 text-sm text-cream-muted">
            Indiquez l’adresse e-mail de votre compte : nous vous enverrons un code de réinitialisation.
          </p>
          <MotDePasseOublieForm />
        </div>
      </div>
    </div>
  );
}
