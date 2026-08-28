import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/layout/Logo';
import { LoginForm } from '@/components/forms/AuthForms';
import { getCurrentUser } from '@/lib/auth';
import { homePathFor } from '@/lib/rbac';
import { getSettings } from '@/lib/settings';
import { resolveLogo } from '@/lib/brand';

export const metadata: Metadata = { title: 'Connexion' };
export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: { motdepasse?: string } }) {
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
          <h1 className="mb-1 font-display text-2xl text-cream">Connexion</h1>
          <p className="mb-6 text-sm text-cream-muted">Accédez à votre espace personnel.</p>
          {searchParams.motdepasse === 'modifie' ? (
            <div
              className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100"
              role="status"
            >
              Votre mot de passe a été modifié. Connectez-vous avec votre nouveau mot de passe.
            </div>
          ) : null}
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
