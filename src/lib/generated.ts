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

// Resort files only: the folder also holds index.json and heroes.json.
export const GENERATED: GeneratedResort[] = Object.values(modules)
  .filter((data): data is GeneratedResort => typeof data?.slug === 'string' && typeof data?.runs === 'object')
  .sort((a, b) => a.name.localeCompare(b.name, 'ro'));

export function generatedBySlug(slug: string): GeneratedResort | undefined {
  return GENERATED.find((r) => r.slug === slug);
}
