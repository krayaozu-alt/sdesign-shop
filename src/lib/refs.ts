import { prisma } from '@/lib/prisma';

/**
 * Generation des numeros metier (inscriptions, reservations, paiements,
 * recus, certificats, matricules). Format : PREFIXE-ANNEE-SEQUENCE.
 * La sequence est calculee par comptage annuel puis verifiee pour unicite.
 */

const PREFIXES = {
  enrollment: 'INS',
  appointment: 'RDV',
  payment: 'PAY',
  receipt: 'REC',
  certificate: 'CERT',
  student: 'ELV',
} as const;

type RefKind = keyof typeof PREFIXES;

function yearStart(year: number) {
  return new Date(year, 0, 1);
}

async function countThisYear(kind: RefKind, year: number): Promise<number> {
  const gte = yearStart(year);
  const lt = yearStart(year + 1);
  const range = { gte, lt };
  switch (kind) {
    case 'enrollment':
      return prisma.enrollment.count({ where: { createdAt: range } });
    case 'appointment':
      return prisma.appointment.count({ where: { createdAt: range } });
    case 'payment':
      return prisma.payment.count({ where: { createdAt: range } });
    case 'receipt':
      return prisma.receipt.count({ where: { issuedAt: range } });
    case 'certificate':
      return prisma.certificate.count({ where: { createdAt: range } });
    case 'student':
      return prisma.student.count({ where: { createdAt: range } });
  }
}

async function exists(kind: RefKind, value: string): Promise<boolean> {
  switch (kind) {
    case 'enrollment':
      return !!(await prisma.enrollment.findUnique({ where: { reference: value }, select: { id: true } }));
    case 'appointment':
      return !!(await prisma.appointment.findUnique({ where: { reference: value }, select: { id: true } }));
    case 'payment':
      return !!(await prisma.payment.findUnique({ where: { reference: value }, select: { id: true } }));
    case 'receipt':
      return !!(await prisma.receipt.findUnique({ where: { number: value }, select: { id: true } }));
    case 'certificate':
      return !!(await prisma.certificate.findUnique({ where: { number: value }, select: { id: true } }));
    case 'student':
      return !!(await prisma.student.findUnique({ where: { matricule: value }, select: { id: true } }));
  }
}

export async function nextReference(kind: RefKind, date = new Date()): Promise<string> {
  const year = date.getFullYear();
  const prefix = PREFIXES[kind];
  let seq = (await countThisYear(kind, year)) + 1;
  // Garde-fou : en cas de suppression d'enregistrements le compteur peut collisionner.
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = `${prefix}-${year}-${String(seq).padStart(5, '0')}`;
    if (!(await exists(kind, candidate))) return candidate;
    seq += 1;
  }
  return `${prefix}-${year}-${Date.now().toString().slice(-6)}`;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Code court public imprime sous le QR code de verification d'un certificat. */
export function randomVerificationCode(length = 10): string {
  const bytes = new Uint8Array(length);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = '';
  for (let i = 0; i < length; i += 1) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return `${out.slice(0, 5)}-${out.slice(5)}`;
}
