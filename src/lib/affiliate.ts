// Every affiliate link goes through /go/ (CLAUDE.md). Shared by AffiliateLink.astro
// and the Preact islands, so the URL shape and rel attributes live in one place.

export const AFFILIATE_REL = 'sponsored nofollow noopener';

/** /go/{partner}/{target}/?from={slug} (trailing slash: trailingSlash is 'always'). */
export function affiliateHref(partner: string, target: string, from?: string): string {
  const path = `/go/${encodeURIComponent(partner)}/${encodeURIComponent(target)}/`;
  return from ? `${path}?from=${encodeURIComponent(from)}` : path;
}
