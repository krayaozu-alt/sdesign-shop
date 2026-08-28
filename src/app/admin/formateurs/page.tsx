import { Pencil, Plus } from 'lucide-react';
import { TrainerForm } from '@/components/admin/PeopleForms';
import { Badge, Card, EmptyState, Media } from '@/components/ui/primitives';
import { Disclosure } from '@/components/ui/Disclosure';
import { prisma } from '@/lib/prisma';
import { deleteTrainerAction } from '@/server/actions/people';
import { requirePermission } from '@/lib/auth';

export const metadata = { title: 'Formateurs' };
export const dynamic = 'force-dynamic';

export default async function AdminTrainersPage() {
  await requirePermission('trainers.manage');
  const trainers = await prisma.trainer.findMany({
    include: { courses: { select: { id: true, name: true } } },
    orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }],
  });

  return (
    <div className="space-y-5">
      <div>
        <p className="label-eyebrow mb-1">Équipe pédagogique</p>
        <h1 className="section-title">Formateurs</h1>
      </div>

      <Disclosure label={<><Plus size={15} /> Nouveau formateur</>}>
        <TrainerForm trainer={null} />
      </Disclosure>

      {trainers.length === 0 ? (
        <EmptyState title="Aucun formateur" description="Ajoutez les formatrices qui encadrent vos formations." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trainers.map((t) => (
            <Card key={t.id}>
              <div className="mb-3 flex items-center gap-3">
                <Media src={t.photoUrl} alt={t.fullName} label={t.fullName} ratio="aspect-square" className="w-16 rounded-full" />
                <div className="min-w-0">
                  <p className="truncate font-display text-lg text-cream">{t.fullName}</p>
                  <p className="truncate text-xs text-cream-muted">{t.speciality}</p>
                  <Badge tone={t.isActive ? 'green' : 'neutral'} className="mt-1">
                    {t.isActive ? 'Actif' : 'Inactif'}
                  </Badge>
                </div>
              </div>

              {t.availability ? <p className="mb-2 text-xs text-cream-dim">{t.availability}</p> : null}
              {t.bio ? <p className="mb-3 line-clamp-3 text-xs text-cream-muted">{t.bio}</p> : null}

              <p className="mb-3 text-xs text-cream-dim">
                {t.courses.length} formation(s) : {t.courses.map((c) => c.name).join(', ') || '—'}
              </p>

              <div className="space-y-2">
                <Disclosure variant="row" label={<><Pencil size={13} /> Modifier</>}>
                  <TrainerForm
                    trainer={{
                      id: t.id,
                      fullName: t.fullName,
                      speciality: t.speciality,
                      phone: t.phone,
                      whatsapp: t.whatsapp,
                      bio: t.bio,
                      availability: t.availability,
                      isActive: t.isActive,
                    }}
                  />
                </Disclosure>
                <form action={deleteTrainerAction}>
                  <input type="hidden" name="id" value={t.id} />
                  <button type="submit" className="btn-danger w-full px-3 py-2 text-xs">
                    {t.courses.length > 0 ? 'Désactiver' : 'Supprimer'}
                  </button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
