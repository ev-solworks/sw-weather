/**
 * IPMA client (Portugal + Atlantic islands). Free, no key. Returns source-shaped
 * data; normalize.ts maps it into `WeatherConditions`.
 *
 * Live-verified 2026-05-27 (Lisboa city 1110600, Lisboa coast 1111026):
 * - All numeric values are STRINGS (`tMin: "20.0"`, `precipitaProb: "0.0"`).
 * - City daily forecast is **daily only** — no hourly in the public feed. The
 *   normalize layer fills hourly granularity from Open-Meteo for PT locations.
 * - `idWeatherType` (int) maps to text via `/weather-type-classe.json` (cache 24h).
 * - Marine (waves/SST) is a SEPARATE product keyed by a SEA globalIdLocal (from
 *   `/sea-locations.json`), NOT the city globalIdLocal. The forecast files are
 *   aggregate per day-offset: `…/oceanography/daily/hp-daily-sea-forecast-day{N}.json`
 *   lists all coastal points; filter by globalIdLocal. Wave/SST come as min/max ranges.
 * - Times/dates are UTC.
 */

import { cacheGet, cacheKey, cacheSet, TTL } from '@/utils/cache';

const BASE = 'https://api.ipma.pt/open-data';

export class IpmaError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'IpmaError';
    this.status = status;
  }
}

// ── Source-shaped types ──────────────────────────────────────────────────────

export interface IpmaDailyDay {
  forecastDate: string; // 'YYYY-MM-DD' (UTC)
  tMin: string; // °C
  tMax: string; // °C
  precipitaProb: string; // 0–100 %
  predWindDir: string; // 'N' | 'NW' | …
  idWeatherType: number; // → weather-type lookup
  classWindSpeed: number; // 1–5 ordinal
  latitude: string;
  longitude: string;
}

interface IpmaDailyResponse {
  globalIdLocal: number;
  dataUpdate: string;
  data: IpmaDailyDay[];
}

export interface IpmaSeaDay {
  globalIdLocal: number;
  waveHighMin: string; // m
  waveHighMax: string; // m
  wavePeriodMin: string; // s
  wavePeriodMax: string; // s
  predWaveDir: string; // 'N' | 'NW' | …
  sstMin: string; // °C
  sstMax: string; // °C
  totalSeaMin: number;
  totalSeaMax: number;
}

interface IpmaWeatherType {
  idWeatherType: number;
  descWeatherTypeEN: string;
  descWeatherTypePT: string;
}

interface IpmaSeaLocation {
  globalIdLocal: number;
  idLocal: number;
  local: string;
  latitude: string;
  longitude: string;
}

// ── Fetch primitive ──────────────────────────────────────────────────────────

async function ipmaFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new IpmaError(`IPMA ${path} failed`, res.status);
  return (await res.json()) as T;
}

// ── Public API ───────────────────────────────────────────────────────────────

/** 5-day daily city forecast. `globalIdLocal` is the CITY id (e.g. 1110600). */
export async function fetchDaily(globalIdLocal: number): Promise<IpmaDailyDay[]> {
  const res = await ipmaFetch<IpmaDailyResponse>(
    `/forecast/meteorology/cities/daily/${globalIdLocal}.json`,
  );
  return res.data;
}

/**
 * Marine forecast for a SEA globalIdLocal, for day offsets 0..days-1. IPMA serves
 * one aggregate file per day-offset; we fetch each, filter to our point, and return
 * the matched entry per day (or null if absent that day).
 */
export async function fetchSea(seaGlobalIdLocal: number, days = 3): Promise<(IpmaSeaDay | null)[]> {
  const out: (IpmaSeaDay | null)[] = [];
  for (let day = 0; day < days; day++) {
    const list = await ipmaFetch<{ data?: IpmaSeaDay[] } | IpmaSeaDay[]>(
      `/forecast/oceanography/daily/hp-daily-sea-forecast-day${day}.json`,
    ).catch(() => null);
    const data = Array.isArray(list) ? list : (list?.data ?? []);
    out.push(data.find((d) => d.globalIdLocal === seaGlobalIdLocal) ?? null);
  }
  return out;
}

/** Weather-type id → EN/PT descriptions. Cached 24h (rarely changes). */
export async function fetchWeatherTypes(): Promise<Map<number, IpmaWeatherType>> {
  const key = cacheKey('ipma', 'weather-types', 'global');
  const cached = cacheGet<IpmaWeatherType[]>(key);
  const items =
    cached ??
    (await ipmaFetch<{ data: IpmaWeatherType[] }>(`/weather-type-classe.json`)).data;
  if (!cached) cacheSet(key, items, TTL.lookupTable);
  return new Map(items.map((it) => [it.idWeatherType, it]));
}

/** Coastal sea points, for mapping a city/coords to its nearest SEA globalIdLocal. Cached 24h. */
export async function fetchSeaLocations(): Promise<IpmaSeaLocation[]> {
  const key = cacheKey('ipma', 'sea-locations', 'global');
  const cached = cacheGet<IpmaSeaLocation[]>(key);
  if (cached) return cached;
  const res = await ipmaFetch<{ data?: IpmaSeaLocation[] } | IpmaSeaLocation[]>(`/sea-locations.json`);
  const items = Array.isArray(res) ? res : (res.data ?? []);
  cacheSet(key, items, TTL.lookupTable);
  return items;
}

/** Nearest sea globalIdLocal to a coordinate (haversine), or null if none. */
export async function nearestSeaLocation(lat: number, lon: number): Promise<number | null> {
  const seas = await fetchSeaLocations();
  let best: { id: number; d: number } | null = null;
  for (const s of seas) {
    const d = haversine(lat, lon, Number(s.latitude), Number(s.longitude));
    if (!best || d < best.d) best = { id: s.globalIdLocal, d };
  }
  return best?.id ?? null;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
