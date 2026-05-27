# API Notes — Things That Bite

Living document of API quirks, response-shape surprises, and gotchas discovered during implementation. Update as you learn.

---

## AEMET OpenData

**Base:** `https://opendata.aemet.es/opendata/api`
**Auth:** `?api_key=KEY` query param (also accepts `api_key` header)
**Rate limit:** 50 req/min (hard, returns 429)
**Docs:** https://opendata.aemet.es/dist/index.html

### The two-step pattern

Every endpoint returns:
```json
{
  "descripcion": "exito",
  "estado": 200,
  "datos": "https://opendata.aemet.es/opendata/sh/abc123...",
  "metadatos": "https://opendata.aemet.es/opendata/sh/def456..."
}
```

`datos` is a **temporary signed URL**. You must GET it to retrieve the actual payload. Treat both URLs as ephemeral — they may 404 within minutes. Cache the resolved JSON, never the URL.

### Response encodings

- AEMET responses are sometimes served as **`application/json` with Latin-1 bytes** despite claiming UTF-8. If you see `Mallorca` rendered as `Mallorca`, force-decode as `latin1` or `iso-8859-1` before `JSON.parse`. Implemented in `aemet.ts` `decodeBody()`: decode UTF-8 first, and if the result contains U+FFFD (replacement char) re-decode as `iso-8859-1`.

### Live-verified payload shapes (probed 2026-05-27, municipio 07040)

Both forecast endpoints return a **single-element array**; real data is at `[0].prediccion.dia[]`.

**Daily** (`/diaria/{municipio}`) — period-based, NOT hourly. Use for hi/lo, uvMax, day wind.
- `dia[].fecha` — naive ISO `2026-05-27T00:00:00` (no TZ → interpret in location TZ).
- `dia[].temperatura` — `{ maxima, minima, dato:[{value,hora}] }` (numbers; `dato` sparse at hours 6/12/18/24).
- `dia[].uvMax` — number.
- `dia[].estadoCielo` / `probPrecipitacion` / `viento` / `rachaMax` — arrays keyed by `periodo` (`00-24`, `00-12`, `12-24`, then 6h blocks). `estadoCielo` items have `{value, periodo, descripcion}`.

**Hourly** (`/horaria/{municipio}`) — the real per-hour source (≈48h).
- Values are **STRINGS** (`"19"`, `"0"`); empty string `""` = no data → null. (`aemet.ts` `aemetNum()`.)
- `dia[].orto` / `dia[].ocaso` — sunrise/sunset `"HH:MM"`.
- `estadoCielo.value` carries an `n` night suffix, e.g. `"17n"` → strip `n`, set `isNight`. (`parseSkyCode()`.)
- Per-hour arrays (`temperatura`, `humedadRelativa`, `precipitacion`, `sensTermica`) keyed by `periodo` = hour `"03".."23"`.
- `probPrecipitacion.periodo` is a **range** (`"0208"` = 02–08), different cadence — don't assume 1:1 with the hour.
- `vientoAndRachaMax` **alternates**: a wind entry `{direccion:[..],velocidad:[..],periodo}` then a gust entry `{value,periodo}`, both with the same hour `periodo`. Pair by `periodo`. (`pairWind()`.)
- `estadoCielo.value` codes seen: `11` Despejado, `12` Poco nuboso, `17` Nubes altas, `81` Niebla, `82` Bruma (+ `n` variants). Full code→ConditionCode map lives in `normalize.ts`.

### Endpoints used in Phase 1

| Purpose | Path | Notes |
|---|---|---|
| Daily forecast (7d) | `/prediccion/especifica/municipio/diaria/{municipio_id}` | `municipio_id` is 5-digit zero-padded string |
| Hourly forecast (48h) | `/prediccion/especifica/municipio/hora/{municipio_id}` | |
| All stations latest obs | `/observacion/convencional/todas` | Returns ~800 stations; filter client-side by distance |
| Single station obs | `/observacion/convencional/datos/estacion/{station_id}` | `station_id` is alphanumeric (e.g. `B228`) |
| Active alerts | `/avisos` | Phase 2 |

### Station-to-location mapping

Phase 1 hardcodes nearest AEMET station per saved location. Discover via `/observacion/convencional/todas` then compute haversine distance to the location lat/lon.

| Location | Nearest station ID | Status |
|---|---|---|
| Palma de Mallorca | `B228` (Palma airport) | confirmed in kickoff prompt |
| Ibiza / Eivissa | TBD | needs lookup |
| Santa Cruz de Tenerife | TBD | needs lookup |
| Madrid | TBD | needs lookup (likely `3195` Retiro or `3129` Cuatro Vientos) |

### Common mistakes

- ❌ `parseInt("07040")` → `7040` — AEMET will 404. Keep municipio IDs as strings.
- ❌ Caching the `datos` URL — it expires.
- ❌ Polling on a timer — burns the 50-req/min budget for no benefit (forecasts only update 4×/day).
- ❌ Decoding response as UTF-8 without checking — see encoding note above.

---

## IPMA Open API

**Base:** `https://api.ipma.pt/open-data`
**Auth:** none
**Rate limit:** none documented (be polite — 6h cache TTL)

### Endpoints used in Phase 1

