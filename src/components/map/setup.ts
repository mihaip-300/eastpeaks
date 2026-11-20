// Shared MapLibre setup for ResortMap (resort pages) and MapExplorer (/harta/):
// on-demand loading, piste layers, filters, hit-testing, 3D and popups.
import type {
  ExpressionSpecification,
  FilterSpecification,
  MapGeoJSONFeature,
  Map as MlMap,
  PointLike,
  RasterDEMSourceSpecification,
  SymbolLayerSpecification,
} from 'maplibre-gl';
import maplibreCssUrl from 'maplibre-gl/dist/maplibre-gl.css?url';
// MapLibre 6 loads its web worker from a separate, self-contained file; Vite does not
// bundle it, so it is emitted as an asset and handed to setWorkerUrl().
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { DIFFICULTIES, DIFFICULTY_LABEL, LIFT_TYPE_LABEL, type Difficulty } from '../../data/pistes';
import { escapeHtml, formatMeters, formatPct } from '../../lib/format';

export const BASE_STYLE = 'https://tiles.openfreemap.org/styles/positron';
const TERRAIN_TILES = 'https://tiles.mapterhorn.com/{z}/{x}/{y}.webp';
const TERRAIN_ATTRIBUTION = "<a href='https://mapterhorn.com/attribution'>© Mapterhorn</a>";
const PISTES_ATTRIBUTION =
  "<a href='https://openskimap.org'>OpenSkiMap</a>, <a href='https://www.openstreetmap.org/copyright'>© OpenStreetMap</a>, Copernicus DEM";

export const MAP_LOCALE = {
  'CooperativeGesturesHandler.WindowsHelpText': 'Ține apăsat Ctrl și derulează ca să mărești harta',
  'CooperativeGesturesHandler.MacHelpText': 'Ține apăsat ⌘ și derulează ca să mărești harta',
  'CooperativeGesturesHandler.MobileHelpText': 'Folosește două degete ca să miști harta',
  'NavigationControl.ZoomIn': 'Mărește',
  'NavigationControl.ZoomOut': 'Micșorează',
  'NavigationControl.ResetBearing': 'Orientează spre nord',
  'FullscreenControl.Enter': 'Ecran complet',
  'FullscreenControl.Exit': 'Ieși din ecran complet',
};

export const ALL_DIFFICULTIES: Difficulty[] = DIFFICULTIES.map((d) => d.key);
const LIFT_LAYERS = ['lifts', 'lifts-hit', 'lift-stations', 'lifts-label'];

// The stylesheet is imported as a URL and attached on demand: a plain CSS import
// would be hoisted into every page that contains a map island.
function loadStylesheet(href: string): Promise<void> {
  if (document.querySelector(`link[href="${href}"]`)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href });
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`stylesheet failed: ${href}`));
    document.head.appendChild(link);
  });
}

let ready: Promise<typeof import('maplibre-gl')> | null = null;

/** MapLibre + pmtiles + stylesheet, loaded once on first use. */
export function loadMapLibs(): Promise<typeof import('maplibre-gl')> {
  ready ??= Promise.all([import('maplibre-gl'), import('pmtiles'), loadStylesheet(maplibreCssUrl)]).then(([maplibregl, { Protocol }]) => {
    maplibregl.setWorkerUrl(maplibreWorkerUrl);
    maplibregl.addProtocol('pmtiles', new Protocol().tile);
    return maplibregl;
  });
  return ready;
}

const colorExpr = ['match', ['get', 'difficulty'], ...DIFFICULTIES.flatMap((d) => [d.key, d.color]), '#8a8a8a'] as unknown as ExpressionSpecification;

const widthExpr: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  12,
  ['case', ['==', ['get', 'difficulty'], 'expert'], 2.5, 1.6],
  16,
  ['case', ['==', ['get', 'difficulty'], 'expert'], 5.5, 4],
];

function runFilter(shown: Difficulty[], extra?: FilterSpecification): FilterSpecification {
  const byDifficulty: FilterSpecification = ['in', ['get', 'difficulty'], ['literal', shown]];
  return (extra ? ['all', byDifficulty, extra] : byDifficulty) as FilterSpecification;
}

