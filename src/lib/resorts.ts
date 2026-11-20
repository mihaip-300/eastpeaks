// Joins the three sources of a resort (HANDOFF 4): pipeline output (data/generated/),
// editorial content (src/content/statiuni/) and prices (data/prices.json).
// Missing pieces never fail the build: they come back as null and log a warning.
import { getCollection, type CollectionEntry } from 'astro:content';
import pricesFile from '../../data/prices.json';
import { PER_EUR } from '../data/constants';
import { countryByIso2, type Country } from '../data/countries';
import type { SkipassPrices } from './calculator';
import { GENERATED, type GeneratedResort } from './generated';

export type Editorial = CollectionEntry<'statiuni'>['data'];

export interface PriceRow extends SkipassPrices {
  slug: string;
  currency: string;
  season?: string;
  source_url: string;
  checked_at: string;
  note?: string;
}

export interface Resort {
  slug: string;
  name: string;
  url: string;
  country: Country;
  generated: GeneratedResort;
  editorial: Editorial | null;
  price: PriceRow | null;
  /** Skipass prices converted to EUR (null when the currency has no rate). */
  priceEur: SkipassPrices | null;
}

export const resortUrl = (countrySlug: string, slug: string) => `/statiuni/${countrySlug}/${slug}/`;

export function toEur(amount: number | null, currency: string): number | null {
  const rate = PER_EUR[currency];
  if (amount == null || !rate) return null;
  return Math.round((amount / rate) * 100) / 100;
}

const warned = new Set<string>();
function warnOnce(message: string) {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(`[resorts] ${message}`);
}

let cache: Promise<Resort[]> | null = null;

export function getResorts(): Promise<Resort[]> {
  cache ??= load();
  return cache;
}

async function load(): Promise<Resort[]> {
  const entries = await getCollection('statiuni');
  const editorialBySlug = new Map<string, Editorial>();
  for (const entry of entries) {
    if (entry.data.slug !== entry.id) warnOnce(`editorial file ${entry.id}.json has slug "${entry.data.slug}"`);
    editorialBySlug.set(entry.data.slug, entry.data);
  }
  const prices = new Map((pricesFile.prices as PriceRow[]).map((p) => [p.slug, p]));

  const resorts: Resort[] = [];
  for (const generated of GENERATED) {
    const country = countryByIso2(generated.country);
    if (!country) {
      warnOnce(`unknown country ${generated.country} for ${generated.slug}; page skipped`);
      continue;
    }
    const editorial = editorialBySlug.get(generated.slug) ?? null;
    if (!editorial) warnOnce(`${generated.slug}: no editorial data, page shows "în curând"`);
    const price = prices.get(generated.slug) ?? null;
    if (!price) warnOnce(`${generated.slug}: no prices in data/prices.json`);
    if (price && !PER_EUR[price.currency]) warnOnce(`${generated.slug}: no exchange rate for ${price.currency}`);

    resorts.push({
      slug: generated.slug,
      name: editorial?.name ?? generated.name,
      url: resortUrl(country.slug, generated.slug),
      country,
      generated,
      editorial,
      price,
      priceEur: price
        ? {
            adult_1d: toEur(price.adult_1d, price.currency),
            adult_6d: toEur(price.adult_6d, price.currency),
            child_1d: toEur(price.child_1d, price.currency),
            child_6d: toEur(price.child_6d, price.currency),
          }
        : null,
    });
  }
  for (const slug of editorialBySlug.keys()) {
    if (!GENERATED.some((g) => g.slug === slug)) warnOnce(`${slug}: editorial data but no pipeline output`);
  }
  return resorts.sort((a, b) => a.name.localeCompare(b.name, 'ro'));
}

export async function getResort(slug: string): Promise<Resort | undefined> {
  return (await getResorts()).find((r) => r.slug === slug);
}
