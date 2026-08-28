import Link from 'next/link';
import { Lock } from 'lucide-react';
import { Card } from '@/components/ui/primitives';

export const metadata = { title: 'Accès refusé' };

export default function AccessDeniedPage() {
  return (
    <div className="container-page py-16">
      <div className="mx-auto max-w-md">
        <Card className="text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-amber-400/40 bg-amber-400/10 text-amber-300">
            <Lock size={26} />
          </span>
          <h1 className="font-display text-2xl text-cream">Accès refusé</h1>
          <p className="mt-2 text-sm text-cream-muted">
            Votre rôle ne permet pas d’accéder à cette page. Contactez la direction si vous pensez qu’il s’agit d’une
            erreur.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/" className="btn-gold">
              Retour à l’accueil
            </Link>
            <Link href="/espace" className="btn-ghost">
              Mon espace
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
