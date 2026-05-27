# SW Weather — Build Plan

Single living plan doc (no GSD phase tree — see CLAUDE.md "How we work"). Sequenced
by dependency, not by ceremony. Edit in place; check items as they land; prune when stale.

**Goal:** Replace eltiempo.es with a clean, ad-free, dark PWA for ES + PT (incl.
Atlantic islands), built as a module that can later embed into sw-client-app. Full
6-view design system, AEMET/IPMA-primary with Open-Meteo backfill, marine first-class.

**Working state:** Scaffold + type contract done. No provider code yet.

---

## Reference docs
- Type contract: [src/types/weather.ts](../src/types/weather.ts) — the boundary everything normalizes into.
- Data blend: [docs/DATA-SOURCES-RESEARCH.md](../docs/DATA-SOURCES-RESEARCH.md) — per-region per-field source priority.
- API gotchas: [docs/API-NOTES.md](../docs/API-NOTES.md) — update as we hit real responses.
- Design: [design_handoff_sw_weather/](../design_handoff_sw_weather/) — VIEWS.md, ARCHITECTURE.md, DESIGN_TOKENS.md, INTEGRATION.md.

---

## Stage 1 — Data layer (current)

Get real, normalized `WeatherConditions` for one location before any view work.

- [x] `src/types/weather.ts` — canonical contract
- [ ] `src/utils/cache.ts` — in-memory Map + localStorage mirror, keyed `{source}:{kind}:{locationId}`, TTL on read. Namespace localStorage under `sw.weather.*` (per INTEGRATION.md §5).
- [ ] `src/utils/locations.ts` — seed locations (dev data) typed as `Location[]`, with source-routing IDs + TZ.
- [ ] `src/services/aemet.ts` — two-step `datos` fetch; daily + hourly + station obs; Latin-1 decode guard; cache JSON not URL; municipio IDs as strings.
- [ ] `src/services/ipma.ts` — daily forecast; cache weather-type / wind-speed / precip lookup tables; oceanography (waves/SST) via `sea-locations.json` globalIdLocal; UV; warnings.
- [ ] `src/services/openMeteo.ts` — forecast (hourly backfill, wind@altitude), marine (waves/SST for Spain), air-quality (pollen/AQI). Separate hosts per sub-API; pass `timezone`.
- [ ] `src/services/sun.ts` — suncalc adapter → `SunPhases` + `MoonInfo` (no network).
- [ ] `src/services/normalize.ts` — merge all sources → `WeatherConditions` per the per-region blend; populate the `sources` provenance map + `confidence`.
- [ ] `src/hooks/useWeather.ts` — fetch + cache + `{ data, error, loading }` per location.
- [ ] **Verify:** log a fully-normalized `WeatherConditions` for Palma (ES coastal) and Lisboa (PT) to console; eyeball field-by-field against AEMET/IPMA web. No UI yet.

**Key blend reminders** (from research):
- ES land/UV/alerts: AEMET primary → OM backfill. ES **waves: Open-Meteo Marine** (AEMET marine is text only).
- PT land/UV/alerts/waves: IPMA primary; **hourly from Open-Meteo** (IPMA has no hourly). PT waves: IPMA oceanography → OM fill.
- Atlantic islands: IPMA land + waves; OM backfill falls to global models → mark `lowConfidence`/`confidence: 'low'`.

## Stage 2 — Key proxy (Supabase edge fn)
- [ ] Supabase edge function proxying the AEMET key (Deno), mirroring sw-client-app's pattern. AEMET client calls the function, not AEMET directly. IPMA/Open-Meteo stay client-side (keyless).
- [ ] `.env` / `.env.example`: document the Supabase URL + anon key; remove `VITE_AEMET_API_KEY` from the client once proxied.

## Stage 3 — App shell + first view (vertical slice)
- [ ] `src/main.tsx` + `src/App.tsx` — router + tab bar (Home · Today · Week · Map · More).
- [ ] Design tokens → `src/styles/tokens.css`; motion keyframes → `motion.css`.
- [ ] `src/components/WxIcon.tsx`, `WeatherBackdrop/`, color scales (`scales/wgScales.ts`).
- [ ] **`TodayVisual`** wired to real `useWeather` for one location — the vertical slice that validates the contract against reality.
- [ ] **Verify in preview.**

## Stage 4 — Remaining views
- [ ] `HomeView` (saved-location cards + motion backdrops)
- [ ] `WeekView`
- [ ] `TodayWindguru` (dense colored table; memoize cells)
- [ ] `TodayGraph` (SVG panels; memoize paths)
- [ ] `TodaySun` (twilight bands, golden hour, moon)
- [ ] Details view incl. **marine/watersports block** (waves/period/dir/SST, confidence badge)

## Stage 5 — Locations UX
- [ ] Geolocation acquisition
- [ ] Location search (Open-Meteo geocoding — keyless, proven in sw-client-app)
- [ ] Add/remove/reorder saved locations, persisted to `sw.weather.locations`

## Stage 6 — PWA + polish
- [ ] `vite-plugin-pwa` manifest + icons, installable, offline last-known forecast
- [ ] Confidence/provenance badging across views ("AEMET official" vs "model estimate")
- [ ] Accessibility pass (DESIGN_TOKENS contrast, reduced-motion, aria — see design ARCHITECTURE.md checklist)
- [ ] Performance (bundle, memoization, CLS)

## Stage 7 — Module build (when integrating into sw-client-app)
- [ ] `src/module.tsx` exporting `<WeatherModule>` (surfaces: full / card / compact) per INTEGRATION.md
- [ ] Library build config (`dist/module/`), React externalized, CSS extracted

---

## Deferred / open
- **Tides** — no free keyless source. StormGlass free (10/day, hard-cache) if watersports needs it. Flagged.
- **AEMET marine text** — show OM Marine numbers + link to AEMET bulletin rather than parsing the Spanish text (Phase-1 recommendation).
- **Capacitor / native AR sun tracker** — the only feature needing native sensors; far future.
- **Light theme** — explicitly not this iteration (rainbow cells need dark backdrop).
- **Commercial status** — keep ad-free/no-subscription to stay Open-Meteo + IPMA free-tier compliant.

## Decision log
- **2026-05-27** Scope expanded from "Phase 1 MVP" to full 6-view design system (+ marine, geolocation). See memory `project-sw-weather-scope-expansion`.
- **2026-05-27** AEMET/IPMA primary, Open-Meteo backfill; per-field provenance + confidence baked into the type contract.
- **2026-05-27** Key proxy = Supabase edge fn (not Cloudflare Worker); stack = React 19 + Tailwind 4. See memory `project-sw-client-weather-relationship`.
- **2026-05-27** Marine fields nullable (region-dependent coverage), not faked to 0.
- **2026-05-27** Dropped GSD phase tree; replaced `docs/PHASES.md` with this single living plan.
