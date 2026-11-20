export const SITE = {
  name: 'EastPeaks',
  tagline: 'Stațiuni de schi din România, Balcani și Austria, comparate pe date',
  locale: 'ro-RO',
} as const;

// Pages that don't exist yet (Ghid) stay out of the navigation until they do.
export const NAV = [
  { href: '/statiuni/', label: 'Stațiuni' },
  { href: '/harta/', label: 'Hartă' },
  { href: '/conditii/', label: 'Condiții' },
  { href: '/calculator-cost-schi/', label: 'Planifică' },
] as const;

// Ski utilities, always one click away (utility bar). Live values appear only with real data.
export const UTILITY_LINKS = [
  { href: '/conditii/#zapada', label: 'Zăpadă' },
  { href: '/conditii/#instalatii', label: 'Instalații' },
  { href: '/conditii/#vreme', label: 'Vreme' },
  { href: '/conditii/#webcam', label: 'Webcam' },
  { href: '/harta/', label: 'Hartă' },
] as const;

export const FOOTER_LINKS = [
  { href: '/despre/', label: 'Despre' },
  { href: '/despre/date/', label: 'Surse și atribuiri' },
  { href: '/afiliere/', label: 'Afiliere' },
  { href: '/confidentialitate/', label: 'Confidențialitate' },
  { href: '/termeni/', label: 'Termeni' },
  { href: '/contact/', label: 'Contact' },
] as const;
