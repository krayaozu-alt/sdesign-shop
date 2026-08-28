'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import { Eye, Monitor, Smartphone } from 'lucide-react';
import { FormAlert, Input, Select, SubmitButton, Textarea } from '@/components/ui/form';
import { AnnonceLarge, type AnnonceData } from '@/components/public/Annonce';
import {
  BANNER_PLACEMENT_LABELS,
  BANNER_PLACEMENT_VALUES,
  POST_STATUS_LABELS,
  POST_STATUS_VALUES,
} from '@/lib/constants';
import { EMPTY_ACTION_STATE } from '@/lib/validation';
import { saveBannerAction, savePostAction } from '@/server/actions/marketing';

export type OptionFormation = { id: string; name: string; price: number; imageUrl: string | null };
export type OptionSession = {
  id: string;
  title: string;
  courseId: string;
  courseName: string;
  debut: string;
  fin: string;
  prix: number;
  restantes: number;
  photo: string | null;
  pastille: { texte: string; ton: 'ouvert' | 'tension' | 'ferme' | 'neutre' };
};

/**
 * Apercu avant publication.
 *
 * Il rend l'annonce avec EXACTEMENT le composant du site public, a partir des
 * valeurs saisies dans le formulaire. L'administrateur voit donc ce que verra
 * la cliente, en mobile comme en bureau — et rien n'est publie pour autant.
 */
function Apercu({ annonce }: { annonce: AnnonceData }) {
  const [largeur, setLargeur] = useState<'mobile' | 'bureau'>('bureau');
  return (
    <div className="mb-5 rounded-xl border border-white/10 bg-plum-950/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-gold-300">
          <Eye size={13} /> Aperçu client
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setLargeur('mobile')}
            className={largeur === 'mobile' ? 'btn-gold px-2.5 py-1.5 text-xs' : 'btn-ghost px-2.5 py-1.5 text-xs'}
            aria-label="Aperçu mobile"
          >
            <Smartphone size={13} />
          </button>
          <button
            type="button"
            onClick={() => setLargeur('bureau')}
            className={largeur === 'bureau' ? 'btn-gold px-2.5 py-1.5 text-xs' : 'btn-ghost px-2.5 py-1.5 text-xs'}
            aria-label="Aperçu bureau"
          >
            <Monitor size={13} />
          </button>
        </div>
      </div>
      <div className={largeur === 'mobile' ? 'mx-auto w-[375px] max-w-full' : 'w-full'}>
        <AnnonceLarge annonce={annonce} etiquette="À la une" />
      </div>
      <p className="mt-3 text-center text-xs text-cream-dim">
        Cet aperçu ne publie rien. Les dates, le prix et les places viennent de la session liée.
      </p>
    </div>
  );
}

/** Champs communs aux deux formulaires : rattachement et bouton. */
function ChampsLiaison({
  formations,
  sessions,
  courseId,
  sessionId,
  setCourseId,
  setSessionId,
  ctaLabel,
  setCtaLabel,
  ctaUrl,
  setCtaUrl,
}: {
  formations: OptionFormation[];
  sessions: OptionSession[];
  courseId: string;
  sessionId: string;
  setCourseId: (v: string) => void;
  setSessionId: (v: string) => void;
  ctaLabel: string;
  setCtaLabel: (v: string) => void;
  ctaUrl: string;
  setCtaUrl: (v: string) => void;
}) {
  return (
    <>
      <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
        <Select label="Formation liée" name="courseId" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          <option value="">Aucune</option>
          {formations.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </Select>
        <Select label="Session liée" name="sessionId" value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
          <option value="">Aucune</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.courseName} — {s.title}
            </option>
          ))}
        </Select>
      </div>
      <p className="-mt-2 mb-4 text-xs text-cream-dim">
        Une session liée alimente automatiquement les dates, le prix et les places : ne les recopiez pas dans le texte.
      </p>

      <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
        <div>
          <Input
            label="Texte du bouton"
            name="ctaLabel"
            value={ctaLabel}
            onChange={(e) => setCtaLabel(e.target.value)}
            placeholder="S’inscrire"
          />
          <div className="-mt-2 mb-4 flex flex-wrap gap-1">
            {['S’inscrire', 'Voir la formation', 'Voir la session', 'Réserver', 'Nous contacter', 'WhatsApp'].map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => {
                  setCtaLabel(l);
                  if (l === 'WhatsApp') setCtaUrl('https://wa.me/22676518811');
                  if (l === 'Nous contacter') setCtaUrl('/contact');
                  if (l === 'Réserver') setCtaUrl('/reservation');
                }}
                className="chip text-[11px] hover:text-cream"
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <Input
          label="Lien du bouton"
          name="ctaUrl"
          value={ctaUrl}
          onChange={(e) => setCtaUrl(e.target.value)}
          hint="Vide = lien automatique vers la session ou la formation liée."
        />
      </div>
    </>
  );
}

