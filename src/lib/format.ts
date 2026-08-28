/** Formatage monetaire, dates et durees - locale fr-FR / devise FCFA. */

export const CURRENCY = 'FCFA';

/** 25000 -> "25 000 FCFA" */
export function formatMoney(amount: number | null | undefined, withCurrency = true): string {
  const value = Number.isFinite(amount) ? Number(amount) : 0;
  const formatted = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value);
  return withCurrency ? `${formatted} ${CURRENCY}` : formatted;
}

/**
 * Affichage d'un tarif cote public : un montant a 0 signifie qu'aucun prix
 * officiel n'a encore ete saisi par la boutique, on n'invente donc rien.
 */
export function priceLabel(amount: number | null | undefined): string {
  const value = Number(amount ?? 0);
  return value > 0 ? formatMoney(value) : 'Sur demande';
}

/** 2450000 -> "2,45 M" (pour les tuiles compactes du tableau de bord) */
export function formatMoneyCompact(amount: number | null | undefined): string {
  const value = Number(amount ?? 0);
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2).replace('.', ',')} M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)} K`;
  return String(value);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(d);
}

export function formatDateShort(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(d);
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—';
  return `${formatDateShort(date)} à ${formatTime(date)}`;
}

/** 90 -> "1 h 30" */
export function formatDuration(minutes: number | null | undefined): string {
  const m = Number(minutes ?? 0);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} h` : `${h} h ${rest}`;
}

/** Valeur d'entree pour <input type="datetime-local"> */
export function toDateTimeLocal(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Valeur d'entree pour <input type="date"> */
export function toDateInput(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function relativeFromNow(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  if (j < 30) return `il y a ${j} j`;
  return formatDateShort(d);
}
