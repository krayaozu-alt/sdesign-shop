'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { courseSchema, moduleSchema, serviceSchema, sessionSchema, zodToState, type ActionState } from '@/lib/validation';
import { linesToJson, slugify } from '@/lib/utils';
import { formToObject, guard, isDenied, withCheckboxes } from '@/server/guard';
import { retirerAncienFichier, saveUpload, verifierEcriture } from '@/server/uploads';
import { filtreInscriptionsOccupantes } from '@/server/sessions';
import { SESSION_STATUS } from '@/lib/constants';

/** Slug unique : ajoute un suffixe numerique en cas de collision. */
/** Slug unique d'une session : « coiffe-senegalais-session-de-septembre ». */
async function uniqueSessionSlug(courseName: string, title: string, currentId?: string): Promise<string> {
  const base = slugify(`${courseName} ${title}`) || 'session';
  let candidate = base;
  for (let i = 2; i < 100; i += 1) {
    const found = await prisma.courseSession.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!found || found.id === currentId) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

async function uniqueSlug(kind: 'course' | 'service', name: string, currentId?: string): Promise<string> {
  const base = slugify(name) || 'element';
  let candidate = base;
  for (let i = 2; i < 100; i += 1) {
    const found =
      kind === 'course'
        ? await prisma.course.findUnique({ where: { slug: candidate }, select: { id: true } })
        : await prisma.service.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!found || found.id === currentId) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/**
 * Recopie l'URL de la photo principale dans Course.imageUrl : tout l'affichage
 * public (cartes, fiche, accueil) continue de lire ce champ unique.
 */
async function syncPrimaryImage(courseId: string): Promise<void> {
  const primary =
    (await prisma.courseImage.findFirst({ where: { courseId, isPrimary: true } })) ??
    (await prisma.courseImage.findFirst({ where: { courseId }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }));
  await prisma.course.update({ where: { id: courseId }, data: { imageUrl: primary?.url ?? null } });
}

/* ------------------------------------------------------- PHOTOS DE FORMATION */

/** Ajout d'une ou plusieurs photos à la photothèque d'une formation. */
export async function addCourseImagesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const g = await guard('courses.manage');
  if (isDenied(g)) return g.error;

  const courseId = String(formData.get('courseId') ?? '');
  if (!courseId) return { ok: false, message: 'Formation introuvable.' };
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, name: true } });
  if (!course) return { ok: false, message: 'Formation introuvable.' };

  const files = formData.getAll('images').filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { ok: false, message: 'Sélectionnez au moins une photo.' };

  const alt = String(formData.get('alt') ?? '').trim() || course.name;
  let count = await prisma.courseImage.count({ where: { courseId } });
  let added = 0;

  for (const file of files) {
    const upload = await saveUpload(file);
    if (!upload) continue;
    if (!upload.ok) return { ok: false, message: upload.error };
    // Ajout et non remplacement : rien a supprimer, mais on refuse d'enregistrer
    // une reference vers un fichier qu'on n'a pas pu relire.
    const controle = await verifierEcriture(upload.url, upload.sha256);
    if (!controle.ok) return { ok: false, message: controle.error };
    await prisma.courseImage.create({
      data: { courseId, url: upload.url, alt, isPrimary: count === 0, sortOrder: count },
    });
    count += 1;
    added += 1;
  }

  if (added === 0) return { ok: false, message: 'Aucune photo n’a pu être enregistrée.' };

  await syncPrimaryImage(courseId);
  await logAudit({ userId: g.user.id, action: 'CREATE', entity: 'CourseImage', entityId: courseId, details: `${added} photo(s)` });
  revalidatePath(`/admin/formations/${courseId}`);
  revalidatePath('/formations');
  revalidatePath('/');
  return { ok: true, message: `${added} photo(s) ajoutée(s).` };
}

/** Définit la photo principale affichée sur le site public. */
export async function setPrimaryCourseImageAction(formData: FormData): Promise<void> {
  const g = await guard('courses.manage');
  if (isDenied(g)) return;
  const id = String(formData.get('id') ?? '');
  const courseId = String(formData.get('courseId') ?? '');
  if (!id || !courseId) return;

  await prisma.courseImage.updateMany({ where: { courseId }, data: { isPrimary: false } });
  await prisma.courseImage.update({ where: { id }, data: { isPrimary: true } });
  await syncPrimaryImage(courseId);

  await logAudit({ userId: g.user.id, action: 'PRIMARY', entity: 'CourseImage', entityId: id });
  revalidatePath(`/admin/formations/${courseId}`);
  revalidatePath('/formations');
  revalidatePath('/');
}

