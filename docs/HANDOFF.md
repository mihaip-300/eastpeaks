# Handoff: site de schi pentru români — faza 1 (MVP)

Versiune: 20 noiembrie 2026. Sursa deciziilor: documentul „Stack tehnic — site de schi pentru români (Balcani + Alpi)”.

Acest fișier e brief-ul de lucru pentru Claude Code. `CLAUDE.md` din rădăcină conține regulile permanente; aici sunt contextul, specificațiile și milestone-urile.

Domeniu: `eastpeaks.eu`.

---

## 1. Obiectiv

Un site static, în română, cu 30–40 de stațiuni la lansare. Fiecare stațiune are:

- o hartă interactivă a pârtiilor și lifturilor, cu culorile europene, filtre de dificultate și statistici pe pârtie (lungime, diferență de nivel, pantă medie și maximă);
- date comparabile: skipass, km de pârtie, altitudini, timp cu mașina din București, Cluj și Brașov, aeroportul cel mai apropiat;
- un calculator de cost pentru o vacanță;
- blocuri de afiliere (cazare, închiriere echipament, transfer), toate prin redirectul `/go/`.

**Termen țintă:** primele pagini publice înainte de vacanța de schi din februarie 2027.

### În scope (faza 1)

Milestone-urile M1–M6 din secțiunea 11: schelet, pipeline de date, hartă, pagini de stațiune cu calculator, afiliere, lansare.

### În afara scope-ului (nu le implementa acum)

- Magazinul online (Shopify, faza 2, octombrie 2027).
- Starea live a pârtiilor și prognoza meteo (Open-Meteo cere abonament pentru uz comercial).
- Conturi de utilizator, comentarii, recenzii.
- Versiunea în engleză (`hreflang` vine abia atunci).
- Newsletter (în faza 1 doar un formular simplu, dacă rămâne timp).

---

## 2. Decizii tehnice fixe

| Decizie | Motiv |
| --- | --- |
| Astro 7 static + o singură rută dinamică (`/go/`) | Site de conținut: HTML generat la build, rapid, fără server |
| Cloudflare Workers cu static assets, R2, D1 | Gratuit la volumul MVP; R2 nu taxează traficul de ieșire |
| MapLibre + PMTiles pe R2 | Fără server de tile-uri; browserul citește doar bucățile de care are nevoie |
| OpenFreeMap ca hartă de bază | Fără cheie API și fără limită de afișări; uz comercial permis, cu atribuire |
| Preact pentru insule | Mai mic decât React; JavaScript doar pentru hartă, filtre, calculator |
| Python pentru pipeline | GeoPandas și Rasterio sunt standardul pentru date geo |
| Datele în fișiere, nu în bază de date | Conținutul se schimbă o dată pe sezon |
| Fără WordPress, Next.js, Mapbox, Google Maps, GA4 | Vezi documentul de stack, secțiunea „Ce am exclus” |

**Cerințe locale (Windows):** Node.js 22.23+ (Astro 7) și Wrangler în Windows; Python 3.12, tippecanoe, `make` și GDAL în imaginea Docker din `pipeline/Dockerfile` (Docker Desktop). tippecanoe nu rulează nativ pe Windows.

---

## 3. Structura repository-ului

