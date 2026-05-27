// weather-refresh — cron-invoked prefetch. Iterates weather_locations and
// refreshes their weather_cache so client reads are always warm. Runs at the
// providers' update cadence (see pg_cron schedule). Processes locations
// SEQUENTIALLY to stay gentle on AEMET (which hangs under concurrency).
//
// Secured by a shared secret header (REFRESH_SECRET) so only the cron can invoke
// it — pg_cron passes it; the public can't trigger refreshes.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fetchAllForLocation, type LocationRow } from '../_shared/weather-fetch.ts';

Deno.serve(async (req) => {
  const secret = Deno.env.get('REFRESH_SECRET');
  if (secret && req.headers.get('x-refresh-secret') !== secret) {
    return new Response('forbidden', { status: 403 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const aemetKey = Deno.env.get('AEMET_API_KEY') ?? '';

  const { data: locations, error } = await supabase.from('weather_locations').select('*').returns<LocationRow[]>();
  if (error || !locations) {
    return new Response(JSON.stringify({ error: error?.message ?? 'no locations' }), { status: 500 });
  }

  const results: Record<string, number> = {};
  for (const loc of locations) {
    try {
      const fresh = await fetchAllForLocation(loc, aemetKey);
      const upserts = Object.entries(fresh)
        .filter(([, v]) => v != null)
        .map(([kind, payload]) => ({ location_id: loc.id, kind, payload, fetched_at: new Date().toISOString() }));
      if (upserts.length) {
        await supabase.from('weather_cache').upsert(upserts, { onConflict: 'location_id,kind' });
      }
      results[loc.id] = upserts.length;
    } catch (e) {
      results[loc.id] = -1;
      console.error(`refresh ${loc.id} failed:`, e instanceof Error ? e.message : e);
    }
  }

  return new Response(JSON.stringify({ refreshed: results, at: new Date().toISOString() }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
