import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/layout/Logo';
import { InscriptionClienteForm } from '@/components/forms/AccountForms';
import { getCurrentUser } from '@/lib/auth';
import { homePathFor } from '@/lib/rbac';
import { getSettings } from '@/lib/settings';
import { resolveLogo } from '@/lib/brand';

export const metadata: Metadata = { title: 'Créer un compte' };
export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect(homePathFor(user.role));
  const settings = await getSettings();

  return (
    <div className="container-page flex justify-center py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Logo logoUrl={resolveLogo(settings['shop.logoUrl'])} name={settings['shop.name']} tagline={settings['shop.tagline']} />
        </div>
        <div className="surface p-6 sm:p-8">
          <h1 className="mb-1 font-display text-2xl text-cream">Créer un compte</h1>
          <p className="mb-6 text-sm text-cream-muted">
            Suivez vos rendez-vous, vos formations, vos paiements et vos certificats. Votre adresse e-mail sera vérifiée
            par un code à 6 chiffres.
          </p>
          <InscriptionClienteForm />
        </div>
      </div>
    </div>
  );
}
