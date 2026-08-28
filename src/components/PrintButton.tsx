'use client';

import { Printer } from 'lucide-react';

/** Impression / export PDF via la boite de dialogue du navigateur. */
export function PrintButton({ label = 'Imprimer / PDF' }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn-gold no-print">
      <Printer size={16} /> {label}
    </button>
  );
}
