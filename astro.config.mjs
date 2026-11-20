// @ts-check
import { defineConfig, envField } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? 'https://eastpeaks.eu',
  output: 'static',
  trailingSlash: 'always',
  // Only /go/ renders on demand; everything else is prerendered HTML.
  adapter: cloudflare({ imageService: 'compile' }),
  // No Astro.session usage: skip the auto-provisioned SESSION KV namespace.
  session: false,
  integrations: [preact(), sitemap({ filter: (page) => !page.includes('/design/') })],
  env: {
    schema: {
      // Versioned PMTiles on R2 (npm run tiles:upload). Public, so the default lives here;
      // switch to tiles.eastpeaks.eu at launch (HANDOFF M6).
      PUBLIC_PMTILES_URL: envField.string({
        context: 'client',
        access: 'public',
        default: 'https://pub-aeebd9481a5245de97461a8045baa828.r2.dev/pistes-20261119.pmtiles',
      }),
    },
  },
  vite: {
    plugins: [tailwindcss()],
    // MapLibre is one ~1.1 MB chunk, loaded only when the user opens a map.
    build: { chunkSizeWarningLimit: 1300 },
  },
});
