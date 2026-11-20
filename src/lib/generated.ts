// Pipeline output (data/generated/{slug}.json). Written only by the pipeline.
import type { Difficulty } from '../data/pistes';

export interface SteepestRun {
  id: string;
  name: string | null;
  name_local?: string | null;
  difficulty: Difficulty;
  length_m: number;
  drop_m: number;
  avg_gradient_pct: number;
  max_gradient_100m_pct: number;
}

export interface GeneratedResort {
  slug: string;
  skiarea_sources: string[];
  openskimap_ids: string[];
  name: string;
  country: string;
  center: [number, number];
  bbox: [number, number, number, number];
  elevation_m: { min: number; max: number };
  runs: { count: number; km_total: number; km_by_difficulty: Record<Difficulty, number> };
  lifts: { count: number; by_type: Record<string, number> };
  steepest_runs: SteepestRun[];
  forest_share: number | null;
  generated_at: string;
  sources: { openskimap_date: string; openskimap_build: string; dem: string };
}

const modules = import.meta.glob<GeneratedResort>('../../data/generated/*.json', { eager: true, import: 'default' });

export const GENERATED: GeneratedResort[] = Object.entries(modules)
  .filter(([path]) => !path.endsWith('/index.json'))
  .map(([, data]) => data)
  .sort((a, b) => a.name.localeCompare(b.name, 'ro'));

export function generatedBySlug(slug: string): GeneratedResort | undefined {
  return GENERATED.find((r) => r.slug === slug);
}
