// wind-archive — 1-min cron-invoked sampler for live wind stations.
//
// Hits OceanDrivers DIRECTLY (no proxy, no cache) so each sample is the latest
// reading available, not a 60s-stale copy. Inserts one row per station per tick
// into wind_stream — 1440 rows/station/day, ~30 bytes each.
//
// Bay of Palma only for now: rcnp (Real Club Náutico Palma) + cmsap (San
// Antoni, Can Pastilla). Add stations here as the watersports map grows.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { oceanDriversLive } from '../_shared/weather-fetch.ts';
import { oceanDriversLiveToWindStreamRow, type WindStreamRow } from '../_shared/archive.ts';

const STATIONS = ['rcnp', 'cmsap'];

Deno.serve(async (req) => {
  const secret = Deno.env.get('REFRESH_SECRET');
  if (secret && req.headers.get('x-refresh-secret') !== secret) {
    return new Response('forbidden', { status: 403 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const rows: WindStreamRow[] = [];
  const result: Record<string, string> = {};
  await Promise.all(
    STATIONS.map(async (id) => {
      try {
        const live = await oceanDriversLive(id);
        const row = oceanDriversLiveToWindStreamRow(id, live);
        if (row) { rows.push(row); result[id] = 'ok'; }
        else { result[id] = 'no-reading'; }
      } catch (e) {
        result[id] = e instanceof Error ? e.message : String(e);
      }
    }),
  );

  if (rows.length) {
    // ON CONFLICT DO NOTHING: same observed_at second from a re-run is a no-op.
    const { error } = await supabase
      .from('wind_stream')
      .upsert(rows, { onConflict: 'station_id,observed_at', ignoreDuplicates: true });
    if (error) console.error('wind_stream upsert failed:', error.message);
  }

  return new Response(JSON.stringify({ inserted: rows.length, stations: result, at: new Date().toISOString() }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
