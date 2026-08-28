'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useFormState } from 'react-dom';
import { CalendarCheck, ChevronRight, Clock } from 'lucide-react';
import { FormAlert, Input, SubmitButton, Textarea } from '@/components/ui/form';
import { Card, Media } from '@/components/ui/primitives';
import { Stepper } from '@/components/ui/Stepper';
import { formatDuration, formatMoney, priceLabel } from '@/lib/format';
import { cn } from '@/lib/utils';
import { EMPTY_ACTION_STATE } from '@/lib/validation';
import { createAppointmentAction } from '@/server/actions/appointments';

export type BookingService = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  durationMinutes: number;
  imageUrl: string | null;
};

const STEPS = ['Prestation', 'Date', 'Heure', 'Infos'];

export function BookingWizard({
  services,
  slots,
  minDate,
  preselectedSlug,
  currentUser,
}: {
  services: BookingService[];
  slots: string[];
  minDate: string;
  preselectedSlug?: string;
  currentUser: { fullName: string; phone: string; whatsapp: string | null; email: string | null } | null;
}) {
  const preselected = services.find((s) => s.slug === preselectedSlug) ?? null;
  const [state, action] = useFormState(createAppointmentAction, EMPTY_ACTION_STATE);
  const [step, setStep] = useState(preselected ? 1 : 0);
  const [serviceId, setServiceId] = useState(preselected?.id ?? '');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  const service = useMemo(() => services.find((s) => s.id === serviceId) ?? null, [serviceId, services]);

  if (state.ok && state.data) {
    const d = state.data as Record<string, string | number>;
    const when = new Date(String(d.scheduledAt));
    return (
      <Card strong className="p-6 text-center sm:p-10">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-gold-500/40 bg-gold-500/10 text-gold-300">
          <CalendarCheck size={28} />
        </span>
        <h2 className="font-display text-2xl text-cream">Votre réservation a été enregistrée.</h2>
        <p className="mt-2 text-sm text-cream-muted">
          Elle est en attente de confirmation par notre équipe. Vous serez recontactée pour validation.
        </p>

        <dl className="mx-auto mt-6 max-w-sm space-y-2 text-left text-sm">
          <div className="flex justify-between gap-3 border-b border-white/8 pb-2">
            <dt className="text-cream-dim">Numéro de réservation</dt>
            <dd className="font-semibold text-gold-300">{String(d.reference)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-white/8 pb-2">
            <dt className="text-cream-dim">Prestation</dt>
            <dd className="text-cream">{String(d.serviceName)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-white/8 pb-2">
            <dt className="text-cream-dim">Date</dt>
            <dd className="text-cream">{when.toLocaleDateString('fr-FR')}</dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-white/8 pb-2">
            <dt className="text-cream-dim">Heure</dt>
            <dd className="text-cream">
              {when.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-white/8 pb-2">
            <dt className="text-cream-dim">Montant</dt>
            <dd className="text-cream">{formatMoney(Number(d.amount))}</dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/espace/rendez-vous" className="btn-gold">
            Voir mes rendez-vous
          </Link>
          <Link href="/prestations" className="btn-ghost">
            Réserver autre chose
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <Stepper steps={STEPS} current={step} />

      <form action={action} noValidate className="mt-6">
        <input type="hidden" name="serviceId" value={serviceId} />
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="time" value={time} />
        <FormAlert state={state} />

        {/* Etape 1 : prestation */}
        <div className={step === 0 ? 'block' : 'hidden'}>
          <div className="space-y-2">
            {services.map((s) => (
              <button
                type="button"
                key={s.id}
                onClick={() => {
                  setServiceId(s.id);
                  setStep(1);
                }}
                className={cn(
                  'surface flex w-full items-center gap-3 p-3 text-left transition hover:border-gold-500/40',
                  serviceId === s.id && 'border-gold-500/50',
                )}
              >
                <Media src={s.imageUrl} alt={s.name} label={s.name} ratio="aspect-square" className="w-14 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-cream">{s.name}</span>
                  <span className="block truncate text-xs text-cream-muted">{s.description}</span>
                  <span className="mt-0.5 block text-xs text-gold-300">
                    {priceLabel(s.price)} · {formatDuration(s.durationMinutes)}
                  </span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-cream-dim" />
              </button>
            ))}
          </div>
        </div>

        {/* Etape 2 : date */}
        <div className={step === 1 ? 'block' : 'hidden'}>
          <Card>
            {service ? (
              <p className="mb-4 text-sm text-cream-muted">
                Prestation : <span className="text-cream">{service.name}</span> —{' '}
                <span className="text-gold-300">{priceLabel(service.price)}</span>
              </p>
            ) : null}
            <label htmlFor="booking-date">Choisissez une date</label>
            <input
              id="booking-date"
              type="date"
              min={minDate}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setStep(0)} className="btn-ghost flex-1">
                Retour
              </button>
              <button
                type="button"
                disabled={!date}
                onClick={() => setStep(2)}
                className="btn-gold flex-1 disabled:opacity-40"
              >
                Continuer
              </button>
            </div>
          </Card>
        </div>

        {/* Etape 3 : heure */}
        <div className={step === 2 ? 'block' : 'hidden'}>
          <Card>
            <p className="mb-3 flex items-center gap-2 text-sm text-cream">
              <Clock size={16} className="text-gold-400" /> Choisissez un créneau
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {slots.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setTime(s)}
                  className={cn(
                    'rounded-xl border px-2 py-2.5 text-sm transition',
                    time === s
                      ? 'border-transparent bg-gold-gradient font-semibold text-night-900'
                      : 'border-white/12 bg-white/5 text-cream-muted hover:border-gold-500/40',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setStep(1)} className="btn-ghost flex-1">
                Retour
              </button>
              <button
                type="button"
                disabled={!time}
                onClick={() => setStep(3)}
                className="btn-gold flex-1 disabled:opacity-40"
              >
                Continuer
              </button>
            </div>
          </Card>
        </div>

        {/* Etape 4 : informations */}
        <div className={step === 3 ? 'block' : 'hidden'}>
          <Card>
            <div className="mb-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-cream-muted">
              {service?.name} — {date ? new Date(`${date}T00:00:00`).toLocaleDateString('fr-FR') : ''} à {time}
              {service ? ` · ${priceLabel(service.price)}` : ''}
            </div>
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
            <Textarea label="Précision (facultatif)" name="notes" rows={3} errors={state.errors?.notes} />
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(2)} className="btn-ghost flex-1">
                Retour
              </button>
              <SubmitButton className="flex-1" pendingLabel="Envoi…">
                Confirmer la réservation
              </SubmitButton>
            </div>
          </Card>
        </div>
      </form>
    </div>
  );
}
