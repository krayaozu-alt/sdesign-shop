'use client';

import { useFormState } from 'react-dom';
import { FormAlert, Input, SubmitButton } from '@/components/ui/form';
import { EMPTY_ACTION_STATE } from '@/lib/validation';
import { rejoindreListeAttenteAction } from '@/server/actions/waitlist';

/**
 * Demande d'information pour une session complete.
 * Le formulaire disparait une fois la demande enregistree : rien ne pousse a
 * s'inscrire deux fois.
 */
export function FormulaireListeAttente({
  sessionId,
  valeursParDefaut,
}: {
  sessionId: string;
  valeursParDefaut?: { fullName?: string; phone?: string; email?: string };
}) {
  const [state, action] = useFormState(rejoindreListeAttenteAction, EMPTY_ACTION_STATE);

  if (state.ok) {
    return (
      <div
        className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100"
        role="status"
      >
        {state.message}
      </div>
    );
  }

  return (
    <form action={action} noValidate>
      <FormAlert state={state} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <Input
        label="Nom complet"
        name="fullName"
        defaultValue={valeursParDefaut?.fullName}
        errors={state.errors?.fullName}
        required
      />
      <Input
        label="Téléphone"
        name="phone"
        type="tel"
        placeholder="+226 70 00 00 00"
        defaultValue={valeursParDefaut?.phone}
        errors={state.errors?.phone}
        required
      />
      <Input
        label="Adresse e-mail (facultatif)"
        name="email"
        type="email"
        defaultValue={valeursParDefaut?.email}
        errors={state.errors?.email}
      />
      <SubmitButton className="w-full" variant="outline" pendingLabel="Enregistrement…">
        Être informée
      </SubmitButton>
    </form>
  );
}
