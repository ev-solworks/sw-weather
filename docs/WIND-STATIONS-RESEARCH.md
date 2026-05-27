# Live Wind Stations — Network Research

**Researched:** 2026-05-27
**Domain:** Public/free real-time coastal wind-station networks for a watersports "live wind" feature
**Use case:** Kitesurf / windsurf / wingfoil — live wind speed + gust + direction (+ short history) at coastal stations
**Primary region:** Spain — Balearics (Bay of Palma, Mallorca, Ibiza) + Tarifa/Andalucía. Secondary: Greek islands, Portugal.
**Confidence:** HIGH for Holfuy / Pioupiou / Meteoclimatic (verified with live calls today). MEDIUM for SOCIB / WeatherLink (verified docs + auth behaviour, not full data shape). LOW-flagged items noted inline.

> Architecture fit reminder: a source is usable only if we can call a documented REST/JSON (or affordable-key) endpoint **server-side** from the Supabase edge function and cache the JSON. Embed-only widgets and bot-protected private backends are out. We already run **OceanDrivers** (keyless, Bay-of-Palma clubs) — not re-researched here except for overlap notes.

---

## Top-line summary

- **Holfuy** is the single best next integration. It is *the* de-facto network at European kite/windsurf spots, has a clean documented JSON live API (`api.holfuy.com/live/`) returning **speed + gust + direction + min**, plus a history API. Free of charge but **per-station password-gated** — you email `info@holfuy.hu` with the station IDs you want and they enable a free API password. Verified live today against the public test station 101. **This is where Tarifa and most Balearic kite-spot stations actually live.**
- **Pioupiou / OpenWindMap** is the best *fully-keyless, CORS-open* option and great as a complementary layer. Verified live today: `api.pioupiou.fr/v1/live/{id}`, `/v1/live/all` (whole network with coords — perfect for station discovery), and `/v1/archive/{id}` for history. Community sensors; coverage is patchier on our exact spots but it's zero-friction and explicitly licensed for reuse with attribution.
- **Meteoclimatic** (Spanish amateur network) is keyless XML, verified live today, covers the Balearics (`ESIB…` codes) and all of Spain — but stations are mostly **inland/town gardens**, give wind `now/max/azimuth` only (gust ≈ `max`, weak), and the data is uncalibrated. Useful as a wide fallback, not as a primary watersports source.
- **SOCIB** is the authoritative Balearic ocean-observing network (Bay of Palma buoy + coastal met stations). Solid REST/JSON but **requires a free API key** (verified: keyless calls return `401 "No API key found"`). Worth it for one high-quality Bay-of-Palma marine wind source.
- **Windguru stations, WeatherLink/Davis, Ecowitt, Met Office WOW, Weather Underground PWS** — all have APIs but each is **own-station / contributor-keyed**, i.e. you can only read stations you own or are entitled to. Not viable as third-party public-station reads (details below).
- **Puertos del Estado / Portus** has real-time buoy wind but **no clean documented public JSON API**; the website backend returns HTML chart pages and the realtime variant 404s. Recommend getting Balearic buoy wind via **SOCIB** instead.

**Recommended shortlist (ranked):** 1) Holfuy → 2) Pioupiou/OpenWindMap → 3) SOCIB → 4) Meteoclimatic (fallback breadth).

---

## Comparison matrix

