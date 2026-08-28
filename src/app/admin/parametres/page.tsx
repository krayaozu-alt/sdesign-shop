import { SettingsForm } from '@/components/admin/ContentForms';
import { Card } from '@/components/ui/primitives';
import { requireRole } from '@/lib/auth';
import { PAYMENT_METHOD_LABELS, ROLES } from '@/lib/constants';
import { getSettings } from '@/lib/settings';
import { resetLogoAction, supprimerPhotoHeroAction } from '@/server/actions/content';
import { emailStatus } from '@/server/email';
import { storageStatus } from '@/server/storage';

export const metadata = { title: 'Paramètres' };
export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  await requireRole([ROLES.ADMIN]);
  const settings = await getSettings();
  const stockage = storageStatus();
  const messagerie = emailStatus();

  return (
    <div className="space-y-5">
      <div>
        <p className="label-eyebrow mb-1">Système</p>
        <h1 className="section-title">Paramètres</h1>
        <p className="mt-2 max-w-2xl text-sm text-cream-muted">
          Ces informations alimentent l’ensemble du site : en-tête, page de contact, reçus et certificats.
        </p>
      </div>

      <SettingsForm settings={settings} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <p className="mb-2 text-sm text-cream">Logo</p>
          <p className="mb-3 text-xs text-cream-muted">
            Téléversez un fichier PNG ou SVG avec fond transparent pour un rendu optimal sur le fond violet. Sans logo,
            le logotype typographique S.Design est utilisé.
          </p>
          <form action={resetLogoAction}>
            <button type="submit" className="btn-ghost px-4 py-2 text-xs">
              Revenir au logotype par défaut
            </button>
          </form>
        </Card>

        <Card>
          <p className="mb-2 text-sm text-cream">Photo du hero</p>
          {settings['hero.imageUrl'] ? (
            <>
              <div className="mb-3 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={settings['hero.imageUrl']}
                  alt="Photo actuellement affichée dans le hero"
                  className="h-20 w-20 rounded-full object-cover object-top ring-1 ring-gold-400/30"
                />
                <p className="text-xs text-cream-muted">
                  Cette photo occupe le cercle doré de la page d’accueil. Pour la remplacer, utilisez le champ
                  « Photo du hero » du formulaire ci-dessus.
                </p>
              </div>
              <form action={supprimerPhotoHeroAction}>
                <button type="submit" className="btn-ghost px-4 py-2 text-xs">
                  Supprimer la photo du hero
                </button>
              </form>
              <p className="mt-2 text-[11px] text-cream-dim">
                Le fichier n’est retiré du stockage que s’il n’est utilisé nulle part ailleurs.
              </p>
            </>
          ) : (
            <p className="text-xs text-cream-muted">
              Aucune photo n’est configurée. Le hero affiche un motif doré discret à sa place. Ajoutez-la depuis le
              champ « Photo du hero » du formulaire ci-dessus.
              <br />
              <span className="mt-2 block text-cream-dim">
                Format recommandé : photo verticale haute résolution, sujet positionné vers le centre.
              </span>
            </p>
          )}
        </Card>

        <Card>
          <p className="mb-2 text-sm text-cream">Méthodes de paiement</p>
          <p className="mb-2 text-xs text-cream-muted">
            Saisissez les codes séparés par des virgules. Codes disponibles :
          </p>
          <ul className="space-y-1 text-xs text-cream-dim">
            {Object.entries(PAYMENT_METHOD_LABELS).map(([code, label]) => (
              <li key={code}>
                <code className="text-gold-300">{code}</code> — {label}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <p className="mb-2 text-sm text-cream">Services techniques</p>
        <p className="mb-3 text-xs text-cream-muted">
          Ces réglages proviennent des variables d’environnement du serveur (fichier <code>.env</code>) et ne se modifient
          pas depuis cette page.
        </p>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-cream-dim">Stockage des fichiers</dt>
            <dd className="text-sm text-cream">
              <span className="text-gold-300">{stockage.driver}</span>{' '}
              {stockage.driver === 'r2'
                ? stockage.configured
                  ? '· Cloudflare R2 configuré'
                  : '· clés R2 incomplètes'
                : '· dossier public/uploads'}
            </dd>
            {stockage.manquantes.length ? (
              <p className="mt-1 text-xs text-amber-200">
                Variables absentes :{' '}
                {stockage.manquantes.map((v, i) => (
                  <span key={v}>
                    {i > 0 ? ', ' : ''}
                    <code>{v}</code>
                  </span>
                ))}
              </p>
            ) : null}
            {stockage.driver === 'local' && stockage.production ? (
              <p className="mt-1 text-xs text-red-200">
                En production, les fichiers écrits sur le disque du serveur sont perdus à chaque déploiement. Le logo et
                les photos des formations doivent être hébergés sur R2.
              </p>
            ) : null}
          </div>
          <div>
            <dt className="text-xs text-cream-dim">Envoi des e-mails</dt>
            <dd className="text-sm text-cream">
              <span className="text-gold-300">{messagerie.driver}</span>{' '}
              {messagerie.driver === 'dev'
                ? '· mode test, codes affichés dans la console du serveur'
                : messagerie.configured
                  ? '· fournisseur actif'
                  : '· clé API manquante'}
            </dd>
            {messagerie.manquantes.length ? (
              <p className="mt-1 text-xs text-amber-200">
                Variables absentes :{' '}
                {messagerie.manquantes.map((v, i) => (
                  <span key={v}>
                    {i > 0 ? ', ' : ''}
                    <code>{v}</code>
                  </span>
                ))}
              </p>
            ) : null}
            {messagerie.driver === 'dev' ? (
              <p className="mt-1 text-xs text-amber-200">
                Renseignez <code>BREVO_API_KEY</code> et <code>BREVO_SENDER_EMAIL</code> pour que les codes de
                vérification partent réellement.
              </p>
            ) : null}
          </div>
        </dl>
      </Card>
    </div>
  );
}
