/** @jsxImportSource preact */
// /harta/: map-first explorer (DESIGN.md, brief "SkiGrades-style"). Map ~2/3, dark side panel
// with resort switcher, stats, steepest runs and layer controls; on phones the panel is a
// bottom sheet. Selecting a run highlights it in gold and shows its numbers in the panel.
import type { MapGeoJSONFeature, Map as MlMap, MapMouseEvent } from 'maplibre-gl';
import { useEffect, useRef, useState } from 'preact/hooks';
import { DIFFICULTIES, DIFFICULTY_LABEL, type Difficulty } from '../../data/pistes';
import { formatInt, formatMeters, formatPct } from '../../lib/format';
import {
  ALL_DIFFICULTIES,
  BASE_STYLE,
  MAP_LOCALE,
  addResortLayers,
  applyDifficultyFilter,
  isLift,
  liftLabel,
  loadMapLibs,
  pickFeature,
  runBounds,
  selectRun,
  setLiftsVisible,
  setTerrain3d,
} from './setup';

export interface ExplorerRun {
  id: string;
  name: string | null;
  difficulty: Difficulty;
  length_m: number;
  drop_m: number;
  avg_gradient_pct: number;
  max_gradient_100m_pct: number;
}

export interface ExplorerResort {
  slug: string;
  name: string;
  url: string;
  place: string;
  season: string;
  bbox: [number, number, number, number];
  km: number;
  runs: number;
  lifts: number;
  elevMin: number;
  elevMax: number;
  kmByDifficulty: Partial<Record<Difficulty, number>>;
  steepest: ExplorerRun[];
}

interface Props {
  resorts: ExplorerResort[];
  pmtilesUrl: string;
}

type Selection = { kind: 'run'; p: Record<string, unknown> } | { kind: 'lift'; p: Record<string, unknown> } | null;
type Tab = 'prezentare' | 'partii' | 'straturi';

