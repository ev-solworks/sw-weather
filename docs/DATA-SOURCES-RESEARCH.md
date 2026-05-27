# SW Weather — Data Sources Research

**Researched:** 2026-05-27
**Domain:** Free/low-cost weather + marine data for Spain (incl. Canaries) & Portugal (incl. Azores/Madeira)
**Confidence:** HIGH for IPMA (live-probed) and Open-Meteo (current docs); MEDIUM for AEMET marine structure (endpoints verified, field-level structure inferred); MEDIUM for Meteoblue/StormGlass (current marketing + docs).
**Thesis:** Beat eltiempo.es by using national MOS-corrected forecasts (AEMET, IPMA) as primary, backfilling gaps (wave period, multi-altitude wind, pollen) with Open-Meteo's free model family.

---

## Top-Line Recommendation

**Three-source free blend, no paid tier needed for Phase 1–2:**

1. **AEMET** — primary for **Spain** land forecast (MOS-corrected municipal daily+hourly), observations, UV, official avisos. `[VERIFIED: live endpoints + CLAUDE.md key]`
2. **IPMA** — primary for **Portugal incl. Azores/Madeira** land forecast (MOS-corrected daily), official warnings, UV, **and structured marine** (wave height/period/direction + SST, even for Madeira/Azores). `[VERIFIED: live-probed 2026-05-27]`
3. **Open-Meteo** — the marine/air-quality/altitude **backfill** everywhere, and the **only** structured numeric wave source for the Spanish coast (AEMET's marine product is free-text bulletins, not per-point numeric fields). Free, no key, CC-BY 4.0, 10k calls/day. `[VERIFIED: open-meteo.com/en/terms]`

**Decisive finding:** AEMET's maritime product (`/prediccion/maritima/costera`, `/altamar`) returns **free-text zone bulletins + map images**, NOT structured per-coordinate wave height/period/direction JSON. Since waves are a first-class Details requirement, **Open-Meteo Marine is the structured wave source for Spain**, while **IPMA oceanography gives structured waves for Portugal/islands**. This asymmetry is the single most important driver of the `sources` provenance object.

**Skip for now:** Meteoblue (only ~14 calls/day free — unusable as a live source), StormGlass (10 calls/day free — same problem), Copernicus Marine (no simple REST; requires WEkEO/Jupyter — too heavy for a PWA).

---

## 1. AEMET (Spain National — OpenData API)

`[VERIFIED: endpoints]` Base: `https://opendata.aemet.es/opendata/api` · Key already provisioned (`VITE_AEMET_API_KEY`).

### Two-step `datos` fetch `[VERIFIED: multiple sources + CLAUDE.md]`
Every endpoint returns `{ datos: "https://...", metadatos: "...", estado: 200 }`. The `datos` URL is a **short-lived signed URL** (seconds–minutes). Flow: (1) GET endpoint `?api_key=KEY` → `datos` URL; (2) GET `datos` URL → actual JSON. **Cache the final JSON, never the `datos` URL.** Each logical fetch = 2 HTTP calls.

### Rate limit `[VERIFIED]`
**50 req/min.** A full Spain location load (daily + hourly + observation = 3 endpoints × 2-step) ≈ 6 calls. Cache per CLAUDE.md TTLs; refresh on focus, never on timer.

### Endpoints & fields

| Product | Endpoint | Cadence | Key fields |
|---|---|---|---|
| Municipal daily | `/prediccion/especifica/municipio/diaria/{municipio}` | 4×/day (00/06/12/18 UTC) | `probPrecipitacion`, `cotaNieveProv`, `estadoCielo`, `viento` (dir+velocidad), `rachaMax`, `temperatura` (max/min), `sensTermica`, `humedadRelativa`, **`uvMax`** |
| Municipal hourly | `/prediccion/especifica/municipio/horaria/{municipio}` | 4×/day | hourly `temperatura`, `estadoCielo`, `precipitacion`, `probPrecipitacion`, `nieve`, `vientoAndRachaMax`, `humedadRelativa` |
| Station observation | `/observacion/convencional/datos/estacion/{idema}` | ~hourly | `ta` (temp), `hr` (humidity), `pres`, `vv`/`dv` (wind), `prec`, `tamin`/`tamax` |
| UV prediction | `/prediccion/especifica/uvi/{dia}` | daily | UVI by municipality, day 0–4 |
| Avisos (alerts) | `/avisos_cap/ultimoelaborado/area/{area}` | as issued | CAP XML/JSON warnings by zone |
| **Marine coastal** | `/prediccion/maritima/costera/costa/{costa}` | 24h text / 5-day maps | **FREE TEXT bulletin + map images — NOT structured wave fields** |
| **Marine high seas** | `/prediccion/maritima/altamar/area/{area}` | 24h text | **FREE TEXT bulletin** |

`[VERIFIED]` Marine endpoints use the **same OpenData key — no separate subscription.** `[CITED: aemet.es marine product page]` But the payload is a narrative bulletin ("mar de fondo del NW de 1 a 2 m...") — useful to *display* a Spanish coastal text summary, **not** to drive a numeric waves widget.

### What AEMET does NOT provide (→ backfill needed)
- **Structured wave height/period/direction & SST per coordinate** → Open-Meteo Marine `[VERIFIED]`
- **Multi-altitude wind** (80/120/180m, pressure levels) → Open-Meteo `[VERIFIED]`
- **Pollen / air quality** → Open-Meteo Air Quality `[VERIFIED]`
- **Portugal** (any) → IPMA

### Gotchas
- Municipio codes: 5-digit zero-padded strings (`07040`) — never `parseInt`. Station IDs alphanumeric (`B228`). `[CITED: CLAUDE.md]`
- `datos` URL expiry — cache final JSON only.
- Times in AEMET payloads are local-ish; treat per CLAUDE.md TZ table (Canaries `Atlantic/Canary` ≠ mainland).
- Attribution required: "AEMET" must be identified as author. `[VERIFIED: aemet.es]`
- Some fields come back as `""` empty strings, not null — coerce on the normalize boundary.

---

## 2. IPMA (Portugal National — free, no key) `[VERIFIED: live-probed 2026-05-27]`

Base: `https://api.ipma.pt/open-data` · No key, plain static JSON (CDN-cached). Forecast = statistical (MOS) blend of **ECMWF + AROME**, updated **2×/day at 00/12 UTC**.

### Endpoints & live-confirmed fields

| Product | Endpoint | Returns |
|---|---|---|
| Daily forecast (per location, 5-day) | `/forecast/meteorology/cities/daily/{globalIdLocal}.json` | per-day: `tMin`,`tMax`,`precipitaProb`,`predWindDir`,`classWindSpeed`,`idWeatherType`,`forecastDate`,`dataUpdate` |
| Daily forecast (all cities, one day) | `/forecast/meteorology/cities/daily/hp-daily-forecast-day{0..N}.json` | same, all locations |
| **Sea state / oceanography** | `/forecast/oceanography/daily/hp-daily-sea-forecast-day{0..N}.json` | **`waveHighMin`/`waveHighMax`, `wavePeriodMin`/`wavePeriodMax`, `predWaveDir`, `totalSeaMin`/`totalSeaMax`, `sstMin`/`sstMax`** — confirmed includes Madeira (33.25N) & Azores (37.95N, 38.57N) |
| UV forecast | `/forecast/meteorology/uv/uv.json` | `iUv`, `intervaloHora` (e.g. "12h-16h"), `data`, `globalIdLocal` |
| Warnings (avisos) | `/forecast/warnings/warnings_www.json` | `awarenessTypeName` (incl. "Agitação Marítima"), `awarenessLevelID` (green/yellow/orange/red), `startTime`,`endTime`,`text`,`idAreaAviso` |
| Locations list | `/distrits-islands.json` | all land locations; `idRegiao` 1=mainland, 2=Madeira, 3=Azores `[VERIFIED]` |
| Sea locations list | `/sea-locations.json` | coastal points (e.g. "Lisboa, costa" `globalIdLocal:1111026`) |
| Weather-type lookup | `/weather-type-classe.json` | `idWeatherType` → EN/PT description |
| Wind-speed lookup | `/wind-speed-daily-classe.json` | `classWindSpeed` → description |
| Precip-class lookup | `/precipitation-classe.json` | `classPrecInt` → description |

### Coverage `[VERIFIED]`
Mainland + **Madeira (Funchal, Porto Santo)** + **Azores (Ponta Delgada, Angra, Horta, Flores, Corvo…)** all present in `distrits-islands.json` and in oceanography. This is a genuine advantage over AEMET — IPMA gives structured Atlantic-island waves for free.

### Gotchas
- **No true hourly via public open-data** — the city forecast is **5-day daily** (despite path saying "daily"; per-location file returns 5 daily entries). The app's 3-hourly mobile-app data is not in the open feed. For PT hourly granularity → Open-Meteo. `[VERIFIED: probed Lisboa 1110600 returned 5 daily rows]`
- Numbers are **strings** in many fields (`"0.9"`, `"8.1"`) — parse at normalize boundary.
- `idWeatherType` integers need the lookup table — **cache it**, don't refetch per request. `[CITED: CLAUDE.md decision]`
- Marine `globalIdLocal` differs from land `globalIdLocal` — keyed via `sea-locations.json`, not the land list.
- All times **UTC** in payloads — render in location TZ (`Europe/Lisbon`, `Atlantic/Madeira`, `Atlantic/Azores`).
- Wave data is min/max ranges, not point values — display as a band or take midpoint.
- Attribution: credit IPMA.

---

## 3. Open-Meteo Family `[VERIFIED: open-meteo.com docs + terms, 2026-05-27]`

No key for non-commercial. **CC-BY 4.0.** Rate: **600/min, 5 000/hr, 10 000/day** (free tier). Attribution: clear credit to Open-Meteo + underlying provider (DWD for forecast/marine, CAMS for air quality).

| Sub-API | Endpoint host | Wins on |
|---|---|---|
| Forecast | `api.open-meteo.com/v1/forecast` | hourly everywhere, **wind at 10/80/120/180 m + 19 pressure levels**, UV index, 16-day horizon, named models |
| **Marine** | `marine-api.open-meteo.com/v1/marine` | **structured wave height/period/direction, wind-wave + swell components, peak period, SST, currents** |
| Air Quality | `air-quality-api.open-meteo.com/v1/air-quality` | **pollen (alder/birch/grass/mugwort/olive/ragweed), PM2.5/PM10, European+US AQI, O3/NO2/SO2/CO**; CAMS Europe 11 km |
| Geocoding | `geocoding-api.open-meteo.com/v1/search` | name → lat/lon/TZ (useful if you ever drop hardcoded locations) |

### Models for Iberia `[VERIFIED]`
- **Best Match** auto-selects highest-res model per point.
- **AROME (Météo-France)** covers France + **eastern/northern Spain** (1.5 km HD / 2.5 km); **does not reliably cover Portugal or Canaries** → those fall to **ARPEGE-Europe (~11 km)**, **ICON-EU (~7 km, DWD)**, **ECMWF IFS (~9 km)**.
- For **Canaries & Azores/Madeira** (outside AROME/ICON-EU), Best Match → ECMWF/GFS global.
- Sibling app already blends Best Match + ICON-EU (temp 70/30, precip=max, wind 70/30) — reuse that blend logic for backfill fields.

### Marine resolution caveat `[VERIFIED]`
Open-Meteo warns marine accuracy is **limited at the coast** ("not for navigation"). For a watersports *overview* it's fine; flag low confidence when the nearest grid point is far offshore. DWD EU wave model ~5 km, Météo-France ~8 km, ECMWF/GFS global 9–25 km.

### Open-Meteo wins (fields AEMET & IPMA lack)
- **Wave period & swell-vs-windwave split for Spain** (AEMET = text only).
- **Hourly** wave/SST timeseries for PT (IPMA = daily min/max only).
- **Multi-altitude wind** (kite/paraglider, the Windguru-style table).
- **Pollen & AQI** everywhere.

### Gotchas
- Default response is **UTC unless `timezone=` passed** — pass the location TZ to get local times, or request UTC and convert in-app (recommended for consistency).
- Marine/forecast/air-quality are **separate hosts** — separate fetches, can't batch across them.
- `current_weather` vs `hourly` arrays — index alignment matters; arrays are parallel (`time[]`, `temperature_2m[]`).
- Free CC-BY ⇒ a personal ad-free PWA qualifies as **non-commercial** (matches sibling-app usage). If you ever add a subscription/ads → commercial tier + key.

---

## 4. Meteoblue Free Tier `[VERIFIED: docs.meteoblue.com + marketing 2026-05-27]`

- **5 000 calls/year ≈ 13–14/day.** Key required (register, confirm non-commercial). Once daily cap hit, returns no data.
- Packages incl. **`sea` (significant wave height, wind-wave height/dir, SST, salinity)** — but gated behind the same tiny quota.
- **Verdict: not viable as a live data source** at ~14 calls/day for a multi-location, multi-view app. Could only serve a cached daily snapshot. **Skip for Phase 1–2.** Its value (high-res MOS) is largely matched free by AROME via Open-Meteo for the regions that matter.

---

## 5. Other Marine / Altitude Options `[VERIFIED: marketing/docs 2026-05-27]`

| Source | Coverage | Catch |
|---|---|---|
| **StormGlass** | Global marine: waves, swell, currents, **tides**, SST | Free = **10 req/day**, non-commercial. Only worth it later for **tides** (no free source above has tide tables). Paid €19/mo for 500/day. |
| **Copernicus Marine (CMEMS)** | Global + IBI + Med wave models, 3-hourly, 10-day | Free **but** access via WEkEO / Jupyter / MyOcean toolbox — **no lightweight REST for a browser PWA**. Would need an edge proxy + subsetting. Defer. |
| **NOAA WaveWatch III** | Global waves via NOMADS (GRIB) | GRIB only, no JSON REST; heavy. Not browser-friendly. |
| **Open-Meteo Marine** | (see §3) | The practical free structured-wave winner. |

**Tide gap:** none of the free-no-key sources give tide tables. If tides become a watersports requirement, StormGlass free (10/day, cache hard) or a dedicated tide API is the path. Flag as Open Question.

---

## Comparison Matrix

| Source | Coverage | Key? | Horizon | Hourly? | Marine/waves | Wind@altitude | UV | AQ/Pollen | Alerts | Rate limit | License/attrib | MOS-corrected? |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **AEMET** | ES (mainland, Balearics, Canaries) | Yes (have) | 7 day | Yes | **Text only** | No | Yes | No | Yes (CAP) | 50/min | Credit AEMET | **Yes** |
| **IPMA** | PT mainland + Madeira + Azores | No | 5 day | **No (daily)** | **Yes (daily ranges + SST)** | No | Yes | No | Yes | (none stated) | Credit IPMA | **Yes** (ECMWF+AROME) |
| **Open-Meteo Forecast** | Global | No | 16 day | Yes | — | **Yes (10–180m + plevels)** | Yes | — | No | 10k/day | CC-BY, credit OM+DWD | Model raw (Best Match blends) |
| **Open-Meteo Marine** | Global (coastal limited) | No | up to 16 day | Yes | **Yes (H/T/dir, swell, SST, currents)** | — | — | — | No | 10k/day | CC-BY, credit OM+DWD | Model raw |
| **Open-Meteo Air Quality** | Europe 11km / global 45km | No | 4–5 day | Yes | — | — | Yes | **Yes (pollen+AQI)** | No | 10k/day | CC-BY, credit CAMS | Model raw |
| **Meteoblue free** | Global | Yes | ~7 day | Yes | Yes (sea pkg) | Limited | Yes | Some | No | **~14/day** | Credit meteoblue | Yes |
| **StormGlass free** | Global marine | Yes | ~10 day | Yes | Yes + **tides** | No | No | No | No | **10/day** | Credit | Multi-model |
| **Copernicus Marine** | Global/IBI/Med | Yes (WEkEO) | 10 day | 3-hourly | Yes | No | No | No | No | n/a (no REST) | Credit CMEMS | Model |

---

## Recommended Blend — Per-Field Source Priority

Drives the `sources` provenance object + `confidence` signal in the unified type.

### Spain mainland + Balearics (`Europe/Madrid`)
| Field | Priority | Confidence note |
|---|---|---|
| temp / sky / precip prob (daily) | **AEMET** → OM Best Match | AEMET MOS = HIGH |
| temp / precip / wind (hourly) | **AEMET horaria** → OM ICON-EU/AROME | AEMET HIGH |
| current observation | **AEMET estación** → OM current | HIGH |
| UV | **AEMET uvi** → OM `uv_index` | HIGH |
| alerts | **AEMET avisos (CAP)** only | official |
| **waves (H/period/dir), SST** | **Open-Meteo Marine** (AEMET = text fallback for a display blurb) | MEDIUM (coastal grid) |
| wind @ altitude | **Open-Meteo** only | MEDIUM |
| pollen / AQI | **Open-Meteo Air Quality** only | MEDIUM |

### Canary Islands (`Atlantic/Canary`)
Same as mainland **but** OM backfill falls to ECMWF/GFS global (no AROME/ICON-EU). AEMET still primary for land + UV + avisos. Waves → **Open-Meteo Marine** (no IPMA here). Lower model confidence on altitude/marine — flag.

### Portugal mainland (`Europe/Lisbon`)
| Field | Priority |
|---|---|
| temp / sky / precip / wind (daily) | **IPMA** → OM Best Match |
| **hourly granularity** | **Open-Meteo** (IPMA has no hourly) → IPMA daily as fallback |
| current | **Open-Meteo current** (IPMA has no obs feed comparable) |
| UV | **IPMA uv.json** → OM |
| alerts | **IPMA warnings** only (incl. Agitação Marítima) |
| **waves / SST** | **IPMA oceanography** → Open-Meteo Marine (fill period/hourly) |
| wind @ altitude | **Open-Meteo** only |
| pollen / AQI | **Open-Meteo Air Quality** only |

### Atlantic Islands — Madeira (`Atlantic/Madeira`) & Azores (`Atlantic/Azores`)
| Field | Priority |
|---|---|
| land forecast (daily) | **IPMA** → OM ECMWF/GFS |
| hourly | **Open-Meteo** |
| **waves / SST** | **IPMA oceanography** (confirmed covers islands) → OM Marine |
| UV / alerts | **IPMA** |
| pollen / AQI | **Open-Meteo Air Quality** (sparse coverage offshore — flag) |

### Type-contract implications
```ts
// every WeatherConditions field carries provenance
interface FieldProvenance {
  source: 'aemet' | 'ipma' | 'open-meteo' | 'open-meteo-marine' | 'open-meteo-aq';
  model?: string;          // e.g. 'best_match', 'icon_eu', 'arome'
  confidence: 'high' | 'medium' | 'low';  // high=national MOS, medium=model, low=offshore/sparse grid
  fetchedAt: string;       // ISO; with the source TTL governs staleness
}
interface WeatherConditions {
  // ...numeric fields...
  sources: Record<string, FieldProvenance>;  // keyed by field name
}
```
`confidence` is computed: national MOS field = `high`; OM model field = `medium`; OM marine far from coast / AQ offshore = `low`. This is what visibly differentiates SW Weather from eltiempo.es — the UI can badge "AEMET official" vs "model estimate".

---

## Consolidated Gotchas Checklist

- **AEMET:** two-step signed `datos` URL (cache JSON not URL); 50/min; marine = **text not numbers**; municipio codes are zero-padded strings; empty-string nulls; credit AEMET.
- **IPMA:** all-strings numbers; **daily only** (no hourly in open feed); cache lookup tables (`weather-type-classe`, `wind-speed`, `precipitation-classe`); marine uses separate `globalIdLocal` from `sea-locations.json`; UTC times; wave values are min/max ranges; credit IPMA.
- **Open-Meteo:** separate hosts per sub-API (no batching); pass `timezone` or convert from UTC consistently; parallel arrays; coastal marine accuracy limited (low-confidence flag); CC-BY non-commercial OK for ad-free personal PWA; credit OM + DWD/CAMS.
- **Cross-cutting:** every location object carries its own TZ; render in location time. New `Atlantic/Madeira` & `Atlantic/Azores` TZs join the CLAUDE.md table for IPMA islands.

---

## Open Questions

1. **Tides** — no free no-key source. If watersports needs tide tables → StormGlass free (10/day, hard-cache) or dedicated tide API. Defer + flag.
2. **AEMET marine text parsing** — worth parsing the Spanish coastal bulletin into a display string, or just show OM Marine numbers + a "see AEMET bulletin" link? Recommend the latter for Phase 1.
3. **IPMA hourly** — confirm there's truly no public hourly feed (mobile app has 3-hourly). If a hidden endpoint exists it'd reduce OM dependence for PT. Currently OM fills PT hourly.
4. **Commercial status** — confirm the PWA stays ad-free/no-subscription to keep Open-Meteo + IPMA free-tier compliant.

---

## Sources

**Primary (HIGH):**
- IPMA open-data — live-probed 2026-05-27: `/forecast/meteorology/cities/daily`, `/forecast/oceanography/daily`, `/forecast/meteorology/uv/uv.json`, `/forecast/warnings/warnings_www.json`, `/distrits-islands.json`, `/sea-locations.json`, `/weather-type-classe.json`
- https://open-meteo.com/en/docs , /marine-weather-api , /air-quality-api , /terms (rate limits, CC-BY, models, fields)
- https://www.aemet.es/en/datos_abiertos/AEMET_OpenData (attribution), AEMET marine product page (text-bulletin nature)
- CLAUDE.md (key, two-step pattern, 50/min, TZ table, lookup-caching decisions)

**Secondary (MEDIUM):**
- github.com/Caesar62/AEMET_API & github.com/pablo-moreno/python-aemet (endpoint paths, marine = costera/altamar)
- docs.meteoblue.com (5000/yr free, sea package); stormglass.io/pricing (10/day free, tides); marine.copernicus.eu (WEkEO access model)

**Valid until:** ~2026-06-27 (Open-Meteo/Meteoblue terms move; re-verify rate limits & commercial definition before any monetization).