```
.
├── CLAUDE.md
├── docs/HANDOFF.md
├── astro.config.mjs
├── wrangler.jsonc
├── package.json
├── migrations/
│   └── 0001_clicks.sql
├── data/
│   ├── generated/            # scris de pipeline: {slug}.json + index.json (în Git)
│   └── prices.json           # generat din Google Sheet (npm run prices) (în Git)
├── public/
│   └── maps/                 # {slug}.webp, previzualizări statice (pipeline) (în Git)
├── scripts/
│   └── fetch-prices.ts       # CSV din Google Sheet → data/prices.json
├── src/
│   ├── content.config.ts     # scheme Zod
│   ├── content/
│   │   ├── statiuni/{slug}.json   # date editoriale
│   │   ├── ghiduri/*.mdx
│   │   └── comparatii.json        # perechi curate pentru /compara/
│   ├── data/
│   │   ├── partners.ts       # parteneri de afiliere + ținte permise
│   │   ├── countries.ts      # țări: slug, nume RO, ISO2
│   │   └── constants.ts      # preț carburant implicit, consum etc.
│   ├── lib/
│   │   ├── resorts.ts        # unește generated + editorial + prices
│   │   ├── format.ts         # numere, km, %, lei/euro în format RO
│   │   └── seo.ts            # titluri, descrieri, JSON-LD
│   ├── components/
│   │   ├── map/ResortMap.tsx
│   │   ├── map/OverviewMap.tsx         # harta tuturor stațiunilor (homepage)
│   │   ├── calculator/CostCalculator.tsx
│   │   ├── resort/ (StatsTable, SteepestRuns, PriceBox, GettingThere)
│   │   └── affiliate/ (AffiliateLink.astro, StayBlock, RentBlock, TransferBlock)
│   ├── layouts/Base.astro
│   └── pages/
│       ├── index.astro
│       ├── statiuni/index.astro
│       ├── statiuni/[tara]/index.astro
│       ├── statiuni/[tara]/[statiune].astro
│       ├── compara/[pereche].astro
│       ├── ghid/[...slug].astro
│       ├── calculator-cost-schi.astro
│       ├── despre/date.astro  (+ despre, contact, confidentialitate, termeni, afiliere)
│       ├── go/[partner]/[target].ts   # prerender = false
│       └── 404.astro
└── pipeline/
    ├── Makefile
    ├── pyproject.toml
    ├── resorts.yaml          # lista de stațiuni, slug, țară, ID OpenSkiMap
    ├── src/ (download.py, clean.py, slope.py, export.py, previews.py, qa.py)
    ├── tests/
    ├── cache/                # date brute + tile-uri DEM (în .gitignore)
    └── out/                  # pistes-*.pmtiles, qa_report.md (în .gitignore)
```

---

## 4. Modelul de date

O stațiune are trei surse, unite în `src/lib/resorts.ts`. Câmpurile lipsă nu opresc build-ul. Cheia de unire e `slug`. La câmpurile prezente în ambele surse (`name`), editorialul are prioritate; un slug care apare doar într-o sursă dă un avertisment în log.

### 4.1 Generat de pipeline: `data/generated/{slug}.json`

```json
{
  "slug": "poiana-brasov",
  "skiarea_sources": ["openstreetmap:way/884881279"],
  "openskimap_ids": ["<id din build-ul curent, informativ>"],
  "name": "Poiana Brașov",
  "country": "RO",
  "center": [25.55, 45.59],
  "bbox": [25.50, 45.56, 25.60, 45.62],
  "elevation_m": { "min": 0, "max": 0 },
  "runs": {
    "count": 0,
    "km_total": 0,
    "km_by_difficulty": { "novice": 0, "easy": 0, "intermediate": 0, "advanced": 0, "expert": 0, "freeride": 0, "unknown": 0 }
  },
  "lifts": { "count": 0, "by_type": { "gondola": 0, "chair_lift": 0, "drag_lift": 0 } },
  "steepest_runs": [
    { "id": "<osm id>", "name": "Lupului", "difficulty": "advanced", "length_m": 0, "drop_m": 0, "avg_gradient_pct": 0, "max_gradient_100m_pct": 0 }
  ],
  "forest_share": null,
  "generated_at": "2026-12-01T00:00:00Z",
  "sources": { "openskimap_date": "…", "dem": "Copernicus GLO-30" }
}
```

Valorile de mai sus sunt doar exemple de format; pipeline-ul le calculează.

### 4.2 Editorial: `src/content/statiuni/{slug}.json`

```json
{
  "slug": "poiana-brasov",
  "name": "Poiana Brașov",
  "region": "Brașov",
  "summary": "2–3 propoziții: pentru cine e stațiunea.",
  "season": { "start": "12-01", "end": "03-31" },
  "drive": {
    "bucuresti": { "km": 0, "hours": 0, "road_costs_eur": 0 },
    "cluj": { "km": 0, "hours": 0, "road_costs_eur": 0 },
    "brasov": { "km": 0, "hours": 0, "road_costs_eur": 0 }
  },
  "airports": [{ "iata": "OTP", "name": "București Otopeni", "km": 0 }],
  "accommodation_per_night_eur": { "budget": 0, "mid": 0, "premium": 0 },
  "room_capacity": 2,
  "rental_per_day_eur": { "adult": 0, "child": 0 },
  "partners": { "booking": "poiana-brasov", "skiset": null, "transfer": null },
  "photos": [{ "src": "/img/poiana-1.webp", "alt": "…", "credit": "Mike", "license": "proprie" }],
  "official_km": null,
  "updated": "2026-11-20"
}
```

