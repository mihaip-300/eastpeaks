// Allow-list for the /go/ redirect: only partner/target pairs listed here resolve,
// so the route can never act as an open redirect.
// Until the affiliate networks approve us, targets are the partners' plain URLs
// (HANDOFF 8.3). Affiliate IDs will come from environment variables, never from here.

export interface Partner {
  name: string;
  targets: Readonly<Record<string, string>>;
}

export const PARTNERS = {
  booking: {
    name: 'Booking.com',
    targets: {
      'poiana-brasov': 'https://www.booking.com/searchresults.ro.html?ss=Poiana+Bra%C8%99ov',
      bansko: 'https://www.booking.com/searchresults.ro.html?ss=Bansko',
    },
  },
} as const satisfies Record<string, Partner>;

export type PartnerKey = keyof typeof PARTNERS;

/** Returns the destination URL for an allowed partner/target pair, or null. */
export function resolvePartnerUrl(partner?: string, target?: string): string | null {
  if (!partner || !target || !Object.hasOwn(PARTNERS, partner)) return null;
  const targets: Readonly<Record<string, string>> = PARTNERS[partner as PartnerKey].targets;
  return Object.hasOwn(targets, target) ? (targets[target] ?? null) : null;
}
