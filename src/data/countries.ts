export interface Country {
  slug: string;
  name: string;
  iso2: string;
}

export const COUNTRIES = [
  { slug: 'romania', name: 'România', iso2: 'RO' },
  { slug: 'bulgaria', name: 'Bulgaria', iso2: 'BG' },
  { slug: 'serbia', name: 'Serbia', iso2: 'RS' },
  { slug: 'bosnia-si-hertegovina', name: 'Bosnia și Herțegovina', iso2: 'BA' },
  { slug: 'macedonia-de-nord', name: 'Macedonia de Nord', iso2: 'MK' },
  { slug: 'muntenegru', name: 'Muntenegru', iso2: 'ME' },
  { slug: 'austria', name: 'Austria', iso2: 'AT' },
] as const satisfies readonly Country[];

export type CountryIso2 = (typeof COUNTRIES)[number]['iso2'];

export function countryByIso2(iso2: string): Country | undefined {
  return COUNTRIES.find((c) => c.iso2 === iso2);
}
