'use client';

import { useFormState } from 'react-dom';
import { FormAlert, Input, SubmitButton } from '@/components/ui/form';
import { EMPTY_ACTION_STATE } from '@/lib/validation';
import { addCourseImagesAction } from '@/server/actions/catalog';

/** Ajout d'une ou plusieurs photos à la photothèque d'une formation. */
export function CourseImageUploader({ courseId, courseName }: { courseId: string; courseName: string }) {
  const [state, action] = useFormState(addCourseImagesAction, EMPTY_ACTION_STATE);

  return (
    <form action={action} noValidate className="surface p-4">
      <FormAlert state={state} />
      <input type="hidden" name="courseId" value={courseId} />
      <Input
        label="Photos de la formation"
        name="images"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        required
        hint="JPG, PNG ou WEBP — 6 Mo par fichier. Vous pouvez en sélectionner plusieurs."
      />
      <Input
        label="Description de l’image (accessibilité)"
        name="alt"
        defaultValue={courseName}
        hint="Décrit ce que montre la photo pour les lecteurs d’écran et le référencement."
      />
      <SubmitButton variant="outline" pendingLabel="Téléversement…">
        Ajouter les photos
      </SubmitButton>
    </form>
  );
}