- `drive.*.km` și `hours` sunt pe un sens; `road_costs_eur` e costul de drum dus-întors pentru o mașină, de la acel oraș (viniete, taxe de autostradă, poduri, tuneluri), pentru că diferă după rută.
- `accommodation_per_night_eur` e pe cameră; `room_capacity` e numărul de persoane pe cameră folosit în calculator.

### 4.3 Prețuri: Google Sheet → `data/prices.json`

Un rând pe stațiune, coloane: `slug, currency, adult_1d, adult_6d, child_1d, child_6d, season, source_url, checked_at, note` (`season` și `note` sunt opționale; un preț lipsă rămâne gol și apare „nedisponibil”). `npm run prices` citește CSV-ul publicat (`PRICES_SHEET_CSV_URL`), îl validează cu Zod și scrie JSON-ul. Rulează automat înainte de build; dacă Sheet-ul nu se poate citi, rămâne `data/prices.json` din Git și apare un avertisment.

Prețurile sunt în moneda locală: `currency` e unul dintre `EUR`, `RON`, `RSD`, `BAM`, `MKD` (Bulgaria și Muntenegru folosesc EUR; Bulgaria din 1 ianuarie 2026). `constants.ts` conține cursurile spre EUR, cursul EUR→RON și data la care au fost actualizate.

---

## 5. Pipeline-ul de date (`pipeline/`)

**Rulare:** local, înainte de sezon și la nevoie. Totul e idempotent și cache-uit în `pipeline/cache/`.

### 5.1 Lista de stațiuni: `resorts.yaml`

Propunere inițială (35), editabilă:

- **România (12):** Poiana Brașov, Sinaia, Predeal, Azuga, Straja, Ranca, Transalpina Ski Resort, Arena Platoș (Păltiniș), Vatra Dornei, Cavnic, Șuior, Borșa
- **Bulgaria (5):** Bansko, Borovets, Pamporovo, Vitosha, Dobrinishte
- **Serbia (3):** Kopaonik, Stara Planina, Zlatibor (Tornik)
- **Bosnia și Herțegovina (3):** Jahorina, Bjelašnica, Vlašić
- **Macedonia de Nord (2):** Popova Shapka, Mavrovo
- **Muntenegru (2):** Kolašin, Žabljak (Savin Kuk)
- **Austria (8):** Schladming (Planai), Zell am See–Kaprun, Saalbach Hinterglemm, Bad Gastein, Sölden, Ischgl, Obertauern, Mayrhofen

Fiecare intrare: `slug`, `name`, `country`, `skiarea_sources` (listă de ID-uri sursă ale ski area-ului, de forma `openstreetmap:way/884881279` sau `openstreetmap:relation/6938879`, găsite în `sources` din `ski_areas.geojson` și verificate manual). ID-urile proprii OpenSkiMap sunt hash-uri de conținut și se schimbă la fiecare modificare, deci nu se folosesc drept cheie. E listă pentru că unele stațiuni sunt mai multe ski areas în OSM: Zell am See–Kaprun (Schmittenhöhe + Kitzsteinhorn), Saalbach Hinterglemm (Skicircus), Schladming (4-Berge).

Înainte de M2, confirmă că fiecare stațiune funcționează în sezonul 2026/27 (de exemplu, Vitosha a avut sezoane cu lifturile majoritar închise).

### 5.2 Pași

