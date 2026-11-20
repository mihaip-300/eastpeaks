# DESIGN.md: EastPeaks, „Alpine editorial”

Ghidul vizual al site-ului. Pagina vie cu toate tokenurile și componentele e `/design/` (noindex, nu apare în sitemap). Sursa brandului: brand board-ul „Midnight & Champagne Gold + Alpine Red” și `claude-code-design-prompt.md`.

## Principii

- **Reținere.** Mult spațiu alb, tipografie mare, etichete mici. Fără gradiente în interfață, fără emoji, fără iconițe decorative.
- **Aurul înseamnă brand, roșul înseamnă acțiune.** Aur pentru logo, linii fine, cifre și etichete pe fundal închis. Roșu alpin doar pentru CTA-uri, indicatori live, tabul activ: maximum ~5% dintr-un ecran.
- **Orice cifră are etichetă și unitate.** Cifre tabulare.
- **Afilierea arată editorial, nu ca reclamă.** Carduri sobre, fără insigne, cu nota „Link de afiliere”.
- **Fără date inventate pe paginile reale.** Blocurile live apar doar cu date reale; până atunci, varianta „în curând” cu link spre raportul oficial. Datele demonstrative există doar pe `/design/`, marcate vizibil.

## Culori (`src/styles/tokens.css`)

Paleta implicită Tailwind e eliminată: există doar culorile de mai jos.

| Token | Hex | Folosire | Contrast |
| --- | --- | --- | --- |
| `black` | #0A0A0A | footer, secțiuni închise, overlay pe hero | |
| `midnight` | #0B1320 | carduri și panouri pe negru; text pe ivoire | 16,3:1 pe ivoire |
| `midnight-2` | #121C2D | navy ridicat (hover, panouri imbricate) | |
| `gold` | #C6A667 | logo, linii, cifre, etichete **doar pe închis** | 8,5:1 pe negru; 2,0:1 pe ivoire ✗ |
| `gold-soft` | #D9C79E | hover pe închis | |
| `gold-deep` | #7E6230 | etichete și linkuri aurii **pe ivoire** | 5,0:1 |
| `ivory` | #F4EFE6 | fundalul deschis (niciodată alb pur pe suprafețe mari) | |
| `stone` | #E4DDD0 | carduri și separatoare pe ivoire | |
| `slate` | #5B6472 | text secundar pe ivoire | 5,2:1; pe negru doar 3,3:1 ✗ |
| `mist` | #9AA3B0 | text secundar pe închis | 7,8:1 |
| `alpine-red` | #A3262A | CTA, live, activ; text ivoire pe roșu | 6,4:1; roșu pe navy 2,5:1 ✗ |
| `open` / `partial` / `closed` | #3FA06A / #E0A23B / #A3262A | stări | |
| pârtii | verde #2E9E44, albastru #2A6FDB, roșu #D63A3A, negru #111111, freeride #F08C00, nemarcată #8A8A8A | hartă, legende | |

## Tipografie

Două familii, self-hosted prin Fontsource (subseturi latin, latin-ext, chirilic):

- **Playfair Display Variable**: titluri și cifre mari. Didone, potrivit cu logoul; are și chirilice pentru numele bulgărești.
- **Inter Variable**: text și interfață.

| Token | Mărime | Line-height | Tracking |
| --- | --- | --- | --- |
| `text-hero` | clamp(3rem → 7.5rem) | 0,95 | −0,025em |
| `text-h1` | clamp(2.75rem → 5.5rem) | 0,98 | −0,02em |
| `text-h2` | clamp(2.25rem → 4rem) | 1,02 | −0,02em |
| `text-h3` | clamp(1.5rem → 1.875rem) | 1,15 | −0,01em |
| `text-stat` | clamp(2.75rem → 4.5rem) | 1 | −0,02em |
| `text-lead` | clamp(1.125rem → 1.375rem) | 1,55 | |
| `text-body` | 1.0625rem (17px) | 1,6 | |
| `label` | 0.75rem, majuscule | 1,2 | 0,12em |

## Layout

- Container `max-w-site` (1280px), coloană editorială `max-w-text` (~680px), padding lateral 20/32px.
- Ritm vertical: clasa `section` (64 / 96 / 128px).
- Colțuri subtile: 4–8px (`rounded-sm` … `rounded-lg`; `xl`/`2xl` sunt plafonate la 8px). Linii de 1px: `stone` pe ivoire, `gold/30` pe închis. Aproape fără umbre; `glass` (blur) doar peste imagini și hartă.

