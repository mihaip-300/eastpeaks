# CLAUDE.md

Site de conținut în limba română despre stațiunile de schi din România, Balcani și Austria. Fiecare stațiune are o pagină cu hartă interactivă a pârtiilor, date comparabile (skipass, km de pârtie, pantă, distanța cu mașina) și un calculator de cost. Banii vin din afiliere: cazare, închirieri, transferuri.

Domeniu: `eastpeaks.eu` (tile-urile pe `tiles.eastpeaks.eu`).

Planul complet, deciziile și milestone-urile sunt în `docs/HANDOFF.md`. Citește-l înainte de orice task nou și lucrează pe milestone-ul cerut, nu pe mai multe deodată.

## Stack (fix; nu-l schimba fără să întrebi)

| Strat | Alegere |
| --- | --- |
| Framework | Astro 7, `output: 'static'`. Adapterul `@astrojs/cloudflare` există doar pentru ruta `/go/` (`export const prerender = false`) |
| Stil | Tailwind CSS v4 |
| Insule interactive | Preact, încărcate cu `client:visible` sau la click |
| Hartă | MapLibre GL JS + `pmtiles` (protocolul `pmtiles://`) |
| Hartă de bază | OpenFreeMap, stilul `positron` (`https://tiles.openfreemap.org/styles/positron`) |
| Relief | Mapterhorn (PMTiles terrarium); AWS Terrain Tiles ca rezervă |
| Pârtii și lifturi | OpenSkiMap / OSM → `pistes-<YYYYMMDD>.pmtiles` pe Cloudflare R2 |
| Pipeline de date | Python 3.12 în `pipeline/`, rulat în Docker: GeoPandas, Shapely, Rasterio, pyproj, tippecanoe |
| Hosting | Cloudflare Workers (static assets) + R2 + D1 |
| Căutare | Pagefind |
| Analytics | Cloudflare Web Analytics (fără cookie-uri) |

## Comenzi

```bash
npm run dev        # Astro dev
npm run build      # build static + index Pagefind
npm run check      # astro check + tsc --noEmit
npm run preview    # build servit local prin wrangler
npm run deploy     # build + wrangler deploy
npm run prices     # Google Sheet (CSV) → data/prices.json

cd pipeline
make download      # OpenSkiMap pentru BBOX-ul regiunii
make process       # curățare, statistici, JSON pe stațiune
make tiles         # PMTiles cu tippecanoe
make previews      # imagini statice ale hărților (public/maps/)
make qa            # raport de calitate (pipeline/out/qa_report.md)
make upload        # urcă PMTiles pe R2
pytest
```

Scripturile se creează în M1 și M2. Ține lista de mai sus la zi când le schimbi.

**Mediul local e Windows.** Comenzile `npm` merg în PowerShell. Pipeline-ul (Python 3.12, GDAL, tippecanoe, `make`) rulează **în Docker**, din imaginea definită în `pipeline/Dockerfile`, pentru că tippecanoe nu rulează nativ pe Windows. Docker Desktop trebuie să fie pornit. Nu scrie scripturi de pipeline care depind de PowerShell.

## Structura

```
src/content/          date editoriale: statiuni/*.json, ghiduri/*.mdx, comparatii.json
src/content.config.ts scheme Zod pentru colecții
src/components/map/   ResortMap.tsx (insulă Preact)
src/components/calculator/  CostCalculator.tsx
src/components/affiliate/   AffiliateLink.astro + blocuri de afiliere
src/data/             partners.ts, countries.ts, constante
src/lib/              unirea datelor generate cu cele editoriale, formatare RO
src/pages/go/[partner]/[target].ts   singura rută dinamică
data/generated/       scris DOAR de pipeline: {slug}.json, index.json
data/prices.json      generat din Google Sheet
public/maps/          previzualizări statice ale hărților, scrise DOAR de pipeline
migrations/           SQL pentru D1
pipeline/             resorts.yaml, src/, tests/, Makefile
```

## Reguli

