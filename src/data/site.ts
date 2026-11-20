// Display name is a working title until Mike confirms it (HANDOFF section 10).
export const SITE = {
  name: 'East Peaks',
  tagline: 'Stațiuni de schi din România, Balcani și Austria, comparate pe date',
  locale: 'ro-RO',
} as const;

export const NAV = [
  { href: '/statiuni/', label: 'Stațiuni' },
  { href: '/despre/', label: 'Despre' },
] as const;

export const FOOTER_LINKS = [
  { href: '/despre/', label: 'Despre' },
  { href: '/despre/date/', label: 'Surse și atribuiri' },
  { href: '/afiliere/', label: 'Afiliere' },
  { href: '/confidentialitate/', label: 'Confidențialitate' },
  { href: '/termeni/', label: 'Termeni' },
  { href: '/contact/', label: 'Contact' },
] as const;