/* ------------------------------------------------------------ PUBLICATIONS */

export type PostFormValue = {
  id: string;
  title: string;
  subtitle: string;
  body: string;
  price: string;
  courseId: string;
  sessionId: string;
  ctaLabel: string;
  ctaUrl: string;
  status: string;
  publishedAt: string;
  expiresAt: string;
  sortOrder: number;
  imageUrl: string | null;
} | null;

export function PostForm({
  post,
  formations,
  sessions,
}: {
  post?: PostFormValue;
  formations: OptionFormation[];
  sessions: OptionSession[];
}) {
  const [state, action] = useFormState(savePostAction, EMPTY_ACTION_STATE);
  const [titre, setTitre] = useState(post?.title ?? '');
  const [sousTitre, setSousTitre] = useState(post?.subtitle ?? '');
  const [texte, setTexte] = useState(post?.body ?? '');
  const [prix, setPrix] = useState(post?.price ?? '');
  const [courseId, setCourseId] = useState(post?.courseId ?? '');
  const [sessionId, setSessionId] = useState(post?.sessionId ?? '');
  const [ctaLabel, setCtaLabel] = useState(post?.ctaLabel ?? '');
  const [ctaUrl, setCtaUrl] = useState(post?.ctaUrl ?? '');

  const session = sessions.find((s) => s.id === sessionId) ?? null;
  const formation = formations.find((f) => f.id === courseId) ?? null;

  const apercu: AnnonceData = {
    titre: titre || 'Titre de la publication',
    sousTitre: sousTitre || null,
    texte: texte || null,
    photo: post?.imageUrl ?? session?.photo ?? formation?.imageUrl ?? null,
    prix: prix ? Number(prix) : (session?.prix ?? formation?.price ?? null),
    lien: ctaUrl || (session ? '#' : formation ? '#' : null),
    libelleBouton: ctaLabel || (session ? 'S’inscrire' : 'En savoir plus'),
    formationNom: session?.courseName ?? formation?.name ?? null,
    periode: session ? { debut: new Date(session.debut), fin: new Date(session.fin) } : null,
    places: session ? { restantes: session.restantes, pastille: session.pastille } : null,
  };

  return (
    <form action={action} noValidate className="surface p-4">
      <FormAlert state={state} />
      {post?.id ? <input type="hidden" name="id" value={post.id} /> : null}

      <Apercu annonce={apercu} />

      <Input label="Titre" name="title" value={titre} onChange={(e) => setTitre(e.target.value)} errors={state.errors?.title} required />
      <Input label="Sous-titre" name="subtitle" value={sousTitre} onChange={(e) => setSousTitre(e.target.value)} placeholder="Nouvelle session" />
      <Textarea label="Texte" name="body" rows={4} value={texte} onChange={(e) => setTexte(e.target.value)} errors={state.errors?.body} required />

      <Input
        label="Image principale"
        name="image"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hint={post?.imageUrl ? 'Une image est déjà associée. En choisir une nouvelle la remplace.' : 'Facultatif — à défaut, la photo de la session ou de la formation est utilisée.'}
      />

      <ChampsLiaison
        formations={formations}
        sessions={sessions}
        courseId={courseId}
        sessionId={sessionId}
        setCourseId={setCourseId}
        setSessionId={setSessionId}
        ctaLabel={ctaLabel}
        setCtaLabel={setCtaLabel}
        ctaUrl={ctaUrl}
        setCtaUrl={setCtaUrl}
      />

      <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
        <Input
          label="Prix mis en avant"
          name="price"
          type="number"
          min={0}
          value={prix}
          onChange={(e) => setPrix(e.target.value)}
          hint="Vide = prix de la session ou de la formation liée."
        />
        <Input label="Ordre d’affichage" name="sortOrder" type="number" min={0} defaultValue={post?.sortOrder ?? 0} />
      </div>

      <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
        <Input label="Date de publication" name="publishedAt" type="date" defaultValue={post?.publishedAt} />
        <Input label="Date d’expiration" name="expiresAt" type="date" defaultValue={post?.expiresAt} />
      </div>
      <p className="-mt-2 mb-4 text-xs text-cream-dim">
        Hors de cette période, la publication disparaît du site toute seule.
      </p>

      <Select label="Statut" name="status" defaultValue={post?.status ?? 'BROUILLON'}>
        {POST_STATUS_VALUES.map((s) => (
          <option key={s} value={s}>
            {POST_STATUS_LABELS[s]}
          </option>
        ))}
      </Select>

      <SubmitButton className="w-full" variant={post?.id ? 'gold' : 'outline'}>
        {post?.id ? 'Enregistrer la publication' : 'Créer la publication'}
      </SubmitButton>
    </form>
  );
}

/* --------------------------------------------------------------- BANNIÈRES */

