# Edge Proxy + Scheduled Prefetch — Plan

**Goal:** Stop every client device hitting AEMET/IPMA/Open-Meteo directly. A Supabase
edge function fetches upstream **server-side**, caches normalized bundles, and a
cron prefetches at the providers' real update cadence so client reads are instant.
Also fixes: the AEMET connection-hang/IP-block (one server fetches, not N devices)
and the slow cold load.

**Project:** `sw_client_app` (`jmsvejlsbijpbeoxnkrs`) — the eventual integration host.
**Strategy:** scheduled prefetch (cron) — cache always warm.

## Why this matters (evidence)
- AEMET hangs sockets under concurrent load (observed: parallel reqs stall ~30s,
  one returned http 000 after 30.003s) and temporarily **blocks the IP** after
  burst traffic (hit during testing). N client devices × bursts = repeated blocks.
- Forecasts update only a few times a day, so per-device live fetching is wasteful.

## Update cadence (drives the cron schedule)
- **AEMET municipal forecast:** model runs 00/06/12/18 UTC; OpenData publishes a
  few hours later. Practically refresh ~**4×/day**. Prefetch at ~03/09/15/21 local.
- **AEMET station observation:** ~hourly. Prefetch hourly (cheap, 1 call/loc).
- **IPMA city daily:** ~2×/day (~10:00 & ~20:00 Lisbon). Prefetch 2×/day.
- **Open-Meteo (hourly backfill / marine / AQ):** hourly model cadence; prefetch
  every 1–3h.
Conservative union: a cron every hour that refreshes anything past its TTL.

## Architecture

```
pg_cron (hourly) ─► edge fn `weather-refresh` ─► fetch AEMET/IPMA/OM (low concurrency)
                                               └─► upsert weather_cache (raw payloads + fetchedAt)

client useWeather ─► edge fn `weather-get?locationId=…` ─► read weather_cache ─► return
                                               (cache miss → fetch once, store, return)
```

### Where normalization happens — DECISION
Keep **raw provider payloads in the cache**; the **client normalizes** via the
existing `normalize.ts`. Rationale:
- Avoids porting the whole normalize layer (AEMET period-parsing, sky-code map,
  blend, provenance) to Deno and keeping two copies in sync.
- `suncalc` sun/moon is client-side anyway (no network, needs location).
- The edge fn stays thin: fetch + store + serve raw JSON. Normalize stays one place.
- Trade-off: payloads are a bit bigger over the wire than a normalized bundle, but
  they're cached and gzipped — fine.

So the proxy is a **transport + cache layer**, not a transform layer. `normalize.ts`
changes only its *source*: instead of calling `aemet.ts`/`ipma.ts`/`openMeteo.ts`
directly, it calls one `proxy.ts` client that returns `{ aemet:{hourly,daily,obs}, ipma:{…}, openMeteo:{…} }` for a location.

## Data model (in sw_client_app Postgres)

```sql
-- locations the cron should keep warm (server-side mirror of saved locations)
create table weather_locations (
  id text primary key,            -- 'palma'
  country text not null,          -- 'ES' | 'PT'
  lat double precision not null,
  lon double precision not null,
  timezone text not null,
  aemet_municipio text,
  aemet_station text,
  ipma_global_id_local int,
  is_coastal boolean default false,
  updated_at timestamptz default now()
);

-- cached raw provider payloads, one row per (location, kind)
create table weather_cache (
  location_id text not null,
  kind text not null,             -- 'aemet-hourly' | 'aemet-daily' | 'aemet-obs'
                                   -- | 'ipma-daily' | 'ipma-sea' | 'om-forecast'
                                   -- | 'om-marine' | 'om-aq'
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  primary key (location_id, kind)
);
```
RLS: `weather_cache` + `weather_locations` readable by anon (public forecast data);
writable only by the service role (the edge fn). No user data here.

## Edge functions (Deno, in sw_client_app/supabase/functions/)
1. **`weather-refresh`** (cron-invoked): for each `weather_locations` row whose
   relevant `weather_cache` rows are stale, fetch upstream (AEMET 2-step w/ 8s
   timeout + concurrency 2; IPMA; OM) and upsert. Idempotent; safe to over-run.
2. **`weather-get`** (client-invoked): `?locationId=…` → read all cache rows for
   the location, return `{ kind: payload }`. On miss, fetch-once inline + store.

Secrets: `AEMET_API_KEY` as a Supabase function secret (NOT in client). IPMA/OM keyless.

## Client changes
- `src/services/proxy.ts` — calls `weather-get`, returns the raw-payload bundle.
- `normalize.ts` — source the raw payloads from `proxy.ts` instead of the direct
  clients. (The direct `aemet.ts`/`ipma.ts`/`openMeteo.ts` stay for the edge fn to
  reuse the fetch logic, and as a fallback.)
- Add Supabase client (`@supabase/supabase-js`) + env: `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY` (public). Drop `VITE_AEMET_API_KEY` from the client.
- The throttle/timeout in `aemet.ts` stays relevant for the edge fn (Deno runs the
  same fetch logic) and as a client fallback.

## AEMET station observations (current conditions) — folds in here
- New `aemet-obs` kind: `/observacion/convencional/datos/estacion/{station}`.
- Station IDs: Palma B228 known; others TBD via `/observacion/convencional/todas`
  (nearest by haversine — do this once, store in `weather_locations`).
- normalize: `current` comes from the station obs when present (measured), else the
  nearest forecast hour. Provenance badge: station obs = `aemet` / `high`.

## Build order
1. SQL: tables + RLS + seed `weather_locations` from SEED_LOCATIONS.
2. `weather-get` edge fn (on-demand fetch+cache) + deploy. Port aemet/ipma/om fetch
   to Deno (share shapes with the TS clients).
3. Client: `proxy.ts` + rewire `normalize.ts` + Supabase client + env. Verify Today.
4. `aemet-obs` + station-id lookup; wire `current` to measured obs.
5. `weather-refresh` + pg_cron schedule. Verify cache stays warm.
6. Remove client-side AEMET key.

## Open questions / risks
- **AEMET IP block:** must wait for it to clear before live testing (caused by test
  bursts). The proxy makes future blocks unlikely (single low-concurrency fetcher).
- **Station coverage:** not every municipio has a close station; fall back to forecast.
- **Cold deploy secret:** AEMET key must be set as a function secret before deploy.
- **Integration:** since this lives in sw_client_app, namespace tables `weather_*`
  to avoid collision with the Client App's own schema.

## Decision log
- 2026-05-27: proxy in sw_client_app (shared backend, integration target).
- 2026-05-27: scheduled prefetch via pg_cron (cache always warm), not on-demand-only.
- 2026-05-27: proxy caches RAW payloads; client keeps normalizing (one source of truth).
- 2026-05-27: AEMET station obs for current conditions, folded into the proxy.
