import Link from 'next/link';

export const metadata = { title: 'Page introuvable' };

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-16">
      <div className="surface max-w-md p-8 text-center">
        <p className="font-script text-5xl gold-text">404</p>
        <h1 className="mt-3 font-display text-2xl text-cream">Page introuvable</h1>
        <p className="mt-2 text-sm text-cream-muted">
          Cette page n’existe pas ou a été déplacée. Retrouvez nos formations et prestations depuis l’accueil.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn-gold">
            Retour à l’accueil
          </Link>
          <Link href="/formations" className="btn-ghost">
            Nos formations
          </Link>
        </div>
      </div>
    </div>
  );
}
