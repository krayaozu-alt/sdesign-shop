'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { ROLES } from '@/lib/constants';
import { nextReference } from '@/lib/refs';
import { customerSchema, studentSchema, trainerSchema, userSchema, zodToState, type ActionState } from '@/lib/validation';
import { formToObject, guard, isDenied, withCheckboxes } from '@/server/guard';
import { retirerAncienFichier, saveUpload, verifierEcriture } from '@/server/uploads';

/* ---------------------------------------------------------------- CLIENTES */

export async function saveCustomerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const g = await guard('customers.manage');
  if (isDenied(g)) return g.error;

  const parsed = customerSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodToState(parsed.error);
  const d = parsed.data;

  const clash = await prisma.customer.findFirst({
    where: { phone: d.phone, ...(d.id ? { id: { not: d.id } } : {}) },
    select: { id: true },
  });
  if (clash) return { ok: false, message: 'Une cliente utilise déjà ce numéro.' };

  const data = {
    fullName: d.fullName,
    phone: d.phone,
    whatsapp: d.whatsapp ?? null,
    email: d.email ?? null,
    address: d.address ?? null,
    notes: d.notes ?? null,
  };

  const customer = d.id
    ? await prisma.customer.update({ where: { id: d.id }, data })
    : await prisma.customer.create({ data });

  await logAudit({
    userId: g.user.id,
    action: d.id ? 'UPDATE' : 'CREATE',
    entity: 'Customer',
    entityId: customer.id,
    details: customer.fullName,
  });
  revalidatePath('/admin/clients');
  return { ok: true, message: d.id ? 'Fiche cliente mise à jour.' : 'Cliente ajoutée.' };
}

export async function deleteCustomerAction(formData: FormData): Promise<void> {
  const g = await guard('customers.manage');
  if (isDenied(g)) return;
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const used = await prisma.appointment.count({ where: { customerId: id } });
  if (used > 0) return; // historique preserve : la fiche reste consultable
  await prisma.customer.delete({ where: { id } });
  await logAudit({ userId: g.user.id, action: 'DELETE', entity: 'Customer', entityId: id });
  revalidatePath('/admin/clients');
}

/* ------------------------------------------------------------------ ELEVES */

export async function saveStudentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const g = await guard('students.manage');
  if (isDenied(g)) return g.error;

  const parsed = studentSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodToState(parsed.error);
  const d = parsed.data;

  if (d.id) {
    const student = await prisma.student.findUnique({ where: { id: d.id }, include: { user: true } });
    if (!student) return { ok: false, message: 'Élève introuvable.' };

    const clash = await prisma.user.findFirst({
      where: { id: { not: student.userId }, OR: [{ phone: d.phone }, ...(d.email ? [{ email: d.email }] : [])] },
      select: { id: true },
    });
    if (clash) return { ok: false, message: 'Ce téléphone ou cet email est déjà utilisé.' };

    await prisma.user.update({
      where: { id: student.userId },
      data: {
        fullName: d.fullName,
        phone: d.phone,
        whatsapp: d.whatsapp ?? null,
        email: d.email ?? null,
        ...(d.password ? { passwordHash: await hashPassword(d.password) } : {}),
      },
    });
    await prisma.student.update({
      where: { id: d.id },
      data: {
        birthDate: d.birthDate ? new Date(d.birthDate) : null,
        address: d.address ?? null,
        emergencyContact: d.emergencyContact ?? null,
        notes: d.notes ?? null,
      },
    });
    await logAudit({ userId: g.user.id, action: 'UPDATE', entity: 'Student', entityId: d.id, details: d.fullName });
    revalidatePath('/admin/eleves');
    return { ok: true, message: 'Élève mise à jour.' };
  }

  const existing = await prisma.user.findFirst({ where: { phone: d.phone }, include: { student: true } });
  if (existing?.student) return { ok: false, message: 'Cette personne est déjà enregistrée comme élève.' };

  const password = d.password && d.password.length >= 6 ? d.password : d.phone.replace(/\D/g, '').slice(-6);

  const user =
    existing ??
    (await prisma.user.create({
      data: {
        fullName: d.fullName,
        phone: d.phone,
        whatsapp: d.whatsapp ?? null,
        email: d.email ?? null,
        passwordHash: await hashPassword(password),
        role: ROLES.ELEVE,
      },
    }));

  const student = await prisma.student.create({
    data: {
      userId: user.id,
      matricule: await nextReference('student'),
      birthDate: d.birthDate ? new Date(d.birthDate) : null,
      address: d.address ?? null,
      emergencyContact: d.emergencyContact ?? null,
      notes: d.notes ?? null,
    },
  });

  if (existing && existing.role === ROLES.CLIENTE) {
    await prisma.user.update({ where: { id: existing.id }, data: { role: ROLES.ELEVE } });
  }

  await logAudit({ userId: g.user.id, action: 'CREATE', entity: 'Student', entityId: student.id, details: d.fullName });
  revalidatePath('/admin/eleves');
  return {
    ok: true,
    message: `Élève créée — matricule ${student.matricule}.${existing ? '' : ` Mot de passe initial : ${password}`}`,
  };
}