/** Relief, ski areas, runs, lifts and labels, inserted on top of the base style. */
export function addResortLayers(map: MlMap, pmtilesUrl: string, shown: Difficulty[] = ALL_DIFFICULTIES): void {
  const firstSymbol = map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
  const dem: RasterDEMSourceSpecification = { type: 'raster-dem', tiles: [TERRAIN_TILES], tileSize: 512, encoding: 'terrarium', maxzoom: 12 };
  map.addSource('relief', { ...dem, attribution: TERRAIN_ATTRIBUTION });
  map.addSource('relief-3d', dem);
  map.addLayer(
    {
      id: 'hillshade',
      type: 'hillshade',
      source: 'relief',
      paint: { 'hillshade-exaggeration': 0.4, 'hillshade-shadow-color': '#4a5866', 'hillshade-highlight-color': '#ffffff' },
    },
    firstSymbol,
  );

  map.addSource('pistes', { type: 'vector', url: `pmtiles://${pmtilesUrl}`, attribution: PISTES_ATTRIBUTION });
  const src = { source: 'pistes' } as const;
  map.addLayer({ id: 'areas-fill', type: 'fill', ...src, 'source-layer': 'areas', paint: { 'fill-color': '#dbe8f3', 'fill-opacity': 0.35 } });
  map.addLayer({ id: 'areas-line', type: 'line', ...src, 'source-layer': 'areas', paint: { 'line-color': '#8fb0cc', 'line-width': 1 } });
  // Gold glow under the selected run (MapExplorer); matches nothing until selectRun().
  map.addLayer({
    id: 'runs-selected', type: 'line', ...src, 'source-layer': 'runs', filter: ['==', ['get', 'id'], ''],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#c6a667', 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 8, 16, 16], 'line-opacity': 0.55, 'line-blur': 2 },
  });
  map.addLayer({
    id: 'runs', type: 'line', ...src, 'source-layer': 'runs', filter: runFilter(shown, ['!=', ['get', 'difficulty'], 'freeride']),
    layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': colorExpr, 'line-width': widthExpr },
  });
  map.addLayer({
    id: 'runs-freeride', type: 'line', ...src, 'source-layer': 'runs', filter: runFilter(shown, ['==', ['get', 'difficulty'], 'freeride']),
    paint: { 'line-color': colorExpr, 'line-width': widthExpr, 'line-dasharray': [2, 1.5] },
  });
  // Wide invisible lines so runs and lifts are easy to tap.
  map.addLayer({ id: 'runs-hit', type: 'line', ...src, 'source-layer': 'runs', filter: runFilter(shown), paint: { 'line-color': '#000', 'line-opacity': 0, 'line-width': 16 } });
  map.addLayer({ id: 'lifts', type: 'line', ...src, 'source-layer': 'lifts', paint: { 'line-color': '#1a1a1a', 'line-width': 1.5 } });
  map.addLayer({ id: 'lifts-hit', type: 'line', ...src, 'source-layer': 'lifts', paint: { 'line-color': '#000', 'line-opacity': 0, 'line-width': 12 } });
  map.addLayer({
    id: 'lift-stations', type: 'circle', ...src, 'source-layer': 'lift_stations',
    paint: { 'circle-radius': 3, 'circle-color': '#1a1a1a', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1 },
  });
  const label = (font: string): SymbolLayerSpecification['layout'] => ({
    'symbol-placement': 'line',
    'text-field': ['coalesce', ['get', 'name'], ''],
    'text-font': [font],
    'text-size': 12,
  });
  map.addLayer({
    id: 'runs-label', type: 'symbol', ...src, 'source-layer': 'runs', minzoom: 14, filter: runFilter(shown), layout: label('Noto Sans Regular'),
    paint: { 'text-color': '#13212e', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
  });
  map.addLayer({
    id: 'lifts-label', type: 'symbol', ...src, 'source-layer': 'lifts', minzoom: 15, layout: label('Noto Sans Italic'),
    paint: { 'text-color': '#333333', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
  });
  for (const id of ['runs-hit', 'lifts-hit']) {
    map.on('mouseenter', id, () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', id, () => (map.getCanvas().style.cursor = ''));
  }
}

export function applyDifficultyFilter(map: MlMap, shown: Difficulty[]): void {
  map.setFilter('runs', runFilter(shown, ['!=', ['get', 'difficulty'], 'freeride']));
  map.setFilter('runs-freeride', runFilter(shown, ['==', ['get', 'difficulty'], 'freeride']));
  map.setFilter('runs-hit', runFilter(shown));
  map.setFilter('runs-label', runFilter(shown));
}

export function setLiftsVisible(map: MlMap, visible: boolean): void {
  for (const id of LIFT_LAYERS) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
}

export function setTerrain3d(map: MlMap, on: boolean): void {
  map.setTerrain(on ? { source: 'relief-3d', exaggeration: 1.2 } : null);
  map.easeTo({ pitch: on ? 60 : 0, duration: 800 });
}

export function selectRun(map: MlMap, id: string | null): void {
  map.setFilter('runs-selected', ['==', ['get', 'id'], id ?? '']);
}

/** The run or lift under the pointer: exact lines first, then the wide tap area. */
export function pickFeature(map: MlMap, point: { x: number; y: number }): MapGeoJSONFeature | undefined {
  const near = (layers: string[], r: number) =>
    map.queryRenderedFeatures([[point.x - r, point.y - r], [point.x + r, point.y + r]] as [PointLike, PointLike], {
      layers: layers.filter((l) => map.getLayoutProperty(l, 'visibility') !== 'none'),
    });
  return near(['runs', 'runs-freeride', 'lifts'], 3)[0] ?? near(['runs-hit', 'lifts-hit'], 1)[0];
}

export const isLift = (f: MapGeoJSONFeature) => f.layer.id.startsWith('lifts');

/** Bounds of all loaded tile pieces of a run (runs are split across tiles). */
export function runBounds(map: MlMap, id: string): [[number, number], [number, number]] | null {
  const parts = map.querySourceFeatures('pistes', { sourceLayer: 'runs', filter: ['==', ['get', 'id'], id] });
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const f of parts) {
    const g = f.geometry;
    const lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
    for (const line of lines) for (const [x, y] of line as [number, number][]) {
      minx = Math.min(minx, x); miny = Math.min(miny, y); maxx = Math.max(maxx, x); maxy = Math.max(maxy, y);
    }
  }
  return Number.isFinite(minx) ? [[minx, miny], [maxx, maxy]] : null;
}

export function runPopupHtml(p: Record<string, unknown>): string {
  const name = typeof p.name === 'string' && p.name ? p.name : 'Pârtie fără nume';
  const difficulty = DIFFICULTY_LABEL[p.difficulty as Difficulty] ?? DIFFICULTY_LABEL.unknown;
  const color = DIFFICULTIES.find((d) => d.key === p.difficulty)?.color ?? '#8a8a8a';
  const rows: [string, string][] = [
    ['Lungime', formatMeters(Number(p.length_m))],
    ['Diferență de nivel', formatMeters(Number(p.drop_m))],
    ['Pantă medie', formatPct(Number(p.avg_pct))],
    ['Pantă maximă (100 m)', formatPct(Number(p.max_pct))],
  ];
  return `<div class="text-sm">
    <p class="font-semibold">${escapeHtml(name)}</p>
    <p class="mb-1 flex items-center gap-1.5 text-slate"><span style="background:${color}" class="inline-block h-2.5 w-2.5 rounded-full"></span>${escapeHtml(difficulty)}</p>
    <table>${rows.map(([k, v]) => `<tr><td class="pr-3 text-slate">${k}</td><td class="text-right tabular-nums">${v}</td></tr>`).join('')}</table>
  </div>`;
}

export function liftLabel(p: Record<string, unknown>): { title: string; type: string } {
  const type = LIFT_TYPE_LABEL[String(p.lift_type)] ?? 'lift';
  const name = typeof p.name === 'string' && p.name ? p.name : null;
  return { title: name ?? type[0]!.toUpperCase() + type.slice(1), type };
}

export function liftPopupHtml(p: Record<string, unknown>): string {
  const { title, type } = liftLabel(p);
  const named = title.toLowerCase() !== type.toLowerCase();
  return `<div class="text-sm"><p class="font-semibold">${escapeHtml(title)}</p>${named ? `<p class="text-slate">${escapeHtml(type)}</p>` : ''}</div>`;
}
