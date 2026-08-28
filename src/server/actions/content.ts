'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { SETTINGS_DEFAULTS, SETTINGS_META, type SettingKey } from '@/lib/settings';
import { parseCoordonnees } from '@/lib/settings-schema';
import { gallerySchema, testimonialSchema, zodToState, type ActionState } from '@/lib/validation';
import { formToObject, guard, isDenied, withCheckboxes } from '@/server/guard';
import { retirerAncienFichier, saveUpload, verifierEcriture } from '@/server/uploads';

/* ------------------------------------------------------------------ GALERIE */

export async function saveGalleryItemAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const g = await guard('gallery.manage');
  if (isDenied(g)) return g.error;

  const upload = await saveUpload(formData.get('media') as File | null);
  if (upload && !upload.ok) return { ok: false, message: upload.error };

  if (upload?.ok) {
    const controle = await verifierEcriture(upload.url, upload.sha256);
    if (!controle.ok) return { ok: false, message: controle.error };
  }

  const raw = withCheckboxes(formToObject(formData), ['isPublished']);
  if (upload?.ok) raw.url = upload.url;

  const parsed = gallerySchema.safeParse(raw);
  if (!parsed.success) {
    return parsed.error.flatten().fieldErrors.url
      ? { ok: false, message: 'Sélectionnez une photo ou une vidéo à téléverser.' }
      : zodToState(parsed.error);
  }
  const d = parsed.data;

  const data = {
    title: d.title,
    description: d.description ?? null,
    category: d.category,
    mediaType: d.mediaType,
    url: d.url,
    isPublished: d.isPublished,
    sortOrder: d.sortOrder,
  };

  const ancienMedia = d.id
    ? (await prisma.galleryItem.findUnique({ where: { id: d.id }, select: { url: true } }))?.url
    : null;

  const item = d.id
    ? await prisma.galleryItem.update({ where: { id: d.id }, data })
    : await prisma.galleryItem.create({ data });

  if (upload?.ok) await retirerAncienFichier(ancienMedia, upload.url);

  await logAudit({ userId: g.user.id, action: d.id ? 'UPDATE' : 'CREATE', entity: 'GalleryItem', entityId: item.id });
  revalidatePath('/admin/galerie');
  revalidatePath('/galerie');
  revalidatePath('/');
  return { ok: true, message: 'Média enregistré.' };
}

export async function deleteGalleryItemAction(formData: FormData): Promise<void> {
  const g = await guard('gallery.manage');
  if (isDenied(g)) return;
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const media = await prisma.galleryItem.delete({ where: { id } });
  // Compte les references avant de supprimer : les photos de la galerie sont
  // souvent LES MEMES fichiers que ceux des formations. Un retrait direct
  // effacerait la photo de la formation en meme temps que l'entree de galerie.
  await retirerAncienFichier(media.url, '');
  await logAudit({ userId: g.user.id, action: 'DELETE', entity: 'GalleryItem', entityId: id });
  revalidatePath('/admin/galerie');
  revalidatePath('/galerie');
}

/* -------------------------------------------------------------- TEMOIGNAGES */

export async function saveTestimonialAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const g = await guard('gallery.manage');
  if (isDenied(g)) return g.error;

  const parsed = testimonialSchema.safeParse(withCheckboxes(formToObject(formData), ['isPublished']));
  if (!parsed.success) return zodToState(parsed.error);
  const d = parsed.data;

  const data = {
    authorName: d.authorName,
    role: d.role || 'Cliente',
    message: d.message,
    rating: d.rating,
    isPublished: d.isPublished,
  };

  const item = d.id
    ? await prisma.testimonial.update({ where: { id: d.id }, data })
    : await prisma.testimonial.create({ data });

  await logAudit({ userId: g.user.id, action: d.id ? 'UPDATE' : 'CREATE', entity: 'Testimonial', entityId: item.id });
  revalidatePath('/admin/galerie');
  revalidatePath('/');
  return { ok: true, message: 'Témoignage enregistré.' };
}

