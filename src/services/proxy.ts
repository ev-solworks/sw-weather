/**
 * Proxy client — reads raw provider payloads from the Supabase `weather-get` edge
 * function instead of hitting AEMET/IPMA/Open-Meteo directly. The server fetches +
 * caches once; every device reads the warm cache. Keeps the AEMET key server-side
 * and avoids the per-device rate-block.
 *
 * Returns the same shapes the direct clients return (AemetForecastRoot, IpmaDailyDay[],
 * OpenMeteoForecast, …) so normalize.ts maps them unchanged.
 */

import type { AemetForecastRoot, AemetDailyDay, AemetHourlyDay } from '@/services/aemet';
import type { IpmaDailyDay, IpmaSeaDay } from '@/services/ipma';
import type { OpenMeteoForecast, OpenMeteoMarine, OpenMeteoAirQuality } from '@/services/openMeteo';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export class ProxyError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ProxyError';
    this.status = status;
  }
}

/** Raw payloads keyed by provider "kind", as returned by weather-get. */
export interface ProxyPayloads {
  'aemet-hourly'?: [AemetForecastRoot<AemetHourlyDay>];
  'aemet-daily'?: [AemetForecastRoot<AemetDailyDay>];
  'aemet-obs'?: unknown;
  'ipma-daily'?: { data: IpmaDailyDay[] };
  'ipma-sea'?: (IpmaSeaDay | null)[];
  'om-forecast'?: OpenMeteoForecast;
  'om-marine'?: OpenMeteoMarine;
  'om-aq'?: OpenMeteoAirQuality;
}

export interface ProxyResponse {
  location: { id: string };
  payloads: ProxyPayloads;
  fetchedAt: Record<string, string>;
}

/** Whether the proxy is configured (env present). Lets normalize fall back if not. */
export function proxyConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/** Fetch the cached raw payloads for a location from the edge proxy. */
export async function fetchFromProxy(locationId: string): Promise<ProxyResponse> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new ProxyError('proxy not configured');
  const url = `${SUPABASE_URL}/functions/v1/weather-get?locationId=${encodeURIComponent(locationId)}`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new ProxyError(`proxy ${res.status}`, res.status);
  const body = (await res.json()) as ProxyResponse & { error?: string };
  if (body.error) throw new ProxyError(body.error);
  return body;
}
