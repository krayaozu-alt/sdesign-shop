'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { FormAlert, Input, SubmitButton } from '@/components/ui/form';
import { EMPTY_ACTION_STATE, type ActionState } from '@/lib/validation';
import {
  inscriptionClienteAction,
  motDePasseOublieAction,
  reinitialiserMotDePasseAction,
  renvoyerCodeAction,
  verifierEmailAction,
} from '@/server/actions/account';

/* --------------------------------------------------------------- INSCRIPTION */

export function InscriptionClienteForm() {
  const [state, action] = useFormState(inscriptionClienteAction, EMPTY_ACTION_STATE);
  return (
    <form action={action} noValidate>
      <FormAlert state={state} />
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Input label="Prénom" name="firstName" autoComplete="given-name" errors={state.errors?.firstName} required />
        <Input label="Nom" name="lastName" autoComplete="family-name" errors={state.errors?.lastName} required />
      </div>
      <Input
        label="Adresse e-mail"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="vous@exemple.com"
        hint="Un code de vérification vous sera envoyé à cette adresse."
        errors={state.errors?.email}
        required
      />
      <Input
        label="Téléphone"
        name="phone"
        type="tel"
        autoComplete="tel"
        placeholder="+226 70 00 00 00"
        errors={state.errors?.phone}
        required
      />
      <Input
        label="Mot de passe"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="8 caractères minimum, avec au moins une lettre et un chiffre."
        errors={state.errors?.password}
        required
      />
      <Input
        label="Confirmer le mot de passe"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        errors={state.errors?.confirmPassword}
        required
      />
      <SubmitButton className="w-full" pendingLabel="Création du compte…">
        Créer mon compte
      </SubmitButton>
      <p className="mt-5 text-center text-sm text-cream-muted">
        Déjà inscrite ?{' '}
        <Link href="/connexion" className="text-gold-300 hover:text-gold-200">
          Se connecter
        </Link>
      </p>
    </form>
  );
}

/* ------------------------------------------------------- SAISIE DU CODE (OTP) */

const LONGUEUR = 6;

/** Six cases indépendantes, regroupées dans un champ caché `code`. */
function ChampsCode({ errors }: { errors?: string[] }) {
  const [chiffres, setChiffres] = useState<string[]>(Array(LONGUEUR).fill(''));
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  function ecrire(index: number, valeur: string) {
    const propre = valeur.replace(/\D/g, '');
    if (!propre) {
      setChiffres((prec) => prec.map((c, i) => (i === index ? '' : c)));
      return;
    }
    setChiffres((prec) => {
      const suivant = [...prec];
      // Un collage de plusieurs chiffres remplit les cases suivantes.
      for (let i = 0; i < propre.length && index + i < LONGUEUR; i += 1) {
        suivant[index + i] = propre[i];
      }
      return suivant;
    });
    const cible = Math.min(index + propre.length, LONGUEUR - 1);
    refs.current[cible]?.focus();
  }

  function touche(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !chiffres[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowLeft' && index > 0) refs.current[index - 1]?.focus();
    if (event.key === 'ArrowRight' && index < LONGUEUR - 1) refs.current[index + 1]?.focus();
  }

  return (
    <div className="mb-4">
      <span className="mb-2 block text-sm text-cream-muted">Code de vérification</span>
      <div className="flex justify-between gap-2" dir="ltr">
        {chiffres.map((chiffre, index) => (
          <input
            key={index}
            ref={(el) => {
              refs.current[index] = el;
            }}
            value={chiffre}
            onChange={(e) => ecrire(index, e.target.value)}
            onKeyDown={(e) => touche(index, e)}
            onFocus={(e) => e.currentTarget.select()}
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            maxLength={LONGUEUR}
            aria-label={`Chiffre ${index + 1}`}
            className="h-14 w-full min-w-0 rounded-xl text-center font-display text-2xl tracking-widest"
            style={{ padding: 0 }}
          />
        ))}
      </div>
      <input type="hidden" name="code" value={chiffres.join('')} />
      {errors?.length ? <p className="mt-2 text-xs text-red-300">{errors[0]}</p> : null}
    </div>
  );
}

/** Bouton de renvoi avec compte à rebours anti-spam. */
function BoutonRenvoi({ delaiInitial }: { delaiInitial: number }) {
  const [restant, setRestant] = useState(delaiInitial);
  const [message, setMessage] = useState<ActionState | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const { pending } = useFormStatus();

  useEffect(() => {
    if (restant <= 0) return;
    const timer = setInterval(() => setRestant((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [restant]);

  async function renvoyer() {
    setEnvoi(true);
    const resultat = await renvoyerCodeAction(EMPTY_ACTION_STATE);
    setMessage(resultat);
    setEnvoi(false);
    setRestant(resultat.ok ? 60 : 15);
  }

  return (
    <div className="mt-5 text-center text-sm">
      {message ? (
        <p className={message.ok ? 'mb-2 text-emerald-200' : 'mb-2 text-red-200'} role="status">
          {message.message}
        </p>
      ) : null}
      {restant > 0 ? (
        <p className="text-cream-dim">
          Renvoyer le code dans <span className="text-gold-300">{restant}s</span>
        </p>
      ) : (
        <button
          type="button"
          onClick={renvoyer}
          disabled={envoi || pending}
          className="text-gold-300 underline-offset-4 hover:text-gold-200 hover:underline disabled:opacity-50"
        >
          {envoi ? 'Envoi…' : 'Renvoyer le code'}
        </button>
      )}
    </div>
  );
}

export function VerificationEmailForm({ delaiRenvoi }: { delaiRenvoi: number }) {
  const [state, action] = useFormState(verifierEmailAction, EMPTY_ACTION_STATE);
  return (
    <form action={action} noValidate>
      <FormAlert state={state} />
      <ChampsCode errors={state.errors?.code} />
      <SubmitButton className="w-full" pendingLabel="Vérification…">
        Vérifier mon e-mail
      </SubmitButton>
      <BoutonRenvoi delaiInitial={delaiRenvoi} />
    </form>
  );
}

/* ----------------------------------------------------- MOT DE PASSE OUBLIÉ */

export function MotDePasseOublieForm() {
  const [state, action] = useFormState(motDePasseOublieAction, EMPTY_ACTION_STATE);
  return (
    <form action={action} noValidate>
      <FormAlert state={state} />
      <Input
        label="Adresse e-mail"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="vous@exemple.com"
        errors={state.errors?.email}
        required
      />
      <SubmitButton className="w-full" pendingLabel="Envoi…">
        Recevoir un code
      </SubmitButton>
      <p className="mt-5 text-center text-sm text-cream-muted">
        <Link href="/connexion" className="text-gold-300 hover:text-gold-200">
          Retour à la connexion
        </Link>
      </p>
    </form>
  );
}

export function ReinitialisationForm({ delaiRenvoi }: { delaiRenvoi: number }) {
  const [state, action] = useFormState(reinitialiserMotDePasseAction, EMPTY_ACTION_STATE);
  return (
    <form action={action} noValidate>
      <FormAlert state={state} />
      <ChampsCode errors={state.errors?.code} />
      <Input
        label="Nouveau mot de passe"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="8 caractères minimum, avec au moins une lettre et un chiffre."
        errors={state.errors?.password}
        required
      />
      <Input
        label="Confirmer le mot de passe"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        errors={state.errors?.confirmPassword}
        required
      />
      <SubmitButton className="w-full" pendingLabel="Modification…">
        Définir mon nouveau mot de passe
      </SubmitButton>
      <BoutonRenvoi delaiInitial={delaiRenvoi} />
    </form>
  );
}
