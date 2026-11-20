# Prompt for Claude Code — Premium ski site design system (Poiana Brașov + Bansko)

You are a senior product designer + front-end engineer. Build the design system and core page templates for a Romanian-language ski website (phase 1: only **Poiana Brașov** and **Bansko**, skiing only). The site must feel **premium, very modern, high quality and expensive** — closer to a luxury Alpine resort site than to a typical travel blog.

## Stack (do not change)
- Astro + Tailwind CSS, Preact islands only for interactive parts
- MapLibre GL + OpenFreeMap basemap, piste data from OpenSkiMap (PMTiles), Copernicus DEM terrain
- Static hosting on Cloudflare Pages; Pagefind search
- Content language: Romanian (with `lang="ro"`), structure ready for `/en/` later
- Performance budget: Lighthouse ≥ 95 on mobile, LCP < 2.0s, no layout shift, JS only where interactive

## Design references (study, don't copy literally)
1. **Val d'Isère** (valdisere.com/en) — editorial hero: oversized headline, photo/text diagonal split, season dates right under the headline, short nav. Resort page rhythm: full-bleed hero → map CTA → key dates → "ski area at a glance".
2. **Lech Zürs** (lechzuers.com/en) — luxury through restraint: refined serif, warm off-white/sand + muted gold, generous whitespace, calm photography. Ski utilities (Lifts & Slopes, Weather, Webcams, Snow) always one click away in the header.
3. **Zermatt** (zermatt.swiss/en) — atmosphere first: full-bleed imagery with people. Live status widget: cards for lifts open / km open + "updated at" time, list with green/orange status dots; map with toggles and filters.
4. **Ski Solutions** (skisolutions.com resort pages) — guide structure: hero + short summary, tabs (Where to stay / What to expect / Map / Inspiration / FAQ), character tags, stats. Do NOT copy their loud yellow bars, phone numbers or review badges.
5. **SkiGrades** (skigrades.com) — interactive mountain page: 2D/3D map takes ~2/3 of the viewport, right-side panel with photo, stats and tabs (Overview / Conditions / Trails / Media); trail overlays colored by difficulty/steepness; comparison cards.

## Brand identity (FINAL — follow exactly)
Brand name: **EastPeaks**. Reference image: `eastpeaks-brand-board-final.jpg` (attach it to this prompt).

**Logo**
- Wordmark "EastPeaks", mixed case, refined high-contrast Didone serif (closest free fonts: Playfair Display / Bodoni Moda; paid: Canela), champagne gold `#C6A667` (subtle gold gradient allowed only in the logo, never in UI).
- The **A in "Peaks" is replaced by a solid mountain peak** (triangle) in the same gold, with a **white snow cap** (`#F4EFE6`) at the top.
- No underline, no dot, no tagline in the primary logo.
- Reversed version: wordmark in ivory/white over dark alpine photos, peak in gold with white snow cap.
- Symbol / favicon / app icon: the gold peak with white snow cap alone, centered on a **midnight navy `#0B1320`** rounded-square tile.
- Build `/public/logo.svg`, `/public/logo-reversed.svg`, `/public/symbol.svg` and favicons (16, 32, 180, 512) as clean SVG/PNG recreations of this logo.

**Brand surfaces**
- Primary dark surface (hero overlays, footer, header on dark pages, brand presentations): **near-black `#0A0A0A`**.
- Cards, tiles, panels and map side panels on dark backgrounds: **midnight navy `#0B1320`** (navy on black = signature look).
- Hairline dividers and small uppercase labels on dark: gold `#C6A667` (thin 1px lines, labels tracked 0.12em).
- Light pages: ivory `#F4EFE6` background with navy text and gold details.
- Alpine red `#A3262A` used only as a small accent (CTA buttons, live indicators, active states, ribbon/tab details) — never in the logo.

## Visual direction: "Alpine editorial"
Merge Lech's restraint + Val d'Isère's editorial scale + Zermatt's live utility + SkiGrades' map-first interactivity.

**Color tokens** (brand palette "Midnight & Champagne Gold + Alpine Red"; define as CSS variables + Tailwind theme):
- `black` #0A0A0A (primary dark surface: footer, dark sections, hero overlays)
- `midnight` #0B1320 (navy: cards/panels on black, map panels, primary text on light)
- `gold` #C6A667 (champagne gold: logo, hairlines, numbers/stat highlights, icons; never large fills)
- `ivory` #F4EFE6 (main light background; never pure #FFF for large areas)
- `slate` #5B6472 (secondary text, labels, borders)
- `alpine-red` #A3262A (5th accent: primary CTAs, live/"open now" indicators, active tab, small sale/alert tags; use sparingly, max ~5% of any screen)
- Derived: `stone` #E4DDD0 (cards/dividers on ivory), `gold-soft` #D9C79E (hover)
- Status: open #3FA06A, partial #E0A23B, closed = alpine-red #A3262A
- Piste colors (EU standard): blue #2A6FDB, red #D63A3A, black #111111
- Rule: gold = prestige/brand, red = action/live. Never put red text on navy at small sizes (contrast); red buttons use ivory text.

