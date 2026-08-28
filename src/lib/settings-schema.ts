/**
 * Definition des parametres de l'etablissement.
 * Ce module ne contient AUCUN acces base de donnees : il est importable aussi
 * bien par les composants serveur que par les formulaires client.
 */

export const SETTINGS_DEFAULTS = {
  'shop.name': 'S.DESIGN SHOP',
  'shop.tagline': 'Beauté • Formation • Élégance',
  'shop.slogan': 'Révélez votre beauté, développez votre talent.',
  'shop.logoUrl': '',
  // Photo mise en avant dans le HERO de l'accueil. Vide = emplacement dore.
  'hero.imageUrl': '',
  'shop.director': 'La Direction',
  // Numero principal : WhatsApp + appels. Numero secondaire : appels uniquement.
  'shop.phone': '+226 76 51 88 11',
  'shop.whatsapp': '+226 76 51 88 11',
  'shop.phone2': '+226 62 71 30 19',
  'shop.email': 'contact@sdesignshop.com',
  'shop.address': 'Ouagadougou, Burkina Faso',
  'shop.city': 'Ouagadougou',
  'shop.country': 'Burkina Faso',
  // Zone / quartier — indication complémentaire, jamais un élément de marque.
  'shop.district': 'Marcoussi',
  // Position GPS officielle de la boutique (source de vérité unique).
  'shop.latitude': '12.40567398071289',
  'shop.longitude': '-1.6069070100784302',
  'shop.mapUrl': 'https://maps.google.com/maps?q=12.40567398071289%2C-1.6069070100784302&z=17&hl=fr',
  'shop.hours': 'Lundi - Samedi : 08h00 - 18h00\nDimanche : sur rendez-vous',
  'shop.facebook': '',
  'shop.instagram': '',
  'shop.tiktok': '',
  'payments.methods': 'ESPECES,ORANGE_MONEY,MOOV_MONEY,WAVE',
  'booking.slots': '08:00,09:00,10:00,11:00,12:00,14:00,15:00,16:00,17:00,18:00',
  'booking.leadDays': '0',
  'certificate.footer':
    'Ce certificat atteste de la participation et de la réussite de la formation suivie au sein de S.DESIGN SHOP.',
} as const;

export type SettingKey = keyof typeof SETTINGS_DEFAULTS;
export type ShopSettings = Record<SettingKey, string>;

export const SETTINGS_META: Record<SettingKey, { label: string; group: string; type: string }> = {
  'shop.name': { label: "Nom de l'établissement", group: 'IDENTITE', type: 'TEXT' },
  'shop.tagline': { label: 'Signature (sous le logo)', group: 'IDENTITE', type: 'TEXT' },
  'shop.slogan': { label: 'Phrase marketing', group: 'IDENTITE', type: 'TEXT' },
  'shop.logoUrl': { label: 'Logo', group: 'IDENTITE', type: 'IMAGE' },
  'hero.imageUrl': { label: 'Photo du hero (accueil)', group: 'IDENTITE', type: 'IMAGE' },
  'shop.director': { label: 'Signataire des certificats', group: 'IDENTITE', type: 'TEXT' },
  'shop.phone': { label: 'Téléphone principal (WhatsApp + appels)', group: 'CONTACT', type: 'TEXT' },
  'shop.whatsapp': { label: 'Numéro WhatsApp', group: 'CONTACT', type: 'TEXT' },
  'shop.phone2': { label: 'Second numéro (appels uniquement)', group: 'CONTACT', type: 'TEXT' },
  'shop.email': { label: 'Email', group: 'CONTACT', type: 'TEXT' },
  'shop.address': { label: 'Adresse affichée', group: 'LOCALISATION', type: 'TEXT' },
  'shop.city': { label: 'Ville', group: 'LOCALISATION', type: 'TEXT' },
  'shop.country': { label: 'Pays', group: 'LOCALISATION', type: 'TEXT' },
  'shop.district': { label: 'Quartier / zone', group: 'LOCALISATION', type: 'TEXT' },
  'shop.latitude': { label: 'Latitude', group: 'LOCALISATION', type: 'TEXT' },
  'shop.longitude': { label: 'Longitude', group: 'LOCALISATION', type: 'TEXT' },
  'shop.mapUrl': { label: 'Lien Google Maps', group: 'LOCALISATION', type: 'TEXT' },
  'shop.hours': { label: "Horaires d'ouverture", group: 'CONTACT', type: 'TEXTAREA' },
  'shop.facebook': { label: 'Facebook', group: 'RESEAUX', type: 'TEXT' },
  'shop.instagram': { label: 'Instagram', group: 'RESEAUX', type: 'TEXT' },
  'shop.tiktok': { label: 'TikTok', group: 'RESEAUX', type: 'TEXT' },
  'payments.methods': { label: 'Méthodes de paiement actives', group: 'PAIEMENT', type: 'TEXT' },
  'booking.slots': { label: 'Créneaux de réservation', group: 'RESERVATION', type: 'TEXT' },
  'booking.leadDays': { label: 'Délai minimum de réservation (jours)', group: 'RESERVATION', type: 'NUMBER' },
  'certificate.footer': { label: 'Mention au bas des certificats', group: 'CERTIFICAT', type: 'TEXTAREA' },
};

export function splitList(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

/* ------------------------------------------------------------ LOCALISATION */

export type Coordonnees = { lat: number; lng: number };

/**
 * Position GPS de la boutique, lue depuis les parametres.
 * Retourne null si les coordonnees enregistrees sont invalides : l'interface
 * masque alors la carte plutot que d'afficher un point approximatif.
 */
export function parseCoordonnees(latitude: string, longitude: string): Coordonnees | null {
  const lat = Number.parseFloat(String(latitude).replace(',', '.'));
  const lng = Number.parseFloat(String(longitude).replace(',', '.'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/** Carte Google Maps interactive avec marqueur, integrable sans cle API. */
export function mapEmbedUrl(c: Coordonnees, zoom = 17): string {
  return `https://maps.google.com/maps?q=${c.lat}%2C${c.lng}&z=${zoom}&hl=fr&output=embed`;
}

/** Fiche Google Maps (ouverture externe / application mobile). */
export function mapLinkUrl(c: Coordonnees, zoom = 17): string {
  return `https://maps.google.com/maps?q=${c.lat}%2C${c.lng}&z=${zoom}&hl=fr`;
}

/** Itineraire vers la boutique depuis la position de l'utilisateur. */
export function mapDirectionsUrl(c: Coordonnees): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${c.lat}%2C${c.lng}`;
}

/** Coordonnees affichables (6 decimales, suffisant au metre pres). */
export function formatCoordonnees(c: Coordonnees): string {
  return `${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}`;
}