1. **`download`**: date OpenSkiMap (ski areas, runs, lifts) ca GeoJSON. OpenSkiMap publică date GeoJSON brute pentru descărcare; găsește URL-urile curente pe openskimap.org și nu le ghici. Rezervă: rulezi `openskidata-processor` (Docker) cu `BBOX="[9.5, 40.5, 29.8, 49.1]"` (Austria + Balcani + România).
2. **`clean`**: păstrezi `piste:type=downhill` și lifturile (`aerialway`) din stațiunile listate. Normalizezi dificultatea la cele 7 valori din `CLAUDE.md`. Unești segmentele cu același nume, aceeași dificultate și aceeași stațiune, dar doar dacă sunt conectate (capete la cel mult ~15 m); altfel rămân pârtii separate. Segmentele fără nume nu se unesc.
3. **`slope`**:
   - DEM: Copernicus GLO-30 din bucketul public AWS `copernicus-dem-30m` (regiunea `eu-central-1`, acces fără cont), fișiere COG pe tile-uri de 1°×1°, de forma `Copernicus_DSM_COG_10_N45_00_E025_00_DEM/Copernicus_DSM_COG_10_N45_00_E025_00_DEM.tif`. Descarci doar tile-urile care intersectează bbox-urile stațiunilor.
   - **Limită:** GLO-30 e model de suprafață (DSM), deci include coronamentul pădurii. Pe pârtiile înguste tăiate prin pădure (majoritatea în România și Balcani) panta poate ieși greșită. Pentru Austria folosește modelul național de teren (DGM Österreich 10 m, CC BY 4.0, prin data.gv.at; verifică URL-ul și licența). FABDEM nu se poate folosi (licență necomercială). Pârtiile cu diferențe mari față de datele oficiale intră în raportul QA.
   - Reproiectezi fiecare pârtie în UTM-ul local (`estimate_utm_crs`) și o eșantionezi la fiecare 10 m.
   - Citești altitudinea biliniar și netezești cu o medie mobilă de 3 puncte.
   - Orientezi pârtia de sus în jos (în OSM pot fi desenate invers).
   - Calculezi: `length_m`, `drop_m`, `avg_gradient_pct = drop / lungime orizontală`, `max_gradient_100m_pct` = cea mai abruptă fereastră de ~100 m.
   - Marchezi ca suspecte pantele peste 100% sau sub 2% și pârtiile cu `drop_m < 5`.
4. **`export`**:
   - `data/generated/{slug}.json` + `data/generated/index.json` (listă scurtă pentru homepage și filtre).
   - GeoJSON-uri pentru tile-uri: `runs`, `lifts`, `lift_stations` (capetele lifturilor ca puncte), `areas`.
   - Proprietăți pe pârtie, păstrate mici: `id, name, difficulty, length_m, drop_m, avg_pct, max_pct, resort`.
   - `forest_share`: fracțiunea din lungimea pârtiilor stațiunii care trece prin clasa 10 (Tree cover) din ESA WorldCover 10 m. Opțional în M2; rămâne `null` dacă nu se calculează.
   - GeoJSON-ul curățat al pârtiilor și lifturilor, pentru descărcare sub ODbL (vezi 5.4).
5. **`tiles`**: tippecanoe → `out/pistes-YYYYMMDD.pmtiles`, straturi `runs`, `lifts`, `lift_stations`, `areas`. Pornește de la `-Z9 -z15` și ajustează după aspect.
6. **`previews`**: o imagine statică pe stațiune (`public/maps/{slug}.webp`, ~800×500) cu matplotlib: umbrire de relief din DEM, pârtiile colorate, lifturile negre. Se afișează pe pagină până se deschide harta interactivă.
7. **`qa`**: `out/qa_report.md` cu stațiunile fără pârtii, procentul de pârtii fără nume sau fără dificultate, pantele suspecte, și diferențele de peste 30% între km calculați și `official_km` (când există).
8. **`upload`**: urci PMTiles pe R2 cu `wrangler r2 object put --remote` (din Wrangler v4, comenzile `r2 object` lucrează implicit pe stocarea locală). Numele fișierului e versionat, iar URL-ul nou intră în `PUBLIC_PMTILES_URL`.

### 5.3 Teste minime (`pytest`)

- Panta pe o linie sintetică: 1.000 m orizontal, 200 m diferență → 20%.
- Orientarea: aceeași pârtie desenată invers dă aceleași rezultate.
- Normalizarea dificultății: toate valorile OSM cunoscute ajung în cele 7 categorii.
- Unirea segmentelor: două segmente cu același nume, dar neconectate, rămân separate.

### 5.4 Licențe și atribuiri

Verifică formularea curentă în licența fiecărei surse; textele de mai jos sunt punctul de pornire pentru `/despre/date`.

