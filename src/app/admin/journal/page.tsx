import { DataTable, EmptyState, Td } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import { prisma } from '@/lib/prisma';

export const metadata = { title: 'Journal' };
export const dynamic = 'force-dynamic';

export default async function AdminAuditPage() {
  await requireRole([ROLES.ADMIN]);

  const logs = await prisma.auditLog.findMany({
    include: { user: { select: { fullName: true } } },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });

  return (
    <div className="space-y-5">
      <div>
        <p className="label-eyebrow mb-1">Sécurité</p>
        <h1 className="section-title">Journal des actions</h1>
        <p className="mt-2 text-sm text-cream-muted">
          Toutes les créations, modifications et suppressions sensibles sont tracées.
        </p>
      </div>

      {logs.length === 0 ? (
        <EmptyState title="Journal vide" description="Les actions du back-office apparaîtront ici." />
      ) : (
        <DataTable head={['Date', 'Utilisateur', 'Action', 'Entité', 'Détail', 'IP']}>
          {logs.map((l) => (
            <tr key={l.id}>
              <Td className="whitespace-nowrap">{formatDateTime(l.createdAt)}</Td>
              <Td>{l.user?.fullName ?? 'Système'}</Td>
              <Td className="text-cream">{l.action}</Td>
              <Td>{l.entity}</Td>
              <Td className="max-w-xs truncate">{l.details ?? '—'}</Td>
              <Td className="text-xs">{l.ip ?? '—'}</Td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