| Network | Balearics? | Tarifa? | Spain coast? | API base | Auth / key | Gust? | Dir? | History? | Rate limit | Personal-use OK? | Station discovery |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Holfuy** | Yes (kite spots) | **Yes** (Tarifa cluster) | Yes | `api.holfuy.com/live/` + `/archive/` | Free, **per-station password** by email | **Yes** (`gust`) | Yes | **Yes** (archive API) | "too many calls limited" (no number) | Yes (non-warranty, can be revoked) | Holfuy map → station IDs; request the IDs you want |
| **Pioupiou / OpenWindMap** | Some | Some | Some | `api.pioupiou.fr/v1/` | **Keyless, CORS `*`** | `wind_speed_max` (gust-ish) | Yes (`wind_heading`) | **Yes** (`/archive/`) | Be reasonable; community-funded | **Yes** (CC-style, attribution required) | `/v1/live/all` → full list w/ lat-lon; filter by bbox |
| **Meteoclimatic** | Yes (`ESIB…`) | Andalucía (`ESAND…`) | Yes (inland-heavy) | `meteoclimatic.net/feed/xml/{code}` | **Keyless** XML | weak (`max` only) | Yes (`azimuth`) | No (current-day only) | `ttl=60` hint; cache hard | **Yes** but **CC BY-NC-ND** (no-derivs — attribution + caution) | Regional codes: `ES`, `ESIB`, `ESAND`, province codes |
| **SOCIB** | **Yes** (Bay of Palma buoy + coastal met) | No | Balearics only | `api.socib.es/` (+ `/data-sources/`) | **Free key required** (signup) | likely | Yes | Yes (time-series) | Not published; cache | Yes (Open Data, attribution) | `/data-sources/?standard_variable=…` filtered by platform/var |
| **Puertos del Estado / Portus** | Yes (buoys) | Yes (Tarifa/strait buoys) | Yes | `portus.puertos.es/PortusData/…` | No key, **but no clean JSON** | n/a (HTML) | n/a | n/a | — | Risky (scrape-only) | Map codes; undocumented |
| **Windguru stations** | Yes | Yes | Yes | `windguru.cz/int/wgsapi.php` | **Own-station password only** | Yes | Yes | Yes | — | Not for 3rd-party reads | n/a |
| **WeatherLink / Davis** | Some clubs | Some | Some | `api.weatherlink.com/v2/` | **Key+secret, your stations only** | Yes | Yes | Yes | 300/hr, 15-min refresh (free) | Only stations on your account | n/a (account-scoped) |
| **Ecowitt** | Some PWS | Some | Some | `api.ecowitt.net/api/v3/` | **app_key + api_key + your MAC** | Yes | Yes | Yes | per-account | Only your devices | n/a |
| **Met Office WOW** | Few | Few | Some | `mowowprod.portal.azure-api.net` | Azure subscription key | Yes | Yes | Yes | per-subscription | Europe PWS, but Azure-keyed | Map/query by geocode |
| **Weather Underground PWS** | Some | Some | Some | `api.weather.com/v2/pws/…` | **Contributor key (must run a PWS)** | Yes | Yes | Yes | 1500/day, 30/min | Only if you contribute a station | geocode lookup |

---

## Network-by-network detail

### 1. Holfuy — RECOMMENDED #1  `[VERIFIED: live call 2026-05-27]`

**What:** Hungarian wind-station maker; their stations are everywhere at European kite/windsurf/paraglide spots, **including Tarifa and the Balearics**. The wynd.live Tarifa spots ("liam-whaley-pro-center", "spinout", "surfin-tarifa") are overwhelmingly backed by Holfuy hardware. This is the network that actually sits *on the water* at our spots.

**API (live):** `http://api.holfuy.com/live/` (https also works for `archive`)

Verified response for the public test station today:
```bash
curl "https://api.holfuy.com/live/?s=101&m=JSON&tu=C&su=km/h&loc"
# {"stationId":101,"stationName":"TestStation",
#  "location":{"latitude":"47.56","longitude":"19.01","altitude":225},
#  "dateTime":"2026-05-27 16:33:19",
#  "wind":{"speed":0,"gust":0,"min":0,"unit":"km/h","direction":300},
#  "humidity":32.4,"pressure":1015,"rain":0,"temperature":31.6}
```
Querying a non-permitted station returns:
```json
{"stationId":620,"error":"Sorry, you don't have access for this station.","errorCode":"no_access"}
```

**Params:** `s` (single, `s=101,102` multi, or `s=all` for *your permitted* set), `pw` (API password — POST-able), `m` = `JSON|CSV|XML`, `su` = `knots|km/h|m/s|mph`, `tu` = `C|F`, `avg` = `0`(newest)/`1`(15-min)/`2`(hourly), `loc`, `utc`, `batt`, `cam`.

**History:** `https://api.holfuy.com/archive/?s=102&pw=…&start_date=YYYY-MM-DD&stop_date=YYYY-MM-DD&m=JSON&utc` → time-series rows with `dateTime`, speed, gust, direction. Perfect for our graph. `[VERIFIED: archive doc 2026-05-27]`