- **Copernicus DEM GLO-30:** „produced using Copernicus WorldDEM-30 © DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH 2014–2018 provided under COPERNICUS by the European Union and ESA; all rights reserved”.
- **OSM / OpenSkiMap (ODbL):** hărțile și paginile sunt „Produced Work”, deci ajunge atribuirea „© OpenStreetMap contributors”. Baza curățată (pârtii unite, statistici) e o bază de date derivată: se publică sub ODbL, ca GeoJSON descărcabil de pe `/despre/date`, cu nota de licență.
- **ESA WorldCover (CC BY 4.0):** „© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium”.
- **DGM Österreich (CC BY 4.0):** atribuirea cerută de furnizor.
- **OpenFreeMap, Mapterhorn:** după cerințele din documentația lor.

---

## 6. Harta

### 6.1 Surse

| Sursă | Tip | Detalii |
| --- | --- | --- |
| OpenFreeMap `positron` | Stil vectorial | Atribuirea apare automat în MapLibre |
| Relief: Mapterhorn | `raster-dem`, terrarium, PMTiles | Construit din Copernicus DEM și swissALTI3D; tile-uri de 512 px până la z12. Verifică documentația pentru protocolul lor și politica de utilizare; dacă nu permite hotlinking la volum, extrage regiunea cu `pmtiles extract` și pune-o pe R2 |
| Relief, rezervă: AWS Terrain Tiles | `raster-dem`, `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png` | Tile-uri de 256 px; pot fi lente din browser |
| Pârtii | `vector`, `pmtiles://${PUBLIC_PMTILES_URL}` | `npm i pmtiles`; `maplibregl.addProtocol("pmtiles", new Protocol().tile)`, o singură dată |

### 6.2 Straturi (de jos în sus)

1. Harta de bază (positron).
2. `hillshade` din sursa de relief, cu opacitate redusă.
3. `areas`: contur subțire și umplere foarte deschisă.
4. `runs`: linie colorată cu `match` pe `difficulty` (culorile din `CLAUDE.md`), lățime 2–4 px în funcție de zoom, `freeride` punctat.
5. `lifts`: linie neagră de 1,5 px; `lift_stations`: cercuri mici.
6. Etichete: numele pârtiilor (`symbol-placement: line`) de la z14; numele lifturilor de la z15.

### 6.3 Interacțiuni

- Click pe pârtie → popup cu nume, eticheta de dificultate în română, lungime, diferență de nivel, pantă medie și maximă, plus link spre pagina pârtiei (dacă există).
- Filtre de dificultate (checkbox-uri) aplicate cu `map.setFilter`.
- `hash: true` pentru poziția hărții în URL.
- Buton de teren 3D (`map.setTerrain`), oprit implicit.
- Pe mobil, harta se deschide pe tot ecranul (modal sau `FullscreenControl`).
- Controlul de atribuire în varianta compactă, dar vizibil.

### 6.4 Performanță

- Pagina afișează întâi `public/maps/{slug}.webp` și un buton „Deschide harta interactivă”.
- MapLibre și `pmtiles` se încarcă prin `import()` dinamic, abia la click sau când harta ajunge pe ecran.
- Ținta: pagina de stațiune ≥ 90 la Lighthouse Performance pe mobil, fără interacțiune.

---

## 7. Pagini, URL-uri și SEO

| Pagină | URL | Conținut |
| --- | --- | --- |
| Acasă | `/` | Harta tuturor stațiunilor (puncte), căutare, comparații populare |
| Toate stațiunile | `/statiuni/` | Tabel sortabil și filtrabil: țară, km, altitudine, skipass |
| Țară | `/statiuni/{tara}/` | Stațiunile țării, cu harta lor |
| Stațiune | `/statiuni/{tara}/{statiune}/` | Rezumat, hartă, statistici, cele mai abrupte pârtii, prețuri, cum ajungi, blocuri de afiliere, calculator |
| Comparație | `/compara/{a}-vs-{b}/` | Doar perechile din `comparatii.json`, nu toate combinațiile |
| Ghid | `/ghid/{subiect}/` | MDX |
| Calculator | `/calculator-cost-schi/` | Calculatorul, cu alegerea stațiunii |
| Surse și atribuiri | `/despre/date/` | Toate sursele de date și licențele |
| Legale | `/confidentialitate/`, `/termeni/`, `/afiliere/`, `/contact/`, `/despre/` | Text simplu |

**Slug-uri de țară:** `romania`, `bulgaria`, `serbia`, `bosnia-si-hertegovina`, `macedonia-de-nord`, `muntenegru`, `austria`.

**SEO:**

