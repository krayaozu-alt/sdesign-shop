'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { guard, isDenied } from '@/server/guard';
import { logAudit } from '@/lib/audit';
import { POST_STATUS } from '@/lib/constants';
import { slugify } from '@/lib/utils';
import { bannerSchema, postSchema, zodToState, type ActionState } from '@/lib/validation';
import { removeUpload, retirerAncienFichier, saveUpload, verifierEcriture } from '@/server/uploads';

function formToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  formData.forEach((value, key) => {
    if (value instanceof File) return;
    out[key] = value;
  });
  return out;
}

/** Cases a cocher absentes du FormData quand elles ne sont pas cochees. */
function withCheckboxes(raw: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  for (const k of keys) raw[k] = raw[k] === 'true' || raw[k] === 'on';
  return raw;
}

/** Rafraichit toutes les surfaces publiques ou une annonce peut apparaitre. */
function rafraichirSurfacesPubliques() {
  revalidatePath('/');
  revalidatePath('/formations');
  revalidatePath('/calendrier-formations');
}

const dateOuNull = (v?: string) => (v?.trim() ? new Date(v) : null);

/* ========================================================================== */
/*                               PUBLICATIONS                                 */
/* ========================================================================== */

async function slugPublicationUnique(titre: string, idCourant?: string): Promise<string> {
  const base = slugify(titre) || 'publication';
  let candidat = base;
  for (let i = 2; i < 100; i += 1) {
    const trouve = await prisma.post.findUnique({ where: { slug: candidat }, select: { id: true } });
    if (!trouve || trouve.id === idCourant) return candidat;
    candidat = `${base}-${i}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function savePostAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const g = await guard('marketing.manage');
  if (isDenied(g)) return g.error;

  const parsed = postSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodToState(parsed.error);
  const d = parsed.data;

  const upload = await saveUpload(formData.get('image') as File | null);
  if (upload && !upload.ok) return { ok: false, message: upload.error };
  // Le visuel doit etre prouve lisible AVANT que la base ne pointe dessus.
  if (upload?.ok) {
    const controle = await verifierEcriture(upload.url, upload.sha256);
    if (!controle.ok) return { ok: false, message: controle.error };
  }

  const ancienneImage = d.id
    ? (await prisma.post.findUnique({ where: { id: d.id }, select: { imageUrl: true } }))?.imageUrl
    : null;

  const data = {
    title: d.title,
    subtitle: d.subtitle || null,
    body: d.body,
    price: d.price,
    courseId: d.courseId || null,
    sessionId: d.sessionId || null,
    ctaLabel: d.ctaLabel || null,
    ctaUrl: d.ctaUrl || null,
    status: d.status,
    publishedAt: dateOuNull(d.publishedAt),
    expiresAt: dateOuNull(d.expiresAt),
    sortOrder: d.sortOrder,
    ...(upload?.ok ? { imageUrl: upload.url } : {}),
  };

  const slug = await slugPublicationUnique(d.title, d.id);
  const post = d.id
    ? await prisma.post.update({ where: { id: d.id }, data: { ...data, slug } })
    : await prisma.post.create({ data: { ...data, slug } });

  if (upload?.ok) await retirerAncienFichier(ancienneImage, upload.url);

  await logAudit({
    userId: g.user.id,
    action: d.id ? 'UPDATE' : 'CREATE',
    entity: 'Post',
    entityId: post.id,
    details: `${d.title} — ${d.status}`,
  });
  revalidatePath('/admin/publications');
  rafraichirSurfacesPubliques();
  return { ok: true, message: d.id ? 'Publication mise à jour.' : 'Publication créée.' };
}

/** Changement de statut rapide : publier, dépublier, archiver. */
export async function changerStatutPostAction(formData: FormData): Promise<void> {
  const g = await guard('marketing.manage');
  if (isDenied(g)) return;
  const id = String(formData.get('id') ?? '');
  const statut = String(formData.get('status') ?? '');
  if (!id || !(statut in POST_STATUS)) return;

  const post = await prisma.post.update({ where: { id }, data: { status: statut } });
  await logAudit({
    userId: g.user.id,
    action: statut === POST_STATUS.PUBLIEE ? 'PUBLISH' : statut === POST_STATUS.ARCHIVEE ? 'ARCHIVE' : 'UNPUBLISH',
    entity: 'Post',
    entityId: id,
    details: `${post.title} → ${statut}`,
  });
  revalidatePath('/admin/publications');
  rafraichirSurfacesPubliques();
}

/**
 * Duplication d'une publication.
 * La copie repart en BROUILLON et sans fenetre de diffusion : rien ne part en
 * ligne par accident au moment ou l'on reprend une campagne.
 */
export async function dupliquerPostAction(formData: FormData): Promise<void> {
  const g = await guard('marketing.manage');
  if (isDenied(g)) return;
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  const source = await prisma.post.findUnique({ where: { id } });
  if (!source) return;

  const titre = `${source.title} (copie)`;
  const copie = await prisma.post.create({
    data: {
      slug: await slugPublicationUnique(titre),
      title: titre,
      subtitle: source.subtitle,
      body: source.body,
      imageUrl: source.imageUrl, // le meme objet R2, partage : aucun re-upload
      images: source.images,
      price: source.price,
      courseId: source.courseId,
      sessionId: source.sessionId,
      ctaLabel: source.ctaLabel,
      ctaUrl: source.ctaUrl,
      status: POST_STATUS.BROUILLON,
      publishedAt: null,
      expiresAt: null,
      sortOrder: source.sortOrder,
    },
  });

  await logAudit({ userId: g.user.id, action: 'DUPLICATE', entity: 'Post', entityId: copie.id, details: titre });
  revalidatePath('/admin/publications');
}

export async function deletePostAction(formData: FormData): Promise<void> {
  const g = await guard('marketing.manage');
  if (isDenied(g)) return;
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  const post = await prisma.post.delete({ where: { id } });
  // `retirerAncienFichier` verifie que l'objet n'est plus reference ailleurs :
  // une image partagee avec une copie ne doit pas disparaitre.
  await retirerAncienFichier(post.imageUrl, '');
  await logAudit({ userId: g.user.id, action: 'DELETE', entity: 'Post', entityId: id, details: post.title });
  revalidatePath('/admin/publications');
  rafraichirSurfacesPubliques();
}

/* ========================================================================== */
/*                                 BANNIERES                                  */
/* ========================================================================== */

export async function saveBannerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const g = await guard('marketing.manage');
  if (isDenied(g)) return g.error;

  const parsed = bannerSchema.safeParse(withCheckboxes(formToObject(formData), []));
  if (!parsed.success) return zodToState(parsed.error);
  const d = parsed.data;

  const upload = await saveUpload(formData.get('image') as File | null);
  if (upload && !upload.ok) return { ok: false, message: upload.error };
  if (upload?.ok) {
    const controle = await verifierEcriture(upload.url, upload.sha256);
    if (!controle.ok) return { ok: false, message: controle.error };
  }

  const ancienneImage = d.id
    ? (await prisma.banner.findUnique({ where: { id: d.id }, select: { imageUrl: true } }))?.imageUrl
    : null;

  const data = {
    title: d.title,
    subtitle: d.subtitle || null,
    description: d.description || null,
    price: d.price,
    placement: d.placement,
    courseId: d.courseId || null,
    sessionId: d.sessionId || null,
    ctaLabel: d.ctaLabel || null,
    ctaUrl: d.ctaUrl || null,
    status: d.status,
    startsAt: dateOuNull(d.startsAt),
    endsAt: dateOuNull(d.endsAt),
    sortOrder: d.sortOrder,
    ...(upload?.ok ? { imageUrl: upload.url } : {}),
  };

  const banner = d.id
    ? await prisma.banner.update({ where: { id: d.id }, data })
    : await prisma.banner.create({ data });

  if (upload?.ok) await retirerAncienFichier(ancienneImage, upload.url);

  await logAudit({
    userId: g.user.id,
    action: d.id ? 'UPDATE' : 'CREATE',
    entity: 'Banner',
    entityId: banner.id,
    details: `${d.title} — ${d.placement} — ${d.status}`,
  });
  revalidatePath('/admin/bannieres');
  rafraichirSurfacesPubliques();
  return { ok: true, message: d.id ? 'Bannière mise à jour.' : 'Bannière créée.' };
}

export async function changerStatutBannerAction(formData: FormData): Promise<void> {
  const g = await guard('marketing.manage');
  if (isDenied(g)) return;
  const id = String(formData.get('id') ?? '');
  const statut = String(formData.get('status') ?? '');
  if (!id || !(statut in POST_STATUS)) return;

  const banner = await prisma.banner.update({ where: { id }, data: { status: statut } });
  await logAudit({
    userId: g.user.id,
    action: statut === POST_STATUS.PUBLIEE ? 'PUBLISH' : statut === POST_STATUS.ARCHIVEE ? 'ARCHIVE' : 'UNPUBLISH',
    entity: 'Banner',
    entityId: id,
    details: `${banner.title} → ${statut}`,
  });
  revalidatePath('/admin/bannieres');
  rafraichirSurfacesPubliques();
}

export async function dupliquerBannerAction(formData: FormData): Promise<void> {
  const g = await guard('marketing.manage');
  if (isDenied(g)) return;
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  const source = await prisma.banner.findUnique({ where: { id } });
  if (!source) return;

  const copie = await prisma.banner.create({
    data: {
      title: `${source.title} (copie)`,
      subtitle: source.subtitle,
      description: source.description,
      imageUrl: source.imageUrl,
      price: source.price,
      placement: source.placement,
      courseId: source.courseId,
      sessionId: source.sessionId,
      ctaLabel: source.ctaLabel,
      ctaUrl: source.ctaUrl,
      status: POST_STATUS.BROUILLON,
      startsAt: null,
      endsAt: null,
      sortOrder: source.sortOrder,
    },
  });

  await logAudit({ userId: g.user.id, action: 'DUPLICATE', entity: 'Banner', entityId: copie.id, details: copie.title });
  revalidatePath('/admin/bannieres');
}

export async function deleteBannerAction(formData: FormData): Promise<void> {
  const g = await guard('marketing.manage');
  if (isDenied(g)) return;
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  const banner = await prisma.banner.delete({ where: { id } });
  await retirerAncienFichier(banner.imageUrl, '');
  await logAudit({ userId: g.user.id, action: 'DELETE', entity: 'Banner', entityId: id, details: banner.title });
  revalidatePath('/admin/bannieres');
  rafraichirSurfacesPubliques();
}

/** Retire le visuel sans supprimer l'annonce. */
export async function retirerImageAction(formData: FormData): Promise<void> {
  const g = await guard('marketing.manage');
  if (isDenied(g)) return;
  const id = String(formData.get('id') ?? '');
  const type = String(formData.get('type') ?? '');
  if (!id) return;

  // L'URL doit etre relevee AVANT la mise a null : `update` renvoie la ligne
  // deja modifiee, ou l'ancienne valeur a disparu.
  if (type === 'post') {
    const avant = await prisma.post.findUnique({ where: { id }, select: { imageUrl: true } });
    await prisma.post.update({ where: { id }, data: { imageUrl: null } });
    await retirerAncienFichier(avant?.imageUrl, '');
    revalidatePath('/admin/publications');
  } else {
    const avant = await prisma.banner.findUnique({ where: { id }, select: { imageUrl: true } });
    await prisma.banner.update({ where: { id }, data: { imageUrl: null } });
    await retirerAncienFichier(avant?.imageUrl, '');
    revalidatePath('/admin/bannieres');
  }
  await logAudit({ userId: g.user.id, action: 'DELETE', entity: type === 'post' ? 'Post' : 'Banner', entityId: id, details: 'image retirée' });
  rafraichirSurfacesPubliques();
}