**Auth / key model:** `[VERIFIED: Holfuy FAQ + support]` APIs are **not open by default** but Holfuy "can offer direct API access to one or more station's data **free of charge**." You email **`info@holfuy.hu`** with the station IDs you want; they issue a `pw`. So integration is: pick our target station IDs (Tarifa + Bay of Palma + Ibiza), request them once, store the password as a Supabase secret, fetch server-side.

**Rate limit / terms:** No published number — doc only warns "too many API calls in a short period limited." Terms: no warranty, access can be disabled anytime. **Our edge-cache + on-focus refresh model is exactly what they want.** Poll no faster than the station's report interval (~1–10 min); cache 5–10 min.

**Station discovery:** Browse `holfuy.com` map, zoom to Tarifa / Bay of Palma / Ibiza, read the numeric station IDs, then request that set. Also reverse-engineerable from wynd spot pages (the underlying IDs are Holfuy IDs) — but ask Holfuy for the IDs directly to stay legitimate.

**Gotchas:** Units default to **m/s** and **°C** — always pass `su`/`tu` explicitly. `s=all` only returns *permitted* stations, not the whole network. CSV is the default format — always pass `m=JSON`.

---

### 2. Pioupiou / OpenWindMap — RECOMMENDED #2  `[VERIFIED: live calls 2026-05-27]`

**What:** Community-funded open wind-sensor network (formerly Pioupiou, now under the OpenWindMap non-profit). Lightweight battery sensors at outdoor-sport spots. Coverage on *our exact* spots is patchier than Holfuy, but it is the **only fully keyless + CORS-open** option, and the open license makes it the safest to redistribute.

**API base:** `http://api.pioupiou.fr/v1/` — **no key, `Access-Control-Allow-Origin: *`**.

Live single station (verified):
```bash
curl "http://api.pioupiou.fr/v1/live/1"
# data.measurements: { wind_heading, wind_speed_avg, wind_speed_max, wind_speed_min, date }  (km/h)
# data.location: { latitude, longitude }  ; data.status: { state:"on"|... }
```
Whole network (verified — **use this for discovery**):
```bash
curl "http://api.pioupiou.fr/v1/live/all"   # array of every station w/ name + lat/lon + measurements
```
History (verified):
```bash
curl "http://api.pioupiou.fr/v1/archive/1?start=2017-11-14&stop=2017-11-15&format=json"
# legend: [time,lat,lon,wind_speed_min,wind_speed_avg,wind_speed_max,wind_heading,pressure]  units: km/h, degrees
```

**Gust:** No dedicated gust field — `wind_speed_max` over the reporting interval is the gust proxy (standard for these sensors). Direction = `wind_heading` (degrees). History resolution ~1 reading/min.

**Auth / rate / terms:** Keyless. Every response embeds `license` + `attribution` pointing at OpenWindMap — **you must display attribution**. Community-funded, so be modest: cache server-side, don't hammer `/live/all`. Personal non-commercial use is squarely fine.

**Station discovery:** Pull `/v1/live/all`, filter by bounding box (Balearics ≈ lat 38.6–40.1 / lon 1.1–4.4; Tarifa/strait ≈ lat 35.9–36.2 / lon −5.9…−5.4), keep `status.state === "on"`. Cache the filtered ID list.

**Gotchas:** `live/all` is a heavy payload — fetch it occasionally to build the ID list, then poll individual `/live/{id}` (or batch your known IDs). Units are **km/h**. Some legacy archives have a deprecated `pressure` column = null.

---

### 3. SOCIB — RECOMMENDED #3 (Bay-of-Palma marine quality)  `[VERIFIED: auth behaviour 2026-05-27]`

**What:** Balearic Islands Coastal Observing & Forecasting System (ICTS, CSIC + Balearic Govt). Operates the **Bay of Palma buoy**, coastal met stations and sea-level stations across the Balearics — calibrated, scientific-grade marine + met data (wind speed, wind direction, pressure). This is the authoritative *over-water* source for the Bay of Palma, complementing the OceanDrivers club stations.