- Titlu și descriere generate din date (`src/lib/seo.ts`), cu șabloane per tip de pagină.
- JSON-LD: `SkiResort` (nume, coordonate, țară, URL, imagine) pe stațiuni, `BreadcrumbList` peste tot, `Article` pe ghiduri.
- `@astrojs/sitemap`; `robots.txt` blochează `/go/`; URL canonical pe fiecare pagină.
- `trailingSlash: 'always'` în Astro, ca URL-urile, canonical-ul și sitemap-ul să coincidă cu tabelul de mai sus.
- Imagini cu `astro:assets` (WebP/AVIF) și `alt` în română.

### 7.1 Calculatorul de cost

**Intrări:** stațiunea, adulți, copii, zile de schi, nopți, nivelul cazării (buget, mediu, premium), transportul (mașină sau manual), închirierea (da/nu), orașul de plecare (București, Cluj, Brașov).

**Formula:**

- skipass, pe persoană (adult sau copil), din `prices.json`, convertit în EUR. Pentru N zile: N = 1 → `1d`; 2–5 → `min(N × 1d, 6d)`; N = 6 → `6d`; N > 6 → `6d + (N − 6) × 1d`. E regula implicită; dacă Sheet-ul primește coloane pentru alte pachete (de exemplu `adult_3d`), se folosesc acelea;
- cazare: camere = `⌈(adulți + copii) / room_capacity⌉` (editabil în calculator); cost = `accommodation_per_night_eur[nivel] × nopți × camere`;
- închiriere: `(rental_per_day_eur.adult × adulți + rental_per_day_eur.child × copii) × zile`;
- mașină: `drive[oraș].km × 2 × consum / 100 × preț carburant + drive[oraș].road_costs_eur`, pentru o mașină, cu valori implicite editabile din `constants.ts`.

**Ieșire:** total și defalcare, în euro și lei, cu cursul în `constants.ts`. Sub rezultat: buton spre cazare prin `/go/`. Dacă lipsesc date, câmpul respectiv apare „nedisponibil”, nu zero.

---

## 8. Afilierea: ruta `/go/` și D1

### 8.1 Ruta

`src/pages/go/[partner]/[target].ts`, cu `export const prerender = false`.

1. Caută `partner` și `target` în `src/data/partners.ts`. Dacă nu există combinația → 404, deci fără open redirect. Parametrul `from` se acceptă doar dacă e un slug cunoscut (din `data/generated/index.json` sau o pagină din listă); altfel se tratează ca lipsă și nu ajunge nici în D1, nici la rețea.
2. Construiește URL-ul final și adaugă identificatorul paginii (`?from=`) în parametrul de tracking al rețelei: `sid` la CJ, `clickref` la Awin, label sau `campaign` acolo unde se aplică. Verifică parametrul exact în documentația fiecărei rețele.
3. Răspunde cu 302, `Cache-Control: no-store`, `X-Robots-Tag: noindex`.
4. Scrie click-ul în D1 prin `ctx.waitUntil` (nu întârzie redirectul). Sari peste boți (user-agent).
5. Cu adapterul v14: binding-ul D1 vine din `import { env } from 'cloudflare:workers'`, `waitUntil` din `locals.cfContext`, țara din `request.cf`. `Astro.locals.runtime` nu mai există.

### 8.2 Tabela D1 (`migrations/0001_clicks.sql`)

```sql
CREATE TABLE clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  partner TEXT NOT NULL,
  target TEXT NOT NULL,
  page TEXT,
  country TEXT,
  device TEXT
);
CREATE INDEX idx_clicks_ts ON clicks (ts);
CREATE INDEX idx_clicks_page ON clicks (page);
```

Fără IP și fără user-agent complet: `country` vine din `request.cf.country`, iar `device` e doar `mobile` sau `desktop`.

### 8.3 Parteneri (`src/data/partners.ts`)

| Cheie | Partener | Rețea | Ținte |
| --- | --- | --- | --- |
| `booking` | Booking.com | CJ | Căutare pe localitatea stațiunii |
| `stay22` | Stay22 | Direct | Hartă de cazări (alternativă la Booking, de testat) |
| `skiset` | Skiset | Awin | Pagina magazinului din stațiune |
| `snowrental` | Snowrental | Awin | Pagina stațiunii |
| `transfer` | Viator / GetYourGuide | Direct sau Travelpayouts | Transfer de la aeroport |
| `car` | DiscoverCars | Travelpayouts sau direct | Închiriere de mașină la aeroport |
| `decathlon` | Decathlon RO | Program propriu | Categorii de echipament (ghiduri) |