const km1 = (n: number) => n.toLocaleString('ro-RO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const color = (d: unknown) => DIFFICULTIES.find((x) => x.key === d)?.color ?? '#8a8a8a';

// ?statiune= is applied after mount (not in the initial state): the server renders the
// first resort, and hydration must match it before the URL choice re-renders.
function slugFromUrl(resorts: ExplorerResort[]): string | null {
  const wanted = new URLSearchParams(window.location.search).get('statiune');
  return wanted && resorts.some((r) => r.slug === wanted) ? wanted : null;
}

export default function MapExplorer({ resorts, pmtilesUrl }: Props) {
  const [slug, setSlug] = useState(resorts[0]!.slug);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [selection, setSelection] = useState<Selection>(null);
  const [tab, setTab] = useState<Tab>('prezentare');
  const [shown, setShown] = useState<Difficulty[]>(ALL_DIFFICULTIES);
  const [lifts, setLifts] = useState(true);
  const [terrain3d, setTerrain] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const resort = resorts.find((r) => r.slug === slug) ?? resorts[0]!;
  const small = () => window.matchMedia('(max-width: 1023px)').matches;
  const padding = () => (small() ? { top: 40, left: 24, right: 24, bottom: 180 } : 48);

  useEffect(() => {
    let cancelled = false;
    const start = resorts.find((r) => r.slug === slugFromUrl(resorts)) ?? resorts[0]!;
    if (start.slug !== slug) setSlug(start.slug);
    (async () => {
      try {
        const maplibregl = await loadMapLibs();
        if (cancelled || !container.current) return;
        const map = new maplibregl.Map({
          container: container.current,
          style: BASE_STYLE,
          bounds: start.bbox,
          fitBoundsOptions: { padding: padding() },
          maxPitch: 75,
          attributionControl: { compact: true },
          locale: MAP_LOCALE,
        });
        mapRef.current = map;
        map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
        map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
        map.on('error', (e) => console.warn('[MapExplorer]', e.error?.message ?? e));
        map.on('load', () => {
          addResortLayers(map, pmtilesUrl);
          map.on('click', (e: MapMouseEvent) => {
            const f: MapGeoJSONFeature | undefined = pickFeature(map, e.point);
            if (!f) {
              setSelection(null);
              selectRun(map, null);
              return;
            }
            if (isLift(f)) {
              selectRun(map, null);
              setSelection({ kind: 'lift', p: f.properties });
            } else {
              selectRun(map, String(f.properties.id));
              setSelection({ kind: 'run', p: f.properties });
            }
            setSheetOpen(true);
          });
          if (small()) container.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
          if (!cancelled) setStatus('ready');
        });
      } catch (err) {
        console.error('[MapExplorer]', err);
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (mapRef.current && status === 'ready') applyDifficultyFilter(mapRef.current, shown);
  }, [shown, status]);
  useEffect(() => {
    if (mapRef.current && status === 'ready') setLiftsVisible(mapRef.current, lifts);
  }, [lifts, status]);
  useEffect(() => {
    if (mapRef.current && status === 'ready') setTerrain3d(mapRef.current, terrain3d);
  }, [terrain3d, status]);

  function switchResort(next: string) {
    if (next === slug) return;
    const target = resorts.find((r) => r.slug === next);
    if (!target) return;
    setSlug(next);
    setSelection(null);
    const url = new URL(window.location.href);
    url.searchParams.set('statiune', next);
    history.replaceState(null, '', url);
    const map = mapRef.current;
    if (map) {
      selectRun(map, null);
      map.fitBounds(target.bbox, { padding: padding(), duration: 2800, pitch: terrain3d ? 60 : 0, essential: true });
    }
  }

  function focusRun(run: ExplorerRun) {
    const map = mapRef.current;
    setSelection({ kind: 'run', p: { id: run.id, name: run.name, difficulty: run.difficulty, length_m: run.length_m, drop_m: run.drop_m, avg_pct: run.avg_gradient_pct, max_pct: run.max_gradient_100m_pct } });
    if (!map) return;
    selectRun(map, run.id);
    const b = runBounds(map, run.id);
    if (b) map.fitBounds(b, { padding: padding(), maxZoom: 15.5, duration: 1600 });
  }

  const toggle = (key: Difficulty) => setShown((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));
  const tabs: { id: Tab; label: string }[] = [
    { id: 'prezentare', label: 'Prezentare' },
    { id: 'partii', label: 'Pârtii' },
    { id: 'straturi', label: 'Straturi' },
  ];
  const total = resort.km || 1;

  return (
    <div class="relative h-[calc(100svh-4rem)] overflow-hidden bg-black sm:h-[calc(100svh-7.25rem)] lg:grid lg:grid-cols-[1fr_27rem]">
      {/* Map */}
      <div class="relative h-full min-h-0">
        <div class="absolute inset-0">
          <div ref={container} class="h-full w-full" aria-label="Harta pârtiilor" role="region" />
        </div>
        {status === 'loading' && <p class="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-mist">Se încarcă harta…</p>}
        {status === 'error' && <p class="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-mist">Harta nu s-a putut încărca. Reîncarcă pagina.</p>}
        {/* Floating toolbar */}
        <div class="glass absolute top-3 left-3 flex items-center gap-1 rounded-sm p-1 text-sm text-ivory">
          {(['2D', '3D'] as const).map((m) => {
            const on = (m === '3D') === terrain3d;
            return (
              <button key={m} type="button" aria-pressed={on} onClick={() => setTerrain(m === '3D')} class={`rounded-[3px] px-3 py-1.5 font-medium ${on ? 'bg-ivory text-midnight' : 'text-ivory/80 hover:text-ivory'}`}>
                {m}
              </button>
            );
          })}
          <span class="mx-1 h-5 w-px bg-gold/30" aria-hidden="true" />
          <button type="button" aria-pressed={lifts} onClick={() => setLifts((v) => !v)} class={`rounded-[3px] px-3 py-1.5 font-medium ${lifts ? 'text-ivory' : 'text-ivory/50 line-through'}`}>
            Lifturi
          </button>
        </div>
      </div>

      {/* Panel: right column on desktop, bottom sheet on phones */}
      <aside
        class={`on-dark absolute inset-x-0 bottom-0 z-10 flex max-h-[78%] flex-col rounded-t-lg bg-black text-ivory shadow-[0_-12px_40px_rgba(0,0,0,0.35)] transition-transform duration-500 ease-[var(--ease-out-soft)] lg:static lg:max-h-none lg:translate-y-0 lg:rounded-none lg:border-l lg:border-gold/20 lg:shadow-none ${
          sheetOpen ? 'translate-y-0' : 'translate-y-[calc(100%-9.5rem)]'
        }`}
        aria-label="Detalii stațiune"
      >
        <button type="button" onClick={() => setSheetOpen((v) => !v)} class="mx-auto mt-2.5 mb-1 h-1.5 w-12 shrink-0 rounded-full bg-gold/40 lg:hidden" aria-label={sheetOpen ? 'Restrânge panoul' : 'Extinde panoul'} aria-expanded={sheetOpen} />

        <div class="min-h-0 flex-1 overflow-y-auto px-5 pt-3 pb-8 sm:px-7 lg:pt-7">
          {/* Resort switcher */}
          <div class="inline-flex rounded-sm border border-gold/30 p-1" role="group" aria-label="Alege stațiunea">
            {resorts.map((r) => (
              <button key={r.slug} type="button" aria-pressed={r.slug === slug} onClick={() => switchResort(r.slug)} class={`rounded-[3px] px-3.5 py-1.5 text-sm font-medium whitespace-nowrap ${r.slug === slug ? 'bg-ivory text-midnight' : 'text-mist hover:text-ivory'}`}>
                {r.name}
              </button>
            ))}
          </div>

          {/* Selected run or lift */}
          {selection && (
            <div class="mt-6 rounded-lg bg-midnight p-5" aria-live="polite">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="label flex items-center gap-2">
                    {selection.kind === 'run' ? (
                      <>
                        <span class="inline-block h-2 w-2 rounded-full" style={{ background: color(selection.p.difficulty) }} />
                        {DIFFICULTY_LABEL[selection.p.difficulty as Difficulty] ?? 'Pârtie'}
                      </>
                    ) : (
                      'Lift'
                    )}
                  </p>
                  <p class="mt-2 font-display text-[1.75rem] leading-tight">
                    {selection.kind === 'run' ? (typeof selection.p.name === 'string' && selection.p.name) || 'Pârtie fără nume' : liftLabel(selection.p).title}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelection(null);
                    if (mapRef.current) selectRun(mapRef.current, null);
                  }}
                  class="shrink-0 rounded-sm px-2 py-1 text-sm text-mist hover:text-ivory"
                  aria-label="Închide detaliile"
                >
                  ✕
                </button>
              </div>
              {selection.kind === 'run' ? (
                <dl class="mt-5 grid grid-cols-2 gap-x-4 gap-y-4">
                  {[
                    ['Lungime', formatMeters(Number(selection.p.length_m))],
                    ['Diferență', formatMeters(Number(selection.p.drop_m))],
                    ['Pantă medie', formatPct(Number(selection.p.avg_pct))],
                    ['Pantă max. 100 m', formatPct(Number(selection.p.max_pct))],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt class="label text-mist">{k}</dt>
                      <dd class="tabular mt-1.5 font-display text-2xl text-gold">{v}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p class="mt-2 text-mist">{liftLabel(selection.p).type}</p>
              )}
            </div>
          )}

          {/* Resort */}
          <p class="label mt-8">{resort.place}</p>
          <h2 class="mt-2 text-h3">{resort.name}</h2>
          <p class="mt-1 text-sm text-mist">Sezon {resort.season}</p>

          <div role="tablist" aria-label="Detalii" class="mt-6 flex gap-6 border-b border-gold/20">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                type="button"
                id={`tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`panel-${t.id}`}
                onClick={() => setTab(t.id)}
                class={`relative pb-3 text-sm font-medium ${tab === t.id ? 'text-ivory' : 'text-mist hover:text-ivory'}`}
              >
                {t.label}
                <span class={`absolute inset-x-0 -bottom-px h-0.5 ${tab === t.id ? 'bg-alpine-red' : 'bg-transparent'}`} />
              </button>
            ))}
          </div>

          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} class="pt-6">
            {tab === 'prezentare' && (
              <>
                <dl class="grid grid-cols-2 gap-3">
                  {[
                    ['Pârtii', km1(resort.km), 'km'],
                    ['Lifturi', formatInt(resort.lifts), 'instalații'],
                    ['Altitudine', formatInt(resort.elevMax), 'm'],
                    ['Diferență', formatInt(resort.elevMax - resort.elevMin), 'm'],
                  ].map(([k, v, u]) => (
                    <div key={k} class="rounded-lg bg-midnight p-4">
                      <dt class="label text-mist">{k}</dt>
                      <dd class="tabular mt-2 flex items-baseline gap-1.5">
                        <span class="font-display text-[2rem] leading-none text-gold">{v}</span>
                        <span class="text-xs text-mist">{u}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
                <div class="mt-6 flex h-1.5 overflow-hidden rounded-full bg-midnight">
                  {DIFFICULTIES.filter((d) => (resort.kmByDifficulty[d.key] ?? 0) > 0).map((d) => (
                    <span key={d.key} style={{ width: `${((resort.kmByDifficulty[d.key] ?? 0) / total) * 100}%`, background: d.key === 'advanced' || d.key === 'expert' ? '#e8e3d8' : d.color }} />
                  ))}
                </div>
                <ul class="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  {DIFFICULTIES.filter((d) => (resort.kmByDifficulty[d.key] ?? 0) > 0).map((d) => (
                    <li key={d.key} class="flex items-center justify-between gap-2">
                      <span class="flex items-center gap-2 text-mist">
                        <span class="inline-block h-2 w-2 rounded-full ring-1 ring-ivory/60" style={{ background: d.color }} />
                        {d.label}
                      </span>
                      <span class="tabular">{km1(resort.kmByDifficulty[d.key] ?? 0)} km</span>
                    </li>
                  ))}
                </ul>
                <a href={resort.url} class="link-quiet mt-8 text-ivory">
                  Pagina stațiunii <span aria-hidden="true">→</span>
                </a>
              </>
            )}

            {tab === 'partii' && (
              <>
                <p class="text-sm text-mist">Cele mai abrupte pârtii. Alege una ca s-o vezi pe hartă.</p>
                <ul class="mt-4 divide-y divide-gold/15 border-y border-gold/15">
                  {resort.steepest.map((run) => (
                    <li key={run.id}>
                      <button type="button" onClick={() => focusRun(run)} class="flex w-full items-center justify-between gap-4 py-3.5 text-left hover:bg-midnight/60">
                        <span class="flex items-center gap-3">
                          <span class="inline-block h-2 w-2 shrink-0 rounded-full ring-1 ring-ivory/60" style={{ background: color(run.difficulty) }} />
                          <span>
                            <span class="block">{run.name ?? 'Pârtie fără nume'}</span>
                            <span class="tabular block text-xs text-mist">
                              {formatMeters(run.length_m)} · {formatMeters(run.drop_m)} diferență
                            </span>
                          </span>
                        </span>
                        <span class="tabular font-display text-xl text-gold">{formatPct(run.max_gradient_100m_pct)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p class="mt-3 text-xs text-mist">Panta maximă: cea mai abruptă porțiune de ~100 m, calculată din Copernicus DEM.</p>
              </>
            )}

            {tab === 'straturi' && (
              <>
                <fieldset>
                  <legend class="label text-mist">Dificultate</legend>
                  <div class="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                    {DIFFICULTIES.map((d) => (
                      <label key={d.key} class="inline-flex cursor-pointer items-center gap-2 select-none">
                        <input type="checkbox" checked={shown.includes(d.key)} onChange={() => toggle(d.key)} class="accent-alpine-red" />
                        <span class="inline-block h-1 w-4 rounded ring-1 ring-ivory/20" style={{ background: d.color }} />
                        {d.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset class="mt-6">
                  <legend class="label text-mist">Straturi</legend>
                  <div class="mt-3 space-y-2.5 text-sm">
                    <label class="flex cursor-pointer items-center gap-2 select-none">
                      <input type="checkbox" checked={lifts} onChange={() => setLifts((v) => !v)} class="accent-alpine-red" />
                      Lifturi și stații
                    </label>
                    <label class="flex cursor-pointer items-center gap-2 select-none">
                      <input type="checkbox" checked={terrain3d} onChange={() => setTerrain((v) => !v)} class="accent-alpine-red" />
                      Teren 3D
                    </label>
                  </div>
                </fieldset>
              </>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
