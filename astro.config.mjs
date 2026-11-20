// @ts-check
import { defineConfig } from 'astro/config';
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
  integrations: [preact(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
