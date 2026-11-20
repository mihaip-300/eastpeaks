// "15 decembrie – 31 martie" from editorial MM-DD season dates.
const MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];

function day(md: string): string {
  const [m, d] = md.split('-').map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]}`;
}

export function seasonLabel(season?: { start: string; end: string } | null): string {
  return season ? `${day(season.start)} – ${day(season.end)}` : 'Sezonul se anunță în curând';
}
