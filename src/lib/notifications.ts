import 'server-only';
import { prisma } from '@/lib/prisma';
import { NOTIFICATION_CHANNELS, ROLES, type NotificationChannel, type NotificationType } from '@/lib/constants';

/**
 * ARCHITECTURE DES NOTIFICATIONS
 * ------------------------------
 * Le canal APP est operationnel : la notification est ecrite en base et
 * apparait immediatement dans le centre de notifications de l'utilisateur.
 *
 * Les canaux WHATSAPP / SMS / EMAIL passent par le meme contrat `Channel`.
 * Aucun fournisseur n'etant configure (pas de cles WhatsApp Cloud API ni de
 * passerelle SMS), ces envois sont enregistres avec le statut EN_ATTENTE et
 * restent visibles dans Admin > Notifications, prets a etre depiles des qu'un
 * adaptateur est branche ici.
 */

export type OutboundMessage = {
  to: string | null;
  title: string;
  message: string;
  link?: string | null;
};

export interface Channel {
  code: NotificationChannel;
  isConfigured(): boolean;
  send(message: OutboundMessage): Promise<{ ok: boolean; error?: string }>;
}

const appChannel: Channel = {
  code: NOTIFICATION_CHANNELS.APP,
  isConfigured: () => true,
  async send() {
    return { ok: true };
  },
};

function pendingChannel(code: NotificationChannel): Channel {
  return {
    code,
    isConfigured: () => false,
    async send() {
      return { ok: false, error: 'Fournisseur non configuré' };
    },
  };
}

export const CHANNELS: Record<NotificationChannel, Channel> = {
  APP: appChannel,
  WHATSAPP: pendingChannel(NOTIFICATION_CHANNELS.WHATSAPP),
  SMS: pendingChannel(NOTIFICATION_CHANNELS.SMS),
  EMAIL: pendingChannel(NOTIFICATION_CHANNELS.EMAIL),
};

export async function notify(params: {
  userId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
  channel?: NotificationChannel;
  payload?: unknown;
  to?: string | null;
}): Promise<void> {
  const channel = params.channel ?? NOTIFICATION_CHANNELS.APP;
  const adapter = CHANNELS[channel];
  const result = adapter.isConfigured()
    ? await adapter.send({
        to: params.to ?? null,
        title: params.title,
        message: params.message,
        link: params.link,
      })
    : { ok: false, error: 'Fournisseur non configuré' };

  try {
    await prisma.notification.create({
      data: {
        userId: params.userId ?? null,
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link ?? null,
        channel,
        status: result.ok ? 'ENVOYEE' : 'EN_ATTENTE',
        sentAt: result.ok ? new Date() : null,
        payload: params.payload ? JSON.stringify(params.payload) : null,
      },
    });
  } catch {
    // Une notification ne doit jamais faire echouer l'operation metier.
  }
}

/** Notifie toute l'equipe (administrateurs + employes). */
export async function notifyStaff(params: {
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
}): Promise<void> {
  try {
    const staff = await prisma.user.findMany({
      where: { isActive: true, role: { in: [ROLES.ADMIN, ROLES.EMPLOYE] } },
      select: { id: true },
    });
    await Promise.all(staff.map((s) => notify({ ...params, userId: s.id })));
  } catch {
    // silencieux
  }
}