export async function deleteCourseImageAction(formData: FormData): Promise<void> {
  const g = await guard('courses.manage');
  if (isDenied(g)) return;
  const id = String(formData.get('id') ?? '');
  const courseId = String(formData.get('courseId') ?? '');
  if (!id || !courseId) return;

  // Le fichier doit disparaitre du stockage, pas seulement de la base : sur R2
  // un objet orphelin resterait publiquement accessible a son URL, et facture.
  // Mais il ne part QUE s'il n'est plus reference ailleurs : la meme photo sert
  // souvent a la fois de visuel de formation et d'entree dans la galerie.
  const supprimee = await prisma.courseImage.delete({ where: { id } });
  await retirerAncienFichier(supprimee.url, '');

  const remaining = await prisma.courseImage.findFirst({ where: { courseId, isPrimary: true } });
  if (!remaining) {
    const first = await prisma.courseImage.findFirst({ where: { courseId }, orderBy: [{ sortOrder: 'asc' }] });
    if (first) await prisma.courseImage.update({ where: { id: first.id }, data: { isPrimary: true } });
  }
  await syncPrimaryImage(courseId);

  await logAudit({ userId: g.user.id, action: 'DELETE', entity: 'CourseImage', entityId: id });
  revalidatePath(`/admin/formations/${courseId}`);
  revalidatePath('/formations');
  revalidatePath('/');
}

/* -------------------------------------------------------------- FORMATIONS */

export async function saveCourseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const g = await guard('courses.manage');
  if (isDenied(g)) return g.error;

  const raw = withCheckboxes(formToObject(formData), ['isFeatured']);
  const parsed = courseSchema.safeParse(raw);
  if (!parsed.success) return zodToState(parsed.error);
  const d = parsed.data;

  const upload = await saveUpload(formData.get('image') as File | null);
  if (upload && !upload.ok) return { ok: false, message: upload.error };

  // Le nouveau fichier doit etre prouve lisible AVANT que la base ne pointe
  // dessus : sinon on remplacerait une image valide par une reference cassee.
  if (upload?.ok) {
    const controle = await verifierEcriture(upload.url, upload.sha256);
    if (!controle.ok) return { ok: false, message: controle.error };
  }

  // URL en place avant modification : elle ne sera retiree qu'une fois la
  // nouvelle enregistree avec succes.
  const ancienneImage = d.id
    ? (await prisma.course.findUnique({ where: { id: d.id }, select: { imageUrl: true } }))?.imageUrl
    : null;

  const data = {
    name: d.name,
    category: d.category,
    shortDescription: d.shortDescription,
    description: d.description,
    objectives: linesToJson(d.objectives),
    requirements: linesToJson(d.requirements),
    durationLabel: d.durationLabel,
    durationHours: d.durationHours,
    level: d.level,
    price: d.price,
    depositAmount: d.depositAmount,
    capacity: d.capacity,
    startDate: d.startDate ? new Date(d.startDate) : null,
    endDate: d.endDate ? new Date(d.endDate) : null,
    trainerId: d.trainerId || null,
    status: d.status,
    isFeatured: d.isFeatured,
    ...(upload?.ok ? { imageUrl: upload.url } : {}),
  };

  const course = d.id
    ? await prisma.course.update({ where: { id: d.id }, data })
    : await prisma.course.create({ data: { ...data, slug: await uniqueSlug('course', d.name) } });

  // La photo envoyée depuis la fiche alimente aussi la photothèque de la
  // formation, et devient la photo principale s'il n'y en a pas encore.
  if (upload?.ok) {
    const already = await prisma.courseImage.count({ where: { courseId: course.id } });
    await prisma.courseImage.create({
      data: { courseId: course.id, url: upload.url, alt: course.name, isPrimary: already === 0, sortOrder: already },
    });
    if (already > 0) {
      await prisma.courseImage.updateMany({ where: { courseId: course.id }, data: { isPrimary: false } });
      const last = await prisma.courseImage.findFirst({
        where: { courseId: course.id, url: upload.url },
        orderBy: { createdAt: 'desc' },
      });
      if (last) await prisma.courseImage.update({ where: { id: last.id }, data: { isPrimary: true } });
    }
    await syncPrimaryImage(course.id);
  }

  // La base pointe desormais sur le nouveau fichier : l'ancien peut partir,
  // sauf s'il reste utilise par une autre ligne (photothèque, par exemple).
  if (upload?.ok) await retirerAncienFichier(ancienneImage, upload.url);

  await logAudit({
    userId: g.user.id,
    action: d.id ? 'UPDATE' : 'CREATE',
    entity: 'Course',
    entityId: course.id,
    details: course.name,
  });

  revalidatePath('/admin/formations');
  revalidatePath('/formations');
  revalidatePath('/');
  return { ok: true, message: d.id ? 'Formation mise à jour.' : 'Formation créée.', data: { id: course.id } };
}