export async function deleteTestimonialAction(formData: FormData): Promise<void> {
  const g = await guard('gallery.manage');
  if (isDenied(g)) return;
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  await prisma.testimonial.delete({ where: { id } });
  await logAudit({ userId: g.user.id, action: 'DELETE', entity: 'Testimonial', entityId: id });
  revalidatePath('/admin/galerie');
  revalidatePath('/');
}

/* --------------------------------------------------------------- PARAMETRES */

export async function saveSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const g = await guard('settings.manage');
  if (isDenied(g)) return g.error;

  const logo = await saveUpload(formData.get('logo') as File | null);
  if (logo && !logo.ok) return { ok: false, message: logo.error };

  // Le logo doit etre prouve lisible AVANT d'etre enregistre : le remplacer par
  // une reference cassee rendrait l'identite visuelle invisible partout.
  if (logo?.ok) {
    const controle = await verifierEcriture(logo.url, logo.sha256);
    if (!controle.ok) return { ok: false, message: controle.error };
  }

  // Logo en place avant modification, retire seulement apres enregistrement.
  const ancienLogo = (await prisma.setting.findUnique({ where: { key: 'shop.logoUrl' } }))?.value;

  // Un logo televerse avec succes est enregistre IMMEDIATEMENT : si une autre
  // valeur du formulaire est refusee plus bas, le fichier deja ecrit sur le
  // disque ne doit jamais rester orphelin avec un reglage vide.
  if (logo?.ok) {
    await prisma.setting.upsert({
      where: { key: 'shop.logoUrl' },
      update: { value: logo.url },
      create: { key: 'shop.logoUrl', value: logo.url, label: 'Logo', group: 'IDENTITE', type: 'IMAGE' },
    });
    // Le reglage pointe desormais sur le nouveau logo : l'ancien peut partir.
    await retirerAncienFichier(ancienLogo, logo.url);
    await logAudit({ userId: g.user.id, action: 'UPDATE', entity: 'Setting', details: `logo → ${logo.url}` });
    revalidatePath('/', 'layout');
  }

  // Photo du HERO : rigoureusement le meme circuit que le logo ci-dessus.
  const heroImage = await saveUpload(formData.get('heroImage') as File | null);
  if (heroImage && !heroImage.ok) return { ok: false, message: heroImage.error };
  if (heroImage?.ok) {
    const controle = await verifierEcriture(heroImage.url, heroImage.sha256);
    if (!controle.ok) return { ok: false, message: controle.error };
  }
  const anciennePhotoHero = (await prisma.setting.findUnique({ where: { key: 'hero.imageUrl' } }))?.value;
  if (heroImage?.ok) {
    await prisma.setting.upsert({
      where: { key: 'hero.imageUrl' },
      update: { value: heroImage.url },
      create: {
        key: 'hero.imageUrl',
        value: heroImage.url,
        label: 'Photo du hero (accueil)',
        group: 'IDENTITE',
        type: 'IMAGE',
      },
    });
    // Le reglage pointe sur la nouvelle photo : l'ancienne peut partir, et
    // `retirerAncienFichier` verifie d'abord qu'elle ne sert nulle part ailleurs.
    await retirerAncienFichier(anciennePhotoHero, heroImage.url);
    await logAudit({ userId: g.user.id, action: 'UPDATE', entity: 'Setting', details: 'photo du hero remplacée' });
    revalidatePath('/', 'layout');
  }

  const keys = Object.keys(SETTINGS_DEFAULTS) as SettingKey[];
  const updates: { key: string; value: string }[] = [];

  for (const key of keys) {
    if (key === 'shop.logoUrl' && logo?.ok) {
      updates.push({ key, value: logo.url });
      continue;
    }
    if (key === 'hero.imageUrl' && heroImage?.ok) {
      updates.push({ key, value: heroImage.url });
      continue;
    }
    const raw = formData.get(key);
    if (raw === null) continue;
    updates.push({ key, value: String(raw).slice(0, 2000) });
  }

  // Les coordonnées GPS pilotent la carte : une valeur invalide est refusée
  // plutôt qu'enregistrée, pour ne jamais afficher un point approximatif.
  const lat = updates.find((u) => u.key === 'shop.latitude')?.value;
  const lng = updates.find((u) => u.key === 'shop.longitude')?.value;
  if (lat !== undefined && lng !== undefined && (lat.trim() !== '' || lng.trim() !== '')) {
    if (!parseCoordonnees(lat, lng)) {
      return {
        ok: false,
        message:
          'Coordonnées GPS invalides. Latitude entre -90 et 90, longitude entre -180 et 180 (exemple : 12.40567398071289 / -1.6069070100784302).',
      };
    }
  }

  for (const u of updates) {
    const meta = SETTINGS_META[u.key as SettingKey];
    await prisma.setting.upsert({
      where: { key: u.key },
      update: { value: u.value },
      create: { key: u.key, value: u.value, label: meta?.label ?? u.key, group: meta?.group ?? 'GENERAL', type: meta?.type ?? 'TEXT' },
    });
  }

  await logAudit({ userId: g.user.id, action: 'UPDATE', entity: 'Setting', details: `${updates.length} paramètres` });
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Paramètres enregistrés.' };
}

