// weather-refresh — cron-invoked prefetch. Iterates weather_locations and
// refreshes their weather_cache so client reads are always warm. Runs at the
// providers' update cadence (see pg_cron schedule). Processes locations
// SEQUENTIALLY to stay gentle on AEMET (which hangs under concurrency).
//
// Also feeds the archive tables (forecast_archive, observation_archive) for
// per-model accuracy scoring — multi-model OM fan-out happens here so each
// hourly tick captures what every model said for the next 48h.
//
// Secured by a shared secret header (REFRESH_SECRET) so only the cron can invoke
// it — pg_cron passes it; the public can't trigger refreshes.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  fetchAllForLocation, omForecastMulti, type LocationRow,
} from '../_shared/weather-fetch.ts';
import {
  aemetHourlyToForecastRows, aemetObsToRows, ipmaDailyToForecastRows,
  oceanDriversLiveToObsRow, omMultiToForecastRows,
  type ForecastRow, type ObservationRow,
} from '../_shared/archive.ts';

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

  const results: Record<string, { cached: number; forecast_rows: number; obs_rows: number }> = {};
  for (const loc of locations) {
    try {
      const fresh = await fetchAllForLocation(loc, aemetKey);
      const upserts = Object.entries(fresh)
        .filter(([, v]) => v != null)
        .map(([kind, payload]) => ({ location_id: loc.id, kind, payload, fetched_at: new Date().toISOString() }));
      if (upserts.length) {
        await supabase.from('weather_cache').upsert(upserts, { onConflict: 'location_id,kind' });
      }

      // ── Archive: forecast (per-model) + observations ──────────────────────
      const issued_at = new Date().toISOString();
      const fRows: ForecastRow[] = [];
      const oRows: ObservationRow[] = [];

      // AEMET hourly (ES) → single 'aemet' model row series
      if (fresh['aemet-hourly']) {
        fRows.push(...aemetHourlyToForecastRows(loc.id, issued_at, fresh['aemet-hourly']));
      }
      // IPMA daily (PT)
      if (fresh['ipma-daily']) {
        fRows.push(...ipmaDailyToForecastRows(loc.id, issued_at, fresh['ipma-daily']));
      }
      // Open-Meteo multi-model: extra call, separate from cache (cache holds
      // best_match only). Failures don't kill the refresh.
      try {
        const multi = await omForecastMulti(loc.lat, loc.lon, loc.timezone);
        fRows.push(...omMultiToForecastRows(loc.id, issued_at, multi));
      } catch (e) {
        console.warn(`om-multi ${loc.id} failed:`, e instanceof Error ? e.message : e);
      }

      // Observations: AEMET station + OceanDrivers live
      if (fresh['aemet-obs'] && loc.aemet_station) {
        oRows.push(...aemetObsToRows(loc.id, loc.aemet_station, fresh['aemet-obs']));
      }
      if (fresh.oceandrivers && loc.oceandrivers_station) {
        const r = oceanDriversLiveToObsRow(loc.id, loc.oceandrivers_station, fresh.oceandrivers);
        if (r) oRows.push(r);
      }

      // Batched upserts (chunk to avoid PostgREST payload limits)
      const chunked = async <T>(arr: T[], table: string, onConflict: string) => {
        const size = 500;
        for (let i = 0; i < arr.length; i += size) {
          const slice = arr.slice(i, i + size);
          const { error: e } = await supabase.from(table).upsert(slice, { onConflict });
          if (e) console.error(`${table} upsert chunk failed:`, e.message);
        }
      };
      if (fRows.length) await chunked(fRows, 'forecast_archive', 'location_id,source,model,valid_time,issued_at');
      if (oRows.length) await chunked(oRows, 'observation_archive', 'location_id,station_source,station_id,observed_at');

      results[loc.id] = { cached: upserts.length, forecast_rows: fRows.length, obs_rows: oRows.length };
    } catch (e) {
      results[loc.id] = { cached: -1, forecast_rows: 0, obs_rows: 0 };
      console.error(`refresh ${loc.id} failed:`, e instanceof Error ? e.message : e);
    }
  }

  return new Response(JSON.stringify({ refreshed: results, at: new Date().toISOString() }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