export async function deleteCourseAction(formData: FormData): Promise<void> {
  const g = await guard('courses.manage');
  if (isDenied(g)) return;
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  const count = await prisma.enrollment.count({ where: { courseId: id } });
  if (count > 0) {
    // Une formation deja suivie n'est jamais supprimee : elle est archivee.
    await prisma.course.update({ where: { id }, data: { status: 'ARCHIVEE' } });
    await logAudit({ userId: g.user.id, action: 'ARCHIVE', entity: 'Course', entityId: id });
  } else {
    // Les CourseImage partent en cascade cote base : on releve leurs URL AVANT
    // la suppression pour pouvoir retirer les fichiers du stockage.
    const aRetirer = await prisma.courseImage.findMany({ where: { courseId: id }, select: { url: true } });
    const cours = await prisma.course.delete({ where: { id } });
    for (const image of aRetirer) await retirerAncienFichier(image.url, '');
    await retirerAncienFichier(cours.imageUrl, '');
    await logAudit({ userId: g.user.id, action: 'DELETE', entity: 'Course', entityId: id });
  }
  revalidatePath('/admin/formations');
  revalidatePath('/formations');
}

export async function saveModuleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const g = await guard('courses.manage');
  if (isDenied(g)) return g.error;

  const parsed = moduleSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodToState(parsed.error);
  const d = parsed.data;

  if (d.id) {
    await prisma.courseModule.update({
      where: { id: d.id },
      data: { title: d.title, description: d.description ?? null, orderIndex: d.orderIndex, durationHours: d.durationHours },
    });
  } else {
    const last = await prisma.courseModule.count({ where: { courseId: d.courseId } });
    await prisma.courseModule.create({
      data: {
        courseId: d.courseId,
        title: d.title,
        description: d.description ?? null,
        orderIndex: d.orderIndex || last,
        durationHours: d.durationHours,
      },
    });
  }

  await logAudit({ userId: g.user.id, action: d.id ? 'UPDATE' : 'CREATE', entity: 'CourseModule', entityId: d.id ?? null });
  revalidatePath(`/admin/formations/${d.courseId}`);
  return { ok: true, message: 'Module enregistré.' };
}

export async function deleteModuleAction(formData: FormData): Promise<void> {
  const g = await guard('courses.manage');
  if (isDenied(g)) return;
  const id = String(formData.get('id') ?? '');
  const courseId = String(formData.get('courseId') ?? '');
  if (!id) return;
  await prisma.courseModule.delete({ where: { id } });
  await logAudit({ userId: g.user.id, action: 'DELETE', entity: 'CourseModule', entityId: id });
  revalidatePath(`/admin/formations/${courseId}`);
}

export async function saveSessionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const g = await guard('sessions.manage');
  if (isDenied(g)) return g.error;

  const parsed = sessionSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodToState(parsed.error);
  const d = parsed.data;

  const formation = await prisma.course.findUnique({ where: { id: d.courseId }, select: { id: true, name: true } });
  if (!formation) return { ok: false, message: 'Formation introuvable.' };

  const upload = await saveUpload(formData.get('image') as File | null);
  if (upload && !upload.ok) return { ok: false, message: upload.error };
  if (upload?.ok) {
    const controle = await verifierEcriture(upload.url, upload.sha256);
    if (!controle.ok) return { ok: false, message: controle.error };
  }

  const ancienneImage = d.id
    ? (await prisma.courseSession.findUnique({ where: { id: d.id }, select: { imageUrl: true } }))?.imageUrl
    : null;

  // Reduire la capacite en dessous du nombre d'inscrites creerait une session
  // en surreservation : on le refuse plutot que d'afficher un nombre negatif.
  if (d.id) {
    const occupees = await prisma.enrollment.count({
      where: { sessionId: d.id, ...filtreInscriptionsOccupantes },
    });
    if (d.capacity < occupees) {
      return {
        ok: false,
        message: `Impossible : ${occupees} inscription(s) confirmée(s) occupent déjà cette session.`,
      };
    }
  }

  const data = {
    courseId: d.courseId,
    title: d.title,
    startDate: new Date(`${d.startDate}T${d.startTime || '00:00'}`),
    endDate: new Date(`${d.endDate}T${d.endTime || '23:59'}`),
    registrationDeadline: d.registrationDeadline ? new Date(d.registrationDeadline) : null,
    location: d.location ?? null,
    capacity: d.capacity,
    // Prix laisse vide : la session suit le prix officiel de la formation.
    price: d.price,
    trainerId: d.trainerId || null,
    status: d.status,
    description: d.description ?? null,
    ...(upload?.ok ? { imageUrl: upload.url } : {}),
  };

  const slug = await uniqueSessionSlug(formation.name, d.title, d.id);
  const session = d.id
    ? await prisma.courseSession.update({ where: { id: d.id }, data: { ...data, slug } })
    : await prisma.courseSession.create({ data: { ...data, slug } });

  if (upload?.ok) await retirerAncienFichier(ancienneImage, upload.url);

  await logAudit({
    userId: g.user.id,
    action: d.id ? 'UPDATE' : 'CREATE',
    entity: 'CourseSession',
    entityId: session.id,
    details: `${formation.name} — ${d.title}`,
  });
  revalidatePath('/admin/sessions');
  revalidatePath(`/admin/formations/${d.courseId}`);
  revalidatePath('/calendrier-formations');
  revalidatePath(`/sessions/${slug}`);
  revalidatePath('/formations');
  revalidatePath('/');
  return { ok: true, message: d.id ? 'Session mise à jour.' : 'Session créée.' };
}

