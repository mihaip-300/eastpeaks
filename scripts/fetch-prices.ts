// npm run prices: published Google Sheet (CSV) -> data/prices.json (HANDOFF 4.3).
// Runs before every build. If the sheet is not configured or can't be read, the
// committed data/prices.json stays as it is and the build continues (CLAUDE.md).
import { readFileSync, writeFileSync } from 'node:fs';
import { z } from 'astro/zod';

const OUT = 'data/prices.json';
const COLUMNS = ['slug', 'currency', 'adult_1d', 'adult_6d', 'child_1d', 'child_6d', 'season', 'source_url', 'checked_at', 'note'] as const;

const price = z.preprocess((v) => (v === '' || v == null ? null : Number(String(v).replace(',', '.'))), z.number().nonnegative().nullable());
const optional = z.preprocess((v) => (v === '' ? undefined : v), z.string().optional());
const Row = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  currency: z.enum(['EUR', 'RON', 'RSD', 'BAM', 'MKD']),
  adult_1d: price,
  adult_6d: price,
  child_1d: price,
  child_6d: price,
  season: optional,
  source_url: z.url(),
  checked_at: z.iso.date(),
  note: optional,
});

function warn(message: string): never {
  console.warn(`[prices] ${message} Keeping the existing ${OUT}.`);
  process.exit(0);
}

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) rows.push([...row, field]);
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

const url = process.env.PRICES_SHEET_CSV_URL;
if (!url) warn('PRICES_SHEET_CSV_URL is not set.');

let csv: string;
try {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) warn(`Sheet returned HTTP ${res.status}.`);
  csv = await res.text();
} catch (err) {
  warn(`Could not fetch the sheet (${(err as Error).message}).`);
}

const [header, ...lines] = parseCsv(csv);
const names = (header ?? []).map((h) => h.trim());
const missing = COLUMNS.filter((c) => !names.includes(c) && c !== 'season' && c !== 'note');
if (missing.length) warn(`Sheet is missing columns: ${missing.join(', ')}.`);

const prices = [];
const errors: string[] = [];
for (const [i, line] of lines.entries()) {
  const record = Object.fromEntries(names.map((n, j) => [n, (line[j] ?? '').trim()]));
  const parsed = Row.safeParse(record);
  if (parsed.success) prices.push(parsed.data);
  else errors.push(`row ${i + 2} (${record.slug || '?'}): ${parsed.error.issues.map((e) => `${e.path.join('.')} ${e.message}`).join('; ')}`);
}
if (errors.length) warn(`Invalid rows:\n  ${errors.join('\n  ')}\n`);

const previous = JSON.parse(readFileSync(OUT, 'utf8'));
const next = { source: 'sheet', generated_at: new Date().toISOString(), prices };
if (JSON.stringify(previous.prices) === JSON.stringify(prices)) {
  console.log(`[prices] ${prices.length} rows, unchanged.`);
} else {
  writeFileSync(OUT, JSON.stringify(next, null, 2) + '\n', 'utf8');
  console.log(`[prices] ${prices.length} rows written to ${OUT}.`);
}
