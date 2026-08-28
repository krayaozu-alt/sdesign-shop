import type { Metadata } from 'next';
import Link from 'next/link';
import { SessionCard, versCarte } from '@/components/public/SessionCard';
import { requireUser } from '@/lib/auth';
import { prochainesSessions } from '@/server/sessions';

export const metadata: Metadata = { title: 'Prochaines formations' };
export const dynamic = 'force-dynamic';

/**
 * Prochaines sessions, vues depuis l'espace personnel.
 *
 * Une cliente deja inscrite doit pouvoir decouvrir et rejoindre une nouvelle
 * session sans repasser par le site public. Les cartes et le calcul des places
 * sont exactement les memes qu'a l'accueil.
 */
export default async function EspaceProchainesFormationsPage() {
  await requireUser();
  const sessions = await prochainesSessions(12);

  return (
    <div className="space-y-5">
      <div>
        <p className="label-eyebrow mb-1">Se former</p>
        <h1 className="section-title">Prochaines formations</h1>
        <p className="mt-2 max-w-2xl text-sm text-cream-muted">
          Nos sessions programmées, avec leurs dates, leurs tarifs et le nombre de places encore disponibles.
        </p>
      </div>

      {sessions.length === 0 ? (
        <div className="surface p-8 text-center">
          <p className="mb-2 font-display text-lg text-cream">
            Aucune prochaine formation n’est programmée pour le moment.
          </p>
          <p className="mb-5 text-sm text-cream-muted">
            Consultez notre catalogue : nous vous préviendrons dès l’ouverture des prochaines dates.
          </p>
          <Link href="/formations" className="btn-outline px-4 py-2 text-xs">
            Voir nos formations
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {sessions.map((s) => (
              <SessionCard key={s.slug} session={versCarte(s)} />
            ))}
          </div>
          <div className="text-center">
            <Link href="/calendrier-formations" className="btn-ghost px-4 py-2 text-xs">
              Voir tout le calendrier →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
