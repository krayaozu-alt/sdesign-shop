import Link from 'next/link';
import { Bell } from 'lucide-react';
import { Badge, Card, DataTable, EmptyState, Td, toneForStatus } from '@/components/ui/primitives';
import { requireUser } from '@/lib/auth';
import { formatDateTime, relativeFromNow } from '@/lib/format';
import { CHANNELS } from '@/lib/notifications';
import { prisma } from '@/lib/prisma';
import { markNotificationsReadAction, retryNotificationAction } from '@/server/actions/content';
import { requirePermission } from '@/lib/auth';

export const metadata = { title: 'Notifications' };
export const dynamic = 'force-dynamic';

export default async function AdminNotificationsPage() {
  await requirePermission('notifications.manage');
  const user = await requireUser();

  const [mine, pending] = await Promise.all([
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 60 }),
    prisma.notification.findMany({
      where: { status: 'EN_ATTENTE' },
      include: { user: { select: { fullName: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ]);

  const channelStates = Object.values(CHANNELS).map((c) => ({ code: c.code, configured: c.isConfigured() }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-eyebrow mb-1">Système</p>
          <h1 className="section-title">Notifications</h1>
        </div>
        <form action={markNotificationsReadAction}>
          <button type="submit" className="btn-ghost px-4 py-2 text-xs">
            Tout marquer comme lu
          </button>
        </form>
      </div>

      <Card>
        <p className="mb-3 text-sm text-cream">Canaux de diffusion</p>
        <div className="flex flex-wrap gap-2">
          {channelStates.map((c) => (
            <Badge key={c.code} tone={c.configured ? 'green' : 'amber'}>
              {c.code} — {c.configured ? 'actif' : 'non configuré'}
            </Badge>
          ))}
        </div>
        <p className="mt-3 text-xs text-cream-muted">
          Le canal <strong>APP</strong> est opérationnel. WhatsApp, SMS et Email suivent le même contrat
          (<code className="text-gold-300">src/lib/notifications.ts</code>) : dès qu’un fournisseur est branché, les
          messages en attente ci-dessous peuvent être renvoyés sans autre modification.
        </p>
      </Card>

      <section>
        <h2 className="mb-3 font-display text-lg text-cream">Mes notifications</h2>
        {mine.length === 0 ? (
          <EmptyState icon={<Bell size={26} />} title="Aucune notification" />
        ) : (
          <div className="space-y-2">
            {mine.map((n) => (
              <Card key={n.id} className={n.isRead ? 'py-3' : 'border-gold-500/30 py-3'}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-cream">{n.title}</p>
                    <p className="text-sm text-cream-muted">{n.message}</p>
                    <p className="mt-1 text-[11px] text-cream-dim">{relativeFromNow(n.createdAt)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {n.link ? (
                      <Link href={n.link} className="text-xs text-gold-300 hover:text-gold-200">
                        Ouvrir →
                      </Link>
                    ) : null}
                    {!n.isRead ? (
                      <form action={markNotificationsReadAction}>
                        <input type="hidden" name="id" value={n.id} />
                        <button type="submit" className="btn-ghost px-3 py-1.5 text-[11px]">
                          Lu
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg text-cream">File d’attente ({pending.length})</h2>
        {pending.length === 0 ? (
          <Card className="text-sm text-cream-muted">Aucun message en attente d’envoi.</Card>
        ) : (
          <DataTable head={['Date', 'Destinataire', 'Canal', 'Message', 'Statut', '']}>
            {pending.map((n) => (
              <tr key={n.id}>
                <Td className="whitespace-nowrap">{formatDateTime(n.createdAt)}</Td>
                <Td>{n.user?.fullName ?? '—'}</Td>
                <Td>{n.channel}</Td>
                <Td className="max-w-xs truncate">{n.message}</Td>
                <Td>
                  <Badge tone={toneForStatus(n.status)}>{n.status}</Badge>
                </Td>
                <Td>
                  <form action={retryNotificationAction}>
                    <input type="hidden" name="id" value={n.id} />
                    <button type="submit" className="btn-ghost px-3 py-1.5 text-xs">
                      Relancer
                    </button>
                  </form>
                </Td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>
    </div>
  );
}
