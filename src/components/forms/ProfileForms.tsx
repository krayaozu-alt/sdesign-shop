'use client';

import { useFormState } from 'react-dom';
import { FormAlert, Input, SubmitButton } from '@/components/ui/form';
import { EMPTY_ACTION_STATE } from '@/lib/validation';
import { changePasswordAction, updateProfileAction } from '@/server/actions/auth';

export function ProfileForm({
  user,
}: {
  user: { fullName: string; phone: string; whatsapp: string | null; email: string | null; address: string | null };
}) {
  const [state, action] = useFormState(updateProfileAction, EMPTY_ACTION_STATE);
  return (
    <form action={action} noValidate>
      <FormAlert state={state} />
      <Input label="Nom complet" name="fullName" defaultValue={user.fullName} errors={state.errors?.fullName} required />
      <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
        <Input label="Téléphone" name="phone" type="tel" defaultValue={user.phone} errors={state.errors?.phone} required />
        <Input label="WhatsApp" name="whatsapp" type="tel" defaultValue={user.whatsapp ?? ''} errors={state.errors?.whatsapp} />
      </div>
      <Input label="Email" name="email" type="email" defaultValue={user.email ?? ''} errors={state.errors?.email} />
      <Input label="Adresse" name="address" defaultValue={user.address ?? ''} errors={state.errors?.address} />
      <SubmitButton>Enregistrer</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useFormState(changePasswordAction, EMPTY_ACTION_STATE);
  return (
    <form action={action} noValidate>
      <FormAlert state={state} />
      <Input
        label="Mot de passe actuel"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        errors={state.errors?.currentPassword}
        required
      />
      <Input
        label="Nouveau mot de passe"
        name="password"
        type="password"
        autoComplete="new-password"
        errors={state.errors?.password}
        required
      />
      <Input
        label="Confirmer le nouveau mot de passe"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        errors={state.errors?.confirmPassword}
        required
      />
      <SubmitButton variant="outline">Modifier le mot de passe</SubmitButton>
    </form>
  );
}
