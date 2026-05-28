// Shared weather upstream fetchers (Deno) for the SW Weather proxy.
// Used by weather-get (on-demand) and weather-refresh (cron). Returns RAW provider
// payloads — the client normalizes them (single source of truth in normalize.ts).
//
// AEMET notes (hard-won): the API hangs sockets under concurrent load and temp-
// blocks IPs after bursts. So: low global concurrency (2) + per-request timeout +
// the two-step datos fetch. Only this server hits AEMET now, never client devices.

export type WeatherKind =
  | 'aemet-hourly'
  | 'aemet-daily'
  | 'aemet-obs'
  | 'ipma-daily'
  | 'ipma-sea'
  | 'om-forecast'
  | 'om-marine'
  | 'om-aq'
  | 'oceandrivers'
  | 'oceandrivers-history';

export interface LocationRow {
  id: string;
  country: 'ES' | 'PT';
  lat: number;
  lon: number;
  timezone: string;
  aemet_municipio: string | null;
  aemet_station: string | null;
  ipma_global_id_local: number | null;
  oceandrivers_station: string | null;
  is_coastal: boolean;
}

const AEMET_BASE = 'https://opendata.aemet.es/opendata/api';
const REQUEST_TIMEOUT_MS = 8_000;

// ── AEMET concurrency gate (max 2 in flight; it's concurrency, not rate, that hangs) ──
let aemetActive = 0;
const aemetWaiters: Array<() => void> = [];
async function aemetSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (aemetActive >= 2) await new Promise<void>((r) => aemetWaiters.push(r));
  aemetActive++;
  try {
    return await fn();
  } finally {
    aemetActive--;
    aemetWaiters.shift()?.();
  }
}

function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
}

/** Decode AEMET body, falling back to Latin-1 when UTF-8 yields mojibake. */
async function decodeBody(res: Response): Promise<string> {
  const buf = await res.arrayBuffer();
  const utf8 = new TextDecoder('utf-8').decode(buf);
  if (utf8.includes('�')) return new TextDecoder('iso-8859-1').decode(buf);
  return utf8;
}

/** AEMET two-step. Returns the parsed `datos` payload (raw). */
async function aemetTwoStep(path: string, apiKey: string): Promise<unknown> {
  return aemetSlot(async () => {
    const url = `${AEMET_BASE}${path}${path.includes('?') ? '&' : '?'}api_key=${encodeURIComponent(apiKey)}`;
    const step1 = await timedFetch(url);
    if (!step1.ok) throw new Error(`AEMET ${path} step1 ${step1.status}`);
    const env = JSON.parse(await decodeBody(step1)) as { estado: number; datos?: string; descripcion?: string };
    if (env.estado !== 200 || !env.datos) throw new Error(`AEMET ${path}: estado ${env.estado} ${env.descripcion ?? ''}`);
    const step2 = await timedFetch(env.datos);
    if (!step2.ok) throw new Error(`AEMET datos ${step2.status}`);
    return JSON.parse(await decodeBody(step2));
  });
}

export function aemetHourly(municipio: string, key: string) {
  return aemetTwoStep(`/prediccion/especifica/municipio/horaria/${municipio}`, key);
}
export function aemetDaily(municipio: string, key: string) {
  return aemetTwoStep(`/prediccion/especifica/municipio/diaria/${municipio}`, key);
}
export function aemetObs(station: string, key: string) {
  return aemetTwoStep(`/observacion/convencional/datos/estacion/${station}`, key);
}

