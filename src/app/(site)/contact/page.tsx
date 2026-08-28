import type { Metadata } from 'next';
import { Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { Card } from '@/components/ui/primitives';
import { CallButton, WhatsAppButton } from '@/components/ContactButtons';
import { MapBoutique } from '@/components/MapBoutique';
import { Logo } from '@/components/layout/Logo';
import { resolveLogo } from '@/lib/brand';
import { getSettings } from '@/lib/settings';
import { formatCoordonnees, parseCoordonnees } from '@/lib/settings-schema';
import { appUrl } from '@/lib/qr';

export const metadata: Metadata = {
  title: 'Contact & localisation',
  alternates: { canonical: appUrl('/contact') },
};
export const dynamic = 'force-dynamic';

export default async function ContactPage() {
  const settings = await getSettings();
  const coordonnees = parseCoordonnees(settings['shop.latitude'], settings['shop.longitude']);

  return (
    <div className="container-page py-8">
      <div className="mb-8 text-center">
        <Logo logoUrl={resolveLogo(settings['shop.logoUrl'])} name={settings['shop.name']} tagline={settings['shop.tagline']} />
        <h1 className="mt-6 section-title">Contact & localisation</h1>
      </div>

      {/* Coordonnées officielles : numéro principal (WhatsApp + appel) puis
          numéro secondaire réservé aux appels. */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-gold-500/25 bg-gold-500/10 text-gold-300">
            <MessageCircle size={20} />
          </span>
          <p className="label-eyebrow mb-1">WhatsApp / Appel</p>
          <p className="font-display text-2xl text-cream">{settings['shop.phone']}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <WhatsAppButton
              phone={settings['shop.whatsapp'] || settings['shop.phone']}
              message={`Bonjour ${settings['shop.name']}, je souhaite des informations.`}
              className="px-4 py-2 text-xs"
            />
            <CallButton phone={settings['shop.phone']} variant="outline" className="px-4 py-2 text-xs" />
          </div>
        </Card>

        {settings['shop.phone2'] ? (
          <Card>
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-gold-500/25 bg-gold-500/10 text-gold-300">
              <Phone size={20} />
            </span>
            <p className="label-eyebrow mb-1">Appel</p>
            <p className="font-display text-2xl text-cream">{settings['shop.phone2']}</p>
            <p className="mt-1 text-xs text-cream-dim">Appels uniquement</p>
            <div className="mt-4">
              <CallButton phone={settings['shop.phone2']} variant="outline" className="px-4 py-2 text-xs" />
            </div>
          </Card>
        ) : null}

        <Card>
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-gold-500/25 bg-gold-500/10 text-gold-300">
            <Mail size={20} />
          </span>
          <p className="label-eyebrow mb-1">Email</p>
          <a
            href={`mailto:${settings['shop.email']}`}
            className="break-all font-display text-lg text-cream hover:text-gold-300"
          >
            {settings['shop.email']}
          </a>
          <p className="mt-3 whitespace-pre-line text-xs text-cream-muted">
            <Clock size={12} className="mr-1 inline text-gold-400" />
            {settings['shop.hours']}
          </p>
        </Card>
      </div>

      {/* ------------------------------------------------------ Nous trouver */}
      <section className="mt-10">
        <div className="mb-5">
          <p className="label-eyebrow mb-1">Où nous rendre visite</p>
          <h2 className="section-title">Nous trouver</h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1.6fr]">
          <Card>
            <p className="font-display text-2xl text-cream">{settings['shop.name']}</p>
            <p className="mt-3 flex items-start gap-2 text-lg text-cream-muted">
              <MapPin size={18} className="mt-1 shrink-0 text-gold-400" />
              <span>{settings['shop.address']}</span>
            </p>

            <div className="my-5 gold-rule" />

            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-cream-dim">Ville</dt>
                <dd className="text-cream">{settings['shop.city']}</dd>
              </div>
              {settings['shop.district'] ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-cream-dim">Zone</dt>
                  <dd className="text-cream">{settings['shop.district']}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-3">
                <dt className="text-cream-dim">Pays</dt>
                <dd className="text-cream">{settings['shop.country']}</dd>
              </div>
              {coordonnees ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-cream-dim">Coordonnées GPS</dt>
                  <dd className="font-mono text-xs text-gold-300">{formatCoordonnees(coordonnees)}</dd>
                </div>
              ) : null}
            </dl>

            <div className="my-5 gold-rule" />

            <p className="mb-2 text-sm text-cream">Horaires d’ouverture</p>
            <p className="whitespace-pre-line text-sm text-cream-muted">{settings['shop.hours']}</p>
          </Card>

          <Card className="p-3 sm:p-4">
            {coordonnees ? (
              <MapBoutique
                coordonnees={coordonnees}
                nom={settings['shop.name']}
                adresse={settings['shop.address']}
              />
            ) : (
              <p className="py-16 text-center text-sm text-cream-muted">
                Aucune position GPS valide n’est enregistrée. Renseignez-la dans Admin → Paramètres → Localisation.
              </p>
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}
