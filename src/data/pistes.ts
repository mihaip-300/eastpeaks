// Piste difficulty classes, Romanian labels and European colours (CLAUDE.md).
export const DIFFICULTIES = [
  { key: 'novice', label: 'Foarte ușoară', color: '#2e9e44' },
  { key: 'easy', label: 'Ușoară', color: '#1e6fd9' },
  { key: 'intermediate', label: 'Medie', color: '#d62b2b' },
  { key: 'advanced', label: 'Dificilă', color: '#1a1a1a' },
  { key: 'expert', label: 'Foarte dificilă', color: '#1a1a1a' },
  { key: 'freeride', label: 'Freeride', color: '#f08c00' },
  { key: 'unknown', label: 'Nemarcată', color: '#8a8a8a' },
] as const;

export type Difficulty = (typeof DIFFICULTIES)[number]['key'];

export const DIFFICULTY_LABEL = Object.fromEntries(DIFFICULTIES.map((d) => [d.key, d.label])) as Record<
  Difficulty,
  string
>;

export const LIFT_TYPE_LABEL: Record<string, string> = {
  cable_car: 'telecabină',
  gondola: 'gondolă',
  chair_lift: 'telescaun',
  mixed_lift: 'lift mixt',
  drag_lift: 'teleschi',
  't-bar': 'teleschi',
  'j-bar': 'teleschi',
  platter: 'teleschi',
  rope_tow: 'teleschi cu sfoară',
  magic_carpet: 'bandă rulantă',
  funicular: 'funicular',
  railway: 'tren',
  unknown: 'lift',
};
