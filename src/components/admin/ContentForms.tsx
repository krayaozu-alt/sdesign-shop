'use client';

import { useFormState } from 'react-dom';
import { Checkbox, FormAlert, Input, Select, SubmitButton, Textarea } from '@/components/ui/form';
import { GALLERY_CATEGORY_LABELS } from '@/lib/constants';
import { SETTINGS_META, type SettingKey } from '@/lib/settings-schema';
import { EMPTY_ACTION_STATE } from '@/lib/validation';
import { saveGalleryItemAction, saveSettingsAction, saveTestimonialAction } from '@/server/actions/content';

export function GalleryForm() {
  const [state, action] = useFormState(saveGalleryItemAction, EMPTY_ACTION_STATE);
  return (
    <form action={action} noValidate className="surface p-5">
      <FormAlert state={state} />
      <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
        <Input label="Titre" name="title" errors={state.errors?.title} required />
        <Select label="Catégorie" name="category" defaultValue="COIFFURE">
          {Object.entries(GALLERY_CATEGORY_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </div>
      <Textarea label="Description" name="description" rows={2} />
      <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
        <Select label="Type de média" name="mediaType" defaultValue="IMAGE">
          <option value="IMAGE">Photo</option>
          <option value="VIDEO">Vidéo</option>
        </Select>
        <Input label="Ordre d’affichage" name="sortOrder" type="number" min={0} defaultValue={0} />
      </div>
      <Input label="Fichier" name="media" type="file" accept="image/*,video/mp4,video/webm" required hint="6 Mo maximum." />
      <input type="hidden" name="url" value="" />
      <Checkbox label="Publier dans la galerie publique" name="isPublished" defaultChecked />
      <SubmitButton>Ajouter à la galerie</SubmitButton>
    </form>
  );
}

export function TestimonialForm() {
  const [state, action] = useFormState(saveTestimonialAction, EMPTY_ACTION_STATE);
  return (
    <form action={action} noValidate className="surface p-5">
      <FormAlert state={state} />
      <div className="grid gap-0 sm:grid-cols-3 sm:gap-4">
        <Input label="Nom" name="authorName" errors={state.errors?.authorName} required />
        <Input label="Qualité" name="role" defaultValue="Cliente" />
        <Input label="Note (1 à 5)" name="rating" type="number" min={1} max={5} defaultValue={5} />
      </div>
      <Textarea label="Témoignage" name="message" rows={3} errors={state.errors?.message} required />
      <Checkbox label="Publier sur la page d’accueil" name="isPublished" defaultChecked />
      <SubmitButton variant="outline">Ajouter le témoignage</SubmitButton>
    </form>
  );
}

/**
 * Visuels de l'etablissement geres depuis les parametres.
 *
 * Chaque entree decrit comment presenter l'image et sous quel nom de champ le
 * fichier est envoye. Le nom du champ doit correspondre exactement a celui que
 * lit `saveSettingsAction` : c'est lui qui declenche le circuit R2 securise
 * (envoi, verification SHA-256, ecriture en base, puis retrait de l'ancien
 * fichier seulement s'il n'est plus reference nulle part).
 */
const VISUELS: Record<string, {
  titre: string;
  alt: string;
  usage: string;
  absent: string;
  champ: string;
  libelleChamp: string;
  formats: string;
  aide: string;
  apercu: string;
}> = {
  'shop.logoUrl': {
    titre: 'Logo de la boutique',
    alt: 'Logo actuellement utilisé',
    usage: 'Affiché sur le site, l’espace cliente et le back-office.',
    absent: 'Aucun logo enregistré : le logotype typographique de secours est utilisé.',
    champ: 'logo',
    libelleChamp: 'Remplacer le logo',
    formats: 'image/png,image/jpeg,image/webp,image/svg+xml',
    aide: 'PNG, JPG, WEBP ou SVG — 6 Mo maximum. Le nouveau logo est appliqué partout immédiatement, sans modification du code.',
    apercu: 'h-24 w-auto rounded-lg bg-white p-2 object-contain',
  },
  'hero.imageUrl': {
    titre: 'Photo du hero (page d’accueil)',
    alt: 'Photo actuellement affichée dans le hero',
    usage: 'Grande photo à droite du slogan, dans le cercle doré de la page d’accueil.',
    absent:
      'Aucune photo enregistrée : un emplacement doré occupe la place, à la taille exacte de la future photo.',
    champ: 'heroImage',
    libelleChamp: 'Ajouter ou remplacer la photo du hero',
    formats: 'image/png,image/jpeg,image/webp',
    aide: 'Format recommandé : photo verticale haute résolution, sujet positionné vers le centre. Les bords sont fondus automatiquement dans le décor : aucun détourage n’est nécessaire. 6 Mo maximum.',
    apercu: 'h-28 w-28 rounded-full object-cover object-top ring-1 ring-gold-400/30',
  },
};

export function SettingsForm({ settings }: { settings: Record<string, string> }) {
  const [state, action] = useFormState(saveSettingsAction, EMPTY_ACTION_STATE);

  const groups = Object.entries(SETTINGS_META).reduce<Record<string, SettingKey[]>>((acc, [key, meta]) => {
    (acc[meta.group] ??= []).push(key as SettingKey);
    return acc;
  }, {});

  const GROUP_LABELS: Record<string, string> = {
    IDENTITE: 'Identité de la boutique',
    CONTACT: 'Contact',
    LOCALISATION: 'Localisation de la boutique',
    RESEAUX: 'Réseaux sociaux',
    PAIEMENT: 'Paiement',
    RESERVATION: 'Réservation',
    CERTIFICAT: 'Certificats',
  };

  return (
    <form action={action} noValidate className="space-y-5">
      <FormAlert state={state} />

      {Object.entries(groups).map(([group, keys]) => (
        <section key={group} className="surface p-5">
          <h2 className="mb-4 font-display text-lg text-cream">{GROUP_LABELS[group] ?? group}</h2>
          <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
            {keys.map((key) => {
              const meta = SETTINGS_META[key];
              if (meta.type === 'IMAGE') {
                const visuel = VISUELS[key];
                if (!visuel) return null;
                return (
                  <div key={key} className="sm:col-span-2">
                    <p className="label-eyebrow mb-2">{visuel.titre}</p>
                    {settings[key] ? (
                      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={settings[key]}
                          alt={visuel.alt}
                          className={visuel.apercu}
                        />
                        <div className="min-w-0 text-xs">
                          <p className="text-cream">{visuel.alt}</p>
                          <p className="mt-0.5 break-all text-cream-dim">{settings[key]}</p>
                          <p className="mt-1 text-cream-dim">{visuel.usage}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-xs text-amber-100">
                        {visuel.absent}
                      </p>
                    )}
                    <Input
                      label={visuel.libelleChamp}
                      name={visuel.champ}
                      type="file"
                      accept={visuel.formats}
                      hint={visuel.aide}
                    />
                    <input type="hidden" name={key} value={settings[key] ?? ''} />
                  </div>
                );
              }
              if (meta.type === 'TEXTAREA') {
                return (
                  <div key={key} className="sm:col-span-2">
                    <Textarea label={meta.label} name={key} rows={3} defaultValue={settings[key] ?? ''} />
                  </div>
                );
              }
              return (
                <Input
                  key={key}
                  label={meta.label}
                  name={key}
                  type={meta.type === 'NUMBER' ? 'number' : 'text'}
                  defaultValue={settings[key] ?? ''}
                />
              );
            })}
          </div>
        </section>
      ))}

      <SubmitButton>Enregistrer les paramètres</SubmitButton>
    </form>
  );
}
