/**
 * useWeather — fetch + cache a normalized WeatherConditions bundle for a location.
 * Exposes the { data, error, loading } shape the views render against.
 *
 * Caching: the assembled bundle is cached per location (short TTL — the underlying
 * source clients also cache their raw payloads at source-appropriate TTLs). On a
 * cache miss we fetch + normalize; on error we fall back to a stale cached bundle
 * if one exists (offline last-known), flagged via `stale`.
 *
 * No timer polling (AEMET 50/min budget) — refresh is user-triggered via refetch.
 */

import { useCallback, useEffect, useState } from 'react';
import type { Location, WeatherConditions } from '@/types/weather';
import { cacheGet, cacheGetAllowStale, cacheKey, cacheSet } from '@/utils/cache';
import { getWeather } from '@/services/normalize';

const BUNDLE_TTL = 10 * 60 * 1000; // 10 min — matches INTEGRATION.md hourly cache hint

export interface UseWeatherResult {
  data: WeatherConditions | null;
  error: string | null;
  loading: boolean;
  stale: boolean;
  refetch: () => void;
}

export function useWeather(location: Location | null): UseWeatherResult {
  const [data, setData] = useState<WeatherConditions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [stale, setStale] = useState(false);

  const load = useCallback(
    async (loc: Location, force = false) => {
      const key = cacheKey('bundle', 'weather', loc.id);

      if (!force) {
        const cached = cacheGet<WeatherConditions>(key);
        if (cached) {
          setData(reviveDates(cached));
          setStale(false);
          setError(null);
          return;
        }
      }

      setLoading(true);
      setError(null);
      try {
        const bundle = await getWeather(loc);
        cacheSet(key, bundle, BUNDLE_TTL);
        setData(bundle);
        setStale(false);
      } catch (e) {
        const stalest = cacheGetAllowStale<WeatherConditions>(key);
        if (stalest) {
          setData(reviveDates(stalest.value));
          setStale(true);
        }
        setError(e instanceof Error ? e.message : 'Failed to load weather');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (location) void load(location);
  }, [location, load]);

  const refetch = useCallback(() => {
    if (location) void load(location, true);
  }, [location, load]);

  return { data, error, loading, stale, refetch };
}

/**
 * JSON round-trips through localStorage turn Date fields into ISO strings. Revive
 * the ones the views treat as Dates so `.getTime()` etc. work after a cache read.
 */
function reviveDates(b: WeatherConditions): WeatherConditions {
  const d = (x: unknown) => (typeof x === 'string' ? new Date(x) : (x as Date));
  return {
    ...b,
    current: { ...b.current, observedAt: d(b.current.observedAt) },
    hours: b.hours.map((h) => ({ ...h, time: d(h.time) })),
    days: b.days.map((day) => ({ ...day, date: d(day.date), sunrise: d(day.sunrise), sunset: d(day.sunset) })),
    sun: Object.fromEntries(
      Object.entries(b.sun).map(([k, v]) => [k, typeof v === 'string' ? new Date(v) : v]),
    ) as WeatherConditions['sun'],
    moon: {
      ...b.moon,
      moonrise: b.moon.moonrise ? d(b.moon.moonrise) : null,
      moonset: b.moon.moonset ? d(b.moon.moonset) : null,
    },
  };
}
