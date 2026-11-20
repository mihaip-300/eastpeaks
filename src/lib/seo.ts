// Titles, descriptions and JSON-LD (HANDOFF 7).
import { SITE } from '../data/site';
import { formatKm, formatMeters } from './format';
import type { Resort } from './resorts';

export interface Crumb {
  name: string;
  url: string;
}

/** Serialise JSON-LD safely inside a <script> tag. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function breadcrumbJsonLd(crumbs: Crumb[], site: URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: new URL(c.url, site).href,
    })),
  };
}

export function skiResortJsonLd(resort: Resort, site: URL) {
  const g = resort.generated;
  return {
    '@context': 'https://schema.org',
    '@type': 'SkiResort',
    name: resort.name,
    url: new URL(resort.url, site).href,
    image: new URL(`/maps/${resort.slug}.webp`, site).href,
    description: resort.editorial?.summary,
    geo: { '@type': 'GeoCoordinates', latitude: g.center[1], longitude: g.center[0] },
    address: {
      '@type': 'PostalAddress',
      addressCountry: resort.country.iso2,
      ...(resort.editorial?.region ? { addressRegion: resort.editorial.region } : {}),
    },
  };
}

export function resortTitle(resort: Resort): string {
  return `${resort.name}: pârtii, prețuri skipass și cum ajungi`;
}

export function resortDescription(resort: Resort): string {
  const g = resort.generated;
  return (
    `${resort.name} (${resort.country.name}): ${formatKm(g.runs.km_total)} de pârtie, ` +
    `${g.lifts.count} lifturi, între ${formatMeters(g.elevation_m.min)} și ${formatMeters(g.elevation_m.max)}. ` +
    `Hartă interactivă, cele mai abrupte pârtii, prețuri și calculator de cost.`
  );
}

export const siteName = SITE.name;