**API base:** `https://api.socib.es/` — **HTTPS only** (http → 301). Verified:
```bash
curl "https://api.socib.es/data-sources/?limit=1"
# {"message":"No API key found in request"}   (HTTP 401)
```
**Auth:** Free **API key required** — sign up at socib.es, get key from your user profile, pass it per their scheme (header/param). `[CITED: api.socib.es/home/]`

**Data model:** Three layers — *data entries* (files), *data sources* (instrument/platform deployments), *data products* (programs). Filterable by `platform_type`, `instrument_type`, `standard_variable` (e.g. wind), `feature-type`, datetime range. Output JSON or netCDF. Swagger at `https://api.socib.es/swagger/`. `[CITED: api.socib.es/home/]`

**Coverage:** Balearics only (Western Med). No Tarifa, no Portugal. **Pursue specifically for a Bay-of-Palma marine-wind tile.**

**Terms:** Open Data / Open Science, attribution. Fine for personal use; cache (buoys update hourly, coastal met every 1–10 min).

**Discovery:** Query `/data-sources/` filtered to met/wind variables + Balearic platforms; identify the Bahía de Palma buoy + relevant coastal stations; pin their IDs. (Exact param names: confirm against Swagger after you have a key — flagged MEDIUM until then.)

---

### 4. Meteoclimatic — fallback breadth  `[VERIFIED: live call 2026-05-27]`

**What:** Large Spanish amateur PWS network (~hundreds of stations). Keyless XML. Covers all of Spain incl. Balearics and Andalucía — but stations are mostly **inland / residential**, so for *coastal watersports* it's a breadth fallback, not a primary.

**API:** `https://www.meteoclimatic.net/feed/xml/{code}` — verified:
```bash
curl "https://www.meteoclimatic.net/feed/xml/ESIB"   # all Illes Balears stations
# <station><id>ESIBA0700000107340E</id><location>…</location>
#   <stationdata><wind><unit>kmh</unit><now>6</now><azimuth>118</azimuth><max>15</max></wind> …
```
Region codes: `ES` (all Spain), `ESIB` (Illes Balears), `ESAND` (Andalucía), `ESCAT` (Catalunya), down to province codes (e.g. `ESCAT08` = Barcelona). One region per call; cannot list arbitrary multiple stations in one query.

**Wind fields:** `now` (current km/h), `max` (period max — use as a weak gust proxy), `azimuth` (direction °). **No true gust, no time-series** (current-day aggregate only). `QOS` field hints at data quality (0 = unrated).

**Terms:** **CC BY-NC-ND 3.0** — attribution required, non-commercial OK (personal app fine), **no-derivatives** clause means be careful about heavily transforming/relabelling the data; display it with attribution.

**Discovery:** Fetch `ESIB` / `ESAND` once, parse `<id>` + `<location>` + lat/lon, manually pick any that are actually coastal.

**Gotchas:** Encoding is `ISO-8859-15` (not UTF-8) — decode correctly. `ttl=60` and `pubDate` per station — respect it, cache hard. Uncalibrated amateur data; cross-check against Holfuy/AEMET before trusting for a launch decision.

---

### 5. Puertos del Estado / Portus — NOT RECOMMENDED as an API  `[VERIFIED: probing 2026-05-27]`

**What:** National ports authority; real-time buoy network (REDEXT/REDMAR) with wind speed/direction, incl. Balearic and Gibraltar-strait buoys near Tarifa — exactly the open-water data we'd love.

**Reality check:** No clean documented public JSON API. The website backend is `https://portus.puertos.es/PortusData/…`; `predChart` returns an **HTML chart page** (verified — `<!DOCTYPE html>…`), and the realtime variant `realTimeChart` **404s**. Community wrappers exist (Ruby gem `rgalindo33/puertos`, `pablopsp/portus`) but they scrape/poke undocumented endpoints. `bancodatos.puertos.es/BD/api/REDEXT/datos` 404'd in testing.

**Verdict:** Treat as scrape-only / undocumented — fails our "documented endpoint" bar. **Get Balearic open-water wind via SOCIB instead.** Revisit only if you find a stable documented JSON endpoint. `[LOW confidence — flagged]`

---

### 6. Own-station / contributor-keyed networks — NOT viable for 3rd-party reads

These all have good APIs but only let you read **stations you own or contribute**, so we cannot pull arbitrary public spots:

- **Windguru stations** `[VERIFIED: docs]` — `https://www.windguru.cz/int/wgsapi.php` requires `id_station` + the station's **API/admin password**. Explicitly *"for reading your own station data."* The public-facing Windguru is a forecast/widget product, not a third-party station-read API. (Note: Holfuy stations often *also* push to Windguru — so read them via Holfuy, not here.)
- **WeatherLink / Davis** `[VERIFIED: docs]` — `api.weatherlink.com/v2/` with `api-key` param + `x-api-secret` header. Free tier = 15-min refresh, **300 calls/hr**, but **only stations on your own account**. No way to read someone's club station without their credentials.
- **Ecowitt** `[VERIFIED: docs]` — `https://api.ecowitt.net/api/v3/device/real_time` needs `application_key` + `api_key` + your device `mac`. Your devices only.
- **Met Office WOW** `[VERIFIED: docs]` — REST/JSON on Azure (`mowowprod.portal.azure-api.net`) with a subscription key; covers European PWS incl. Spain, but it's a keyed portal and coverage at our specific kite spots is thin. Possible *future* breadth source; not a priority.
- **Weather Underground PWS** `[VERIFIED: docs]` — `api.weather.com/v2/pws/…`, 1500/day · 30/min free, **but the key is a contributor key — you must operate a PWS to get it.** Not usable unless we run a station.

---

### 7. AEMET (already integrated) — additional real-time wind

`[CITED: opendata.aemet.es]` Beyond what we use, AEMET OpenData exposes **`/observacion/convencional/todas`** and **`/observacion/convencional/datos/estacion/{idema}`** — the conventional observation network reports `vv` (wind speed), `vmax`/`racha` (gust), `dv` (direction) hourly. Many are coastal (airports/ports incl. Mallorca, Ibiza, Tarifa-area). Same two-step `datos`-URL fetch and 50 req/min limit as the rest of our AEMET usage — **no new key, cache the final JSON**. This is the cheapest "more coastal wind in Spain" win since the client already exists; just add an observations-by-station call and surface gust/direction. Updates ~hourly, so it's lower-resolution than Holfuy/Pioupiou.

---

## Recommended integration order (with exact sample calls)

1. **Holfuy** — email `info@holfuy.hu` for the Tarifa + Bay-of-Palma + Ibiza station IDs, store `pw` as a Supabase secret.
   `GET https://api.holfuy.com/live/?s={ids}&pw={PW}&m=JSON&su=knots&tu=C&loc&utc` → speed/gust/direction.
   History: `https://api.holfuy.com/archive/?s={id}&pw={PW}&start_date=YYYY-MM-DD&m=JSON&utc`.
2. **Pioupiou** — zero friction, ship alongside Holfuy.
   Discovery once: `GET http://api.pioupiou.fr/v1/live/all` → filter bbox. Per-station: `GET http://api.pioupiou.fr/v1/live/{id}`. History: `/v1/archive/{id}?start=…&stop=…`. **Show OpenWindMap attribution.**
3. **SOCIB** — register for a free key, add a Bay-of-Palma marine-wind tile.
   `GET https://api.socib.es/data-sources/?standard_variable=…&platform_type=…` (auth per profile key); confirm exact params in Swagger.
4. **Meteoclimatic** — optional breadth fallback.
   `GET https://www.meteoclimatic.net/feed/xml/ESIB` (and `ESAND`), parse coastal stations, **CC BY-NC-ND attribution**, decode ISO-8859-15.

---

## Cross-cutting gotchas