| Purpose | Path | Notes |
|---|---|---|
| Daily forecast by location | `/forecast/meteorology/cities/daily/{globalIdLocal}.json` | `globalIdLocal` is 7-digit integer |

### Weather-type lookup

IPMA returns `idWeatherType: <int>` per day. The integer-to-text mapping is fetched separately from:
```
GET /weather-type-classe.json
```
Cache this for 24h+ (it doesn't change). Map IDs to a normalized icon string in `normalize.ts`.

### Update timing

IPMA forecasts refresh ~9–10 AM and ~9–10 PM Lisbon local time. Our 6h TTL is intentionally close to the half-day cycle.

### Common mistakes

- ❌ Treating `globalIdLocal` as a string — it's an integer in the JSON. Coerce consistently.
- ❌ Building UI against weather-type IDs without the lookup table loaded — the first render will show numbers.

---

## OceanDrivers — live wind stations (Bay of Palma)

**Base:** `https://api.oceandrivers.com/v1.0`
**Auth:** none. CORS open (`*`). Keyless.
**What:** OceanDrivers "Ocean Web Weather" — private club weather stations around the
Bay of Palma, updating every ~2–10s. MEASURED live data — beats AEMET forecast for
local wind. Use for **current conditions** (wind especially) on Mallorca locations.

### Live endpoint (verified 2026-05-27)
```
GET /getWeatherDisplay/{stationId}/        ← latest reading. NO ?period (bare 500s with period=latest)
GET /getEasyWind/{stationId}/              ← for "EW"-prefixed EasyWind stations
```
Discovered from the station widget's `weatherStationModel.js` (Backbone model polled
by `lib/backbone.poller`).

### History / time-series (for graphs)
```
GET /getWeatherDisplay/{stationId}/?period=latesthour   ← 60 pts, 1/min (last hour)
GET /getWeatherDisplay/{stationId}/?period=latestday    ← 24 pts, 1/hour (last 24h)
```
Returns PARALLEL objects keyed by index: `TIME`, `TWS`, `TWS_GUST`, `TWD` as
`{"0":v,"1":v,…}` + a `length`. Zip by index. (`latestweek` 500s — not available.)
Wired as the `oceandrivers-history` proxy kind → `WeatherConditions.windHistory`
→ wind/gust sparkline (Today/Visual) + 1h/24h panel (Today/Graph).

### Station IDs = the subdomain name, LOWERCASE
| Station | id | coords (from payload) |
|---|---|---|
| Real Club Náutico de Palma | `rcnp` | 39.567, 2.635 |
| Club Marítimo San Antonio de la Playa | `cmsap` | 39.533, 2.716 |
| CN Arenal | `cnarenal` | 39.5, 2.733 |
| Club Náutico Cala Gamba | `cncg`? (unverified) | — |

`rcnp` is the central Palma station → attach to the Palma location.

### Payload fields (knots, °C, hPa)
`TWS` true wind speed (kt) · `TWD` true wind dir (°) · `TWS_GUST` / `TWS_GUST_MAX {VALUE,TIME_STRING}` ·
`TEMPERATURE` · `HUMIDITY` · `PRESSURE` + `PRESSURE_TR` (3h trend) · `RAIN` / `RAIN_DAY` / `RAIN_MONTH` ·
`WINDCHILL` · `HUMIDEX` · `ICON_NOW`/`ICON_FOR` · `WEATHER_DES` · `LATITUDE`/`LONGITUDE` ·
`ACTIVE` (ON/OFF) · `TIME`/`TIME_STRING`. **Wind is in KNOTS** — convert to km/h (×1.852) for our type.

### Common mistakes
- ❌ `?period=latest` → 500. Hit the bare `/getWeatherDisplay/{id}/`.
- ❌ Uppercase / guessed IDs silently fall back to a default station's data. Use the exact lowercase subdomain id.
- ❌ Treating TWS as km/h — it's knots.

### Notes
- Personal/low-volume use; cache server-side (proxy) and poll modestly. Revisit terms if the app goes public/commercial.
- Future: a dedicated "live wind stations" feature (map of stations + live readings) — this endpoint supports it.

## Windguru station widgets — NOT cleanly pullable
Sites like kiteandyogamallorca.com embed a **Windguru station widget** (e.g. spot
`s=1189718`, Pollença/Alcúdia). The raw station data is gated:
- `https://www.windguru.cz/int/iapi.php?q=station_data_current&id_station={id}` → `401 Unauthorized` without a Windguru session/referer; with a referer it returns "Unknown station!" because the widget `s=` id ≠ the internal station id the data API wants.
- No clean public `stations.windguru.cz/v1/...` per-id endpoint (404).
So Windguru station widgets can be *embedded* (iframe) but their live numbers can't
be put in our own UI without reverse-engineering their session. Use Holfuy/OceanDrivers
(own APIs) for these spots instead. See docs/WIND-STATIONS-RESEARCH.md.

---

## Future (Phase 2+)

Not implemented yet. Add quirks here as they come up.

- **Open-Meteo:** always pass `models=ecmwf_ifs025` for Iberia; `best_match` defaults to ICON-D2 which is suboptimal west of the Pyrenees.
- **Meteoblue free tier:** key valid 1 year, must register annually.
- **RainViewer:** free tier is past-radar only; no nowcast tiles, blue color scheme only.