- **Limba.** Textul vizibil e în română, cu diacritice corecte: ș și ț cu virgulă dedesubt (U+0219, U+021B), nu ş/ţ cu sedilă. Codul, numele, comentariile și mesajele de commit sunt în engleză.
- **Slug-uri** ASCII, minuscule, cu cratimă: `poiana-brasov`, `bosnia-si-hertegovina`.
- **Fișierele generate nu se editează de mână.** `data/generated/` și `public/maps/` le scrie doar pipeline-ul; schimbi pipeline-ul și îl rulezi din nou.
- **Fișierele generate se commit-uiesc.** `data/generated/`, `public/maps/` și `data/prices.json` stau în Git, pentru că CI-ul (Workers Builds) nu rulează pipeline-ul Python. În `.gitignore` sunt doar `pipeline/cache/` și `pipeline/out/`.
- **Prețurile nu opresc build-ul.** Dacă `npm run prices` nu poate citi Google Sheet-ul (lipsește `PRICES_SHEET_CSV_URL`, rețea, CSV invalid), păstrează `data/prices.json` existent și scrie un avertisment.
- **Datele lipsă nu opresc build-ul.** O pagină fără date editoriale afișează „în curând” și scrie un avertisment în log.
- **Fără bază de date pentru conținut.** D1 se folosește doar pentru click-urile de afiliere.
- **JavaScript doar în insule.** Nu adăuga React, Next.js, Mapbox, Google Maps, GA4 sau jQuery.
- **Afilierea trece doar prin `AffiliateLink`** → `/go/{partner}/{target}/?from={slug}` (cu slash final, altfel `trailingSlash: 'always'` adaugă un 301), cu `rel="sponsored nofollow noopener"`. Niciun URL de afiliere direct în conținut. `/go/` acceptă doar combinații partener/țintă din `src/data/partners.ts`, ca să nu devină open redirect. Parametrul `from` se acceptă doar dacă e un slug cunoscut (altfel se ignoră).
- **Atribuirile rămân vizibile** pe hartă și pe `/despre/date`: OSM/ODbL, OpenFreeMap, Copernicus DEM (cu textul exact din HANDOFF 5.4), ESA WorldCover, sursa de relief. Datele de pârtii derivate din OSM se oferă sub ODbL (HANDOFF 5.4).
- **Fără date personale în D1:** nu salva IP-uri.
- **Secretele** și ID-urile de afiliere stau în `.dev.vars` sau `wrangler secret`, niciodată în Git.
- **Contul Cloudflare.** Proiectul folosește un API token propriu (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) din `.env`, pe care Wrangler îl citește automat; `account_id` e fixat și în `wrangler.jsonc`. Pe mașină poate fi logat alt cont Cloudflare: nu folosi `wrangler login`/`logout` și nu face deploy fără tokenul proiectului.
- **Dependențe noi** doar cu o justificare scurtă în commit; preferă ce oferă platforma.
- **API-uri incerte** (Astro 7, Wrangler, MapLibre, pmtiles): verifică documentația curentă înainte să scrii cod.

## Culorile pârtiilor (standard european)

| `piste:difficulty` (OSM) | Etichetă | Culoare |
| --- | --- | --- |
| `novice` | Foarte ușoară | `#2e9e44` verde |
| `easy` | Ușoară | `#1e6fd9` albastru |
| `intermediate` | Medie | `#d62b2b` roșu |
| `advanced` | Dificilă | `#1a1a1a` negru |
| `expert` | Foarte dificilă | `#1a1a1a` negru, linie mai groasă |
| `freeride` | Freeride | `#f08c00` portocaliu, punctat |
| lipsă | Nemarcată | `#8a8a8a` gri |
| lifturi (`aerialway`) | — | `#1a1a1a`, 1,5 px, puncte la stații |

## „Gata” înseamnă

- `npm run check` și `npm run build` trec fără erori și fără avertismente noi.
- În pipeline, `pytest` trece și raportul QA nu are erori noi.
- Pagina afectată e verificată în `npm run preview`, pe desktop și la 390 px lățime.
- O pagină de stațiune, fără interacțiune, nu încarcă MapLibre.
- Commit mic, cu mesaj clar.
