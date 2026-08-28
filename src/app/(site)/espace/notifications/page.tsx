import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { Bell, BellOff } from 'lucide-react';
import { Card, EmptyState } from '@/components/ui/primitives';
import { requireUser } from '@/lib/auth';
import { relativeFromNow } from '@/lib/format';
import { prisma } from '@/lib/prisma';

export const metadata = { title: 'Notifications' };
export const dynamic = 'force-dynamic';

async function markAllRead() {
  'use server';
  const user = await requireUser();
  await prisma.notification.updateMany({ where: { userId: user.id, isRead: false }, data: { isRead: true } });
  revalidatePath('/espace/notifications');
}

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const unread = notifications.filter((n) => !n.isRead).length;

  if (notifications.length === 0) {
    return (
      <EmptyState
        icon={<BellOff size={28} />}
        title="Aucune notification"
        description="Vos confirmations de rendez-vous, paiements et certificats apparaîtront ici."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-cream-muted">
          {unread > 0 ? `${unread} non lue${unread > 1 ? 's' : ''}` : 'Tout est à jour'}
        </p>
        {unread > 0 ? (
          <form action={markAllRead}>
            <button type="submit" className="btn-ghost px-4 py-2 text-xs">
              Tout marquer comme lu
            </button>
          </form>
        ) : null}
      </div>

      {notifications.map((n) => (
        <Card key={n.id} className={n.isRead ? '' : 'border-gold-500/30'}>
          <div className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                n.isRead ? 'bg-white/5 text-cream-dim' : 'bg-gold-500/12 text-gold-300'
              }`}
            >
              <Bell size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-cream">{n.title}</p>
              <p className="mt-0.5 text-sm text-cream-muted">{n.message}</p>
              <p className="mt-1 text-[11px] text-cream-dim">{relativeFromNow(n.createdAt)}</p>
            </div>
            {n.link ? (
              <Link href={n.link} className="shrink-0 text-xs text-gold-300 hover:text-gold-200">
                Ouvrir →
              </Link>
            ) : null}
          </div>
        </Card>
      ))}
    </div>
  );
}
