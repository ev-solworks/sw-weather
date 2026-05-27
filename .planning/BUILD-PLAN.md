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
- [x] `src/utils/cache.ts` — in-memory Map + localStorage mirror, keyed `{source}:{kind}:{locationId}`, TTL on read. Namespaced `sw.weather.*`; allow-stale read for offline.
- [x] `src/utils/locations.ts` — seed locations (dev data) typed as `Location[]`, with source-routing IDs + TZ.
- [x] `src/services/aemet.ts` — two-step `datos` fetch; daily + hourly; Latin-1 decode guard; cache JSON not URL; municipio IDs as strings. (Station obs deferred — hourly covers current via nearest-hour.)
- [x] `src/services/ipma.ts` — daily forecast; cached weather-type + sea-location lookups; oceanography (waves/SST) via sea globalIdLocal + nearest-sea haversine.
- [x] `src/services/openMeteo.ts` — forecast (hourly backfill), marine (waves/SST for Spain), air-quality (pollen/AQI), keyless geocoding. Separate hosts; pass `timezone`.
- [x] `src/services/sun.ts` — suncalc adapter → `SunPhases` + `MoonInfo` (no network).
- [x] `src/services/conditions.ts` — WMO / AEMET estadoCielo / IPMA weather-type → `ConditionCode`; compass→degrees; day/night variant.
- [x] `src/services/normalize.ts` — merge all sources → `WeatherConditions` per the per-region blend; provenance map + confidence; TZ-aware day labels.
- [x] `src/hooks/useWeather.ts` — fetch + cache + `{ data, error, loading, stale }` per location; date revival after cache read.
- [x] **Verified** against live APIs for Palma (ES) + Lisboa (PT) via `scripts/verify-normalize.ts` (kept as a dev smoke test). Caught + fixed a TZ day-label bug and wired AEMET range-period precip probability.

**Known data-layer limitations (not bugs):** AEMET hourly has no per-hour UV or cloud-cover % (sky-state drives the icon; daily `uvMax` available). AEMET daily gives precip *probability*, not mm. AEMET station observations not yet wired (current = nearest forecast hour). Pollen/AQI fetched but not yet surfaced. These are follow-ups, tracked here.

**Key blend reminders** (from research):
- ES land/UV/alerts: AEMET primary → OM backfill. ES **waves: Open-Meteo Marine** (AEMET marine is text only).
- PT land/UV/alerts/waves: IPMA primary; **hourly from Open-Meteo** (IPMA has no hourly). PT waves: IPMA oceanography → OM fill.
- Atlantic islands: IPMA land + waves; OM backfill falls to global models → mark `lowConfidence`/`confidence: 'low'`.

## Stage 2 — Key proxy (Supabase edge fn)
- [ ] Supabase edge function proxying the AEMET key (Deno), mirroring sw-client-app's pattern. AEMET client calls the function, not AEMET directly. IPMA/Open-Meteo stay client-side (keyless).
- [ ] `.env` / `.env.example`: document the Supabase URL + anon key; remove `VITE_AEMET_API_KEY` from the client once proxied.

## Stage 3 — App shell + first view (vertical slice)
- [x] `src/components/WxIcon.tsx` — line glyphs per ConditionCode, day/night variants.
- [x] `src/components/WeatherBackdrop.tsx` — static condition+time-of-day gradient (CSS-keyframe motion layers deferred to Stage 4).
- [x] `src/utils/format.ts` — TZ-aware time/hour, compass, UV label, duration.
- [x] **`TodayVisual`** wired to real `useWeather` for Palma — hero stack, next-12h strip, wind/humidity/UV metrics, daylight sun arc. UV falls back to daily uvMax.
- [x] **Verified in real browser** (CDP screenshot at 390px): live AEMET data renders correctly, TZ-correct times (NOW·10:00, sunset 21:07 Europe/Madrid). The full chain works end-to-end on a screen.
- [x] **Navigation (context-based, no router)** — `app/navigation.tsx` (active tab + Today sub-view + saved locations, persisted to `sw.weather.locations`); `TabBar` (Home·Today·Week·Map·More; Map/More disabled); `LocationSwitcher` bottom-sheet. App shell renders the active tab. Routerless → embeddable per INTEGRATION.md.
- [x] **Home dashboard** — `HomeView` with per-location cards (featured taller + 6h strip), each via `useWeather` (cached); condition backdrops; tap → Today/Visual.
- [x] **Fixed AEMET rate-limit burst** — Home firing 4 ES locations at once tripped 429s (Madrid failed). Added a concurrency gate (max 3 in flight, ~350ms spacing) + single 429 retry in `aemet.ts`. All 5 locations now load.
- [ ] Design tokens → `src/styles/tokens.css` (currently Tailwind utilities + inline palette; extract when a 2nd view shares them).

