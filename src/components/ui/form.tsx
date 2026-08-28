'use client';

import { useFormStatus } from 'react-dom';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { ActionState } from '@/lib/validation';

export function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="mt-1 text-xs text-red-300">{errors[0]}</p>;
}

export function Field({
  label,
  name,
  errors,
  hint,
  children,
  className,
}: {
  label?: string;
  name?: string;
  errors?: string[];
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-4', className)}>
      {label ? <label htmlFor={name}>{label}</label> : null}
      {children}
      {hint ? <p className="mt-1 text-xs text-cream-dim">{hint}</p> : null}
      <FieldError errors={errors} />
    </div>
  );
}

export function Input({
  label,
  name,
  errors,
  hint,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; errors?: string[]; hint?: string }) {
  return (
    <Field label={label} name={name} errors={errors} hint={hint}>
      <input id={name} name={name} className={cn(errors?.length && 'border-red-400/50', className)} {...props} />
    </Field>
  );
}

export function Textarea({
  label,
  name,
  errors,
  hint,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; errors?: string[]; hint?: string }) {
  return (
    <Field label={label} name={name} errors={errors} hint={hint}>
      <textarea id={name} name={name} rows={4} className={cn(errors?.length && 'border-red-400/50', className)} {...props} />
    </Field>
  );
}

export function Select({
  label,
  name,
  errors,
  hint,
  children,
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; errors?: string[]; hint?: string }) {
  return (
    <Field label={label} name={name} errors={errors} hint={hint}>
      <select id={name} name={name} className={cn(errors?.length && 'border-red-400/50', className)} {...props}>
        {children}
      </select>
    </Field>
  );
}

export function Checkbox({
  label,
  name,
  defaultChecked,
  value = 'true',
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
  value?: string;
}) {
  return (
    <label className="mb-4 flex cursor-pointer items-center gap-3 text-sm text-cream">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="h-4 w-4 shrink-0 accent-[#D4AF37]"
        style={{ width: '1rem', padding: 0 }}
      />
      {label}
    </label>
  );
}

export function SubmitButton({
  children,
  className,
  variant = 'gold',
  pendingLabel = 'Traitement…',
}: {
  children: ReactNode;
  className?: string;
  variant?: 'gold' | 'outline' | 'ghost' | 'danger';
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  const variantClass =
    variant === 'gold'
      ? 'btn-gold'
      : variant === 'outline'
        ? 'btn-outline'
        : variant === 'danger'
          ? 'btn-danger'
          : 'btn-ghost';
  return (
    <button type="submit" disabled={pending} className={cn(variantClass, className)}>
      {pending ? pendingLabel : children}
    </button>
  );
}

export function FormAlert({ state }: { state: ActionState }) {
  if (!state?.message) return null;
  return (
    <div
      className={cn(
        'mb-4 rounded-xl border px-4 py-3 text-sm',
        state.ok
          ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
          : 'border-red-400/30 bg-red-400/10 text-red-100',
      )}
      role="status"
    >
      {state.message}
    </div>
  );
}
