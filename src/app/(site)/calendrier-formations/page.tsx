import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendrierSessions, type SessionCalendrier } from '@/components/public/CalendrierSessions';
import { appUrl } from '@/lib/qr';
import { categoriesDesSessions, sessionsEntre } from '@/server/sessions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Calendrier des formations',
  description:
    'Toutes les prochaines sessions de formation S.DESIGN SHOP : dates, places disponibles, tarifs et inscription en ligne.',
  alternates: { canonical: appUrl('/calendrier-formations') },
  openGraph: {
    title: 'S.DESIGN SHOP — Calendrier des formations',
    description: 'Dates, places disponibles et tarifs de nos prochaines sessions de formation.',
    url: appUrl('/calendrier-formations'),
    siteName: 'S.DESIGN SHOP',
    locale: 'fr_FR',
    type: 'website',
  },
};

export default async function CalendrierFormationsPage() {
  const maintenant = new Date();

  // Fenetre large : le mois precedent pour les sessions en cours, et un an
  // devant, afin que la navigation entre les mois trouve toujours ses donnees.
  const debut = new Date(maintenant.getFullYear(), maintenant.getMonth() - 1, 1);
  const fin = new Date(maintenant.getFullYear() + 1, maintenant.getMonth(), 0, 23, 59, 59);

  const [sessions, categories] = await Promise.all([
    sessionsEntre(debut, fin, maintenant),
    categoriesDesSessions(maintenant),
  ]);

  const pourClient: SessionCalendrier[] = sessions.map((s) => ({
    slug: s.slug,
    titre: s.title,
    formationNom: s.course.name,
    formationSlug: s.course.slug,
    categorie: s.course.category,
    debut: s.startDate.toISOString(),
    fin: s.endDate.toISOString(),
    lieu: s.location,
    prix: s.prix,
    restantes: s.etat.restantes,
    capacite: s.etat.capacite,
    inscriptionPossible: s.etat.inscriptionPossible,
    pastille: s.etat.pastille,
  }));

  return (
    <div className="container-page py-8 sm:py-12">
      <header className="mb-8 max-w-2xl">
        <p className="label-eyebrow mb-2">Nos prochaines dates</p>
        <h1 className="section-title mb-3">Calendrier des formations</h1>
        <p className="text-sm leading-relaxed text-cream-muted sm:text-base">
          Retrouvez toutes nos sessions programmées, leurs dates, leurs tarifs et le nombre de places encore
          disponibles. Cliquez sur une session pour en voir le détail et vous inscrire.
        </p>
      </header>

      {pourClient.length === 0 ? (
        <div className="surface p-8 text-center sm:p-12">
          <p className="mb-2 font-display text-xl text-cream">
            Aucune prochaine formation n’est programmée pour le moment.
          </p>
          <p className="mb-6 text-sm text-cream-muted">
            Découvrez nos formations et contactez-nous : nous vous préviendrons dès l’ouverture des prochaines dates.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/formations" className="btn-gold px-5 py-2.5 text-sm">
              Voir nos formations
            </Link>
            <Link href="/contact" className="btn-outline px-5 py-2.5 text-sm">
              Nous contacter
            </Link>
          </div>
        </div>
      ) : (
        <CalendrierSessions sessions={pourClient} categories={categories} />
      )}
    </div>
  );
}
