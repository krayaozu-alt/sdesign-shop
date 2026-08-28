import Link from 'next/link';
import { LogOut, ShieldCheck } from 'lucide-react';
import { PasswordForm, ProfileForm } from '@/components/forms/ProfileForms';
import { Badge, Card } from '@/components/ui/primitives';
import { requireUser } from '@/lib/auth';
import { ROLE_LABELS, type Role } from '@/lib/constants';
import { formatDateShort } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { initials } from '@/lib/utils';

export const metadata = { title: 'Mon profil' };
export const dynamic = 'force-dynamic';

export default async function ProfilPage() {
  const user = await requireUser();

  const [nbFormations, nbRendezVous] = await Promise.all([
    user.student ? prisma.enrollment.count({ where: { studentId: user.student.id } }) : 0,
    user.customer ? prisma.appointment.count({ where: { customerId: user.customer.id } }) : 0,
  ]);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
      <div className="space-y-5">
        <Card>
          <div className="flex items-center gap-4">
            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-gold-500/30 bg-gold-500/10 font-display text-2xl text-gold-300">
              {initials(user.fullName)}
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-xl text-cream">{user.fullName}</p>
              <Badge tone="gold" className="mt-1">
                {ROLE_LABELS[user.role as Role] ?? user.role}
              </Badge>
              <p className="mt-1.5 text-xs text-cream-dim">Membre depuis le {formatDateShort(user.createdAt)}</p>
            </div>
          </div>

          <div className="my-5 gold-rule" />

          <dl className="space-y-2.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-cream-dim">Téléphone</dt>
              <dd className="text-cream">{user.phone}</dd>
            </div>
            {user.whatsapp ? (
              <div className="flex justify-between gap-3">
                <dt className="text-cream-dim">WhatsApp</dt>
                <dd className="text-cream">{user.whatsapp}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-3">
              <dt className="text-cream-dim">Email</dt>
              <dd className="truncate text-cream">{user.email ?? '—'}</dd>
            </div>
            {user.student ? (
              <div className="flex justify-between gap-3">
                <dt className="text-cream-dim">Matricule</dt>
                <dd className="text-gold-300">{user.student.matricule}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-3">
              <dt className="text-cream-dim">Formations</dt>
              <dd className="text-cream">{nbFormations}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-cream-dim">Rendez-vous</dt>
              <dd className="text-cream">{nbRendezVous}</dd>
            </div>
          </dl>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/espace/formations" className="btn-ghost px-4 py-2 text-xs">
              Historique formations
            </Link>
            <Link href="/espace/rendez-vous" className="btn-ghost px-4 py-2 text-xs">
              Historique rendez-vous
            </Link>
          </div>
        </Card>

        <Card>
          <p className="mb-4 flex items-center gap-2 text-sm text-cream">
            <ShieldCheck size={16} className="text-gold-400" /> Sécurité
          </p>
          <PasswordForm />
          <div className="mt-4 border-t border-white/8 pt-4">
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="btn-ghost w-full">
                <LogOut size={15} /> Se déconnecter
              </button>
            </form>
          </div>
        </Card>
      </div>

      <Card>
        <p className="mb-4 text-sm text-cream">Mes informations</p>
        <ProfileForm
          user={{
            fullName: user.fullName,
            phone: user.phone,
            whatsapp: user.whatsapp,
            email: user.email,
            address: user.customer?.address ?? user.student?.address ?? null,
          }}
        />
        <p className="mt-4 text-xs text-cream-dim">
          Besoin d’aide ?{' '}
          <Link href="/contact" className="text-gold-300 hover:text-gold-200">
            Contactez la boutique
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}
