/** @jsxImportSource preact */
// Resort-page map: a static preview until the user opens it (or a shared #harta= link),
// so a resort page loads no map code by default. Shared setup lives in ./setup.ts.
import type { Map as MlMap, MapMouseEvent } from 'maplibre-gl';
import { useEffect, useRef, useState } from 'preact/hooks';
import { DIFFICULTIES, type Difficulty } from '../../data/pistes';
import {
  ALL_DIFFICULTIES,
  BASE_STYLE,
  MAP_LOCALE,
  addResortLayers,
  applyDifficultyFilter,
  isLift,
  liftPopupHtml,
  loadMapLibs,
  pickFeature,
  runPopupHtml,
  setTerrain3d,
} from './setup';

interface Props {
  name: string;
  slug: string;
  bbox: [number, number, number, number];
  preview: string;
  pmtilesUrl: string;
}

const HASH_KEY = 'harta';

export default function ResortMap({ name, slug, bbox, preview, pmtilesUrl }: Props) {
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [shown, setShown] = useState<Difficulty[]>(ALL_DIFFICULTIES);
  const [terrain3d, setTerrain] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);

  useEffect(() => {
    if (window.location.hash.startsWith(`#${HASH_KEY}=`)) setActive(true);
  }, []);

  useEffect(() => {
    if (!active || !container.current) return;
    let cancelled = false;
    setStatus('loading');

    (async () => {
      try {
        const maplibregl = await loadMapLibs();
        if (cancelled || !container.current) return;
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
          locale: MAP_LOCALE,
        });
        mapRef.current = map;
        map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
        if (!isSmall) map.addControl(new maplibregl.FullscreenControl(), 'top-right');
        map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
        map.on('error', (e) => console.warn('[ResortMap]', e.error?.message ?? e));

        map.on('load', () => {
          addResortLayers(map, pmtilesUrl, shown);
          map.on('click', (e: MapMouseEvent) => {
            const f = pickFeature(map, e.point);
            if (!f) return;
            new maplibregl.Popup({ maxWidth: '260px' })
              .setLngLat(e.lngLat)
              .setHTML(isLift(f) ? liftPopupHtml(f.properties) : runPopupHtml(f.properties))
              .addTo(map);
          });
          // Compact attribution starts expanded; on phones collapse it to the (i) button.
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

  useEffect(() => {
    if (mapRef.current && status === 'ready') applyDifficultyFilter(mapRef.current, shown);
  }, [shown, status]);

  useEffect(() => {
    if (mapRef.current && status === 'ready') setTerrain3d(mapRef.current, terrain3d);
  }, [terrain3d, status]);

  function close() {
    setActive(false);
    setTerrain(false);
    if (window.location.hash.startsWith(`#${HASH_KEY}=`)) history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  const toggle = (key: Difficulty) => setShown((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));

  if (!active) {
    return (
      <div class="relative overflow-hidden rounded-lg border border-stone bg-stone/50">
        <img src={preview} alt={`Harta pârtiilor din ${name}`} width={800} height={500} loading="lazy" decoding="async" class="aspect-[8/5] w-full object-cover" />
        <div class="absolute inset-0 flex flex-col items-center justify-center gap-3">
          {/* A real link until the island hydrates (client:visible): an early click opens the
              full-screen map instead of doing nothing; once hydrated it opens the map inline. */}
          <a
            href={`/harta/?statiune=${slug}`}
            onClick={(e) => {
              e.preventDefault();
              setActive(true);
            }}
            class="btn btn-primary"
            role="button"
          >
            Deschide harta interactivă
          </a>
          <a href={`/harta/?statiune=${slug}`} class="glass rounded-sm px-3 py-1.5 text-sm text-ivory no-underline">
            sau pe tot ecranul <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      class="fixed inset-0 z-50 flex flex-col bg-ivory sm:static sm:z-auto sm:rounded-lg sm:border sm:border-stone"
      role="region"
      aria-label={`Harta interactivă a pârtiilor din ${name}`}
      data-resort={slug}
    >
      <div class="flex items-center justify-between gap-2 border-b border-stone px-3 py-2 sm:hidden">
        <p class="font-display text-xl">{name}</p>
        <button type="button" onClick={close} class="rounded-sm px-3 py-1.5 text-sm font-medium text-gold-deep">
          Închide
        </button>
      </div>
      <div class="relative min-h-0 flex-1 sm:aspect-[8/5] sm:flex-none">
        {/* MapLibre sets position:relative on its container, so it gets an inner full-size div. */}
        <div class="absolute inset-0 overflow-hidden sm:rounded-t-lg">
          <div ref={container} class="h-full w-full" />
        </div>
        {status === 'loading' && <p class="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate">Se încarcă harta…</p>}
        {status === 'error' && (
          <p class="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-slate">Harta nu s-a putut încărca. Reîncarcă pagina sau încearcă mai târziu.</p>
        )}
      </div>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-stone px-3 py-2.5 text-sm">
        <span class="sr-only">Filtrează pârtiile după dificultate</span>
        {DIFFICULTIES.map((d) => (
          <label key={d.key} class="inline-flex cursor-pointer items-center gap-1.5 select-none">
            <input type="checkbox" checked={shown.includes(d.key)} onChange={() => toggle(d.key)} class="accent-alpine-red" />
            <span
              class="inline-block w-4 rounded"
              style={{
                background: d.key === 'freeride' ? `repeating-linear-gradient(90deg, ${d.color} 0 4px, transparent 4px 7px)` : d.color,
                height: d.key === 'expert' ? '6px' : '4px',
              }}
            />
            {d.label}
          </label>
        ))}
        <label class="ml-auto inline-flex cursor-pointer items-center gap-1.5 select-none">
          <input type="checkbox" checked={terrain3d} onChange={() => setTerrain((v) => !v)} class="accent-alpine-red" />
          Teren 3D
        </label>
      </div>
    </div>
  );
}
