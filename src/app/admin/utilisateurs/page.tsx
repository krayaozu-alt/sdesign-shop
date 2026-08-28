import { Pencil, Plus } from 'lucide-react';
import { UserForm } from '@/components/admin/PeopleForms';
import { Badge, Card, DataTable, Td } from '@/components/ui/primitives';
import { Disclosure } from '@/components/ui/Disclosure';
import { requireRole } from '@/lib/auth';
import { ROLES, ROLE_LABELS, type Role } from '@/lib/constants';
import { formatDateShort } from '@/lib/format';
import { prisma } from '@/lib/prisma';

export const metadata = { title: 'Utilisateurs' };
export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const current = await requireRole([ROLES.ADMIN]);
  const users = await prisma.user.findMany({ orderBy: [{ role: 'asc' }, { fullName: 'asc' }], take: 300 });

  return (
    <div className="space-y-5">
      <div>
        <p className="label-eyebrow mb-1">Sécurité</p>
        <h1 className="section-title">Utilisateurs & rôles</h1>
      </div>

      <Disclosure label={<><Plus size={15} /> Nouvel utilisateur</>}>
        <UserForm user={null} currentUserId={current.id} />
      </Disclosure>

      <DataTable head={['Nom', 'Téléphone', 'Rôle', 'Statut', 'Dernière connexion', '']}>
        {users.map((u) => (
          <tr key={u.id}>
            <Td className="text-cream">{u.fullName}</Td>
            <Td>{u.phone}</Td>
            <Td>
              <Badge tone={u.role === ROLES.ADMIN ? 'gold' : 'neutral'}>{ROLE_LABELS[u.role as Role] ?? u.role}</Badge>
            </Td>
            <Td>
              <Badge tone={u.isActive ? 'green' : 'red'}>{u.isActive ? 'Actif' : 'Désactivé'}</Badge>
            </Td>
            <Td>{u.lastLoginAt ? formatDateShort(u.lastLoginAt) : '—'}</Td>
            <Td>
              <Disclosure variant="row" label={<><Pencil size={13} /> Modifier</>}>
                <UserForm
                  user={{
                    id: u.id,
                    fullName: u.fullName,
                    phone: u.phone,
                    whatsapp: u.whatsapp,
                    email: u.email,
                    role: u.role,
                    isActive: u.isActive,
                  }}
                  currentUserId={current.id}
                />
              </Disclosure>
            </Td>
          </tr>
        ))}
      </DataTable>

      <Card className="text-xs text-cream-muted">
        <p className="mb-2 text-cream">Droits par rôle</p>
        <ul className="space-y-1">
          <li>
            <strong className="text-gold-300">Administrateur</strong> — accès complet, paramètres, utilisateurs,
            rapports.
          </li>
          <li>
            <strong className="text-gold-300">Formateur</strong> — élèves, formations, présences, progression,
            certificats.
          </li>
          <li>
            <strong className="text-gold-300">Employé</strong> — clientes, réservations, prestations, encaissements,
            reçus.
          </li>
          <li>
            <strong className="text-gold-300">Élève</strong> / <strong className="text-gold-300">Cliente</strong> —
            espace personnel uniquement.
          </li>
        </ul>
      </Card>
    </div>
  );
}
