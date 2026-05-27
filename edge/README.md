# Edge functions (SW Weather proxy)

Source of record for the Supabase edge functions that proxy + cache weather data.
See [../.planning/EDGE-PROXY.md](../.planning/EDGE-PROXY.md) for the full design.

**Deployed to:** the `sw_client_app` Supabase project (`jmsvejlsbijpbeoxnkrs`) — the
eventual integration host. The live copies live in
`sw-client-app/supabase/functions/`; these are mirrored here because sw-weather-app
is the app that depends on them.

## Functions
- **`weather-get`** — client-facing read. `GET ?locationId=<id>` → `{ location,
  payloads: { kind: rawPayload }, fetchedAt }`. Serves from `weather_cache`;
  fetches upstream once on miss/stale. `verify_jwt: false` (public forecast data).
- **`_shared/weather-fetch.ts`** — the AEMET (two-step, timeout, concurrency 2) /
  IPMA / Open-Meteo fetchers. Returns RAW payloads; the client normalizes.
- **`weather-refresh`** (TODO) — cron-invoked prefetch to keep the cache warm.

## Secrets (set on the Supabase project, NOT in any repo)
- `AEMET_API_KEY` — required for ES locations. Set via dashboard → Edge Function
  secrets, or `supabase secrets set AEMET_API_KEY=… --project-ref jmsvejlsbijpbeoxnkrs`.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — auto-injected by Supabase.
- IPMA / Open-Meteo need no key.

## Tables (in sw_client_app public schema, namespaced weather_*)
- `weather_locations` — locations the proxy serves/prefetches (seeded from the
  client's SEED_LOCATIONS). Public read.
- `weather_cache` — `(location_id, kind) → payload, fetched_at`. Public read,
  service-role write.

## Redeploy
Via the Supabase MCP `deploy_edge_function`, or the CLI:
`supabase functions deploy weather-get --project-ref jmsvejlsbijpbeoxnkrs`
(include the `_shared/` file).
