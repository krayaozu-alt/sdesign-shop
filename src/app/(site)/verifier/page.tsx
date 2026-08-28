import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/primitives';
import { appUrl } from '@/lib/qr';

export const metadata: Metadata = {
  title: 'Vérifier un certificat',
  alternates: { canonical: appUrl('/verifier') },
};

async function search(formData: FormData) {
  'use server';
  const code = String(formData.get('code') ?? '')
    .trim()
    .toUpperCase();
  if (!code) redirect('/verifier');
  redirect(`/verifier/${encodeURIComponent(code)}`);
}

export default function VerifyIndexPage() {
  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-md text-center">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-gold-500/40 bg-gold-500/10 text-gold-300">
          <ShieldCheck size={26} />
        </span>
        <h1 className="section-title">Vérifier un certificat</h1>
        <p className="mt-2 text-sm text-cream-muted">
          Saisissez le code de vérification imprimé sur le certificat, ou scannez son QR code.
        </p>

        <Card className="mt-6 text-left">
          <form action={search}>
            <label htmlFor="code">Code de vérification</label>
            <input id="code" name="code" placeholder="ABCDE-12345" required className="uppercase tracking-widest" />
            <button type="submit" className="btn-gold mt-4 w-full">
              Vérifier
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
