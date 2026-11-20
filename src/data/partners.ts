// Allow-list for the /go/ redirect (HANDOFF 8.3): only partner/target pairs listed
// here resolve, so the route can never act as an open redirect.
//
// Until the affiliate networks approve us, targets are the partners' plain URLs,
// each one loaded and checked on 2026-11-20. When an affiliate ID arrives, add its
// env variable to the partner and wrap the URL in `affiliateUrl` below; IDs never
// live in this file.

export interface Partner {
  name: string;
  /** Network and the parameter that carries our page id (for when IDs arrive). */
  network: 'cj' | 'awin' | 'direct' | 'travelpayouts';
  trackingParam?: string;
  targets: Readonly<Record<string, string>>;
}

export const PARTNERS = {
  booking: {
    name: 'Booking.com',
    network: 'cj',
    trackingParam: 'sid',
    targets: {
      'poiana-brasov': 'https://www.booking.com/searchresults.ro.html?ss=Poiana+Bra%C8%99ov',
      bansko: 'https://www.booking.com/searchresults.ro.html?ss=Bansko',
    },
  },
  skiset: {
    name: 'Skiset',
    network: 'awin',
    trackingParam: 'clickref',
    targets: { bansko: 'https://www.skiset.com/station-ski/bansko' },
  },
  snowrental: {
    name: 'Snowrental',
    network: 'awin',
    trackingParam: 'clickref',
    targets: { bansko: 'https://www.snowrental.com/fr/location-de-ski/bansko' },
  },
  car: {
    name: 'DiscoverCars',
    network: 'direct',
    targets: {
      otp: 'https://www.discovercars.com/romania/bucharest/otp',
      sof: 'https://www.discovercars.com/bulgaria/sofia/sof',
      pdv: 'https://www.discovercars.com/bulgaria/plovdiv/pdv',
    },
  },
} as const satisfies Record<string, Partner>;

export type PartnerKey = keyof typeof PARTNERS;

export function getPartner(partner: string | undefined): Partner | null {
  return partner && Object.hasOwn(PARTNERS, partner) ? PARTNERS[partner as PartnerKey] : null;
}

/** Destination URL for an allowed partner/target pair, or null. */
export function resolvePartnerUrl(partner?: string, target?: string): string | null {
  const p = getPartner(partner);
  if (!p || !target || !Object.hasOwn(p.targets, target)) return null;
  return p.targets[target] ?? null;
}

/** True when the partner has a page for this target (used to decide which blocks to show). */
export function hasTarget(partner: PartnerKey, target: string | null | undefined): target is string {
  return !!target && Object.hasOwn(PARTNERS[partner].targets, target);
}
