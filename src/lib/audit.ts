import 'server-only';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';

/** Journalise une action sensible (creation, modification, suppression). */
export async function logAudit(params: {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: unknown;
}): Promise<void> {
  try {
    const h = headers();
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? null;
    await prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        details:
          params.details === undefined
            ? null
            : typeof params.details === 'string'
              ? params.details
              : JSON.stringify(params.details),
        ip,
      },
    });
  } catch {
    // Le journal ne doit jamais faire echouer l'operation metier.
  }
}