export async function deleteStudentAction(formData: FormData): Promise<void> {
  const g = await guard('students.manage');
  if (isDenied(g)) return;
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const used = await prisma.enrollment.count({ where: { studentId: id } });
  if (used > 0) return; // dossier conserve : inscriptions et paiements lies
  const student = await prisma.student.findUnique({ where: { id } });
  await prisma.student.delete({ where: { id } });
  if (student) await prisma.user.update({ where: { id: student.userId }, data: { role: ROLES.CLIENTE } });
  await logAudit({ userId: g.user.id, action: 'DELETE', entity: 'Student', entityId: id });
  revalidatePath('/admin/eleves');
}

/* -------------------------------------------------------------- FORMATEURS */

export async function saveTrainerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const g = await guard('trainers.manage');
  if (isDenied(g)) return g.error;

  const raw = withCheckboxes(formToObject(formData), ['isActive']);
  const parsed = trainerSchema.safeParse(raw);
  if (!parsed.success) return zodToState(parsed.error);
  const d = parsed.data;

  const upload = await saveUpload(formData.get('photo') as File | null);
  if (upload && !upload.ok) return { ok: false, message: upload.error };

  if (upload?.ok) {
    const controle = await verifierEcriture(upload.url, upload.sha256);
    if (!controle.ok) return { ok: false, message: controle.error };
  }

  const anciennePhoto = d.id
    ? (await prisma.trainer.findUnique({ where: { id: d.id }, select: { photoUrl: true } }))?.photoUrl
    : null;

  const data = {
    fullName: d.fullName,
    speciality: d.speciality,
    phone: d.phone ?? null,
    whatsapp: d.whatsapp ?? null,
    bio: d.bio ?? null,
    availability: d.availability ?? null,
    isActive: d.isActive,
    ...(upload?.ok ? { photoUrl: upload.url } : {}),
  };

  const trainer = d.id
    ? await prisma.trainer.update({ where: { id: d.id }, data })
    : await prisma.trainer.create({ data });

  if (upload?.ok) await retirerAncienFichier(anciennePhoto, upload.url);

  await logAudit({
    userId: g.user.id,
    action: d.id ? 'UPDATE' : 'CREATE',
    entity: 'Trainer',
    entityId: trainer.id,
    details: trainer.fullName,
  });
  revalidatePath('/admin/formateurs');
  return { ok: true, message: d.id ? 'Formateur mis à jour.' : 'Formateur ajouté.' };
}

export async function deleteTrainerAction(formData: FormData): Promise<void> {
  const g = await guard('trainers.manage');
  if (isDenied(g)) return;
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const used = await prisma.course.count({ where: { trainerId: id } });
  if (used > 0) {
    await prisma.trainer.update({ where: { id }, data: { isActive: false } });
  } else {
    const formateur = await prisma.trainer.delete({ where: { id } });
    await retirerAncienFichier(formateur.photoUrl, '');
  }
  await logAudit({ userId: g.user.id, action: 'DELETE', entity: 'Trainer', entityId: id });
  revalidatePath('/admin/formateurs');
}

/* ---------------------------------------------------------- UTILISATEURS */

export async function saveUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const g = await guard('users.manage');
  if (isDenied(g)) return g.error;

  const raw = withCheckboxes(formToObject(formData), ['isActive']);
  const parsed = userSchema.safeParse(raw);
  if (!parsed.success) return zodToState(parsed.error);
  const d = parsed.data;

  const clash = await prisma.user.findFirst({
    where: { ...(d.id ? { id: { not: d.id } } : {}), OR: [{ phone: d.phone }, ...(d.email ? [{ email: d.email }] : [])] },
    select: { id: true },
  });
  if (clash) return { ok: false, message: 'Ce téléphone ou cet email est déjà utilisé.' };

  if (d.id) {
    // Un administrateur ne peut pas se retirer lui-meme ses propres droits.
    if (d.id === g.user.id && d.role !== g.user.role) {
      return { ok: false, message: 'Vous ne pouvez pas modifier votre propre rôle.' };
    }
    await prisma.user.update({
      where: { id: d.id },
      data: {
        fullName: d.fullName,
        phone: d.phone,
        whatsapp: d.whatsapp ?? null,
        email: d.email ?? null,
        role: d.role,
        isActive: d.isActive,
        ...(d.password && d.password.length >= 6 ? { passwordHash: await hashPassword(d.password) } : {}),
      },
    });
    await logAudit({ userId: g.user.id, action: 'UPDATE', entity: 'User', entityId: d.id, details: d.fullName });
    revalidatePath('/admin/utilisateurs');
    return { ok: true, message: 'Utilisateur mis à jour.' };
  }

  if (!d.password || d.password.length < 6) {
    return { ok: false, message: 'Mot de passe requis (6 caractères minimum).' };
  }

  const user = await prisma.user.create({
    data: {
      fullName: d.fullName,
      phone: d.phone,
      whatsapp: d.whatsapp ?? null,
      email: d.email ?? null,
      role: d.role,
      isActive: d.isActive,
      passwordHash: await hashPassword(d.password),
    },
  });
  await logAudit({ userId: g.user.id, action: 'CREATE', entity: 'User', entityId: user.id, details: d.fullName });
  revalidatePath('/admin/utilisateurs');
  return { ok: true, message: 'Utilisateur créé.' };
}
