/**
 * history.ts — historical look-back via Open-Meteo's free archive API.
 *
 * Fetch the same calendar day a year ago (and N years ago) at the given lat/lon
 * → return temp max, temp min, rain total. Used for "last year on this day" chips.
 *
 * Cached in-memory + localStorage by `${date}@${lat,lon}` — historical data
 * never changes, so a long TTL is fine. 30-day localStorage TTL.
 */

const ARCHIVE_BASE = 'https://archive-api.open-meteo.com/v1/archive';
const CACHE_KEY_PREFIX = 'sw.weather.history:';
const TTL_MS = 30 * 24 * 3600_000;

export interface HistoryDay {
  date: string; // YYYY-MM-DD
  tempMax: number;
  tempMin: number;
  rainMm: number;
}

interface OmArchiveResponse {
  daily?: {
    time: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_sum?: number[];
  };
}

interface CacheEntry { v: HistoryDay; at: number; }

const mem = new Map<string, HistoryDay>();

function cacheKey(date: string, lat: number, lon: number): string {
  return `${date}@${lat.toFixed(2)},${lon.toFixed(2)}`;
}

function readCache(key: string): HistoryDay | undefined {
  if (mem.has(key)) return mem.get(key);
  try {
    const raw = globalThis.localStorage?.getItem(CACHE_KEY_PREFIX + key);
    if (!raw) return undefined;
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() - entry.at > TTL_MS) return undefined;
    mem.set(key, entry.v);
    return entry.v;
  } catch {
    return undefined;
  }
}

function writeCache(key: string, v: HistoryDay): void {
  mem.set(key, v);
  try {
    globalThis.localStorage?.setItem(CACHE_KEY_PREFIX + key, JSON.stringify({ v, at: Date.now() } satisfies CacheEntry));
  } catch { /* ignore */ }
}

/**
 * Get the historical day exactly N years before `ref`. Defaults to last year.
 * Returns undefined when the archive has no data (very recent date — archive
 * lags real-time by ~5 days).
 */
export async function getHistoryYearsAgo(ref: Date, lat: number, lon: number, years = 1): Promise<HistoryDay | undefined> {
  const yearsAgo = new Date(ref);
  yearsAgo.setFullYear(yearsAgo.getFullYear() - years);
  const date = yearsAgo.toISOString().slice(0, 10);
  const key = cacheKey(date, lat, lon);
  const cached = readCache(key);
  if (cached) return cached;
  try {
    const url = new URL(ARCHIVE_BASE);
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lon));
    url.searchParams.set('start_date', date);
    url.searchParams.set('end_date', date);
    url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_sum');
    url.searchParams.set('timezone', 'UTC');
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return undefined;
    const body = (await res.json()) as OmArchiveResponse;
    const d = body.daily;
    if (!d?.time?.length) return undefined;
    const v: HistoryDay = {
      date,
      tempMax: Math.round(d.temperature_2m_max?.[0] ?? 0),
      tempMin: Math.round(d.temperature_2m_min?.[0] ?? 0),
      rainMm: Math.round((d.precipitation_sum?.[0] ?? 0) * 10) / 10,
    };
    writeCache(key, v);
    return v;
  } catch {
    return undefined;
  }
}
