// Romanian number formatting: 1.234,5 km · 24,9% · 1.786 m.
const nf = (digits: number) =>
  new Intl.NumberFormat('ro-RO', { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: true });

const int = nf(0);
const one = nf(1);

export const formatInt = (n: number): string => int.format(Math.round(n));
export const formatKm = (km: number): string => `${one.format(km)} km`;
export const formatMeters = (m: number): string => `${int.format(Math.round(m))} m`;
export const formatPct = (pct: number): string => `${one.format(pct)}%`;

export function formatEur(eur: number): string {
  return new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'EUR', currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0 }).format(eur);
}

export function formatLei(lei: number): string {
  return `${int.format(Math.round(lei))} lei`;
}

/** "20 noiembrie 2026". ISO dates are read as UTC, so format in UTC to avoid an off-by-one day. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
