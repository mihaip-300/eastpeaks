import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import index from '../../../../data/generated/index.json';
import { resolvePartnerUrl } from '../../../data/partners';

// The only on-demand route (HANDOFF 8.1); everything else is prerendered.
export const prerender = false;

const HEADERS = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
const KNOWN_PAGES = new Set(index.resorts.map((r) => r.slug));
const BOT = /bot|crawl|spider|slurp|preview|monitor|headless|curl|wget|python|java\/|go-http|httpclient|facebookexternalhit|embedly|lighthouse/i;
const MOBILE = /Mobi|Android|iPhone|iPad|iPod/i;

export const GET: APIRoute = ({ params, url, request, locals }) => {
  const { partner, target } = params;
  const destination = resolvePartnerUrl(partner, target);
  if (!destination || !partner || !target) {
    return new Response('Not found', { status: 404, headers: { ...HEADERS, 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  // Only known resort slugs are accepted as the source page; anything else is dropped.
  const from = url.searchParams.get('from');
  const page = from && from.length <= 64 && KNOWN_PAGES.has(from) ? from : null;

  const ua = request.headers.get('user-agent') ?? '';
  if (ua && !BOT.test(ua) && env.DB) {
    // No IP and no full user agent: country from Cloudflare, device as mobile/desktop.
    const country = (request.cf?.country as string | undefined) ?? null;
    const device = MOBILE.test(ua) ? 'mobile' : 'desktop';
    locals.cfContext.waitUntil(
      env.DB.prepare('INSERT INTO clicks (partner, target, page, country, device) VALUES (?, ?, ?, ?, ?)')
        .bind(partner, target, page, country, device)
        .run()
        .catch((err: unknown) => console.error('[go] click not logged', err)),
    );
  }

  // Affiliate IDs and the network tracking parameter (sid / clickref, carrying `page`)
  // are added here once the networks approve us (HANDOFF 8.1 step 2).
  return new Response(null, { status: 302, headers: { ...HEADERS, Location: destination } });
};