## Stage 4 — Remaining views
- [x] `HomeView` (saved-location cards + condition backdrops) — done in Stage 3.
- [x] **`WeekView`** — summary tiles (week hi/lo, peak rain; wave tile only when a day has waves), shared temp scale, per-day gradient range bars + today's current-temp marker, rain/wind/wave chips. Nullable marine handled honestly (no faked zeros). Verified in browser. (Added `stampTodayCurrent` in normalize.)
- [x] **`TodaySun`** (twilight bands, golden hour arc, phase list, moon disc) — see Stage-4 entry above.
- [x] **`TodayWindguru`** — dense color-coded hourly table; sticky label column + sync-scrolling rows; memoized cells; auto-scroll to now; per-metric ramps in `scales/wgScales.ts`. Marine rows show honest dots when no wave data. Legend strip. Verified for Palma. **Surfaced:** AEMET hourly has no per-hour cloud%/UV → those rows are dots for ES locations (PT/Open-Meteo populates them). Possible follow-up: backfill ES hourly cloud/UV from Open-Meteo.
- [x] **`TodayGraph`** — 5 sync-scrolling SVG panels (temp area, wind bars+gusts+arrows, rain area+precip bars, wave area+period+arrows [hidden if no waves], cloud bars); now-guide, day/night shading, memoized panels. Verified for Palma.
- [x] **Marine/watersports** — fulfilled by Windguru (the "details" view per user) marine rows + Graph wave panel, PLUS a `WatersportsSummary` header on Windguru: plain-language sea state ("0.1m @ 4s · short wind-chop from SE"), wind-vs-wave alignment, sea temp, and the **source/confidence badge** ("MODEL ESTIMATE · MEDIUM" for ES / "IPMA OFFICIAL · HIGH" for PT) — first surfacing of the provenance differentiator. Verified for Palma.

**Stage 4 complete.** All 6 design views + the watersports summary are built and verified in-browser.

**Cold-load polish follow-up:** on a fresh page load, Home fetches 5 locations and Today re-fetches the active one (separate `useWeather` instances share the cache but not in-flight requests) → duplicate fetch, slow first paint under the AEMET throttle. Add request de-duplication (in-flight promise map) keyed by `{source}:{kind}:{locationId}`. Polish, not correctness.

**Resilience follow-up (noted 2026-05-27):** hit a transient AEMET `ConnectTimeoutError` in testing → a cold load with nothing cached dead-ends at "Couldn't load." Stale-cache fallback only helps after a first success. Consider retry-on-mount with backoff and/or partial render (show IPMA/OM even if AEMET times out). AEMET OpenData is intermittently slow.

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

## Live wind stations (future feature)
A dedicated page: map of live measured stations (à la **wynd.live** — kitesurf/wingfoil
aggregator, Mediterranean/Mallorca, live wind+gust+direction, community-rated spots)
with live readings + the wind/gust history graph already built.
- **Source mining:** wynd.live aggregates stations we may want — inspect its network
  calls / station list to find the underlying feeds (it blocks server-side scraping;
  check in a real browser's devtools). Likely overlaps OceanDrivers + others.
- Infrastructure already in place: OceanDrivers live + history through the proxy,
  `windHistory` on the type, `WindHistoryChart` component, `oceandrivers_station`
  column. Extending to more stations = add rows + (maybe) a stations table/map.
- **Record our own history** (longer retention than OceanDrivers' hour/day) when this
  lands: the cron already fetches; add a time-series table + retention.

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
