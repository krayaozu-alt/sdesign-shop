import { Pencil, Plus } from 'lucide-react';
import { ServiceForm } from '@/components/admin/CatalogForms';
import { Badge, Card, EmptyState, Media } from '@/components/ui/primitives';
import { Disclosure } from '@/components/ui/Disclosure';
import { formatDuration, formatMoney } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { deleteServiceAction } from '@/server/actions/catalog';
import { requirePermission } from '@/lib/auth';

export const metadata = { title: 'Prestations' };
export const dynamic = 'force-dynamic';

export default async function AdminServicesPage() {
  await requirePermission('services.manage');
  const services = await prisma.service.findMany({
    include: { _count: { select: { appointments: true } } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });

  return (
    <div className="space-y-5">
      <div>
        <p className="label-eyebrow mb-1">Catalogue</p>
        <h1 className="section-title">Prestations</h1>
      </div>

      <Disclosure label={<><Plus size={15} /> Nouvelle prestation</>}>
        <ServiceForm service={null} />
      </Disclosure>

      {services.length === 0 ? (
        <EmptyState title="Aucune prestation" description="Ajoutez vos prestations pour ouvrir les réservations." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <Card key={s.id} className="p-0">
              <Media src={s.imageUrl} alt={s.name} label={s.name} ratio="aspect-[5/3]" />
              <div className="p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h2 className="font-display text-lg text-cream">{s.name}</h2>
                  <Badge tone={s.isAvailable ? 'green' : 'red'}>{s.isAvailable ? 'Active' : 'Inactive'}</Badge>
                </div>
                <p className="mb-2 line-clamp-2 text-xs text-cream-muted">{s.description}</p>
                <p className="mb-3 text-xs text-cream-dim">
                  {formatMoney(s.price)} · {formatDuration(s.durationMinutes)} · {s._count.appointments} RDV
                </p>
                <div className="space-y-2">
                  <Disclosure variant="row" label={<><Pencil size={13} /> Modifier</>}>
                    <ServiceForm
                      service={{
                        id: s.id,
                        name: s.name,
                        category: s.category,
                        description: s.description,
                        price: s.price,
                        durationMinutes: s.durationMinutes,
                        isAvailable: s.isAvailable,
                        isFeatured: s.isFeatured,
                      }}
                    />
                  </Disclosure>
                  <form action={deleteServiceAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <button type="submit" className="btn-danger w-full px-3 py-2 text-xs">
                      {s._count.appointments > 0 ? 'Désactiver' : 'Supprimer'}
                    </button>
                  </form>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
