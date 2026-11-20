/** @jsxImportSource preact */
import type {
  ExpressionSpecification,
  FilterSpecification,
  Map as MlMap,
  MapMouseEvent,
  RasterDEMSourceSpecification,
  SymbolLayerSpecification,
} from 'maplibre-gl';
import maplibreCssUrl from 'maplibre-gl/dist/maplibre-gl.css?url';
// MapLibre 6 loads its web worker from a separate, self-contained file; Vite does not
// bundle it, so it is emitted as an asset and handed to setWorkerUrl().
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { useEffect, useRef, useState } from 'preact/hooks';
import { DIFFICULTIES, DIFFICULTY_LABEL, LIFT_TYPE_LABEL, type Difficulty } from '../../data/pistes';
import { escapeHtml, formatMeters, formatPct } from '../../lib/format';

// MapLibre and pmtiles are only imported after the user asks for the map
// (or opens a shared #harta= link), so a resort page loads no map code by default.

interface Props {
  name: string;
  slug: string;
  bbox: [number, number, number, number];
  preview: string;
  pmtilesUrl: string;
}

const BASE_STYLE = 'https://tiles.openfreemap.org/styles/positron';
const TERRAIN_TILES = 'https://tiles.mapterhorn.com/{z}/{x}/{y}.webp';
const TERRAIN_ATTRIBUTION = "<a href='https://mapterhorn.com/attribution'>© Mapterhorn</a>";
const PISTES_ATTRIBUTION =
  "<a href='https://openskimap.org'>OpenSkiMap</a>, <a href='https://www.openstreetmap.org/copyright'>© OpenStreetMap</a>, Copernicus DEM";
const HASH_KEY = 'harta';

let protocolRegistered = false;

// The stylesheet is imported as a URL and attached on demand: a plain CSS import
// would be hoisted into every resort page by the bundler.
function loadStylesheet(href: string): Promise<void> {
  if (document.querySelector(`link[href="${href}"]`)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href });
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`stylesheet failed: ${href}`));
    document.head.appendChild(link);
  });
}

const colorExpr: ExpressionSpecification = [
  'match',
  ['get', 'difficulty'],
  ...DIFFICULTIES.flatMap((d) => [d.key, d.color]),
  '#8a8a8a',
] as unknown as ExpressionSpecification;

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