**Typography**
- Display: a refined high-contrast Didone serif matching the logo (e.g. "Playfair Display" or "Bodoni Moda", self-hosted; paid alternative Canela) for H1/H2 — oversized, tight tracking (-0.02em), line-height 0.95–1.05
- UI/body: "Inter" or "Manrope" (variable), 16–18px body, line-height 1.6
- Numbers/stats: tabular figures, large (48–72px) with small uppercase labels (letter-spacing 0.12em)
- Must support Romanian diacritics (ă â î ș ț) and Bulgarian place names
- Fluid type scale with `clamp()`

**Layout & spacing**
- 12-col grid, max content width 1280px, editorial text column ~680px
- Generous vertical rhythm (sections 96–160px desktop, 64–96px mobile)
- Full-bleed imagery alternating with contained text; occasional asymmetric/diagonal splits
- Corners: subtle (4–8px); hairline borders (1px stone/gold at 30%); almost no drop shadows — use layering and blur instead
- Frosted-glass panels (backdrop-blur) only over imagery and the map

**Imagery**
- Cinematic, cool-toned color grade, people skiing (not only lifts), golden-hour and blue-hour shots
- Use `<picture>` with AVIF/WebP, aspect ratios fixed, blur-up placeholders
- Placeholder images clearly marked until real photos exist

**Motion** (subtle, expensive-feeling)
- Slow fades/reveals on scroll (200–400ms, ease-out), gentle parallax on hero only
- Number count-up on stats, smooth map fly-to between resorts
- Respect `prefers-reduced-motion`

## Global components
1. **Header**: transparent over hero → solid `ivory` with hairline on scroll. Logo left, short nav (Stațiuni, Hartă, Condiții, Ghid, Planifică). Persistent **live utility bar** (Zăpadă · Webcam · Instalații · Vreme · Hartă) with a small pulsing `alpine-red` dot for live data.
2. **Resort switcher**: elegant segmented control Poiana Brașov / Bansko, persistent on resort pages.
3. **Footer**: dark `black` with navy cards, large serif sign-off line, newsletter field (Kit), affiliate disclosure, language placeholder.
4. **Stat card**, **status list row** (dot + name + state + updated time), **tag chips** (Familii, Începători, Freeride, Après-ski, Ski de noapte), **CTA button** (solid midnight, alpine-red primary variant, gold hairline underline on hover), **tab bar**, **FAQ accordion**, **affiliate card** (cazare/închirieri/transfer — understated, no loud badges).

## Pages to build
1. **Homepage**
   - Full-bleed video/photo hero, oversized serif headline (e.g. "Doi munți. Un sezon întreg."), season dates and live snow depth for both resorts directly below
   - Logo: EastPeaks wordmark per Brand identity section (`/public/logo.svg`).
   - Two-resort chooser: two large side-by-side image cards with key stats (altitudine, km pârtii, zăpadă azi, preț skipass) and "Explorează"
   - Comparison strip Poiana vs Bansko (tabular, elegant)
   - Map teaser section (dark), editorial "Ghid" articles grid, newsletter
2. **Resort page template** (same structure for both)
   - Hero + headline + season dates + 4 "at a glance" stats
   - Live conditions block (Zermatt-style): lifts open X/Y, km open, snow base/top, temp vale/vârf, "actualizat la HH:MM"
   - Tabs: Prezentare · Condiții · Pârtii · Hartă · Cazare · Închirieri · Cum ajungi · FAQ
   - Character tags, short editorial text, photo gallery
3. **Interactive map page** (SkiGrades-style): MapLibre map ~2/3 width, right panel with resort/trail details and tabs; toggle 2D/3D terrain, filters by difficulty, lift layer, POIs; mobile = full map + bottom sheet
4. **Conditions page**: both resorts, snow, lifts, webcams (links/embeds), forecast (MET Norway)

## Deliverables
- `tailwind.config` theme + `src/styles/tokens.css` with all tokens
- Reusable Astro components in `src/components/` (Header, UtilityBar, Hero, StatCard, StatusList, ResortSwitcher, Tabs, AffiliateCard, Footer)
- Preact islands only for: map, tabs, live status, resort switcher
- Pages: `/`, `/statiuni/poiana-brasov/`, `/statiuni/bansko/`, `/harta/`, `/conditii/`
- Mock data in `src/data/*.json` (clearly fake values) so pages render without APIs
- A short `DESIGN.md` documenting tokens, type scale, components and do/don't rules

## Rules — what makes it feel expensive
- Restraint: gold for brand, red only for actions/live, lots of whitespace, no gradients-everywhere, no stock icons clutter, no emoji
- Big type, small labels; every number has a label and a unit
- Never more than 2 typefaces; consistent 8px spacing scale
- Affiliate/monetization elements must look editorial, never like ads
- Accessibility: WCAG AA contrast, keyboard navigable tabs/map controls, alt text, focus states styled in gold
- Mobile-first; test at 375, 768, 1280, 1536 widths

Start by proposing the token set and type scale, then build the homepage and the resort template, then the map page. Show me screenshots/previews after each step.
