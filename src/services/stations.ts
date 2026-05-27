/**
 * Live wind stations service.
 *
 * Two data paths, by design:
 * - **Registry** (which stations exist + metadata): from our Supabase proxy
 *   (`weather-stations`). Rarely changes; cheap.
 * - **Live readings**: fetched DIRECTLY from OceanDrivers (keyless, CORS-open) so
 *   the grid is genuinely real-time (~the source's own ~2–10s cadence), not gated
 *   by the proxy's cache. History still comes via the proxy (cached).
 *
 * Wind is canonical in KNOTS, kept as floats (1-decimal); UI converts to km/h.
 */

import type { OceanDriversLive, OceanDriversHistory } from '@/services/proxy';
import type { WindHistoryPoint } from '@/types/weather';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const OD_BASE = 'https://api.oceandrivers.com/v1.0';

export interface StationMeta {
  id: string;
  name: string;
  place: string;
  region: string;
  lat: number;
  lon: number;
  source: string;
  extId: string;
}

/** A station's current reading. Speeds in KNOTS, 1-decimal precision retained. */
export interface StationReading {
  windKt: number;
  gustKt: number | null;
  dir: number; // degrees, FROM
  tempC: number | null;
  online: boolean;
  observedAt: Date | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function parseReading(live: OceanDriversLive | null | undefined): StationReading | null {
  if (!live || typeof live.TWS !== 'number' || typeof live.TWD !== 'number') return null;
  const gust = live.TWS_GUST ?? (live.TWS_GUST_MAX?.VALUE != null ? Number(live.TWS_GUST_MAX.VALUE) : null);
  return {
    windKt: round1(live.TWS),
    gustKt: gust != null && Number.isFinite(gust) ? round1(gust) : null,
    dir: Math.round(live.TWD),
    tempC: typeof live.TEMPERATURE === 'number' ? Math.round(live.TEMPERATURE) : null,
    online: live.ACTIVE !== 'OFF',
    observedAt: live.TIME ? new Date(live.TIME) : null,
  };
}

// ── Registry (via proxy) ──────────────────────────────────────────────────────

async function proxyCall(params = ''): Promise<unknown> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('proxy not configured');
  const res = await fetch(`${SUPABASE_URL}/functions/v1/weather-stations${params}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`stations ${res.status}`);
  return res.json();
}

type RawStation = { id: string; name: string; place: string; region: string; lat: number; lon: number; source: string; ext_id: string };

/** Station list + metadata (no live — that's fetched direct). Fast DB-only read. */
export async function fetchStationRegistry(): Promise<StationMeta[]> {
  const body = (await proxyCall('?meta')) as { stations: (RawStation & { live?: unknown })[] };
  return body.stations.map((s) => ({
    id: s.id, name: s.name, place: s.place, region: s.region, lat: s.lat, lon: s.lon, source: s.source, extId: s.ext_id,
  }));
}

// ── Live (direct from OceanDrivers, real-time) ────────────────────────────────

/** Fetch one station's live reading straight from OceanDrivers (no proxy/cache). */
export async function fetchLiveDirect(meta: StationMeta): Promise<StationReading | null> {
  if (meta.source !== 'oceandrivers') return null;
  try {
    const res = await fetch(`${OD_BASE}/getWeatherDisplay/${encodeURIComponent(meta.extId)}/`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    return parseReading((await res.json()) as OceanDriversLive);
  } catch {
    return null;
  }
}

// ── History (via proxy, cached) ───────────────────────────────────────────────

export async function fetchStationHistory(id: string): Promise<{ hour: WindHistoryPoint[]; day: WindHistoryPoint[] }> {
  const body = (await proxyCall(`?station=${encodeURIComponent(id)}&history`)) as {
    history: OceanDriversHistory | null;
  };
  return { hour: parseSeries(body.history?.hour), day: parseSeries(body.history?.day) };
}

/** Zip an OceanDrivers index-keyed series into WindHistoryPoint[] (KNOTS, 1-decimal). */
function parseSeries(series: OceanDriversHistory['hour'] | null | undefined): WindHistoryPoint[] {
  if (!series?.TIME || !series.TWS) return [];
  const n = series.length ?? Object.keys(series.TIME).length;
  const pts: WindHistoryPoint[] = [];
  for (let i = 0; i < n; i++) {
    const k = String(i);
    const t = series.TIME[k];
    const ws = series.TWS[k];
    if (t == null || ws == null) continue;
    pts.push({
      time: new Date(t),
      windSpeed: round1(ws),
      windGust: series.TWS_GUST?.[k] != null ? round1(series.TWS_GUST[k]) : null,
      windDirection: series.TWD?.[k] != null ? Math.round(series.TWD[k]) : null,
    });
  }
  return pts;
}

// ── unit helpers ──────────────────────────────────────────────────────────────
export type WindUnit = 'kt' | 'kmh';
const UNIT_KEY = 'sw.weather.windUnit';

export function loadWindUnit(): WindUnit {
  try {
    return globalThis.localStorage?.getItem(UNIT_KEY) === 'kmh' ? 'kmh' : 'kt';
  } catch {
    return 'kt';
  }
}
export function saveWindUnit(u: WindUnit): void {
  try {
    globalThis.localStorage?.setItem(UNIT_KEY, u);
  } catch {
    /* ignore */
  }
}
/** Convert a knots value to the chosen display unit, keeping 1 decimal. */
export function toUnit(kt: number, unit: WindUnit): number {
  return unit === 'kt' ? round1(kt) : round1(kt * 1.852);
}
/** Format for display: 1 decimal only when not a whole number (9.4, but 9 not 9.0). */
export function fmtSpeed(kt: number, unit: WindUnit): string {
  const v = toUnit(kt, unit);
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** Split a speed into integer + decimal parts for tighter rendering of the `.x`. */
export function splitSpeed(kt: number, unit: WindUnit): { int: string; dec: string | null } {
  const v = toUnit(kt, unit);
  if (Number.isInteger(v)) return { int: String(v), dec: null };
  const [int, dec] = v.toFixed(1).split('.');
  return { int, dec };
}
export const unitLabel = (u: WindUnit): string => (u === 'kt' ? 'KN' : 'KM/H');

// ── station order (user-reorderable, persisted) ──────────────────────────────
const ORDER_KEY = 'sw.weather.stationOrder';

function loadOrder(): string[] {
  try {
    const raw = globalThis.localStorage?.getItem(ORDER_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
export function saveOrder(ids: string[]): void {
  try {
    globalThis.localStorage?.setItem(ORDER_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

/** Apply the saved order to a registry; unknown/new stations keep their default tail. */
export function applyOrder(metas: StationMeta[]): StationMeta[] {
  const order = loadOrder();
  if (!order.length) return metas;
  const rank = new Map(order.map((id, i) => [id, i]));
  return [...metas].sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999));
}
