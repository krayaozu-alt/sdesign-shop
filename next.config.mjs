/**
 * Configuration de production — S.DESIGN SHOP
 *
 * Architecture cible :
 *   Utilisateur → Cloudflare (DNS, TLS, proxy, WAF) → serveur Node.js
 *   → Next.js 14.2.35 → PostgreSQL, et R2 pour les fichiers.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  /**
   * Sortie autonome : `next build` produit `.next/standalone`, qui contient le
   * serveur et uniquement les dependances reellement utilisees. C'est le mode
   * documente pour l'auto-hebergement — image de deploiement bien plus legere
   * et demarrage par `node server.js`, sans `npm install` sur le serveur.
   */
  output: 'standalone',

  experimental: {
    serverActions: {
      bodySizeLimit: '8mb',

      /**
       * INDISPENSABLE DERRIERE UN PROXY.
       *
       * Next 14 compare l'en-tete `Origin` de la requete a `Host` /
       * `X-Forwarded-Host`. Derriere Cloudflare — ou tout autre proxy — ces
       * valeurs peuvent differer (port absent, hote reecrit), et Next REJETTE
       * alors l'action. Concretement, tous les formulaires du site cesseraient
       * de fonctionner : inscription, verification OTP, connexion, reservation,
       * parametres.
       *
       * On declare donc explicitement les origines legitimes. La liste vient de
       * l'environnement pour qu'aucun domaine ne soit fige dans le code.
       *   SERVER_ACTIONS_ORIGINS="sdesignshop.com,www.sdesignshop.com"
       * A defaut, l'hote de NEXT_PUBLIC_APP_URL est utilise.
       */
      allowedOrigins: originesAutorisees(),
    },
  },

  async headers() {
    const securite = [
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ];

    /**
     * Les espaces prives ne doivent JAMAIS etre mis en cache, ni par
     * Cloudflare, ni par un navigateur partage. `private` interdit tout cache
     * intermediaire ; `no-store` interdit meme l'ecriture sur disque.
     * Cette entete est la garantie cote application : les regles de cache
     * Cloudflare la doublent, elles ne la remplacent pas.
     */
    const prive = [
      ...securite,
      { key: 'Cache-Control', value: 'private, no-store, max-age=0, must-revalidate' },
    ];

    return [
      { source: '/:path*', headers: securite },
      { source: '/admin/:path*', headers: prive },
      { source: '/espace/:path*', headers: prive },
      { source: '/connexion', headers: prive },
      { source: '/creer-compte', headers: prive },
      { source: '/verification', headers: prive },
      { source: '/mot-de-passe-oublie', headers: prive },
      { source: '/reinitialiser-mot-de-passe', headers: prive },
      { source: '/api/:path*', headers: prive },
    ];
  },
};

/** Origines acceptees pour les server actions, deduites de l'environnement. */
function originesAutorisees() {
  const liste = (process.env.SERVER_ACTIONS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim().replace(/^https?:\/\//, '').replace(/\/+$/, ''))
    .filter(Boolean);

  if (liste.length) return liste;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      return [new URL(appUrl).host];
    } catch {
      // URL mal formee : on retombe sur la liste vide, Next applique alors
      // son controle par defaut (Origin doit egaler Host).
    }
  }
  return [];
}

export default nextConfig;