ID-urile de afiliat vin din variabile de mediu. Până la aprobarea în rețele, `/go/` trimite spre URL-ul simplu al partenerului.

### 8.4 Componenta

`<AffiliateLink partner="booking" target="bansko" from={slug}>Vezi cazări în Bansko</AffiliateLink>` generează `<a href="/go/booking/bansko/?from=…" rel="sponsored nofollow noopener" target="_blank">`. Fiecare pagină cu afiliere afișează o notă scurtă cu link spre `/afiliere/`.

---

## 9. Deploy și configurare Cloudflare

- **`wrangler.jsonc`**: nume, `compatibility_date`, `assets.directory: "./dist/client"`, binding D1 `DB`, variabilele publice. Adapterul v14 scrie HTML-ul static în `dist/client/` și generează configul final în `dist/server/wrangler.json`, pe care `wrangler deploy` îl folosește automat (prin `.wrangler/deploy/config.json`). Pagefind indexează `dist/client/`.
- **R2:** bucketul `pistes`, legat de subdomeniul `tiles.eastpeaks.eu`.
  - CORS: `GET`, `HEAD`, headerul `Range`, originile site-ului.
  - Regulă de cache „Cache Everything”, cu TTL lung pe edge (fișierele sunt versionate prin nume).
- **D1:** `wrangler d1 create`, apoi migrațiile pe local și pe remote.
- **Variabile de mediu:** `PUBLIC_PMTILES_URL`, `PUBLIC_SITE_URL`, `PRICES_SHEET_CSV_URL`, ID-urile de afiliere (`CJ_PID`, `AWIN_AFFID`, `STAY22_AID` etc.).
- **CI:** deploy din Git (Workers Builds) la push pe `main`; branch-urile primesc previzualizare.

---

## 10. Ce trebuie să furnizeze Mike

- [x] Domeniul: `eastpeaks.eu`
- [ ] Numele afișat al site-ului
- [ ] Contul Cloudflare cu domeniul adăugat; `wrangler login` făcut local
- [x] Repository-ul GitHub: `github.com/mihaip-300/eastpeaks` (branch `main`)
- [ ] Docker Desktop pornit, pentru pipeline
- [ ] API token Cloudflare pentru proiect, în `.env` (vezi CLAUDE.md, „Contul Cloudflare”)
- [ ] Google Sheet-ul cu prețuri, publicat ca CSV
- [ ] ID-urile de afiliere, pe măsură ce vin aprobările (CJ/Booking, Awin, Stay22)
- [ ] Confirmarea listei de stațiuni din 5.1
- [ ] Preferințe vizuale: culoarea de brand, fontul (altfel: neutru, sistem)

---

## 11. Milestone-uri

O sesiune Claude Code pe milestone. Fiecare se încheie cu `npm run check`, `npm run build` și un commit. Estimările sunt ore de dezvoltare, fără scrierea textelor.

### M0: Prima versiune, cap-coadă, cu Poiana Brașov și Bansko (în lucru)

Înainte de M1–M5 pentru toate stațiunile, construim un drum complet pentru două stațiuni, ca să validăm pipeline-ul, harta și pagina înainte de a scala. Ordinea:

- **A. Schelet:** partea de M1 fără Pagefind; deploy pe `*.workers.dev`, pe contul proiectului.
- **B. Pipeline:** M2 pentru 2 stațiuni, în Docker; PMTiles pe R2.
- **C. Harta:** `ResortMap.tsx` (M3), fără `OverviewMap`.
- **D. Pagina de stațiune și calculatorul:** M4 pentru cele 2 stațiuni. Datele editoriale și `prices.json` se completează de mână, cu sursă și marcate „de verificat”, până există Google Sheet-ul.
- **E. Afilierea:** M5, cu URL-urile simple ale partenerilor (fără ID-uri de afiliat).

Rămân pentru după: paginile de țară, comparațiile, ghidurile, `OverviewMap`, Pagefind, domeniul propriu, Web Analytics.

