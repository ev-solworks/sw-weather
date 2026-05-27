/**
 * Live wind stations service — reads the `weather-stations` edge function (proxy +
 * cache). Stations are independent of saved forecast locations. Wind is kept in
 * KNOTS as the canonical unit (the source, OceanDrivers, reports knots); the UI
 * converts to km/h on demand.
 */

import type { OceanDriversLive, OceanDriversHistory } from '@/services/proxy';
import type { WindHistoryPoint } from '@/types/weather';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export interface StationMeta {
  id: string;
  name: string;
  place: string;
  region: string;
  lat: number;
  lon: number;
  source: string;
}

/** A station's current reading, normalized. Speeds in KNOTS. */
export interface StationReading {
  windKt: number;
  gustKt: number | null;
  dir: number; // degrees, FROM
  tempC: number | null;
  online: boolean;
  observedAt: Date | null;
}

export interface Station extends StationMeta {
  reading: StationReading | null;
}

function parseReading(live: OceanDriversLive | null | undefined): StationReading | null {
  if (!live || typeof live.TWS !== 'number' || typeof live.TWD !== 'number') return null;
  const gust = live.TWS_GUST ?? (live.TWS_GUST_MAX?.VALUE != null ? Number(live.TWS_GUST_MAX.VALUE) : null);
  return {
    windKt: Math.round(live.TWS),
    gustKt: gust != null && Number.isFinite(gust) ? Math.round(gust) : null,
    dir: Math.round(live.TWD),
    tempC: typeof live.TEMPERATURE === 'number' ? Math.round(live.TEMPERATURE) : null,
    online: live.ACTIVE !== 'OFF',
    observedAt: live.TIME ? new Date(live.TIME) : null,
  };
}

type RawStation = StationMeta & { live: OceanDriversLive | null };

async function call(params = ''): Promise<unknown> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('proxy not configured');
  const res = await fetch(`${SUPABASE_URL}/functions/v1/weather-stations${params}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`stations ${res.status}`);
  return res.json();
}

/** All active stations with their current reading. */
export async function fetchStations(): Promise<Station[]> {
  const body = (await call()) as { stations: RawStation[] };
  return body.stations.map(({ live, ...meta }) => ({ ...meta, reading: parseReading(live) }));
}

/** One station + its current reading + wind/gust history (1h @1min, 24h @1h). */
export async function fetchStationDetail(
  id: string,
): Promise<{ station: StationMeta; reading: StationReading | null; hour: WindHistoryPoint[]; day: WindHistoryPoint[] }> {
  const body = (await call(`?station=${encodeURIComponent(id)}&history`)) as {
    station: StationMeta;
    live: OceanDriversLive | null;
    history: OceanDriversHistory | null;
  };
  return {
    station: body.station,
    reading: parseReading(body.live),
    hour: parseSeries(body.history?.hour),
    day: parseSeries(body.history?.day),
  };
}

/** Zip an OceanDrivers index-keyed series into WindHistoryPoint[] (speeds in KNOTS). */
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
      windSpeed: Math.round(ws), // knots
      windGust: series.TWS_GUST?.[k] != null ? Math.round(series.TWS_GUST[k]) : null,
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
/** Convert a knots value to the chosen display unit, rounded. */
export function toUnit(kt: number, unit: WindUnit): number {
  return unit === 'kt' ? kt : Math.round(kt * 1.852);
}
export const unitLabel = (u: WindUnit): string => (u === 'kt' ? 'KN' : 'KM/H');
