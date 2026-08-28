'use client';

import Link from 'next/link';
import { useFormState } from 'react-dom';
import { FormAlert, Input, SubmitButton } from '@/components/ui/form';
import { loginAction } from '@/server/actions/auth';
import { EMPTY_ACTION_STATE } from '@/lib/validation';

export function LoginForm() {
  const [state, action] = useFormState(loginAction, EMPTY_ACTION_STATE);
  return (
    <form action={action} noValidate>
      <FormAlert state={state} />
      <Input
        label="Téléphone ou email"
        name="identifier"
        autoComplete="username"
        placeholder="+226 70 00 00 00"
        errors={state.errors?.identifier}
        required
      />
      <Input
        label="Mot de passe"
        name="password"
        type="password"
        autoComplete="current-password"
        errors={state.errors?.password}
        required
      />
      <div className="-mt-2 mb-4 text-right">
        <Link href="/mot-de-passe-oublie" className="text-xs text-cream-muted hover:text-gold-300">
          Mot de passe oublié ?
        </Link>
      </div>
      <SubmitButton className="w-full" pendingLabel="Connexion…">
        Se connecter
      </SubmitButton>
      <p className="mt-5 text-center text-sm text-cream-muted">
        Pas encore de compte ?{' '}
        <Link href="/creer-compte" className="text-gold-300 hover:text-gold-200">
          Créer un compte
        </Link>
      </p>
    </form>
  );
}
