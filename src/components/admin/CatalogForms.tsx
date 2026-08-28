'use client';

import { useFormState } from 'react-dom';
import { Checkbox, FormAlert, Input, Select, SubmitButton, Textarea } from '@/components/ui/form';
import {
  COURSE_CATEGORIES,
  COURSE_STATUS_LABELS,
  LEVEL_LABELS,
  SERVICE_CATEGORIES,
  SESSION_STATUS,
  SESSION_STATUS_LABELS,
  SESSION_STATUS_MANUELS,
} from '@/lib/constants';
import { toDateInput, toDateTimeLocal } from '@/lib/format';
import { useState } from 'react';
import { EMPTY_ACTION_STATE } from '@/lib/validation';
import { parseJsonArray } from '@/lib/utils';
import { saveCourseAction, saveModuleAction, saveServiceAction, saveSessionAction } from '@/server/actions/catalog';

export type CourseFormValue = {
  id: string;
  name: string;
  category: string;
  shortDescription: string;
  description: string;
  objectives: string;
  requirements: string;
  durationLabel: string;
  durationHours: number;
  level: string;
  price: number;
  depositAmount: number;
  capacity: number;
  startDate: Date | null;
  endDate: Date | null;
  trainerId: string | null;
  status: string;
  isFeatured: boolean;
} | null;