**Acceptare:** cele două pagini de stațiune sunt live pe `workers.dev`, cu harta, statisticile verificate de Mike față de datele oficiale, calculatorul și `/go/` cu click-uri în D1.

### M1: Schelet (~8 h)

- Astro 7 + Tailwind v4 + Preact + `@astrojs/cloudflare` + `@astrojs/sitemap` + Pagefind.
- `Base.astro` cu header și footer în română; paginile legale goale; pagina 404.
- `wrangler.jsonc`; deploy pe `*.workers.dev`.
- Repo-ul GitHub (`mihaip-300/eastpeaks`), `.gitignore` și primul commit există deja; M1 pornește de pe `main`.
- Scripturile npm din `CLAUDE.md`.

**Acceptare:** site-ul gol e live pe `workers.dev`; `npm run check` și `npm run build` trec; o pagină de test cu `prerender = false` răspunde corect.

### M2: Pipeline pentru 35 de stațiuni (~40 h)

- `resorts.yaml`, `download`, `clean`, `slope`, `export`, `tiles`, `previews`, `qa`, plus testele din 5.3.

**Acceptare:** 35 de fișiere în `data/generated/`; `pistes-*.pmtiles` se deschide corect în viewer-ul de pe pmtiles.io; raportul QA există; valorile pentru Poiana Brașov și Bansko sunt plauzibile față de datele oficiale ale stațiunilor (verificare manuală de Mike).

### M3: Harta (~30 h)

- `ResortMap.tsx` după secțiunea 6, cu încărcare întârziată; `OverviewMap.tsx` pentru homepage (puncte, din `index.json`).

**Acceptare:** merge pe Poiana Brașov și Bansko; filtrele, popup-ul și hash-ul funcționează; pe mobil harta se deschide pe tot ecranul; în tab-ul Network, MapLibre nu se încarcă înainte de interacțiune; atribuirea e vizibilă.

### M4: Paginile de stațiune și calculatorul (~30 h)

- Colecțiile de conținut cu scheme Zod; `resorts.ts`; paginile de stațiune, țară, listă și comparații; calculatorul; JSON-LD; `npm run prices`.

**Acceptare:** 35 de pagini generate; o stațiune fără date editoriale arată „în curând” fără să oprească build-ul; `BreadcrumbList` și `Article` trec de Google Rich Results Test, iar `SkiResort` (pentru care Google nu are rich result) e valid în validator.schema.org; calculatorul dă o defalcare corectă pe un caz verificat de mână.

### M5: Afilierea (~10 h)

- Ruta `/go/`, `partners.ts`, migrația D1, `AffiliateLink` și blocurile Stay/Rent/Transfer, pagina `/afiliere/`.

**Acceptare:** o combinație necunoscută dă 404; un click scrie un rând în D1 (local și remote); `robots.txt` blochează `/go/`; linkurile au `rel="sponsored nofollow noopener"`.

### M6: Lansarea (~5 h)

- Domeniul propriu; R2 pe `tiles.eastpeaks.eu`, cu CORS și cache; Cloudflare Web Analytics; verificarea în Search Console (DNS); sitemap trimis; pagina `/despre/date` completă.

**Acceptare:** lista de mai sus bifată; Lighthouse ≥ 90 pe mobil pentru o pagină de stațiune; nicio eroare în consolă.

---

## 12. Prompt de start pentru Claude Code

Lipește asta în prima sesiune, cu `CLAUDE.md` în rădăcină și acest fișier în `docs/`:

```
Citește CLAUDE.md și docs/HANDOFF.md. Lucrăm la M1.

1. Înainte de cod, verifică în documentația curentă: Astro 7 (instalare, output static
   cu o rută prerender = false), adapterul @astrojs/cloudflare, Tailwind CSS v4 cu Astro,
   integrarea Preact, Pagefind cu Astro și configul wrangler pentru static assets + D1.
2. Fă un plan scurt pentru M1: fișiere, dependențe, comenzi. Așteaptă confirmarea mea.
3. După confirmare, implementează M1, rulează npm run check și npm run build și repară
   erorile.
4. Încheie cu un rezumat: ce ai făcut, ce trebuie să fac eu (wrangler login, domeniu)
   și ce rămâne deschis pentru M2.
```

Pentru milestone-urile următoare, același tipar: „Lucrăm la Mx, după secțiunea y din HANDOFF. Plan întâi, apoi implementare, apoi verificare.”
