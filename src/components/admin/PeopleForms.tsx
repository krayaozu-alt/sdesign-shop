'use client';

import { useFormState } from 'react-dom';
import { Checkbox, FormAlert, Input, Select, SubmitButton, Textarea } from '@/components/ui/form';
import { ROLE_LABELS } from '@/lib/constants';
import { toDateInput } from '@/lib/format';
import { EMPTY_ACTION_STATE } from '@/lib/validation';
import { saveCustomerAction, saveStudentAction, saveTrainerAction, saveUserAction } from '@/server/actions/people';

export function CustomerForm({
  customer,
}: {
  customer: {
    id: string;
    fullName: string;
    phone: string;
    whatsapp: string | null;
    email: string | null;
    address: string | null;
    notes: string | null;
  } | null;
}) {
  const [state, action] = useFormState(saveCustomerAction, EMPTY_ACTION_STATE);
  return (
    <form action={action} noValidate className="surface p-5">
      <FormAlert state={state} />
      {customer ? <input type="hidden" name="id" value={customer.id} /> : null}
      <Input label="Nom complet" name="fullName" defaultValue={customer?.fullName ?? ''} errors={state.errors?.fullName} required />
      <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
        <Input label="Téléphone" name="phone" type="tel" defaultValue={customer?.phone ?? ''} errors={state.errors?.phone} required />
        <Input label="WhatsApp" name="whatsapp" type="tel" defaultValue={customer?.whatsapp ?? ''} errors={state.errors?.whatsapp} />
      </div>
      <Input label="Email" name="email" type="email" defaultValue={customer?.email ?? ''} errors={state.errors?.email} />
      <Input label="Adresse" name="address" defaultValue={customer?.address ?? ''} />
      <Textarea label="Notes internes" name="notes" rows={3} defaultValue={customer?.notes ?? ''} />
      <SubmitButton>{customer ? 'Enregistrer' : 'Ajouter la cliente'}</SubmitButton>
    </form>
  );
}

export function StudentForm({
  student,
}: {
  student: {
    id: string;
    fullName: string;
    phone: string;
    whatsapp: string | null;
    email: string | null;
    birthDate: Date | null;
    address: string | null;
    emergencyContact: string | null;
    notes: string | null;
  } | null;
}) {
  const [state, action] = useFormState(saveStudentAction, EMPTY_ACTION_STATE);
  return (
    <form action={action} noValidate className="surface p-5">
      <FormAlert state={state} />
      {student ? <input type="hidden" name="id" value={student.id} /> : null}
      <Input label="Nom complet" name="fullName" defaultValue={student?.fullName ?? ''} errors={state.errors?.fullName} required />
      <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
        <Input label="Téléphone" name="phone" type="tel" defaultValue={student?.phone ?? ''} errors={state.errors?.phone} required />
        <Input label="WhatsApp" name="whatsapp" type="tel" defaultValue={student?.whatsapp ?? ''} />
      </div>
      <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
        <Input label="Email" name="email" type="email" defaultValue={student?.email ?? ''} errors={state.errors?.email} />
        <Input label="Date de naissance" name="birthDate" type="date" defaultValue={toDateInput(student?.birthDate ?? null)} />
      </div>
      <Input label="Adresse" name="address" defaultValue={student?.address ?? ''} />
      <Input label="Contact d’urgence" name="emergencyContact" defaultValue={student?.emergencyContact ?? ''} />
      <Textarea label="Notes internes" name="notes" rows={3} defaultValue={student?.notes ?? ''} />
      <Input
        label={student ? 'Nouveau mot de passe (facultatif)' : 'Mot de passe initial (facultatif)'}
        name="password"
        type="password"
        hint={student ? 'Laissez vide pour ne pas le changer.' : 'Par défaut : les 6 derniers chiffres du téléphone.'}
      />
      <SubmitButton>{student ? 'Enregistrer' : 'Créer la fiche élève'}</SubmitButton>
    </form>
  );
}

export function TrainerForm({
  trainer,
}: {
  trainer: {
    id: string;
    fullName: string;
    speciality: string;
    phone: string | null;
    whatsapp: string | null;
    bio: string | null;
    availability: string | null;
    isActive: boolean;
  } | null;
}) {
  const [state, action] = useFormState(saveTrainerAction, EMPTY_ACTION_STATE);
  return (
    <form action={action} noValidate className="surface p-5">
      <FormAlert state={state} />
      {trainer ? <input type="hidden" name="id" value={trainer.id} /> : null}
      <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
        <Input label="Nom complet" name="fullName" defaultValue={trainer?.fullName ?? ''} errors={state.errors?.fullName} required />
        <Input label="Spécialité" name="speciality" defaultValue={trainer?.speciality ?? ''} errors={state.errors?.speciality} required />
      </div>
      <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
        <Input label="Téléphone" name="phone" type="tel" defaultValue={trainer?.phone ?? ''} />
        <Input label="WhatsApp" name="whatsapp" type="tel" defaultValue={trainer?.whatsapp ?? ''} />
      </div>
      <Input label="Disponibilité" name="availability" placeholder="Lundi - Samedi, 08h - 18h" defaultValue={trainer?.availability ?? ''} />
      <Textarea label="Présentation" name="bio" rows={3} defaultValue={trainer?.bio ?? ''} />
      <Input label="Photo" name="photo" type="file" accept="image/*" />
      <Checkbox label="Formateur actif" name="isActive" defaultChecked={trainer?.isActive ?? true} />
      <SubmitButton>{trainer ? 'Enregistrer' : 'Ajouter le formateur'}</SubmitButton>
    </form>
  );
}

export function UserForm({
  user,
  currentUserId,
}: {
  user: {
    id: string;
    fullName: string;
    phone: string;
    whatsapp: string | null;
    email: string | null;
    role: string;
    isActive: boolean;
  } | null;
  currentUserId: string;
}) {
  const [state, action] = useFormState(saveUserAction, EMPTY_ACTION_STATE);
  const isSelf = user?.id === currentUserId;
  return (
    <form action={action} noValidate className="surface p-5">
      <FormAlert state={state} />
      {user ? <input type="hidden" name="id" value={user.id} /> : null}
      <Input label="Nom complet" name="fullName" defaultValue={user?.fullName ?? ''} errors={state.errors?.fullName} required />
      <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
        <Input label="Téléphone" name="phone" type="tel" defaultValue={user?.phone ?? ''} errors={state.errors?.phone} required />
        <Input label="WhatsApp" name="whatsapp" type="tel" defaultValue={user?.whatsapp ?? ''} />
      </div>
      <Input label="Email" name="email" type="email" defaultValue={user?.email ?? ''} errors={state.errors?.email} />
      <Select label="Rôle" name="role" defaultValue={user?.role ?? 'EMPLOYE'} disabled={isSelf}>
        {Object.entries(ROLE_LABELS).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </Select>
      {isSelf ? <input type="hidden" name="role" value={user?.role ?? ''} /> : null}
      <Input
        label={user ? 'Nouveau mot de passe (facultatif)' : 'Mot de passe'}
        name="password"
        type="password"
        required={!user}
        hint={user ? 'Laissez vide pour ne pas le changer.' : '6 caractères minimum.'}
      />
      <Checkbox label="Compte actif" name="isActive" defaultChecked={user?.isActive ?? true} />
      <SubmitButton>{user ? 'Enregistrer' : 'Créer l’utilisateur'}</SubmitButton>
    </form>
  );
}
