import Link from 'next/link';
import { ApercuSite } from '@/components/admin/ApercuSite';
import { Card } from '@/components/ui/primitives';
import { requirePermission } from '@/lib/auth';
import { BANNER_PLACEMENTS, BANNER_PLACEMENT_LABELS } from '@/lib/constants';
import { bannieresActives, publicationsActives } from '@/server/marketing';
import { prochainesSessions } from '@/server/sessions';

export const metadata = { title: 'Aperçu du site' };
export const dynamic = 'force-dynamic';

export default async function AdminApercuPage() {
  await requirePermission('marketing.manage');

  const maintenant = new Date();
  const [banniereHero, publications, sessions] = await Promise.all([
    bannieresActives(BANNER_PLACEMENTS.HERO, 1, maintenant),
    publicationsActives(6, maintenant),
    prochainesSessions(6, maintenant),
  ]);

  // Meme ordre de priorite que la page d'accueil, explique en clair.
  const hero = banniereHero[0] ?? null;
  const publication = !hero ? (publications[0] ?? null) : null;
  const session = !hero && !publication ? (sessions.find((s) => s.etat.inscriptionPossible) ?? null) : null;

  const vedette = hero
    ? { source: `Bannière — ${BANNER_PLACEMENT_LABELS[BANNER_PLACEMENTS.HERO]}`, titre: hero.title }
    : publication
      ? { source: 'Publication', titre: publication.title }
      : session
        ? { source: 'Prochaine session', titre: `${session.course.name} — ${session.title}` }
        : null;

  return (
    <div className="space-y-5">
      <div>
        <p className="label-eyebrow mb-1">Marketing</p>
        <h1 className="section-title">Aperçu du site</h1>
        <p className="mt-2 max-w-2xl text-sm text-cream-muted">
          Voici le site tel que la cliente le voit en ce moment, sur téléphone comme sur ordinateur.
        </p>
      </div>

      <Card>
        <p className="label-eyebrow mb-2">Ce qui occupe « À la une » en ce moment</p>
        {vedette ? (
          <>
            <p className="font-display text-lg text-cream">{vedette.titre}</p>
            <p className="mt-1 text-sm text-cream-muted">Origine : {vedette.source}</p>
          </>
        ) : (
          <p className="text-sm text-cream-muted">
            Rien n’est mis en avant : aucune bannière, aucune publication et aucune session ouverte.
          </p>
        )}
        <p className="mt-3 text-xs text-cream-dim">
          Ordre de priorité : bannière d’en-tête, puis publication, puis prochaine session ouverte. Une seule est
          affichée à la fois.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/admin/bannieres" className="chip">
            Gérer les bannières
          </Link>
          <Link href="/admin/publications" className="chip">
            Gérer les publications
          </Link>
        </div>
      </Card>

      <ApercuSite />
    </div>
  );
}
