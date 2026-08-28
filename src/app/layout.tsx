import type { Metadata, Viewport } from 'next';
import './globals.css';
import { appUrl } from '@/lib/qr';
import { getSettings } from '@/lib/settings';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings().catch(() => null);
  const name = settings?.['shop.name'] ?? 'S.DESIGN SHOP';
  const tagline = settings?.['shop.tagline'] ?? 'Beauté • Formation • Élégance';
  const description =
    settings?.['shop.slogan'] ??
    'Révélez votre beauté, développez votre talent. Formations et prestations beauté professionnelles.';
  const titre = `${name} — ${tagline}`;

  // Image de partage : on ne prend que des visuels reellement en place, jamais
  // un chemin invente. La photo du hero d'abord — c'est le visage de la marque
  // et elle est deja au format paysage attendu par les reseaux ; le logo
  // ensuite. Si aucun des deux n'est configure, on n'annonce pas d'image du
  // tout : mieux vaut un partage sobre qu'un lien casse.
  const visuel = settings?.['hero.imageUrl'] || settings?.['shop.logoUrl'] || '';
  const images = visuel ? [{ url: visuel, alt: titre }] : undefined;

  return {
    // Sans base, une URL relative posee dans une carte de partage n'est pas
    // resolvable par WhatsApp ou Facebook. Elle suit NEXT_PUBLIC_APP_URL : en
    // production, cette variable doit porter le domaine reel du site.
    metadataBase: new URL(appUrl('/')),
    title: { default: titre, template: `%s | ${name}` },
    description,
    manifest: '/manifest.webmanifest',
    applicationName: name,
    formatDetection: { telephone: true },
    // Pas de `alternates` ici : une adresse canonique posee sur la racine
    // serait heritee par toutes les pages qui n'en declarent pas, et chacune
    // se declarerait alors comme etant l'accueil. Chaque page publique porte
    // la sienne.
    openGraph: {
      title: titre,
      description,
      url: appUrl('/'),
      siteName: name,
      locale: 'fr_FR',
      type: 'website',
      images,
    },
    twitter: {
      card: images ? 'summary_large_image' : 'summary',
      title: titre,
      description,
      images: visuel ? [visuel] : undefined,
    },
  };
}

export const viewport: Viewport = {
  themeColor: '#160522',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        {/* Polices chargees a l'execution : en cas de coupure reseau, les
            polices systeme de secours declarees dans tailwind.config prennent
            le relais sans casser la mise en page. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,600&family=Cormorant+Garamond:ital,wght@0,600;1,600;1,700&family=Inter:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
