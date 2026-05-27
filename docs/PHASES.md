# SW Weather — Phase Plan

Tracker for the 6-phase build. Update checkboxes as work lands. Source of truth for "what's next."

---

## Phase 1 — Core MVP

**Goal:** A usable dark-mode PWA showing current conditions + 48h hourly + 7-day daily for Spain (AEMET) and Portugal (IPMA), with hardcoded saved locations.

- [ ] Project scaffold (Vite + React + TS + Tailwind + vite-plugin-pwa)
- [ ] `src/types/weather.ts` — `WeatherConditions`, `SavedLocation` interfaces
- [ ] `src/utils/locations.ts` — hardcoded saved locations with municipio/globalIdLocal/TZ
- [ ] `src/utils/cache.ts` — in-memory + localStorage TTL cache
- [ ] `src/services/aemet.ts` — two-step fetch, hourly + daily + station obs
- [ ] `src/services/ipma.ts` — daily forecast, weather-type lookup
- [ ] `src/services/normalize.ts` — both sources → `WeatherConditions`
- [ ] `src/hooks/useWeather.ts` — fetch + cache + loading/error state per location
- [ ] `src/views/Home.tsx` — current conditions, station, "feels like", alerts banner stub
- [ ] `src/views/Today.tsx` — horizontal 48h timeline, color-coded precip bars
- [ ] `src/views/Week.tsx` — 7 daily cards, tap to expand hourly
- [ ] Bottom tab bar nav (Home / Today / Week)
- [ ] Location switcher in header, persisted to localStorage
- [ ] Loading skeletons for all views
- [ ] PWA manifest + icons, installable on iOS/Android
- [ ] Pick + ship a single weather icon set (Meteocons, Weather Icons, or custom SVG)

**Exit criteria:** Can install on phone, switch between all 5 hardcoded locations, see current/today/week without errors, works offline with cached data.

---

## Phase 2 — Enhanced Data + Wind

- [ ] Open-Meteo client (`models=ecmwf_ifs025`, never `best_match`)
- [ ] Air quality view (PM10/PM2.5/AQI, calima alert when PM10 spikes)
- [ ] Pollen data (grass, olive, birch — olive is critical for southern Spain)
- [ ] Marine view for `isCoastal` locations
- [ ] Meteoblue free-tier client (cross-reference / confidence signal)
- [ ] AEMET `/avisos` alerts integration
- [ ] IPMA warnings integration
- [ ] Wind view: Windguru-style multi-model color-coded table (ECMWF vs ICON)
- [ ] Edge function proxy (Cloudflare Worker) for AEMET + Meteoblue keys
- [ ] Move caching to edge proxy where possible

---

## Phase 3 — Radar + Wind Maps + Embeds

- [ ] Leaflet integration
- [ ] RainViewer tile overlay with animated playback (last 2h + nowcast)
- [ ] Station map showing nearest AEMET observation points
- [ ] Windy.com animated wind map embed
- [ ] Windguru widget embed with dark-theme wrapper
- [ ] Windguru spot-ID mapping for saved locations

---

## Phase 4 — Solar + Production Tools

- [ ] Port sunrise/sunset logic from SW Client App
- [ ] Golden hour, blue hour, civil/nautical/astronomical twilight (suncalc)
- [ ] Moon phase, moonrise/moonset
- [ ] Production planning view (shoot-day weather summary)
- [ ] Solar elevation/azimuth on hourly timeline

---

## Phase 5 — Polish

- [ ] Service Worker offline support (last-known forecast)
- [ ] ntfy.sh push notifications for alerts
- [ ] Compact widget-style view
- [ ] Performance pass (bundle size, image lazy-load, CLS)
- [ ] Geolocation for "current location" weather
- [ ] Add/remove custom locations (no longer hardcoded)

---

## Phase 6 — Native iOS (Capacitor) + AR Solar Tracker

- [ ] Apple Developer Program enrollment ($99/year)
- [ ] Capacitor 6+ integration
- [ ] Native Swift `SolarARPlugin` (sensor fusion: gyro + accel + mag)
- [ ] Use `CMAttitudeReferenceFrame.xArbitraryCorrectedZVertical` (drift-free)
- [ ] AR sun-tracker view (camera + sun-path arc overlay)
- [ ] AR moon-tracker (same engine, lunar ephemeris)
- [ ] WidgetKit Lock Screen + Home Screen widgets
- [ ] TestFlight OTA pipeline
- [ ] (Stretch) Apple Watch complication