function popupHtml(p: Record<string, unknown>): string {
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

function liftPopupHtml(p: Record<string, unknown>): string {
  const type = LIFT_TYPE_LABEL[String(p.lift_type)] ?? 'lift';
  const name = typeof p.name === 'string' && p.name ? p.name : null;
  return `<div class="text-sm"><p class="font-semibold">${escapeHtml(name ?? type[0]!.toUpperCase() + type.slice(1))}</p>${
    name ? `<p class="text-slate">${escapeHtml(type)}</p>` : ''
  }</div>`;
}

export default function ResortMap({ name, slug, bbox, preview, pmtilesUrl }: Props) {
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [shown, setShown] = useState<Difficulty[]>(DIFFICULTIES.map((d) => d.key));
  const [terrain3d, setTerrain3d] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);

  // A shared link with a map position (#harta=...) opens the map directly.
  useEffect(() => {
    if (window.location.hash.startsWith(`#${HASH_KEY}=`)) setActive(true);
  }, []);

  useEffect(() => {
    if (!active || !container.current) return;
    let cancelled = false;
    setStatus('loading');

    (async () => {
      try {
        const [maplibregl, { Protocol }] = await Promise.all([
          import('maplibre-gl'),
          import('pmtiles'),
          loadStylesheet(maplibreCssUrl),
        ]);
        if (cancelled || !container.current) return;
        if (!protocolRegistered) {
          maplibregl.setWorkerUrl(maplibreWorkerUrl);
          maplibregl.addProtocol('pmtiles', new Protocol().tile);
          protocolRegistered = true;
        }

        const isSmall = window.matchMedia('(max-width: 639px)').matches;
        const map = new maplibregl.Map({
          container: container.current,
          style: BASE_STYLE,
          bounds: bbox,
          fitBoundsOptions: { padding: 32 },
          hash: HASH_KEY,
          maxPitch: 75,
          attributionControl: { compact: true },
          // Inline on desktop, page scrolling keeps working; full screen on mobile.
          cooperativeGestures: !isSmall,
          locale: {
            'CooperativeGesturesHandler.WindowsHelpText': 'Ține apăsat Ctrl și derulează ca să mărești harta',
            'CooperativeGesturesHandler.MacHelpText': 'Ține apăsat ⌘ și derulează ca să mărești harta',
            'CooperativeGesturesHandler.MobileHelpText': 'Folosește două degete ca să miști harta',
            'NavigationControl.ZoomIn': 'Mărește',
            'NavigationControl.ZoomOut': 'Micșorează',
            'NavigationControl.ResetBearing': 'Orientează spre nord',
            'FullscreenControl.Enter': 'Ecran complet',
            'FullscreenControl.Exit': 'Ieși din ecran complet',
          },
        });
        mapRef.current = map;
        map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
        if (!isSmall) map.addControl(new maplibregl.FullscreenControl(), 'top-right');
        map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

        map.on('error', (e) => console.warn('[ResortMap]', e.error?.message ?? e));

        map.on('load', () => {
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
          map.addLayer({ id: 'areas-fill', type: 'fill', source: 'pistes', 'source-layer': 'areas', paint: { 'fill-color': '#dbe8f3', 'fill-opacity': 0.35 } });
          map.addLayer({ id: 'areas-line', type: 'line', source: 'pistes', 'source-layer': 'areas', paint: { 'line-color': '#8fb0cc', 'line-width': 1 } });

          const runLayout = { 'line-cap': 'round', 'line-join': 'round' } as const;
          map.addLayer({
            id: 'runs', type: 'line', source: 'pistes', 'source-layer': 'runs',
            filter: runFilter(shown, ['!=', ['get', 'difficulty'], 'freeride']),
            layout: runLayout, paint: { 'line-color': colorExpr, 'line-width': widthExpr },
          });
          map.addLayer({
            id: 'runs-freeride', type: 'line', source: 'pistes', 'source-layer': 'runs',
            filter: runFilter(shown, ['==', ['get', 'difficulty'], 'freeride']),
            paint: { 'line-color': colorExpr, 'line-width': widthExpr, 'line-dasharray': [2, 1.5] },
          });
          // Wide invisible line so runs are easy to tap.
          map.addLayer({
            id: 'runs-hit', type: 'line', source: 'pistes', 'source-layer': 'runs',
            filter: runFilter(shown), paint: { 'line-color': '#000000', 'line-opacity': 0, 'line-width': 16 },
          });
          map.addLayer({ id: 'lifts', type: 'line', source: 'pistes', 'source-layer': 'lifts', paint: { 'line-color': '#1a1a1a', 'line-width': 1.5 } });
          map.addLayer({
            id: 'lifts-hit', type: 'line', source: 'pistes', 'source-layer': 'lifts',
            paint: { 'line-color': '#000000', 'line-opacity': 0, 'line-width': 12 },
          });
          map.addLayer({
            id: 'lift-stations', type: 'circle', source: 'pistes', 'source-layer': 'lift_stations',
            paint: { 'circle-radius': 3, 'circle-color': '#1a1a1a', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1 },
          });
          const label = (font: string): SymbolLayerSpecification['layout'] => ({
            'symbol-placement': 'line',
            'text-field': ['coalesce', ['get', 'name'], ''],
            'text-font': [font],
            'text-size': 12,
          });
          map.addLayer({
            id: 'runs-label', type: 'symbol', source: 'pistes', 'source-layer': 'runs', minzoom: 14,
            filter: runFilter(shown), layout: label('Noto Sans Regular'),
            paint: { 'text-color': '#13212e', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
          });
          map.addLayer({
            id: 'lifts-label', type: 'symbol', source: 'pistes', 'source-layer': 'lifts', minzoom: 15,
            layout: label('Noto Sans Italic'),
            paint: { 'text-color': '#333333', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
          });

          // Prefer the line actually under the pointer; fall back to the wide tap area.
          map.on('click', (e: MapMouseEvent) => {
            const near = (layers: string[], r: number) =>
              map.queryRenderedFeatures(
                [
                  [e.point.x - r, e.point.y - r],
                  [e.point.x + r, e.point.y + r],
                ],
                { layers },
              );
            const f = near(['runs', 'runs-freeride', 'lifts'], 3)[0] ?? near(['runs-hit', 'lifts-hit'], 1)[0];
            if (!f) return;
            const html = f.layer.id.startsWith('lifts') ? liftPopupHtml(f.properties) : popupHtml(f.properties);
            new maplibregl.Popup({ maxWidth: '260px' }).setLngLat(e.lngLat).setHTML(html).addTo(map);
          });
          for (const id of ['runs-hit', 'lifts-hit']) {
            map.on('mouseenter', id, () => (map.getCanvas().style.cursor = 'pointer'));
            map.on('mouseleave', id, () => (map.getCanvas().style.cursor = ''));
          }
          // Compact attribution starts expanded; on phones collapse it to the (i) button
          // so it doesn't cover the runs. It stays visible and opens on tap.
          if (isSmall) container.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
          if (!cancelled) setStatus('ready');
        });
      } catch (err) {
        console.error('[ResortMap]', err);
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [active]);

  // Difficulty filters.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== 'ready') return;
    map.setFilter('runs', runFilter(shown, ['!=', ['get', 'difficulty'], 'freeride']));
    map.setFilter('runs-freeride', runFilter(shown, ['==', ['get', 'difficulty'], 'freeride']));
    map.setFilter('runs-hit', runFilter(shown));
    map.setFilter('runs-label', runFilter(shown));
  }, [shown, status]);

  // 3D terrain toggle.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== 'ready') return;
    map.setTerrain(terrain3d ? { source: 'relief-3d', exaggeration: 1.2 } : null);
    map.easeTo({ pitch: terrain3d ? 60 : 0, duration: 800 });
  }, [terrain3d, status]);

  function close() {
    setActive(false);
    setTerrain3d(false);
    if (window.location.hash.startsWith(`#${HASH_KEY}=`)) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  const toggle = (key: Difficulty) =>
    setShown((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));

  if (!active) {
    return (
      <div class="relative overflow-hidden rounded-xl border border-stone bg-stone/50">
        <img
          src={preview}
          alt={`Harta pârtiilor din ${name}`}
          width={800}
          height={500}
          loading="lazy"
          decoding="async"
          class="aspect-[8/5] w-full object-cover"
        />
        <div class="absolute inset-0 flex items-center justify-center bg-white/10">
          <button
            type="button"
            onClick={() => setActive(true)}
            class="btn btn-primary"
          >
            Deschide harta interactivă
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      class="fixed inset-0 z-50 flex flex-col bg-white sm:static sm:z-auto sm:rounded-xl sm:border sm:border-stone"
      role="region"
      aria-label={`Harta interactivă a pârtiilor din ${name}`}
      data-resort={slug}
    >
      <div class="flex items-center justify-between gap-2 border-b border-stone px-3 py-2 sm:hidden">
        <p class="font-semibold">{name}</p>
        <button type="button" onClick={close} class="rounded-md px-3 py-1.5 text-sm font-medium text-gold-deep">
          Închide
        </button>
      </div>
      <div class="relative min-h-0 flex-1 sm:aspect-[8/5] sm:flex-none">
        {/* MapLibre sets position:relative on its container, so it gets an inner full-size div. */}
        <div class="absolute inset-0 overflow-hidden sm:rounded-t-xl">
          <div ref={container} class="h-full w-full" />
        </div>
        {status === 'loading' && (
          <p class="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate">Se încarcă harta…</p>
        )}
        {status === 'error' && (
          <p class="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-slate">
            Harta nu s-a putut încărca. Reîncarcă pagina sau încearcă mai târziu.
          </p>
        )}
      </div>
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-stone px-3 py-2.5 text-sm">
        <span class="sr-only">Filtrează pârtiile după dificultate</span>
        {DIFFICULTIES.map((d) => (
          <label key={d.key} class="inline-flex cursor-pointer items-center gap-1.5 select-none">
            <input type="checkbox" checked={shown.includes(d.key)} onChange={() => toggle(d.key)} class="accent-alpine-red" />
            <span
              class="inline-block h-1 w-4 rounded"
              style={{
                background: d.key === 'freeride' ? `repeating-linear-gradient(90deg, ${d.color} 0 4px, transparent 4px 7px)` : d.color,
                height: d.key === 'expert' ? '6px' : '4px',
              }}
            />
            {d.label}
          </label>
        ))}
        <label class="ml-auto inline-flex cursor-pointer items-center gap-1.5 select-none">
          <input type="checkbox" checked={terrain3d} onChange={() => setTerrain3d((v) => !v)} class="accent-alpine-red" />
          Teren 3D
        </label>
      </div>
    </div>
  );
}
