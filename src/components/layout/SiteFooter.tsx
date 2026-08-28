import Link from 'next/link';
import { Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { callHref } from '@/components/ContactButtons';
import { Logo } from '@/components/layout/Logo';
import { resolveLogo } from '@/lib/brand';
import type { ShopSettings } from '@/lib/settings';
import { mapLinkUrl, parseCoordonnees } from '@/lib/settings-schema';
import { whatsappLink } from '@/lib/utils';

/**
 * Logos de marque.
 *
 * `lucide-react` fournit bien un pictogramme Facebook, mais rien pour TikTok.
 * Plutot que de melanger un trace au trait avec un glyphe plein — deux graisses
 * qui ne s'accordent pas cote a cote —, les trois marques sont dessinees ici en
 * aplat, a la meme taille et en `currentColor`. Elles suivent donc la couleur
 * du lien qui les porte, survol compris.
 */
function IconeFacebook() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-[18px] w-[18px]">
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.5-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.45 2.91h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
    </svg>
  );
}

function IconeTikTok() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-[18px] w-[18px]">
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.59 2.59 0 1 1 .77-5.06V9.7a5.68 5.68 0 0 0-.77-.05A5.66 5.66 0 1 0 15.54 15.3V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.28 4.28 0 0 1-3.24-1.48Z" />
    </svg>
  );
}

function IconeInstagram() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-[18px] w-[18px]">
      <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.8 3.8 0 0 1-1.38-.9 3.8 3.8 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16Zm0 3.68a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32Zm0 10.16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm7.85-10.4a1.44 1.44 0 1 1-2.88 0 1.44 1.44 0 0 1 2.88 0Z" />
    </svg>
  );
}

/**
 * Rangee des reseaux.
 *
 * Les adresses viennent des reglages de la boutique — jamais ecrites en dur —
 * et un reseau non renseigne n'apparait pas. Si aucun n'est configure, la
 * rangee entiere disparait plutot que de laisser un vide.
 */
function ReseauxSociaux({ settings }: { settings: ShopSettings }) {
  const reseaux = [
    { cle: 'Facebook', url: settings['shop.facebook'], Icone: IconeFacebook },
    { cle: 'TikTok', url: settings['shop.tiktok'], Icone: IconeTikTok },
    { cle: 'Instagram', url: settings['shop.instagram'], Icone: IconeInstagram },
  ].filter((r) => Boolean(r.url?.trim()));

  if (reseaux.length === 0) return null;

  return (
    <div className="mt-5">
      <p className="sr-only">Suivez-nous</p>
      <ul className="flex items-center gap-3">
        {reseaux.map(({ cle, url, Icone }) => (
          <li key={cle}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${cle} — nouvelle fenetre`}
              title={cle}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.045] text-cream-muted transition hover:border-gold-500/50 hover:text-gold-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/40"
            >
              <Icone />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter({ settings }: { settings: ShopSettings }) {
  const wa = whatsappLink(settings['shop.whatsapp']);
  const coordonnees = parseCoordonnees(settings['shop.latitude'], settings['shop.longitude']);
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-white/10 bg-night-950/60">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo
            logoUrl={resolveLogo(settings['shop.logoUrl'])}
            name={settings['shop.name']}
            tagline={settings['shop.tagline']}
            className="items-start"
          />
          <p className="mt-4 max-w-xs text-sm text-cream-muted">{settings['shop.slogan']}</p>
          <ReseauxSociaux settings={settings} />
        </div>

        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gold-300">Navigation</h3>
          <ul className="space-y-2 text-sm text-cream-muted">
            <li>
              <Link href="/formations" className="hover:text-cream">
                Nos formations
              </Link>
            </li>
            <li>
              <Link href="/prestations" className="hover:text-cream">
                Nos prestations
              </Link>
            </li>
            <li>
              <Link href="/reservation" className="hover:text-cream">
                Réserver
              </Link>
            </li>
            <li>
              <Link href="/galerie" className="hover:text-cream">
                Galerie
              </Link>
            </li>
            <li>
              <Link href="/verifier" className="hover:text-cream">
                Vérifier un certificat
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gold-300">Contact</h3>
          <ul className="space-y-3 text-sm text-cream-muted">
            <li className="flex items-start gap-2">
              <MapPin size={16} className="mt-0.5 shrink-0 text-gold-400" />
              <span>
                {settings['shop.address']}
                {coordonnees ? (
                  <>
                    <br />
                    <a
                      href={mapLinkUrl(coordonnees)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-gold-300 hover:text-gold-200"
                    >
                      Voir notre localisation →
                    </a>
                  </>
                ) : null}
              </span>
            </li>
            {wa ? (
              <li className="flex items-center gap-2">
                <MessageCircle size={16} className="shrink-0 text-gold-400" />
                <a href={wa} target="_blank" rel="noreferrer" className="hover:text-cream">
                  WhatsApp — {settings['shop.whatsapp']}
                </a>
              </li>
            ) : null}
            <li className="flex items-center gap-2">
              <Phone size={16} className="shrink-0 text-gold-400" />
              <a href={callHref(settings['shop.phone'])} className="hover:text-cream">
                Appel — {settings['shop.phone']}
              </a>
            </li>
            {settings['shop.phone2'] ? (
              <li className="flex items-center gap-2">
                <Phone size={16} className="shrink-0 text-gold-400" />
                <a href={callHref(settings['shop.phone2'])} className="hover:text-cream">
                  Appel — {settings['shop.phone2']}
                </a>
              </li>
            ) : null}
            <li className="flex items-center gap-2">
              <Mail size={16} className="shrink-0 text-gold-400" />
              <a href={`mailto:${settings['shop.email']}`} className="hover:text-cream">
                {settings['shop.email']}
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gold-300">Horaires</h3>
          <p className="whitespace-pre-line text-sm text-cream-muted">{settings['shop.hours']}</p>
        </div>
      </div>

      <div className="gold-rule" />
      <div className="container-page flex flex-col items-center justify-between gap-2 py-5 text-xs text-cream-dim sm:flex-row">
        <p>
          © {year} {settings['shop.name']} — Tous droits réservés.
        </p>
        <p>{settings['shop.tagline']}</p>
      </div>
    </footer>
  );
}