// ── IPMA (keyless) ────────────────────────────────────────────────────────────
const IPMA_BASE = 'https://api.ipma.pt/open-data';
export async function ipmaDaily(globalIdLocal: number): Promise<unknown> {
  const res = await timedFetch(`${IPMA_BASE}/forecast/meteorology/cities/daily/${globalIdLocal}.json`);
  if (!res.ok) throw new Error(`IPMA daily ${res.status}`);
  return res.json();
}
/** Aggregate sea forecast for day offsets 0..days-1, filtered to one sea point. */
export async function ipmaSea(seaGlobalId: number, days = 3): Promise<unknown> {
  const out: unknown[] = [];
  for (let d = 0; d < days; d++) {
    const res = await timedFetch(`${IPMA_BASE}/forecast/oceanography/daily/hp-daily-sea-forecast-day${d}.json`).catch(() => null);
    if (!res || !res.ok) { out.push(null); continue; }
    const j = (await res.json()) as { data?: Array<{ globalIdLocal: number }> } | Array<{ globalIdLocal: number }>;
    const arr = Array.isArray(j) ? j : (j.data ?? []);
    out.push(arr.find((x) => x.globalIdLocal === seaGlobalId) ?? null);
  }
  return out;
}
export async function ipmaSeaLocations(): Promise<Array<{ globalIdLocal: number; latitude: string; longitude: string }>> {
  const res = await timedFetch(`${IPMA_BASE}/sea-locations.json`);
  if (!res.ok) throw new Error(`IPMA sea-locations ${res.status}`);
  const j = (await res.json()) as { data?: unknown } | unknown[];
  return (Array.isArray(j) ? j : ((j as { data?: unknown[] }).data ?? [])) as Array<{ globalIdLocal: number; latitude: string; longitude: string }>;
}

// ── Open-Meteo (keyless) ────────────────────────────────────────────────────────
const OM_FORECAST = 'https://api.open-meteo.com/v1/forecast';
const OM_MARINE = 'https://marine-api.open-meteo.com/v1/marine';
const OM_AQ = 'https://air-quality-api.open-meteo.com/v1/air-quality';

const OM_HOURLY = 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,precipitation_probability,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,is_day';
const OM_DAILY = 'temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,uv_index_max,sunrise,sunset';
// 15-min precip nowcast (Open-Meteo `minutely_15`). 1h ahead is enough for the
// "rain in N min" banner; longer windows aren't more accurate at this resolution.
const OM_MINUTELY = 'precipitation,rain';

async function omFetch(host: string, params: Record<string, string | number>): Promise<unknown> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const res = await timedFetch(`${host}?${qs}`);
  if (!res.ok) throw new Error(`Open-Meteo ${host} ${res.status}`);
  return res.json();
}
export function omForecast(lat: number, lon: number, tz: string) {
  return omFetch(OM_FORECAST, { latitude: lat, longitude: lon, timezone: tz, hourly: OM_HOURLY, daily: OM_DAILY, minutely_15: OM_MINUTELY, forecast_minutely_15: 16, forecast_days: 7 });
}
export function omMarine(lat: number, lon: number, tz: string) {
  return omFetch(OM_MARINE, { latitude: lat, longitude: lon, timezone: tz, hourly: 'wave_height,wave_direction,wave_period,sea_surface_temperature' });
}
export function omAirQuality(lat: number, lon: number, tz: string) {
  return omFetch(OM_AQ, { latitude: lat, longitude: lon, timezone: tz, hourly: 'european_aqi,pm10,pm2_5,alder_pollen,birch_pollen,grass_pollen,olive_pollen,ragweed_pollen' });
}

// OceanDrivers live station (Bay of Palma, keyless). Bare path — NO ?period.
const OD_BASE = 'https://api.oceandrivers.com/v1.0';
export async function oceanDriversLive(stationId: string): Promise<unknown> {
  const res = await timedFetch(`${OD_BASE}/getWeatherDisplay/${stationId}/`);
  if (!res.ok) throw new Error(`OceanDrivers ${stationId} ${res.status}`);
  return res.json();
}
/**
 * Time-series history: ?period=latesthour → 60 pts @1min; latestday → 24 pts @1h.
 * Each series is {TIME, TWS, TWS_GUST, TWD} as {"0":v,...} objects. Returns both.
 */
export async function oceanDriversHistory(stationId: string): Promise<unknown> {
  const get = async (period: string) => {
    const res = await timedFetch(`${OD_BASE}/getWeatherDisplay/${stationId}/?period=${period}`).catch(() => null);
    return res && res.ok ? res.json() : null;
  };
  const [hour, day] = await Promise.all([get('latesthour'), get('latestday')]);
  return { hour, day };
}

// ── Multi-model Open-Meteo (for forecast_archive scoring) ────────────────────
// One request returns all models inline as `temperature_2m_icon_eu`, etc.
const OM_MODELS = 'best_match,dwd_icon_eu,meteofrance_arome_france,ecmwf_ifs025,gfs_seamless';
const OM_MULTI_HOURLY = 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,precipitation_probability,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m';

