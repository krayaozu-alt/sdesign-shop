'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useFormState } from 'react-dom';
import { CheckCircle2, CreditCard, User } from 'lucide-react';
import { FormAlert, Input, Select, SubmitButton, Textarea } from '@/components/ui/form';
import { Card } from '@/components/ui/primitives';
import { Stepper } from '@/components/ui/Stepper';
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/constants';
import { formatMoney } from '@/lib/format';
import { EMPTY_ACTION_STATE } from '@/lib/validation';
import { createEnrollmentAction } from '@/server/actions/enrollments';

type Props = {
  course: { id: string; name: string; price: number; depositAmount: number; durationLabel: string; slug: string };
  methods: PaymentMethod[];
  currentUser: { fullName: string; phone: string; whatsapp: string | null; email: string | null } | null;
  /** Session visee, lorsque l'inscription part d'une date precise. */
  session?: { id: string; titre: string; periode: string; prix: number } | null;
};

const STEPS = ['Formation', 'Informations', 'Paiement', 'Confirmation'];

export function EnrollmentWizard({ course, methods, currentUser, session }: Props) {
  const [state, action] = useFormState(createEnrollmentAction, EMPTY_ACTION_STATE);
  const [step, setStep] = useState(0);

  // Etape de confirmation : rendue apres succes du server action
  if (state.ok && state.data) {
    const d = state.data as Record<string, string | number | null>;
    return (
      <Card strong className="p-6 text-center sm:p-10">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-gold-500/40 bg-gold-500/10 text-gold-300">
          <CheckCircle2 size={28} />
        </span>
        <h2 className="font-display text-2xl text-cream">Inscription enregistrée</h2>
        <p className="mt-2 text-sm text-cream-muted">
          Merci ! Votre demande d’inscription a bien été prise en compte. Notre équipe vous contactera pour finaliser.
        </p>

        <dl className="mx-auto mt-6 max-w-sm space-y-2 text-left text-sm">
          <div className="flex justify-between gap-3 border-b border-white/8 pb-2">
            <dt className="text-cream-dim">Numéro d’inscription</dt>
            <dd className="font-semibold text-gold-300">{String(d.reference)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-white/8 pb-2">
            <dt className="text-cream-dim">Formation</dt>
            <dd className="text-cream">{String(d.courseName)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-white/8 pb-2">
            <dt className="text-cream-dim">Montant total</dt>
            <dd className="text-cream">{formatMoney(Number(d.price))}</dd>
          </div>
          {Number(d.deposit) > 0 ? (
            <div className="flex justify-between gap-3 border-b border-white/8 pb-2">
              <dt className="text-cream-dim">Acompte annoncé</dt>
              <dd className="text-cream">{formatMoney(Number(d.deposit))}</dd>
            </div>
          ) : null}
        </dl>

        {Number(d.deposit) > 0 ? (
          <p className="mx-auto mt-4 max-w-sm rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-xs text-amber-100">
            L’acompte est enregistré <strong>en attente de confirmation</strong>. Il ne sera validé qu’après
            encaissement effectif par la boutique, qui vous remettra alors un reçu.
          </p>
        ) : null}

        {d.tempPassword ? (
          <div className="mx-auto mt-4 max-w-sm rounded-xl border border-gold-500/30 bg-gold-500/10 px-4 py-3 text-xs text-gold-100">
            Un espace élève a été créé pour vous.
            <br />
            Identifiant : <strong>{String(d.phone)}</strong>
            <br />
            Mot de passe provisoire : <strong className="tracking-widest">{String(d.tempPassword)}</strong>
            <br />
            <span className="text-gold-200/80">Notez-le : il ne sera plus affiché. Changez-le après connexion.</span>
          </div>
        ) : (
          <p className="mx-auto mt-4 max-w-sm text-xs text-cream-dim">
            Retrouvez le suivi de votre formation dans votre espace élève.
          </p>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/connexion" className="btn-gold">
            Accéder à mon espace
          </Link>
          <Link href="/formations" className="btn-ghost">
            Voir les autres formations
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <Stepper steps={STEPS} current={step} />

      <form action={action} noValidate className="mt-6">
        <input type="hidden" name="courseId" value={course.id} />
        {/* Session visee : le dossier conserve courseId ET sessionId. */}
        {session ? <input type="hidden" name="sessionId" value={session.id} /> : null}

        {session ? (
          <div className="mb-5 rounded-xl border border-gold-500/25 bg-gold-500/10 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-gold-300">Session choisie</p>
            <p className="mt-1 text-sm text-cream">{session.titre}</p>
            <p className="text-xs text-cream-muted">{session.periode}</p>
          </div>
        ) : null}
        <FormAlert state={state} />

        {/* ---------------------------------------------- Etape 1 : formation */}
        <div className={step === 0 ? 'block' : 'hidden'}>
          <Card>
            <p className="label-eyebrow mb-2">Formation choisie</p>
            <h2 className="font-display text-xl text-cream">{course.name}</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-cream-dim">Durée</dt>
                <dd className="text-cream">{course.durationLabel}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-cream-dim">Montant total</dt>
                <dd className="font-semibold text-gold-300">{formatMoney(course.price)}</dd>
              </div>
              {course.depositAmount > 0 ? (
                <div className="flex justify-between">
                  <dt className="text-cream-dim">Acompte conseillé</dt>
                  <dd className="text-cream">{formatMoney(course.depositAmount)}</dd>
                </div>
              ) : null}
            </dl>
            <div className="mt-5 flex gap-2">
              <Link href={`/formations/${course.slug}`} className="btn-ghost flex-1">
                Revoir le détail
              </Link>
              <button type="button" onClick={() => setStep(1)} className="btn-gold flex-1">
                Continuer
              </button>
            </div>
          </Card>
        </div>

        {/* ------------------------------------------ Etape 2 : informations */}
        <div className={step === 1 ? 'block' : 'hidden'}>
          <Card>
            <p className="mb-4 flex items-center gap-2 text-sm text-cream">
              <User size={16} className="text-gold-400" /> Vos informations
            </p>
            <Input
              label="Nom complet"
              name="fullName"
              defaultValue={currentUser?.fullName ?? ''}
              errors={state.errors?.fullName}
              required
            />
            <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
              <Input
                label="Téléphone"
                name="phone"
                type="tel"
                placeholder="+226 70 00 00 00"
                defaultValue={currentUser?.phone ?? ''}
                errors={state.errors?.phone}
                required
              />
              <Input
                label="WhatsApp"
                name="whatsapp"
                type="tel"
                defaultValue={currentUser?.whatsapp ?? ''}
                errors={state.errors?.whatsapp}
              />
            </div>
            <Input
              label="Email (facultatif)"
              name="email"
              type="email"
              defaultValue={currentUser?.email ?? ''}
              errors={state.errors?.email}
            />
            <Input
              label="Date de début souhaitée (facultatif)"
              name="desiredDate"
              type="date"
              errors={state.errors?.desiredDate}
            />
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => setStep(0)} className="btn-ghost flex-1">
                Retour
              </button>
              <button type="button" onClick={() => setStep(2)} className="btn-gold flex-1">
                Continuer
              </button>
            </div>
          </Card>
        </div>

        {/* --------------------------------------------- Etape 3 : paiement */}
        <div className={step === 2 ? 'block' : 'hidden'}>
          <Card>
            <p className="mb-4 flex items-center gap-2 text-sm text-cream">
              <CreditCard size={16} className="text-gold-400" /> Acompte et règlement
            </p>
            <Input
              label="Acompte que vous souhaitez verser (FCFA)"
              name="depositAmount"
              type="number"
              min={0}
              max={course.price}
              step={500}
              defaultValue={course.depositAmount || 0}
              hint="Laissez 0 si vous préférez régler sur place. Aucun paiement n’est prélevé en ligne."
              errors={state.errors?.depositAmount}
            />
            <Select label="Moyen de règlement prévu" name="paymentMethod" defaultValue={methods[0] ?? 'ESPECES'}>
              {methods.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m]}
                </option>
              ))}
            </Select>
            <Textarea
              label="Message ou précision (facultatif)"
              name="notes"
              rows={3}
              errors={state.errors?.notes}
            />
            <p className="mb-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-cream-muted">
              Le règlement s’effectue auprès de {`la boutique`} (espèces ou dépôt mobile money). Votre acompte sera
              confirmé et un reçu officiel vous sera remis après encaissement.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(1)} className="btn-ghost flex-1">
                Retour
              </button>
              <SubmitButton className="flex-1" pendingLabel="Envoi…">
                Confirmer l’inscription
              </SubmitButton>
            </div>
          </Card>
        </div>
      </form>
    </div>
  );
}
