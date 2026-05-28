# Forecast/Obs/Wind Archive

Append-only Supabase tables that capture what every model said vs what stations actually measured. Foundation for empirical model scoring and for promoting plausibility rules from heuristic to data-driven.

## Tables (sw_client_app)

| Table | Cadence | PK | Retention |
|---|---|---|---|
| `forecast_archive` | hourly (weather-refresh) | `(location_id, source, model, valid_time, issued_at)` | 90 days |
| `observation_archive` | hourly | `(location_id, station_source, station_id, observed_at)` | 365 days |
| `wind_stream` | 1-min (wind-archive) | `(station_id, observed_at)` | 30 days |

RLS enabled, anon-deny — service role only.

## Sources captured

| source | model | locations |
|---|---|---|
| `aemet` | `aemet` | ES only |
| `ipma` | `ipma` | PT only |
| `om` | `best_match` | all 5 |
| `om` | `dwd_icon_eu` | mainland + Balearics, Madrid, Lisboa (no Canary/Azores) |
| `om` | `meteofrance_arome_france` | Palma, Ibiza, Madrid only (France-coverage spillover) |
| `om` | `ecmwf_ifs025` | all 5 |
| `om` | `gfs_seamless` | all 5 |

OM model identifiers per docs as of 2026-05-28. If a deploy fails with `model not available`, refetch the list at https://open-meteo.com/en/docs (they rename periodically — `ecmwf_ifs04` → `ecmwf_ifs025`, `icon_eu` → `dwd_icon_eu`, etc.).

## Observations

- AEMET conventional station hourly readings (1 row per `fint`) — `aemet-obs` payload yields ~13 rows/loc/tick (covers last ~24h).
- OceanDrivers latest live reading — 1 row/tick when station active.

## Wind stream

`wind-archive` fires every minute, fetches `rcnp` (Real Club Náutico Palma) + `cmsap` (Can Pastilla) directly, dedupe by `(station_id, observed_at)` since OD's `TIME` field doesn't tick faster than 1-min in practice. 1440 rows/station/day, ~30 bytes each.

## Cron jobs (pg_cron)

| Job | Schedule | What |
|---|---|---|
| `weather-refresh-hourly` | `7 * * * *` | hourly prefetch + forecast/obs archive |
| `wind-archive-1min` | `* * * * *` | OD live → wind_stream |
| `archive-retention-nightly` | `17 3 * * *` | `archive_retention_sweep()` deletes rows past retention |

## Query patterns

### Per-model MAE per location (after ~1 week of data)
```sql
with truth as (
  select location_id, observed_at, temp_c, wind_kmh
  from observation_archive
  where observed_at > now() - interval '7 days'
)
select f.source, f.model,
  count(*) as pairs,
  round(avg(abs(f.temp_c - t.temp_c))::numeric, 2) as mae_temp,
  round(avg(abs(f.wind_kmh - t.wind_kmh))::numeric, 2) as mae_wind
from forecast_archive f
join truth t
  on t.location_id = f.location_id
 and date_trunc('hour', t.observed_at) = date_trunc('hour', f.valid_time)
where f.issued_at < t.observed_at - interval '3 hours'  -- lead time ≥3h
  and f.location_id = 'palma'
group by 1,2
order by mae_temp;
```

### Fog false-positive rate per model
```sql
select f.source, f.model,
  count(*) filter (where f.sky_code in ('Fog','Haze')) as fog_calls,
  count(*) filter (where f.sky_code in ('Fog','Haze') and t.rh < 90) as false_pos,
  round(100.0 * count(*) filter (where f.sky_code in ('Fog','Haze') and t.rh < 90)
        / nullif(count(*) filter (where f.sky_code in ('Fog','Haze')), 0), 1) as fp_pct
from forecast_archive f
join observation_archive t
  on t.location_id = f.location_id
 and date_trunc('hour', t.observed_at) = date_trunc('hour', f.valid_time)
where f.location_id = 'palma' and t.rh is not null
group by 1,2
having count(*) filter (where f.sky_code in ('Fog','Haze')) > 5;
```

### Lead-time decay
```sql
select extract(epoch from (f.valid_time - f.issued_at))/3600 as lead_h,
  round(avg(abs(f.temp_c - t.temp_c))::numeric, 2) as mae_temp
from forecast_archive f
join observation_archive t using (location_id)
where date_trunc('hour', t.observed_at) = date_trunc('hour', f.valid_time)
  and f.model in ('aemet','best_match','ecmwf_ifs025','dwd_icon_eu')
  and f.location_id = 'palma'
group by 1, f.model
order by 1, f.model;
```

## Next steps (deferred)

1. **First-month signal check** — query in Supabase SQL editor after ~30 days of ticks. Decide if blend weights are worth tuning.
2. **Promote plausibility rules** — current Fog check uses RH<90% + wind>10kt heuristic. Once archive has signal, derive the threshold empirically from `false_pos` query above.
3. **Per-lead-time blend** — replace fixed source precedence in `normalize.ts` with inverse-MAE weights stored in a small `blend_weights` table, recomputed weekly.
4. **UI surface** — eventually a small "model trust" badge ("AEMET wins for 3-hr lead here") in Detail view. Build only when signal proven.

## Storage notes

- forecast: 5 locs × ~6 models × ~48h × 24 ticks/day ≈ 35k rows/day, <2 MB/day with current schema. 90-day retention ~150 MB.
- observation: 5 locs × 24 readings × 24 ticks/day. The 24-readings comes from each AEMET-obs payload covering the past 24h (we upsert; only new fint values land). True row growth ~5 × 24/day = 120 rows/day. Trivial.
- wind_stream: 2 stations × 1440/day = 2880 rows/day. 30-day rolling = 86k rows, ~3 MB.

## Failure modes seen

- **AEMET model name typos**: rejected by OM silently, models just don't appear in the response. Verify via `select model, count(*) from forecast_archive` after a deploy.
- **AEMET hangs under concurrency**: handled by `aemetSlot(2)` gate in `_shared/weather-fetch.ts`. Don't raise concurrency.
- **AROME / ICON-EU coverage**: missing for Canary (AROME) and Azores (both) — expected, regional models. `omMultiToForecastRows` skips empty arrays so no fake rows.
- **AEMET wraps root in `[…]`**: the parser unwraps; `weather_cache` payload stores the wrapped form (consistent with on-disk shape).