- **Units:** Holfuy & Meteoclimatic default to **m/s** / km/h; Pioupiou is **km/h**; AEMET is m/s. Normalize to your `WeatherConditions` unit in `normalize.ts` per source (watersports users expect **knots** — convert at the edge or in normalize, consistently).
- **Gust semantics differ:** Holfuy has a real `gust`; Pioupiou/Meteoclimatic only give interval `max`. Label accordingly so you don't present a 1-min max as a true gust.
- **Server-only / CORS:** Holfuy and Meteoclimatic are fine server-side (Supabase edge fn). Pioupiou is CORS-`*` (could even go direct) but route it through the edge cache for consistency. **Never put the Holfuy `pw` or SOCIB key in the client bundle** — these are real secrets, unlike the Phase-1 AEMET key. Keep them in Supabase secrets.
- **Caching:** Match TTL to report cadence — Holfuy/Pioupiou ~5 min, SOCIB buoys hourly / coastal ~10 min, Meteoclimatic respect `ttl=60`, AEMET obs hourly. These networks are donated/community/scientific infrastructure — over-polling is both rude and risks revocation (Holfuy explicitly reserves the right to cut access).
- **Terms / redistribution:** Pioupiou → attribution mandatory. Meteoclimatic → **CC BY-NC-ND** (non-commercial + no-derivatives — fine for a personal display app, but display, don't relabel/repackage). SOCIB → Open Data attribution. Holfuy → no warranty, revocable, no explicit redistribution grant — keep it a personal display, attribute the station.
- **Discovery friction:** Holfuy IDs are numeric and must be requested per-station (one email, done). Pioupiou/Meteoclimatic are self-serve via the all/region feeds. SOCIB needs the Swagger schema after key signup.
- **Don't bother with:** Windguru station API, WeatherLink, Ecowitt, WUnderground PWS (all own-station/contributor-keyed) and Portus (no clean JSON) — covered above.

---

## Sources

**Primary (HIGH — verified with live calls today, 2026-05-27):**
- Holfuy live API: `https://api.holfuy.com/live/` (verified station 101 JSON; `no_access` on un-permitted station) and archive doc `https://api.holfuy.com/archive/`
- Pioupiou: `http://api.pioupiou.fr/v1/live/1`, `/v1/live/all`, `/v1/archive/1` (all returned valid JSON + license/attribution)
- Meteoclimatic XML: `https://www.meteoclimatic.net/feed/xml/ESCAT`, `/ESIB` (wind now/max/azimuth confirmed)
- SOCIB auth: `https://api.socib.es/data-sources/` → `401 "No API key found"`
- Portus: `https://portus.puertos.es/PortusData/predChart…` returns HTML; `realTimeChart` 404 (no clean JSON)

**Secondary (MEDIUM — official docs / FAQ):**
- Holfuy FAQ + key model: <https://holfuy.com/en/faq>, key-by-email confirmed via support docs
- Holfuy live API params: <https://api.holfuy.com/live/>
- SOCIB API overview: <http://api.socib.es/home/> (key required, 3-layer model, Swagger at `/swagger/`)
- Windguru station JSON API: <https://stations.windguru.cz/json_api_stations.html> (own-station + password)
- WeatherLink v2 API: <https://weatherlink.github.io/v2-api/> (key+secret, 300/hr, your stations)
- Ecowitt v3: <https://api.ecowitt.net/api/v3/device/real_time> (app_key+api_key+mac)
- Met Office WOW: <https://mowowprod.portal.azure-api.net/> (Azure subscription key)
- Weather Underground PWS: <https://www.wunderground.com/pws/overview> (contributor key)
- Puertos del Estado / Portus: <https://portus.puertos.es/>, <https://portus.puertos.es/Portus/html/info/infotr.html>
- Pioupiou docs: <http://developers.pioupiou.fr/> (live, archive, licensing)

**Tertiary (LOW — flagged for validation):**
- Puertos del Estado community wrappers (`github.com/rgalindo33/puertos`, `github.com/pablopsp/portus`) — undocumented endpoint pokers; do not rely on.
- Exact SOCIB query param names for wind data sources — confirm against Swagger after key signup.
- AEMET conventional-observation gust/direction field availability per station — confirm against a real `idema` once querying.

## Metadata

**Confidence breakdown:**
- Holfuy / Pioupiou / Meteoclimatic: **HIGH** — live calls today returned expected data shapes.
- SOCIB / WeatherLink / Windguru / Ecowitt / WOW / WUnderground: **MEDIUM** — auth model and endpoint verified via docs (and SOCIB's 401 confirmed live), full data shape not exercised (keys required).
- Puertos del Estado: **LOW** — no documented JSON API found; HTML/404 responses confirm scrape-only.

**Research date:** 2026-05-27
**Valid until:** ~2026-06-27 (keyless APIs are stable; re-verify Holfuy key model and SOCIB Swagger before integration).