/**
 * Retire un visuel de l'etablissement (logo ou photo du hero).
 *
 * Le reglage est vide D'ABORD, le fichier retire ENSUITE : ainsi, si le retrait
 * echoue, on se retrouve avec un objet inutilise — sans consequence — plutot
 * qu'avec une reference pointant dans le vide.
 *
 * Le retrait passe par `retirerAncienFichier`, qui compte les references avant
 * de supprimer quoi que ce soit. C'est indispensable : le meme fichier peut
 * parfaitement servir de logo ET de photo du hero. L'appel direct a
 * `removeUpload` qui figurait ici auparavant ne faisait pas ce controle et
 * pouvait effacer une image encore affichee ailleurs sur le site.
 */
async function retirerVisuel(cle: 'shop.logoUrl' | 'hero.imageUrl', libelle: string, userId: string) {
  const actuel = await prisma.setting.findUnique({ where: { key: cle } });
  await prisma.setting.upsert({
    where: { key: cle },
    update: { value: '' },
    create: { key: cle, value: '', label: libelle, group: 'IDENTITE', type: 'IMAGE' },
  });
  const retrait = await retirerAncienFichier(actuel?.value, '');
  await logAudit({
    userId,
    action: 'RESET',
    entity: 'Setting',
    details: `${cle} — ${retrait.supprime ? 'fichier retiré' : retrait.raison}`,
  });
  revalidatePath('/', 'layout');
}

export async function resetLogoAction(): Promise<void> {
  const g = await guard('settings.manage');
  if (isDenied(g)) return;
  await retirerVisuel('shop.logoUrl', 'Logo', g.user.id);
}

/** Retire la photo du hero. Le hero repasse alors sur son visuel de secours. */
export async function supprimerPhotoHeroAction(): Promise<void> {
  const g = await guard('settings.manage');
  if (isDenied(g)) return;
  await retirerVisuel('hero.imageUrl', 'Photo du hero (accueil)', g.user.id);
}

/* ------------------------------------------------------------ NOTIFICATIONS */

export async function markNotificationsReadAction(formData: FormData): Promise<void> {
  const g = await guard('notifications.manage');
  if (isDenied(g)) return;
  const id = String(formData.get('id') ?? '');
  if (id) await prisma.notification.update({ where: { id }, data: { isRead: true } });
  else await prisma.notification.updateMany({ where: { userId: g.user.id, isRead: false }, data: { isRead: true } });
  revalidatePath('/admin/notifications');
}

/** Relance manuelle d'un envoi reste en attente (WhatsApp / SMS non configures). */
export async function retryNotificationAction(formData: FormData): Promise<void> {
  const g = await guard('notifications.manage');
  if (isDenied(g)) return;
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const { CHANNELS } = await import('@/lib/notifications');
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification) return;
  const channel = CHANNELS[notification.channel as keyof typeof CHANNELS];
  if (!channel?.isConfigured()) return;
  const result = await channel.send({
    to: null,
    title: notification.title,
    message: notification.message,
    link: notification.link,
  });
  await prisma.notification.update({
    where: { id },
    data: { status: result.ok ? 'ENVOYEE' : 'ECHEC', sentAt: result.ok ? new Date() : null },
  });
  revalidatePath('/admin/notifications');
}
