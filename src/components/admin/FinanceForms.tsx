'use client';

import Link from 'next/link';
import { useFormState } from 'react-dom';
import { FormAlert, Input, Select, SubmitButton, Textarea } from '@/components/ui/form';
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, type PaymentMethod } from '@/lib/constants';
import { toDateInput } from '@/lib/format';
import { EMPTY_ACTION_STATE } from '@/lib/validation';
import { generateCertificateAction, recordPaymentAction } from '@/server/actions/finance';

export function PaymentForm({
  methods,
  enrollments,
  appointments,
  defaultEnrollmentId,
}: {
  methods: PaymentMethod[];
  enrollments: { id: string; label: string; balance: number }[];
  appointments: { id: string; label: string; balance: number }[];
  defaultEnrollmentId?: string;
}) {
  const [state, action] = useFormState(recordPaymentAction, EMPTY_ACTION_STATE);
  const receipt = state.ok ? (state.data?.receiptNumber as string | null) : null;

  return (
    <form action={action} noValidate className="surface p-5">
      <FormAlert state={state} />
      {receipt ? (
        <Link href={`/recu/${receipt}`} className="btn-outline mb-4 w-full">
          Ouvrir le reçu {receipt}
        </Link>
      ) : null}

      <Input label="Libellé" name="label" placeholder="Acompte formation Onglerie" errors={state.errors?.label} required />

      <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
        <Select label="Rattacher à une inscription" name="enrollmentId" defaultValue={defaultEnrollmentId ?? ''}>
          <option value="">Aucune</option>
          {enrollments.map((e) => (
            <option key={e.id} value={e.id}>
              {e.label}
            </option>
          ))}
        </Select>
        <Select label="Ou à un rendez-vous" name="appointmentId" defaultValue="">
          <option value="">Aucun</option>
          {appointments.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-0 sm:grid-cols-3 sm:gap-4">
        <Input label="Montant (FCFA)" name="amount" type="number" min={1} step={500} errors={state.errors?.amount} required />
        <Select label="Méthode" name="method" defaultValue={methods[0] ?? 'ESPECES'}>
          {methods.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABELS[m]}
            </option>
          ))}
        </Select>
        <Select label="Statut" name="status" defaultValue="PAYE">
          {Object.entries(PAYMENT_STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-0 sm:grid-cols-3 sm:gap-4">
        <Select label="Objet" name="purpose" defaultValue="FORMATION">
          <option value="FORMATION">Formation</option>
          <option value="PRESTATION">Prestation</option>
          <option value="AUTRE">Autre</option>
        </Select>
        <Input label="Référence opérateur" name="providerRef" placeholder="ID transaction mobile money" />
        <Input label="Date d’encaissement" name="paidAt" type="date" defaultValue={toDateInput(new Date())} />
      </div>

      <Textarea label="Notes" name="notes" rows={2} />
      <p className="mb-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-cream-muted">
        Le reçu officiel est généré automatiquement dès que le statut est « Payé ». Les soldes des inscriptions et
        rendez-vous sont recalculés à partir des paiements confirmés.
      </p>
      <SubmitButton>Enregistrer le paiement</SubmitButton>
    </form>
  );
}

export function CertificateForm({
  enrollments,
  defaultSignedBy,
}: {
  enrollments: { id: string; label: string }[];
  defaultSignedBy: string;
}) {
  const [state, action] = useFormState(generateCertificateAction, EMPTY_ACTION_STATE);
  const number = state.ok ? (state.data?.number as string | undefined) : undefined;

  return (
    <form action={action} noValidate className="surface p-5">
      <FormAlert state={state} />
      {number ? (
        <Link href={`/certificat/${number}`} className="btn-outline mb-4 w-full">
          Ouvrir le certificat {number}
        </Link>
      ) : null}

      <Select label="Inscription terminée" name="enrollmentId" defaultValue="" errors={state.errors?.enrollmentId} required>
        <option value="">Sélectionner…</option>
        {enrollments.map((e) => (
          <option key={e.id} value={e.id}>
            {e.label}
          </option>
        ))}
      </Select>
      <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
        <Input label="Mention" name="mention" defaultValue="Satisfaisant" />
        <Input label="Signataire" name="signedBy" defaultValue={defaultSignedBy} />
      </div>
      {enrollments.length === 0 ? (
        <p className="mb-4 text-xs text-cream-muted">
          Aucune inscription au statut « Terminée » sans certificat. Marquez d’abord une formation comme terminée.
        </p>
      ) : null}
      <SubmitButton>Générer le certificat</SubmitButton>
    </form>
  );
}
