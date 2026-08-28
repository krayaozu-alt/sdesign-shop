import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EnrollmentWizard } from '@/components/forms/EnrollmentWizard';
import { getCurrentUser } from '@/lib/auth';
import { COURSE_STATUS, PAYMENT_METHOD_VALUES, type PaymentMethod } from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import { getSettings, splitList } from '@/lib/settings';
import { periodeLisible } from '@/components/public/SessionCard';
import { sessionParSlug } from '@/server/sessions';

export const metadata: Metadata = { title: 'Inscription à une formation' };
export const dynamic = 'force-dynamic';

export default async function EnrollPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { session?: string };
}) {
  const course = await prisma.course.findUnique({ where: { slug: params.slug } });
  if (!course || course.status === COURSE_STATUS.ARCHIVEE || course.status === COURSE_STATUS.BROUILLON) {
    notFound();
  }

  const [settings, user] = await Promise.all([getSettings(), getCurrentUser().catch(() => null)]);

  // Session visee, transmise par « ?session=slug » depuis le calendrier,
  // l'accueil ou la fiche de session. Elle n'est retenue que si elle appartient
  // bien a cette formation et accepte encore des inscriptions.
  const sessionChoisie = searchParams.session ? await sessionParSlug(searchParams.session) : null;
  const session =
    sessionChoisie && sessionChoisie.course.id === course.id && sessionChoisie.etat.inscriptionPossible
      ? {
          id: sessionChoisie.id,
          titre: sessionChoisie.title,
          periode: periodeLisible(sessionChoisie.startDate, sessionChoisie.endDate),
          prix: sessionChoisie.prix,
        }
      : null;
  const configured = splitList(settings['payments.methods']).filter((m) =>
    (PAYMENT_METHOD_VALUES as readonly string[]).includes(m),
  ) as PaymentMethod[];

  return (
    <div className="container-page py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 text-center">
          <p className="label-eyebrow mb-1">Inscription</p>
          <h1 className="section-title">{course.name}</h1>
        </div>
        <EnrollmentWizard
          course={{
            id: course.id,
            name: course.name,
            price: course.price,
            depositAmount: course.depositAmount,
            durationLabel: course.durationLabel,
            slug: course.slug,
          }}
          session={session}
          methods={configured.length ? configured : (['ESPECES'] as PaymentMethod[])}
          currentUser={
            user
              ? { fullName: user.fullName, phone: user.phone, whatsapp: user.whatsapp, email: user.email }
              : null
          }
        />
      </div>
    </div>
  );
}
