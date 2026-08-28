import 'server-only';
import QRCode from 'qrcode';

/**
 * QR code de verification d'un certificat, sous forme de data URL integree
 * directement dans la page : aucun appel reseau, donc imprimable et
 * consultable hors ligne.
 *
 * Le rendu est un SVG encode en base64, et non un PNG. Ce choix est
 * volontaire : `QRCode.toDataURL()` produit un PNG en passant par `pngjs` et
 * `node:zlib`, deux modules absents ou incomplets sur un runtime edge et sur
 * Cloudflare Workers. `QRCode.toString({ type: 'svg' })` n'utilise que des
 * chaines de caracteres et fonctionne partout, sans dependance native.
 *
 * Le rendu visuel et l'impression sont identiques ; le SVG est meme net a
 * toutes les tailles, la ou le PNG etait fige a 320 pixels.
 */
export async function qrDataUrl(text: string): Promise<string | null> {
  try {
    const svg = await QRCode.toString(text, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
      color: { dark: '#160522', light: '#FFFFFF' },
    });
    // btoa n'accepte que du Latin-1 : le SVG genere ne contient que de l'ASCII,
    // mais on encode en UTF-8 par securite si une couleur nommee changeait.
    const octets = new TextEncoder().encode(svg);
    let binaire = '';
    for (let i = 0; i < octets.length; i += 1) binaire += String.fromCharCode(octets[i]);
    return `data:image/svg+xml;base64,${btoa(binaire)}`;
  } catch {
    return null;
  }
}

export function appUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
