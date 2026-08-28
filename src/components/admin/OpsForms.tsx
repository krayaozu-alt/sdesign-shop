'use client';

import { useFormState } from 'react-dom';
import { FormAlert, Input, Select, SubmitButton, Textarea } from '@/components/ui/form';
import {
  APPOINTMENT_STATUS_LABELS,
  ATTENDANCE_STATUS_LABELS,
  ENROLLMENT_STATUS_LABELS,
} from '@/lib/constants';
import { toDateInput, toDateTimeLocal } from '@/lib/format';
import { EMPTY_ACTION_STATE } from '@/lib/validation';
import { saveAppointmentAction, saveAttendanceAction, saveEnrollmentAction } from '@/server/actions/operations';

export function EnrollmentForm({
  students,
  courses,
  enrollment,
}: {
  students: { id: string; label: string }[];
  courses: { id: string; label: string; price: number }[];
  enrollment: {
    id: string;
    studentId: string;
    courseId: string;
    sessionId: string | null;
    status: string;
    progress: number;
    amountDue: number;
    notes: string | null;
  } | null;
}) {
  const [state, action] = useFormState(saveEnrollmentAction, EMPTY_ACTION_STATE);
  return (
    <form action={action} noValidate className="surface p-5">
      <FormAlert state={state} />
      {enrollment ? <input type="hidden" name="id" value={enrollment.id} /> : null}
      <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
        <Select label="Élève" name="studentId" defaultValue={enrollment?.studentId ?? ''} errors={state.errors?.studentId} required>
          <option value="">Sélectionner…</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
        <Select label="Formation" name="courseId" defaultValue={enrollment?.courseId ?? ''} errors={state.errors?.courseId} required>
          <option value="">Sélectionner…</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-0 sm:grid-cols-3 sm:gap-4">
        <Select label="Statut" name="status" defaultValue={enrollment?.status ?? 'EN_ATTENTE'}>
          {Object.entries(ENROLLMENT_STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <Input label="Progression (%)" name="progress" type="number" min={0} max={100} defaultValue={enrollment?.progress ?? 0} />
        <Input label="Montant dû (FCFA)" name="amountDue" type="number" min={0} step={500} defaultValue={enrollment?.amountDue ?? 0} />
      </div>
      <Textarea label="Notes" name="notes" rows={2} defaultValue={enrollment?.notes ?? ''} />
      <SubmitButton>{enrollment ? 'Enregistrer' : 'Créer l’inscription'}</SubmitButton>
    </form>
  );
}

export function AttendanceForm({ enrollmentId }: { enrollmentId: string }) {
  const [state, action] = useFormState(saveAttendanceAction, EMPTY_ACTION_STATE);
  return (
    <form action={action} noValidate className="surface p-4">
      <FormAlert state={state} />
      <input type="hidden" name="enrollmentId" value={enrollmentId} />
      <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
        <Input label="Date" name="date" type="date" defaultValue={toDateInput(new Date())} required />
        <Select label="Statut" name="status" defaultValue="PRESENT">
          {Object.entries(ATTENDANCE_STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </div>
      <Input label="Remarque" name="note" />
      <SubmitButton variant="outline">Enregistrer la présence</SubmitButton>
    </form>
  );
}

export function AppointmentForm({
  customers,
  services,
  staff,
  appointment,
}: {
  customers: { id: string; label: string }[];
  services: { id: string; label: string; price: number; duration: number }[];
  staff: { id: string; label: string }[];
  appointment: {
    id: string;
    customerId: string;
    serviceId: string;
    staffUserId: string | null;
    scheduledAt: Date;
    durationMinutes: number;
    status: string;
    amountDue: number;
    notes: string | null;
  } | null;
}) {
  const [state, action] = useFormState(saveAppointmentAction, EMPTY_ACTION_STATE);
  return (
    <form action={action} noValidate className="surface p-5">
      <FormAlert state={state} />
      {appointment ? <input type="hidden" name="id" value={appointment.id} /> : null}
      <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
        <Select label="Cliente" name="customerId" defaultValue={appointment?.customerId ?? ''} errors={state.errors?.customerId} required>
          <option value="">Sélectionner…</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
        <Select label="Prestation" name="serviceId" defaultValue={appointment?.serviceId ?? ''} errors={state.errors?.serviceId} required>
          <option value="">Sélectionner…</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
        <Input
          label="Date et heure"
          name="scheduledAt"
          type="datetime-local"
          defaultValue={toDateTimeLocal(appointment?.scheduledAt ?? new Date())}
          errors={state.errors?.scheduledAt}
          required
        />
        <Input label="Durée (minutes)" name="durationMinutes" type="number" min={5} step={5} defaultValue={appointment?.durationMinutes ?? 60} />
      </div>
      <div className="grid gap-0 sm:grid-cols-3 sm:gap-4">
        <Select label="Statut" name="status" defaultValue={appointment?.status ?? 'EN_ATTENTE'}>
          {Object.entries(APPOINTMENT_STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <Select label="Employée assignée" name="staffUserId" defaultValue={appointment?.staffUserId ?? ''}>
          <option value="">Non assignée</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
        <Input label="Montant dû (FCFA)" name="amountDue" type="number" min={0} step={500} defaultValue={appointment?.amountDue ?? 0} />
      </div>
      <Textarea label="Notes" name="notes" rows={2} defaultValue={appointment?.notes ?? ''} />
      <SubmitButton>{appointment ? 'Enregistrer' : 'Créer le rendez-vous'}</SubmitButton>
    </form>
  );
}
