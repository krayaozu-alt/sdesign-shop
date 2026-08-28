import type { Metadata } from 'next';
import { BookingWizard } from '@/components/forms/BookingWizard';
import { EmptyState } from '@/components/ui/primitives';
import { getCurrentUser } from '@/lib/auth';
import { DEFAULT_TIME_SLOTS } from '@/lib/constants';
import { toDateInput } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { getSettings, splitList } from '@/lib/settings';
import { appUrl } from '@/lib/qr';

export const metadata: Metadata = {
  title: 'Réserver une prestation',
  alternates: { canonical: appUrl('/reservation') },
};
export const dynamic = 'force-dynamic';

export default async function BookingPage({ searchParams }: { searchParams: { prestation?: string } }) {
  const [services, settings, user] = await Promise.all([
    prisma.service.findMany({ where: { isAvailable: true }, orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }] }),
    getSettings(),
    getCurrentUser().catch(() => null),
  ]);

  const slots = splitList(settings['booking.slots']);
  const leadDays = Number.parseInt(settings['booking.leadDays'] ?? '0', 10) || 0;
  const min = new Date();
  min.setDate(min.getDate() + leadDays);

  return (
    <div className="container-page py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 text-center">
          <p className="label-eyebrow mb-1">Prise de rendez-vous</p>
          <h1 className="section-title">Réserver une prestation</h1>
          <p className="mt-2 text-sm text-cream-muted">
            Choisissez votre prestation, votre date et votre créneau — nous confirmons votre rendez-vous.
          </p>
        </div>

        {services.length === 0 ? (
          <EmptyState
            title="Aucune prestation disponible"
            description="Les prestations seront publiées depuis l’administration."
          />
        ) : (
          <BookingWizard
            services={services.map((s) => ({
              id: s.id,
              slug: s.slug,
              name: s.name,
              description: s.description,
              price: s.price,
              durationMinutes: s.durationMinutes,
              imageUrl: s.imageUrl,
            }))}
            slots={slots.length ? slots : DEFAULT_TIME_SLOTS}
            minDate={toDateInput(min)}
            preselectedSlug={searchParams.prestation}
            currentUser={
              user ? { fullName: user.fullName, phone: user.phone, whatsapp: user.whatsapp, email: user.email } : null
            }
          />
        )}
      </div>
    </div>
  );
}
