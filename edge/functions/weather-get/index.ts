// weather-get — client-facing read endpoint for the SW Weather proxy.
// GET ?locationId=palma → { location, payloads: { kind: rawPayload }, fetchedAt: {...} }
//
// Serves from weather_cache. On a miss or when entries are stale (past their
// per-kind TTL), fetches upstream ONCE (low concurrency), upserts, and returns.
// The cron (weather-refresh) normally keeps the cache warm so this is a pure read.
//
// No auth required: forecast data is public. CORS open so the PWA can call it.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fetchAllForLocation, type LocationRow, type WeatherKind } from '../_shared/weather-fetch.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

// Per-kind freshness windows (ms). Matches provider update cadence.
const TTL: Record<WeatherKind, number> = {
  'aemet-hourly': 3 * 3600_000,
  'aemet-daily': 3 * 3600_000,
  'aemet-obs': 30 * 60_000,
  'ipma-daily': 6 * 3600_000,
  'ipma-sea': 6 * 3600_000,
  'om-forecast': 1 * 3600_000,
  'om-marine': 1 * 3600_000,
  'om-aq': 1 * 3600_000,
  'oceandrivers': 5 * 60_000,
  'oceandrivers-history': 10 * 60_000,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const locationId = new URL(req.url).searchParams.get('locationId');
    if (!locationId) return json({ error: 'missing locationId' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let { data: loc, error: locErr } = await supabase
      .from('weather_locations')
      .select('*')
      .eq('id', locationId)
      .single<LocationRow>();

    // Auto-register a user-added location when the row doesn't exist yet but
    // the client passed enough metadata. The cron then picks it up next tick.
    if ((locErr || !loc)) {
      const url = new URL(req.url);
      const lat = Number(url.searchParams.get('lat'));
      const lon = Number(url.searchParams.get('lon'));
      const country = url.searchParams.get('country');
      const name = url.searchParams.get('name');
      const tz = url.searchParams.get('tz');
      const region = url.searchParams.get('region') ?? name ?? '';
      if (Number.isFinite(lat) && Number.isFinite(lon) && country && name && tz) {
        const candidate: LocationRow = {
          id: locationId,
          country: country as 'ES' | 'PT',
          lat, lon, timezone: tz,
          aemet_municipio: null, aemet_station: null,
          ipma_global_id_local: null, oceandrivers_station: null,
          is_coastal: false,
        };
        const { error: insErr } = await supabase.from('weather_locations').insert({
          id: locationId, name, region,
          country, lat, lon, timezone: tz,
          aemet_municipio: null, aemet_station: null,
          ipma_global_id_local: null, oceandrivers_station: null,
          is_coastal: false,
        });
        if (insErr) return json({ error: `register failed: ${insErr.message}` }, 500);
        loc = candidate;
        locErr = null;
      } else {
        return json({ error: 'unknown location' }, 404);
      }
    }

    const { data: rows } = await supabase
      .from('weather_cache')
      .select('kind, payload, fetched_at')
      .eq('location_id', locationId);

    const now = Date.now();
    const payloads: Record<string, unknown> = {};
    const fetchedAt: Record<string, string> = {};
    let stale = false;
    for (const r of rows ?? []) {
      payloads[r.kind] = r.payload;
      fetchedAt[r.kind] = r.fetched_at;
      const ttl = TTL[r.kind as WeatherKind] ?? 3600_000;
      if (now - new Date(r.fetched_at).getTime() > ttl) stale = true;
    }

    // Cache miss or stale → fetch once and upsert.
    if (!rows || rows.length === 0 || stale) {
      const aemetKey = Deno.env.get('AEMET_API_KEY') ?? '';
      const fresh = await fetchAllForLocation(loc, aemetKey);
      const upserts = Object.entries(fresh)
        .filter(([, v]) => v != null)
        .map(([kind, payload]) => ({ location_id: locationId, kind, payload, fetched_at: new Date().toISOString() }));
      if (upserts.length) {
        await supabase.from('weather_cache').upsert(upserts, { onConflict: 'location_id,kind' });
        for (const u of upserts) {
          payloads[u.kind] = u.payload;
          fetchedAt[u.kind] = u.fetched_at;
        }
      }
    }

    return json({ location: loc, payloads, fetchedAt });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'unknown error' }, 500);
  }
});
