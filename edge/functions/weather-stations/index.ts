// weather-stations — live wind station network for the Wind view.
//   GET                       → { stations:[{...station, live}], at }   (all, cached live)
//   GET ?station=rcnp&history → { station, live, history }              (one + time-series)
// Live cached ~60s; history ~5min. Public forecast/measurement data, CORS open.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { oceanDriversLive, oceanDriversHistory } from '../_shared/weather-fetch.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};
const LIVE_TTL = 60_000;
const HISTORY_TTL = 5 * 60_000;

interface StationRow {
  id: string; name: string; place: string; region: string;
  lat: number; lon: number; source: string; ext_id: string; sort: number; active: boolean;
}

function fetchLive(source: string, extId: string) {
  if (source === 'oceandrivers') return oceanDriversLive(extId);
  return Promise.reject(new Error(`unknown source ${source}`));
}
function fetchHistory(source: string, extId: string) {
  if (source === 'oceandrivers') return oceanDriversHistory(extId);
  return Promise.reject(new Error(`unknown source ${source}`));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const url = new URL(req.url);
    const stationId = url.searchParams.get('station');
    const wantHistory = url.searchParams.has('history');
    const metaOnly = url.searchParams.has('meta');
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Fast path: registry metadata only (no upstream fetches). The client polls
    // live readings directly from the source for real-time, so it doesn't need
    // the proxy to fetch live here — this is a sub-100ms DB read.
    if (metaOnly) {
      const { data: stations } = await supabase
        .from('weather_stations').select('*').eq('active', true).order('sort').returns<StationRow[]>();
      return json({ stations: stations ?? [], at: new Date().toISOString() });
    }

    // Helper: read a station's cached `kind`, refetch if missing/stale, return payload.
    async function cached(st: StationRow, kind: 'live' | 'history', ttl: number): Promise<unknown> {
      const { data: row } = await supabase
        .from('weather_station_cache')
        .select('payload, fetched_at')
        .eq('station_id', st.id).eq('kind', kind).maybeSingle();
      if (row && Date.now() - new Date(row.fetched_at).getTime() < ttl) return row.payload;
      try {
        const payload = kind === 'live' ? await fetchLive(st.source, st.ext_id) : await fetchHistory(st.source, st.ext_id);
        await supabase.from('weather_station_cache').upsert(
          { station_id: st.id, kind, payload, fetched_at: new Date().toISOString() },
          { onConflict: 'station_id,kind' },
        );
        return payload;
      } catch {
        return row?.payload ?? null; // serve stale on upstream failure
      }
    }

    // Single station + history (detail sheet).
    if (stationId) {
      const { data: st } = await supabase.from('weather_stations').select('*').eq('id', stationId).single<StationRow>();
      if (!st) return json({ error: 'unknown station' }, 404);
      const [live, history] = await Promise.all([
        cached(st, 'live', LIVE_TTL),
        wantHistory ? cached(st, 'history', HISTORY_TTL) : Promise.resolve(undefined),
      ]);
      return json({ station: st, live, history });
    }

    // All active stations + live (grid).
    const { data: stations } = await supabase
      .from('weather_stations').select('*').eq('active', true).order('sort').returns<StationRow[]>();
    const withLive = await Promise.all(
      (stations ?? []).map(async (st) => ({ ...st, live: await cached(st, 'live', LIVE_TTL) })),
    );
    return json({ stations: withLive, at: new Date().toISOString() });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'unknown error' }, 500);
  }
});
