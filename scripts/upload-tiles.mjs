// Upload the newest PMTiles file built by the pipeline to R2.
// Usage: npm run tiles:upload   (bucket: R2_BUCKET, default "pistes")
// Wrangler reads CLOUDFLARE_API_TOKEN from .env, so this runs on the project's account.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const latest = 'pipeline/out/latest_pmtiles.txt';
if (!existsSync(latest)) {
  console.error('No PMTiles yet: run `npm run pipeline -- make tiles` first.');
  process.exit(1);
}
const name = readFileSync(latest, 'utf8').trim();
const bucket = process.env.R2_BUCKET ?? 'pistes';
const wrangler = path.join(path.dirname(createRequire(import.meta.url).resolve('wrangler/package.json')), 'bin', 'wrangler.js');

// File names are versioned (pistes-YYYYMMDD.pmtiles), so they can be cached forever.
execFileSync(
  process.execPath,
  [
    wrangler, 'r2', 'object', 'put', `${bucket}/${name}`,
    '--file', `pipeline/out/${name}`,
    '--remote',
    '--content-type', 'application/octet-stream',
    '--cache-control', 'public, max-age=31536000, immutable',
  ],
  { stdio: 'inherit' },
);
console.log(`\nUploaded ${name}. Point PUBLIC_PMTILES_URL at <bucket public URL>/${name}.`);
