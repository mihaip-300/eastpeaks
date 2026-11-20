import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug: ASCII, lowercase, hyphens');
const monthDay = z.string().regex(/^\d{2}-\d{2}$/, 'MM-DD');
const eur = z.number().nonnegative();

const driveFrom = z.object({ km: z.number().positive(), hours: z.number().positive(), road_costs_eur: eur });

// Editorial data per resort (HANDOFF 4.2). The pipeline writes data/generated/; this is hand-edited.
const statiuni = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/statiuni' }),
  schema: z.object({
    slug,
    name: z.string().min(1),
    region: z.string().min(1),
    summary: z.string().min(20),
    season: z.object({ start: monthDay, end: monthDay }),
    drive: z.object({ bucuresti: driveFrom, cluj: driveFrom, brasov: driveFrom }).partial(),
    airports: z.array(z.object({ iata: z.string().length(3), name: z.string(), km: z.number().positive() })),
    accommodation_per_night_eur: z.object({ budget: eur, mid: eur, premium: eur }).partial(),
    room_capacity: z.number().int().positive().default(2),
    rental_per_day_eur: z.object({ adult: eur, child: eur }).partial(),
    // Target keys in src/data/partners.ts; null when the partner doesn't cover the resort.
    partners: z.object({
      booking: slug.nullable(),
      skiset: slug.nullable().default(null),
      snowrental: slug.nullable().default(null),
      transfer: slug.nullable().default(null),
      /** Car rental at these airports (lowercase IATA). */
      car: z.array(z.string().regex(/^[a-z]{3}$/)).default([]),
    }),
    photos: z.array(
      z.object({ src: z.string(), alt: z.string().min(3), credit: z.string(), license: z.string() }),
    ),
    official_km: z.number().positive().nullable(),
    updated: z.iso.date(),
    verification: z
      .object({
        status: z.enum(['de-verificat', 'verificat']),
        estimates: z.array(z.string()).default([]),
        notes: z.string().optional(),
      })
      .default({ status: 'de-verificat', estimates: [] }),
  }),
});

// Curated comparison pairs for /compara/{a}-vs-{b}/ (never all combinations).
const comparatii = defineCollection({
  loader: file('./src/content/comparatii.json'),
  schema: z.object({ id: z.string(), a: slug, b: slug }),
});

export const collections = { statiuni, comparatii };
