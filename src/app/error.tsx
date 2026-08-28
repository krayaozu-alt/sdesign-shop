'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-16">
      <div className="surface max-w-md p-8 text-center">
        <h1 className="font-display text-2xl text-cream">Une erreur est survenue</h1>
        <p className="mt-2 text-sm text-cream-muted">
          L’opération n’a pas pu être effectuée. Réessayez ; si le problème persiste, contactez l’administrateur.
        </p>
        {error.digest ? <p className="mt-2 text-xs text-cream-dim">Référence : {error.digest}</p> : null}
        <button type="button" onClick={reset} className="btn-gold mt-6">
          Réessayer
        </button>
      </div>
    </div>
  );
}
