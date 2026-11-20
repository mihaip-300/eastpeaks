import type { APIRoute } from 'astro';
import { resolvePartnerUrl } from '../../../data/partners';

// The only on-demand route; everything else is prerendered.
export const prerender = false;

const COMMON_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex',
};

export const GET: APIRoute = ({ params }) => {
  const destination = resolvePartnerUrl(params.partner, params.target);

  if (!destination) {
    return new Response('Not found', {
      status: 404,
      headers: { ...COMMON_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  // Click logging to D1 (via locals.cfContext.waitUntil) and the `from`
  // tracking parameter are added in M0 step E.
  return new Response(null, {
    status: 302,
    headers: { ...COMMON_HEADERS, Location: destination },
  });
};