export async function deleteSessionAction(formData: FormData): Promise<void> {
  const g = await guard('sessions.manage');
  if (isDenied(g)) return;
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  // Une session deja suivie n'est jamais supprimee : elle est annulee, pour
  // que les inscriptions et les presences restent consultables.
  const occupees = await prisma.enrollment.count({ where: { sessionId: id } });
  if (occupees > 0) {
    await prisma.courseSession.update({ where: { id }, data: { status: SESSION_STATUS.ANNULEE } });
    await logAudit({ userId: g.user.id, action: 'CANCEL', entity: 'CourseSession', entityId: id });
  } else {
    const session = await prisma.courseSession.delete({ where: { id } });
    await retirerAncienFichier(session.imageUrl, '');
    await logAudit({ userId: g.user.id, action: 'DELETE', entity: 'CourseSession', entityId: id });
  }

  revalidatePath('/admin/sessions');
  revalidatePath('/calendrier-formations');
  revalidatePath('/');
}

/* ------------------------------------------------------------- PRESTATIONS */

export async function saveServiceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const g = await guard('services.manage');
  if (isDenied(g)) return g.error;

  const raw = withCheckboxes(formToObject(formData), ['isAvailable', 'isFeatured']);
  const parsed = serviceSchema.safeParse(raw);
  if (!parsed.success) return zodToState(parsed.error);
  const d = parsed.data;

  const upload = await saveUpload(formData.get('image') as File | null);
  if (upload && !upload.ok) return { ok: false, message: upload.error };

  if (upload?.ok) {
    const controle = await verifierEcriture(upload.url, upload.sha256);
    if (!controle.ok) return { ok: false, message: controle.error };
  }

  const ancienneImagePrestation = d.id
    ? (await prisma.service.findUnique({ where: { id: d.id }, select: { imageUrl: true } }))?.imageUrl
    : null;

  const data = {
    name: d.name,
    category: d.category,
    description: d.description,
    price: d.price,
    durationMinutes: d.durationMinutes,
    isAvailable: d.isAvailable,
    isFeatured: d.isFeatured,
    ...(upload?.ok ? { imageUrl: upload.url } : {}),
  };

  const service = d.id
    ? await prisma.service.update({ where: { id: d.id }, data })
    : await prisma.service.create({ data: { ...data, slug: await uniqueSlug('service', d.name) } });

  if (upload?.ok) await retirerAncienFichier(ancienneImagePrestation, upload.url);

  await logAudit({
    userId: g.user.id,
    action: d.id ? 'UPDATE' : 'CREATE',
    entity: 'Service',
    entityId: service.id,
    details: service.name,
  });

  revalidatePath('/admin/prestations');
  revalidatePath('/prestations');
  revalidatePath('/');
  return { ok: true, message: d.id ? 'Prestation mise à jour.' : 'Prestation créée.' };
}

export async function deleteServiceAction(formData: FormData): Promise<void> {
  const g = await guard('services.manage');
  if (isDenied(g)) return;
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  const used = await prisma.appointment.count({ where: { serviceId: id } });
  if (used > 0) {
    await prisma.service.update({ where: { id }, data: { isAvailable: false } });
    await logAudit({ userId: g.user.id, action: 'DISABLE', entity: 'Service', entityId: id });
  } else {
    const prestation = await prisma.service.delete({ where: { id } });
    await retirerAncienFichier(prestation.imageUrl, '');
    await logAudit({ userId: g.user.id, action: 'DELETE', entity: 'Service', entityId: id });
  }
  revalidatePath('/admin/prestations');
  revalidatePath('/prestations');
}
