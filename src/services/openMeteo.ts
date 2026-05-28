/**
 * Open-Meteo client — universal backfill. Free, no key, CC-BY (credit Open-Meteo
 * + DWD/CAMS; OK for an ad-free personal PWA). Returns source-shaped data;
 * normalize.ts maps it into `WeatherConditions`.
 *
 * Role in the blend (DATA-SOURCES-RESEARCH.md):
 * - Hourly granularity for PT (IPMA has no hourly) and a backfill for ES.
 * - **Waves/SST for Spain** (AEMET marine is text-only) via the Marine API.
 * - Wind-at-altitude and pollen/AQI everywhere (no national source).
 *
 * Gotchas: each sub-API is a SEPARATE host (no batching). Responses are parallel
 * arrays under `hourly`/`daily` aligned to a `time` array. We pass `timezone` so
 * times come back in the location's local zone; treat the strings as local-naive.
 * Coastal marine accuracy is limited — flag low confidence far from the grid.
 */

const FORECAST_HOST = 'https://api.open-meteo.com/v1/forecast';
const MARINE_HOST = 'https://marine-api.open-meteo.com/v1/marine';
const AQ_HOST = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const GEOCODE_HOST = 'https://geocoding-api.open-meteo.com/v1/search';

export class OpenMeteoError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'OpenMeteoError';
    this.status = status;
  }
}

async function omFetch<T>(host: string, params: Record<string, string | number>): Promise<T> {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  );
  const res = await fetch(`${host}?${qs}`);
  if (!res.ok) throw new OpenMeteoError(`Open-Meteo ${host} failed`, res.status);
  return (await res.json()) as T;
}

// ── Forecast ─────────────────────────────────────────────────────────────────

export interface OpenMeteoForecast {
  timezone: string;
  hourly: {
    time: string[];
    temperature_2m: number[];
    apparent_temperature: number[];
    relative_humidity_2m: number[];
    precipitation: number[];
    precipitation_probability: number[];
    weather_code: number[];
    cloud_cover: number[];
    wind_speed_10m: number[];
    wind_direction_10m: number[];
    wind_gusts_10m: number[];
    uv_index: number[];
    is_day: number[];
  };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
    precipitation_probability_max: number[];
    precipitation_sum: number[];
    wind_speed_10m_max: number[];
    wind_gusts_10m_max: number[];
    wind_direction_10m_dominant: number[];
    uv_index_max: number[];
    sunrise: string[];
    sunset: string[];
  };
  // Optional minutely_15 block when requested. Returns the next ~16 quarter-hour
  // slots (4h) of precip; we slice to the first 60 min in the client.
  minutely_15?: {
    time: string[];
    precipitation?: number[];
    rain?: number[];
  };
}

const HOURLY_VARS = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'precipitation',
  'precipitation_probability',
  'weather_code',
  'cloud_cover',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'uv_index',
  'is_day',
].join(',');

const DAILY_VARS = [
  'temperature_2m_max',
  'temperature_2m_min',
  'weather_code',
  'precipitation_probability_max',
  'precipitation_sum',
  'wind_speed_10m_max',
  'wind_gusts_10m_max',
  'wind_direction_10m_dominant',
  'uv_index_max',
  'sunrise',
  'sunset',
].join(',');

/**
 * Hourly + daily forecast. `model` defaults to 'best_match'; the research found
 * Best Match acceptable as a backfill (the old sw-client-app over-specified ECMWF).
 * Wind in km/h, temp in °C (Open-Meteo metric defaults).
 */
export async function fetchForecast(
  lat: number,
  lon: number,
  timezone: string,
  opts: { model?: string; forecastDays?: number } = {},
): Promise<OpenMeteoForecast> {
  return omFetch<OpenMeteoForecast>(FORECAST_HOST, {
    latitude: lat,
    longitude: lon,
    timezone,
    hourly: HOURLY_VARS,
    daily: DAILY_VARS,
    forecast_days: opts.forecastDays ?? 7,
    ...(opts.model ? { models: opts.model } : {}),
  });
}

// ── Marine ─────────────────────────────────────────────────────────────────

export interface OpenMeteoMarine {
  hourly: {
    time: string[];
    wave_height: number[];
    wave_direction: number[];
    wave_period: number[];
    sea_surface_temperature: number[];
  };
}

/** Wave height (m) / period (s) / direction (deg) + sea-surface temp (°C). */
export async function fetchMarine(lat: number, lon: number, timezone: string): Promise<OpenMeteoMarine> {
  return omFetch<OpenMeteoMarine>(MARINE_HOST, {
    latitude: lat,
    longitude: lon,
    timezone,
    hourly: 'wave_height,wave_direction,wave_period,sea_surface_temperature',
  });
}

// ── Air quality ──────────────────────────────────────────────────────────────

export interface OpenMeteoAirQuality {
  hourly: {
    time: string[];
    european_aqi: number[];
    pm10: number[];
    pm2_5: number[];
    alder_pollen: number[];
    birch_pollen: number[];
    grass_pollen: number[];
    olive_pollen: number[]; // critical for southern Spain
    ragweed_pollen: number[];
  };
}

export async function fetchAirQuality(lat: number, lon: number, timezone: string): Promise<OpenMeteoAirQuality> {
  return omFetch<OpenMeteoAirQuality>(AQ_HOST, {
    latitude: lat,
    longitude: lon,
    timezone,
    hourly:
      'european_aqi,pm10,pm2_5,alder_pollen,birch_pollen,grass_pollen,olive_pollen,ragweed_pollen',
  });
}

// ── Geocoding (location search) ──────────────────────────────────────────────

export interface GeocodeResult {
  id: number;
  name: string;
  admin1?: string;
  country: string;
  country_code: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

/** Keyless place search. Used for the add-location flow (proven in sw-client-app). */
export async function geocode(query: string, count = 5): Promise<GeocodeResult[]> {
  if (query.trim().length < 2) return [];
  const res = await omFetch<{ results?: GeocodeResult[] }>(GEOCODE_HOST, {
    name: query,
    count,
    language: 'en',
    format: 'json',
  });
  return res.results ?? [];
}