## Componente

| Componentă | Fișier | JS |
| --- | --- | --- |
| Header + bara utilă | `src/components/Header.astro` | script inline mic (stare la scroll); meniul mobil e `<details>` |
| Footer | `src/components/Footer.astro` | — |
| StatCard | `src/components/ui/StatCard.astro` | — |
| StatusList | `src/components/ui/StatusList.astro` | — |
| LiveConditions | `src/components/ui/LiveConditions.astro` | — |
| TagChips | `src/components/ui/TagChips.astro` | — |
| Faq (acordeon) | `src/components/ui/Faq.astro` | — (`<details>`) |
| AffiliateCard | `src/components/ui/AffiliateCard.astro` | — |
| Tabs | `src/components/ui/Tabs.tsx` | insulă Preact (tastatură, ARIA) |
| Hartă, calculator | `src/components/map/`, `src/components/calculator/` | insule Preact |

Butoane: `btn` + `btn-primary` (roșu), `btn-dark`, `btn-light`, `btn-outline` (linie aurie). Link discret: `link-quiet` (subliniere aurie la hover). Etichete: `label` + `text-gold` (închis) sau `text-gold-deep` (ivoire).

## Imagini

Până există fotografii reale, eroii sunt **randări ale reliefului real** al fiecărei stațiuni (`npm run pipeline -- make heroes`, `pipeline/src/heroes.py`): vedere oblică la ora albastră din Copernicus DEM, umbre navy, zăpadă ivoire, lumină joasă aurie pe creste. Ieșire în `public/heroes/{slug}-{2400,1600,960}.{avif,webp}`, cu placeholder blur în `data/generated/heroes.json`; componenta `HeroImage.astro` face `<picture>` cu `srcset`. Pe pagină apare discret „randat din Copernicus DEM”, ca să nu pară fotografie. Când vin fotografiile, se înlocuiesc fișierele, nu componentele.

## Pagini

- **Acasă:** hero împărțit pe diagonală (Poiana | Bansko), „Doi munți. Un sezon întreg.”, alegerea stațiunii, bandă de comparație (închis), teaser pentru hărți (navy), „De unde vin cifrele”.
- **Stațiune:** hero cu 4 cifre „dintr-o privire” pe sticlă, bară de taburi lipicioasă (secțiuni pe aceeași pagină, active la scroll, cu comutatorul de stațiune), Prezentare · Condiții · Pârtii · Hartă · Cazare · Închirieri · Cum ajungi · Costuri · FAQ (generat din date).
- Taburile cerute în brief sunt secțiuni ancorate, nu panouri ascunse: tot conținutul rămâne vizibil pentru căutare și pentru citit pe sărite. Insula `Tabs` rămâne pentru locurile unde panourile chiar trebuie ascunse.

## Mișcare

Fade/reveal la scroll (atribut `data-reveal`, 700ms ease-out), parallax doar pe hero, count-up pe cifre. Totul se oprește la `prefers-reduced-motion`. Fără JavaScript, conținutul e vizibil.

## Logo

Generat din pipeline (`npm run pipeline -- make brand`, `pipeline/src/brand.py`): Playfair Display convertit în contururi, cu „a” din „Peaks” înlocuit de vârful auriu cu calotă de zăpadă.

- `logo.svg`: auriu (gradient discret, doar în logo), pe fundal închis.
- `logo-reversed.svg`: litere ivoire, peste fotografii.
- `logo-light.svg`: litere midnight, pe ivoire (calota are contur auriu ca să nu dispară).
- `symbol.svg`, `favicon.svg`, `favicon-16/32.png`, `apple-touch-icon.png`, `icon-512.png`, `site.webmanifest`.

## Nu

- Aur ca text pe ivoire (folosește `gold-deep`), `slate` ca text pe negru (folosește `mist`), text roșu mic pe navy.
- Mai mult de două familii de fonturi; alb pur pe suprafețe mari; gradiente în interfață.
- Cifre fără unitate; date live inventate pe paginile reale; insigne sau culori stridente pe blocurile de afiliere.