export type BannerFormValue = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  price: string;
  placement: string;
  courseId: string;
  sessionId: string;
  ctaLabel: string;
  ctaUrl: string;
  status: string;
  startsAt: string;
  endsAt: string;
  sortOrder: number;
  imageUrl: string | null;
} | null;

export function BannerForm({
  banner,
  formations,
  sessions,
}: {
  banner?: BannerFormValue;
  formations: OptionFormation[];
  sessions: OptionSession[];
}) {
  const [state, action] = useFormState(saveBannerAction, EMPTY_ACTION_STATE);
  const [titre, setTitre] = useState(banner?.title ?? '');
  const [sousTitre, setSousTitre] = useState(banner?.subtitle ?? '');
  const [description, setDescription] = useState(banner?.description ?? '');
  const [prix, setPrix] = useState(banner?.price ?? '');
  const [courseId, setCourseId] = useState(banner?.courseId ?? '');
  const [sessionId, setSessionId] = useState(banner?.sessionId ?? '');
  const [ctaLabel, setCtaLabel] = useState(banner?.ctaLabel ?? '');
  const [ctaUrl, setCtaUrl] = useState(banner?.ctaUrl ?? '');

  const session = sessions.find((s) => s.id === sessionId) ?? null;
  const formation = formations.find((f) => f.id === courseId) ?? null;

  const apercu: AnnonceData = {
    titre: titre || 'Titre de la bannière',
    sousTitre: sousTitre || null,
    texte: description || null,
    photo: banner?.imageUrl ?? session?.photo ?? formation?.imageUrl ?? null,
    prix: prix ? Number(prix) : (session?.prix ?? formation?.price ?? null),
    lien: ctaUrl || (session || formation ? '#' : null),
    libelleBouton: ctaLabel || (session ? 'S’inscrire' : 'En savoir plus'),
    formationNom: session?.courseName ?? formation?.name ?? null,
    periode: session ? { debut: new Date(session.debut), fin: new Date(session.fin) } : null,
    places: session ? { restantes: session.restantes, pastille: session.pastille } : null,
  };

  return (
    <form action={action} noValidate className="surface p-4">
      <FormAlert state={state} />
      {banner?.id ? <input type="hidden" name="id" value={banner.id} /> : null}

      <Apercu annonce={apercu} />

      <Input label="Titre" name="title" value={titre} onChange={(e) => setTitre(e.target.value)} errors={state.errors?.title} required />
      <Input label="Sous-titre" name="subtitle" value={sousTitre} onChange={(e) => setSousTitre(e.target.value)} placeholder="Nouvelle session" />
      <Textarea label="Description" name="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />

      <Input
        label="Image"
        name="image"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hint={banner?.imageUrl ? 'Une image est déjà associée. En choisir une nouvelle la remplace.' : 'Facultatif — à défaut, la photo de la session ou de la formation.'}
      />

      <Select label="Emplacement" name="placement" defaultValue={banner?.placement ?? 'HERO'}>
        {BANNER_PLACEMENT_VALUES.map((p) => (
          <option key={p} value={p}>
            {BANNER_PLACEMENT_LABELS[p]}
          </option>
        ))}
      </Select>

      <ChampsLiaison
        formations={formations}
        sessions={sessions}
        courseId={courseId}
        sessionId={sessionId}
        setCourseId={setCourseId}
        setSessionId={setSessionId}
        ctaLabel={ctaLabel}
        setCtaLabel={setCtaLabel}
        ctaUrl={ctaUrl}
        setCtaUrl={setCtaUrl}
      />

      <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
        <Input
          label="Prix mis en avant"
          name="price"
          type="number"
          min={0}
          value={prix}
          onChange={(e) => setPrix(e.target.value)}
          hint="Vide = prix de la session ou de la formation liée."
        />
        <Input label="Ordre d’affichage" name="sortOrder" type="number" min={0} defaultValue={banner?.sortOrder ?? 0} />
      </div>

      <div className="grid gap-0 sm:grid-cols-2 sm:gap-4">
        <Input label="Date de début" name="startsAt" type="date" defaultValue={banner?.startsAt} />
        <Input label="Date de fin" name="endsAt" type="date" defaultValue={banner?.endsAt} />
      </div>
      <p className="-mt-2 mb-4 text-xs text-cream-dim">
        Hors de cette période, la bannière disparaît du site toute seule.
      </p>

      <Select label="Statut" name="status" defaultValue={banner?.status ?? 'BROUILLON'}>
        {POST_STATUS_VALUES.map((s) => (
          <option key={s} value={s}>
            {POST_STATUS_LABELS[s]}
          </option>
        ))}
      </Select>

      <SubmitButton className="w-full" variant={banner?.id ? 'gold' : 'outline'}>
        {banner?.id ? 'Enregistrer la bannière' : 'Créer la bannière'}
      </SubmitButton>
    </form>
  );
}