export function CourseForm({
  course,
  trainers,
}: {
  course: CourseFormValue;
  trainers: { id: string; fullName: string }[];
}) {
  const [state, action] = useFormState(saveCourseAction, EMPTY_ACTION_STATE);

  return (
    <form action={action} noValidate className="surface p-5">
      <FormAlert state={state} />
      {course ? <input type="hidden" name="id" value={course.id} /> : null}

      <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
        <Input label="Nom de la formation" name="name" defaultValue={course?.name ?? ''} errors={state.errors?.name} required />
        <Select label="Catégorie" name="category" defaultValue={course?.category ?? COURSE_CATEGORIES[0]} errors={state.errors?.category}>
          {COURSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      <Input
        label="Description courte (affichée dans les listes)"
        name="shortDescription"
        defaultValue={course?.shortDescription ?? ''}
        errors={state.errors?.shortDescription}
        required
      />
      <Textarea label="Description complète" name="description" defaultValue={course?.description ?? ''} errors={state.errors?.description} required />
      <Textarea
        label="Objectifs (une ligne par objectif)"
        name="objectives"
        rows={4}
        defaultValue={course ? parseJsonArray(course.objectives).join('\n') : ''}
      />
      <Textarea
        label="Conditions d’inscription (une ligne par condition)"
        name="requirements"
        rows={3}
        defaultValue={course ? parseJsonArray(course.requirements).join('\n') : ''}
      />

      <div className="grid gap-0 sm:grid-cols-3 sm:gap-4">
        <Input label="Durée (texte)" name="durationLabel" placeholder="2 semaines" defaultValue={course?.durationLabel ?? ''} errors={state.errors?.durationLabel} required />
        <Input label="Volume horaire" name="durationHours" type="number" min={0} defaultValue={course?.durationHours ?? 0} />
        <Select label="Niveau" name="level" defaultValue={course?.level ?? 'DEBUTANT'}>
          {Object.entries(LEVEL_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-0 sm:grid-cols-3 sm:gap-4">
        <Input label="Prix (FCFA)" name="price" type="number" min={0} step={500} defaultValue={course?.price ?? 0} errors={state.errors?.price} required />
        <Input label="Acompte conseillé" name="depositAmount" type="number" min={0} step={500} defaultValue={course?.depositAmount ?? 0} />
        <Input label="Places" name="capacity" type="number" min={1} defaultValue={course?.capacity ?? 12} errors={state.errors?.capacity} required />
      </div>

      <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
        <Input label="Date de début" name="startDate" type="date" defaultValue={toDateInput(course?.startDate ?? null)} />
        <Input label="Date de fin" name="endDate" type="date" defaultValue={toDateInput(course?.endDate ?? null)} />
      </div>

      <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
        <Select label="Formatrice" name="trainerId" defaultValue={course?.trainerId ?? ''}>
          <option value="">À définir</option>
          {trainers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.fullName}
            </option>
          ))}
        </Select>
        <Select label="Statut" name="status" defaultValue={course?.status ?? 'OUVERTE'}>
          {Object.entries(COURSE_STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </div>

      <Input label="Photo de la formation" name="image" type="file" accept="image/*" hint="JPG, PNG ou WEBP — 6 Mo maximum." />
      <Checkbox label="Mettre en avant sur la page d’accueil" name="isFeatured" defaultChecked={course?.isFeatured ?? false} />

      <SubmitButton>{course ? 'Enregistrer les modifications' : 'Créer la formation'}</SubmitButton>
    </form>
  );
}

export function ModuleForm({ courseId }: { courseId: string }) {
  const [state, action] = useFormState(saveModuleAction, EMPTY_ACTION_STATE);
  return (
    <form action={action} noValidate className="surface p-4">
      <FormAlert state={state} />
      <input type="hidden" name="courseId" value={courseId} />
      <Input label="Titre du module" name="title" errors={state.errors?.title} required />
      <Textarea label="Description" name="description" rows={2} />
      <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
        <Input label="Ordre" name="orderIndex" type="number" min={0} defaultValue={0} />
        <Input label="Durée (heures)" name="durationHours" type="number" min={0} defaultValue={0} />
      </div>
      <SubmitButton variant="outline">Ajouter le module</SubmitButton>
    </form>
  );
}

export type SessionFormValue = {
  id: string;
  courseId: string;
  title: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  registrationDeadline: string;
  location: string;
  capacity: number;
  /** Vide lorsque la session suit le prix officiel de la formation. */
  price: string;
  trainerId: string;
  status: string;
  description: string;
  imageUrl: string | null;
} | null;

/**
 * Formulaire de session.
 *
 * `courseId` fige la formation lorsqu'on arrive depuis sa fiche ; sinon la
 * liste `formations` permet de la choisir.
 */
export function SessionForm({
  session,
  courseId,
  formations,
  formateurs,
  prixFormations,
}: {
  session?: SessionFormValue;
  courseId?: string;
  formations?: { id: string; name: string }[];
  formateurs?: { id: string; fullName: string }[];
  prixFormations?: Record<string, number>;
}) {
  const [state, action] = useFormState(saveSessionAction, EMPTY_ACTION_STATE);
  const formationFigee = courseId ?? session?.courseId ?? '';
  const [formationChoisie, setFormationChoisie] = useState(formationFigee);
  const prixOfficiel = prixFormations?.[formationChoisie];

  return (
    <form action={action} noValidate className="surface p-4">
      <FormAlert state={state} />
      {session?.id ? <input type="hidden" name="id" value={session.id} /> : null}

      {courseId || !formations?.length ? (
        <input type="hidden" name="courseId" value={formationFigee} />
      ) : (
        <Select
          label="Formation"
          name="courseId"
          defaultValue={formationFigee}
          errors={state.errors?.courseId}
          onChange={(e) => setFormationChoisie(e.target.value)}
          required
        >
          <option value="">Choisir une formation…</option>
          {formations.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </Select>
      )}

      <Input
        label="Intitulé de la session"
        name="title"
        placeholder="Session de septembre"
        defaultValue={session?.title}
        errors={state.errors?.title}
        required
      />

      <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
        <Input label="Date de début" name="startDate" type="date" defaultValue={session?.startDate} errors={state.errors?.startDate} required />
        <Input label="Heure de début" name="startTime" type="time" defaultValue={session?.startTime ?? '08:00'} />
      </div>
      <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
        <Input label="Date de fin" name="endDate" type="date" defaultValue={session?.endDate} errors={state.errors?.endDate} required />
        <Input label="Heure de fin" name="endTime" type="time" defaultValue={session?.endTime ?? '18:00'} />
      </div>

      <Input
        label="Date limite d’inscription"
        name="registrationDeadline"
        type="date"
        defaultValue={session?.registrationDeadline}
        hint="Facultatif — par défaut, jusqu’au début de la session."
        errors={state.errors?.registrationDeadline}
      />

      <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
        <Input label="Lieu" name="location" placeholder="Salle de formation" defaultValue={session?.location} />
        <Input label="Nombre de places" name="capacity" type="number" min={1} defaultValue={session?.capacity ?? 12} errors={state.errors?.capacity} />
      </div>

      <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
        <Input
          label="Prix de la session"
          name="price"
          type="number"
          min={0}
          defaultValue={session?.price}
          hint={
            prixOfficiel !== undefined
              ? `Laisser vide pour appliquer le prix officiel : ${prixOfficiel.toLocaleString('fr-FR')} FCFA`
              : 'Laisser vide pour appliquer le prix officiel de la formation.'
          }
          errors={state.errors?.price}
        />
        {formateurs?.length ? (
          <Select label="Formateur" name="trainerId" defaultValue={session?.trainerId ?? ''}>
            <option value="">Celui de la formation</option>
            {formateurs.map((f) => (
              <option key={f.id} value={f.id}>
                {f.fullName}
              </option>
            ))}
          </Select>
        ) : null}
      </div>

      <Select label="Statut" name="status" defaultValue={session?.status ?? SESSION_STATUS.BROUILLON} errors={state.errors?.status}>
        {SESSION_STATUS_MANUELS.map((s) => (
          <option key={s} value={s}>
            {SESSION_STATUS_LABELS[s]}
          </option>
        ))}
      </Select>
      <p className="-mt-2 mb-4 text-xs text-cream-dim">
        « Presque complète » et « Complète » s’affichent automatiquement selon le nombre d’inscrites.
      </p>

      <Textarea
        label="Description"
        name="description"
        rows={3}
        defaultValue={session?.description}
        hint="Facultatif — affiché sur la page publique de la session."
      />

      <Input
        label="Photo de la session"
        name="image"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hint={session?.imageUrl ? 'Une photo est déjà associée. En choisir une nouvelle la remplace.' : 'Facultatif — à défaut, la photo de la formation est utilisée.'}
      />

      <SubmitButton variant={session?.id ? 'gold' : 'outline'}>
        {session?.id ? 'Enregistrer la session' : 'Créer la session'}
      </SubmitButton>
    </form>
  );
}

export type ServiceFormValue = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  durationMinutes: number;
  isAvailable: boolean;
  isFeatured: boolean;
} | null;

export function ServiceForm({ service }: { service: ServiceFormValue }) {
  const [state, action] = useFormState(saveServiceAction, EMPTY_ACTION_STATE);
  return (
    <form action={action} noValidate className="surface p-5">
      <FormAlert state={state} />
      {service ? <input type="hidden" name="id" value={service.id} /> : null}

      <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
        <Input label="Nom de la prestation" name="name" defaultValue={service?.name ?? ''} errors={state.errors?.name} required />
        <Select label="Catégorie" name="category" defaultValue={service?.category ?? SERVICE_CATEGORIES[0]}>
          {SERVICE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      <Textarea label="Description" name="description" defaultValue={service?.description ?? ''} errors={state.errors?.description} required />

      <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
        <Input label="Prix (FCFA)" name="price" type="number" min={0} step={500} defaultValue={service?.price ?? 0} errors={state.errors?.price} required />
        <Input
          label="Durée (minutes)"
          name="durationMinutes"
          type="number"
          min={5}
          step={5}
          defaultValue={service?.durationMinutes ?? 60}
          errors={state.errors?.durationMinutes}
          required
        />
      </div>

      <Input label="Photo" name="image" type="file" accept="image/*" />
      <Checkbox label="Disponible à la réservation" name="isAvailable" defaultChecked={service?.isAvailable ?? true} />
      <Checkbox label="Mettre en avant sur l’accueil" name="isFeatured" defaultChecked={service?.isFeatured ?? false} />

      <SubmitButton>{service ? 'Enregistrer' : 'Créer la prestation'}</SubmitButton>
    </form>
  );
}