export interface OmMultiHourly {
  time: string[];
  // each variable suffixed by `_<model>` when models param set, e.g. temperature_2m_icon_eu
  [k: string]: string[] | number[];
}
export interface OmMultiForecast { hourly: OmMultiHourly }

export async function omForecastMulti(lat: number, lon: number, tz: string): Promise<OmMultiForecast> {
  return omFetch(OM_FORECAST, {
    latitude: lat, longitude: lon, timezone: tz,
    hourly: OM_MULTI_HOURLY, models: OM_MODELS, forecast_days: 3,
  }) as Promise<OmMultiForecast>;
}

function haversine(la1: number, lo1: number, la2: number, lo2: number): number {
  const R = 6371, toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(la2 - la1), dLon = toRad(lo2 - lo1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(la1)) * Math.cos(toRad(la2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Fetch every relevant raw payload for a location, in parallel-but-bounded.
 * Returns a map { kind: payload }. Individual failures are returned as `null`
 * for that kind rather than failing the whole bundle.
 */
export async function fetchAllForLocation(
  loc: LocationRow,
  aemetKey: string,
): Promise<Partial<Record<WeatherKind, unknown>>> {
  const out: Partial<Record<WeatherKind, unknown>> = {};
  const tasks: Array<Promise<void>> = [];
  const run = (kind: WeatherKind, p: Promise<unknown>) =>
    tasks.push(p.then((v) => void (out[kind] = v)).catch(() => void (out[kind] = null)));

  // Live station (any country) — measured current wind + wind/gust history.
  if (loc.oceandrivers_station) {
    run('oceandrivers', oceanDriversLive(loc.oceandrivers_station));
    run('oceandrivers-history', oceanDriversHistory(loc.oceandrivers_station));
  }

  if (loc.country === 'ES' && loc.aemet_municipio) {
    run('aemet-hourly', aemetHourly(loc.aemet_municipio, aemetKey));
    run('aemet-daily', aemetDaily(loc.aemet_municipio, aemetKey));
    if (loc.aemet_station) run('aemet-obs', aemetObs(loc.aemet_station, aemetKey));
    if (loc.is_coastal) run('om-marine', omMarine(loc.lat, loc.lon, loc.timezone));
    // AEMET hourly has no per-hour UV (only daily uvMax) and no cloud_cover %.
    // Pull OM forecast to fill those fields without replacing AEMET's MOS-
    // corrected temp/wind/precip/sky.
    run('om-forecast', omForecast(loc.lat, loc.lon, loc.timezone));
    run('om-aq', omAirQuality(loc.lat, loc.lon, loc.timezone));
  } else if (loc.country !== 'PT' && loc.country !== 'ES') {
    // Generic country (user-added anywhere in the world) — OM only.
    run('om-forecast', omForecast(loc.lat, loc.lon, loc.timezone));
    if (loc.is_coastal) run('om-marine', omMarine(loc.lat, loc.lon, loc.timezone));
    run('om-aq', omAirQuality(loc.lat, loc.lon, loc.timezone));
  } else if (loc.country === 'PT' && loc.ipma_global_id_local) {
    run('ipma-daily', ipmaDaily(loc.ipma_global_id_local));
    run('om-forecast', omForecast(loc.lat, loc.lon, loc.timezone)); // PT hourly from OM
    run('om-aq', omAirQuality(loc.lat, loc.lon, loc.timezone));
    if (loc.is_coastal) {
      run('om-marine', omMarine(loc.lat, loc.lon, loc.timezone));
      // resolve nearest sea point then fetch its forecast
      tasks.push(
        ipmaSeaLocations()
          .then((seas) => {
            let best: { id: number; d: number } | null = null;
            for (const s of seas) {
              const d = haversine(loc.lat, loc.lon, Number(s.latitude), Number(s.longitude));
              if (!best || d < best.d) best = { id: s.globalIdLocal, d };
            }
            return best ? ipmaSea(best.id, 3) : null;
          })
          .then((v) => void (out['ipma-sea'] = v))
          .catch(() => void (out['ipma-sea'] = null)),
      );
    }
  }

  await Promise.all(tasks);
  return out;
}
