// Archive normalizers — provider payload → forecast_archive / observation_archive rows.
//
// Lives on the edge (Deno) because that's where the prefetch runs. Keeps the
// client normalize.ts free of DB schema concerns. Rows are append-only; the
// primary key (location_id, source, model, valid_time, issued_at) is what gives
// us a model-vs-truth comparison surface later.

import type { OmMultiForecast } from './weather-fetch.ts';

export interface ForecastRow {
  location_id: string;
  source: string;
  model: string;
  issued_at: string;
  valid_time: string;
  temp_c: number | null;
  feels_c: number | null;
  rh: number | null;
  wind_kmh: number | null;
  gust_kmh: number | null;
  wind_dir: number | null;
  precip_mm: number | null;
  precip_prob: number | null;
  sky_code: string | null;
  cloud_pct: number | null;
  wave_m: number | null;
  wave_per_s: number | null;
}

export interface ObservationRow {
  location_id: string;
  station_source: string;
  station_id: string;
  observed_at: string;
  temp_c: number | null;
  rh: number | null;
  wind_kmh: number | null;
  gust_kmh: number | null;
  wind_dir: number | null;
  pressure_hpa: number | null;
  precip_mm: number | null;
  sky_code: string | null;
}

const KNOTS_TO_KMH = 1.852;
const MS_TO_KMH = 3.6;

/** Canonical ConditionCode mapping — mirrors src/services/conditions.ts (subset). */
function wmoToSky(code: number | null | undefined): string | null {
  if (code == null) return null;
  if (code === 0) return 'Clear';
  if (code === 1) return 'Mostly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Cloudy';
  if (code === 45) return 'Fog';
  if (code === 48) return 'Fog';
  if (code >= 51 && code <= 57) return 'Light rain';
  if (code >= 61 && code <= 65) return code >= 65 ? 'Heavy rain' : 'Rain';
  if (code >= 66 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return code === 82 ? 'Heavy rain' : 'Rain';
  if (code >= 95 && code <= 99) return 'Thunder';
  return 'Cloudy';
}

function aemetSkyToSky(raw: string | undefined): string | null {
  if (!raw) return null;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return null;
  if (n <= 13) return n <= 11 ? 'Clear' : 'Mostly clear';
  if (n <= 16) return n === 14 ? 'Mostly clear' : 'Partly cloudy';
  if (n === 17) return 'Mostly clear'; // nubes altas
  if (n <= 18) return 'Cloudy';
  if (n >= 23 && n <= 26) return 'Rain';
  if (n >= 33 && n <= 36) return 'Snow';
  if (n === 81) return 'Fog';
  if (n === 82 || n === 83) return 'Haze';
  return null;
}

const COMPASS_TO_DEG: Record<string, number> = {
  N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
  S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
};
function dirToDeg(s: string | undefined): number | null {
  if (!s) return null;
  return COMPASS_TO_DEG[s.toUpperCase()] ?? null;
}

const num = (x: unknown): number | null =>
  typeof x === 'number' && Number.isFinite(x) ? x : (typeof x === 'string' && x !== '' && Number.isFinite(Number(x)) ? Number(x) : null);

// ── Open-Meteo multi-model → ForecastRow[] ──────────────────────────────────
const OM_MODELS = ['best_match', 'dwd_icon_eu', 'meteofrance_arome_france', 'ecmwf_ifs025', 'gfs_seamless'] as const;

export function omMultiToForecastRows(loc_id: string, issued_at: string, m: OmMultiForecast): ForecastRow[] {
  const h = m.hourly;
  const times = h.time as string[];
  if (!times?.length) return [];
  const rows: ForecastRow[] = [];
  for (const model of OM_MODELS) {
    const suf = `_${model}`;
    const temp = (h[`temperature_2m${suf}`] as number[] | undefined) ?? [];
    if (!temp.length) continue; // model not available at this lat/lon
    const feels = (h[`apparent_temperature${suf}`] as number[] | undefined) ?? [];
    const rh = (h[`relative_humidity_2m${suf}`] as number[] | undefined) ?? [];
    const wind = (h[`wind_speed_10m${suf}`] as number[] | undefined) ?? [];
    const gust = (h[`wind_gusts_10m${suf}`] as number[] | undefined) ?? [];
    const wdir = (h[`wind_direction_10m${suf}`] as number[] | undefined) ?? [];
    const prec = (h[`precipitation${suf}`] as number[] | undefined) ?? [];
    const prob = (h[`precipitation_probability${suf}`] as number[] | undefined) ?? [];
    const code = (h[`weather_code${suf}`] as number[] | undefined) ?? [];
    const cloud = (h[`cloud_cover${suf}`] as number[] | undefined) ?? [];
    for (let i = 0; i < times.length; i++) {
      const t = times[i];
      if (temp[i] == null) continue;
      rows.push({
        location_id: loc_id,
        source: 'om',
        model,
        issued_at,
        valid_time: new Date(t).toISOString(),
        temp_c: num(temp[i]),
        feels_c: num(feels[i]),
        rh: num(rh[i]),
        wind_kmh: num(wind[i]),
        gust_kmh: num(gust[i]),
        wind_dir: num(wdir[i]),
        precip_mm: num(prec[i]),
        precip_prob: num(prob[i]),
        sky_code: wmoToSky(num(code[i])),
        cloud_pct: num(cloud[i]),
        wave_m: null,
        wave_per_s: null,
      });
    }
  }
  return rows;
}

// ── AEMET hourly → ForecastRow[] ────────────────────────────────────────────
interface AemetHourlyRoot {
  prediccion: { dia: Array<{
    fecha: string;
    estadoCielo: Array<{ value: string; periodo: string }>;
    temperatura: Array<{ value: string; periodo: string }>;
    sensTermica: Array<{ value: string; periodo: string }>;
    humedadRelativa: Array<{ value: string; periodo: string }>;
    precipitacion: Array<{ value: string; periodo: string }>;
    probPrecipitacion: Array<{ value: string; periodo: string }>;
    vientoAndRachaMax: Array<{ value?: string[]; direccion?: string[]; velocidad?: string[] | number[]; periodo: string }>;
  }> };
}

function indexBy<T extends { periodo: string }>(arr: T[]): Map<string, T> {
  const m = new Map<string, T>();
  for (const x of arr) m.set(x.periodo, x);
  return m;
}

function precipProbForHour(ranges: Array<{ value: string; periodo: string }>, hr: number): number | null {
  let best: { span: number; v: number } | null = null;
  for (const r of ranges) {
    if (r.periodo.length !== 4) continue;
    const s = Number(r.periodo.slice(0, 2));
    let e = Number(r.periodo.slice(2, 4));
    if (e === 0) e = 24;
    if (hr >= s && hr < e) {
      const v = num(r.value);
      const span = e - s;
      if (v != null && (!best || span < best.span)) best = { span, v };
    }
  }
  return best?.v ?? null;
}

export function aemetHourlyToForecastRows(loc_id: string, issued_at: string, payload: unknown): ForecastRow[] {
  // AEMET wraps its forecast roots in a one-element array. Unwrap.
  const root = (Array.isArray(payload) ? payload[0] : payload) as AemetHourlyRoot;
  const rows: ForecastRow[] = [];
  if (!root?.prediccion?.dia) return rows;
  for (const day of root.prediccion.dia) {
    const date = day.fecha.slice(0, 10);
    const sky = indexBy(day.estadoCielo);
    const temp = indexBy(day.temperatura);
    const feels = indexBy(day.sensTermica);
    const hum = indexBy(day.humedadRelativa);
    const prec = indexBy(day.precipitacion);
    // wind: pick the entry matching periodo with a numeric velocidad[0]
    const wind = new Map<string, { speed: number | null; gust: number | null; dir: number | null }>();
    for (const w of day.vientoAndRachaMax ?? []) {
      if (!w.periodo) continue;
      const v = Array.isArray(w.velocidad) ? num((w.velocidad as unknown[])[0]) : null;
      const g = Array.isArray(w.value) ? num((w.value as string[])[0]) : null;
      const d = Array.isArray(w.direccion) ? dirToDeg(w.direccion[0]) : null;
      const prev = wind.get(w.periodo);
      // overwrite if we now have a speed and didn't before
      if (!prev || (v != null && prev.speed == null)) wind.set(w.periodo, { speed: v, gust: g, dir: d });
    }
    for (const periodo of temp.keys()) {
      const hr = Number(periodo);
      if (!Number.isFinite(hr)) continue;
      const valid = new Date(`${date}T${periodo.padStart(2, '0')}:00:00Z`).toISOString();
      const w = wind.get(periodo);
      rows.push({
        location_id: loc_id,
        source: 'aemet',
        model: 'aemet',
        issued_at,
        valid_time: valid,
        temp_c: num(temp.get(periodo)?.value),
        feels_c: num(feels.get(periodo)?.value) ?? num(temp.get(periodo)?.value),
        rh: num(hum.get(periodo)?.value),
        wind_kmh: w?.speed ?? null,
        gust_kmh: w?.gust ?? null,
        wind_dir: w?.dir ?? null,
        precip_mm: num(prec.get(periodo)?.value),
        precip_prob: precipProbForHour(day.probPrecipitacion ?? [], hr),
        sky_code: aemetSkyToSky(sky.get(periodo)?.value),
        cloud_pct: null,
        wave_m: null,
        wave_per_s: null,
      });
    }
  }
  return rows;
}

// ── IPMA daily → ForecastRow[] (one row per day, valid_time = 12:00 local-naive) ──
interface IpmaDailyRoot { data: Array<{
  forecastDate: string; tMin: string; tMax: string; precipitaProb: string;
  predWindDir: string; classWindSpeed: number; idWeatherType: number;
}> }
function ipmaTypeToSky(id: number): string | null {
  if (id <= 0) return null;
  if (id === 1) return 'Clear';
  if (id === 2 || id === 3) return 'Mostly clear';
  if (id === 4 || id === 5) return 'Partly cloudy';
  if (id === 6 || id === 7) return 'Cloudy';
  if (id >= 8 && id <= 11) return 'Rain';
  if (id === 12 || id === 13) return 'Light rain';
  if (id === 14 || id === 15) return 'Rain';
  if (id === 16 || id === 17) return 'Fog';
  if (id === 18) return 'Snow';
  if (id === 19 || id === 20) return 'Thunder';
  return null;
}
export function ipmaDailyToForecastRows(loc_id: string, issued_at: string, payload: unknown): ForecastRow[] {
  const root = payload as IpmaDailyRoot;
  if (!root?.data) return [];
  return root.data.map((d) => ({
    location_id: loc_id,
    source: 'ipma',
    model: 'ipma',
    issued_at,
    valid_time: new Date(`${d.forecastDate}T12:00:00Z`).toISOString(),
    temp_c: (num(d.tMin) != null && num(d.tMax) != null) ? Math.round(((num(d.tMin) as number) + (num(d.tMax) as number)) / 2) : null,
    feels_c: null,
    rh: null,
    wind_kmh: null, // IPMA gives ordinal class only
    gust_kmh: null,
    wind_dir: dirToDeg(d.predWindDir),
    precip_mm: null,
    precip_prob: num(d.precipitaProb),
    sky_code: ipmaTypeToSky(d.idWeatherType),
    cloud_pct: null,
    wave_m: null,
    wave_per_s: null,
  }));
}

// ── Observations ────────────────────────────────────────────────────────────
interface AemetObsReading { fint?: string; ta?: number; hr?: number; pres?: number; vv?: number; prec?: number; }

export function aemetObsToRows(loc_id: string, station_id: string, payload: unknown): ObservationRow[] {
  if (!Array.isArray(payload)) return [];
  const rows: ObservationRow[] = [];
  for (const r of payload as AemetObsReading[]) {
    if (!r?.fint) continue;
    rows.push({
      location_id: loc_id,
      station_source: 'aemet-obs',
      station_id,
      observed_at: new Date(r.fint).toISOString(),
      temp_c: num(r.ta),
      rh: num(r.hr),
      wind_kmh: r.vv != null ? Math.round(r.vv * MS_TO_KMH) : null,
      gust_kmh: null,
      wind_dir: null,
      pressure_hpa: num(r.pres),
      precip_mm: num(r.prec),
      sky_code: null,
    });
  }
  return rows;
}

interface OceanDriversLive {
  TWS?: number; TWD?: number; TWS_GUST?: number;
  TEMPERATURE?: number; HUMIDITY?: number; PRESSURE?: number;
  TIME?: number; ACTIVE?: string;
}
export function oceanDriversLiveToObsRow(loc_id: string, station_id: string, payload: unknown): ObservationRow | null {
  const od = payload as OceanDriversLive | null;
  if (!od || od.ACTIVE === 'OFF' || !od.TIME) return null;
  return {
    location_id: loc_id,
    station_source: 'oceandrivers',
    station_id,
    observed_at: new Date(od.TIME).toISOString(),
    temp_c: num(od.TEMPERATURE),
    rh: num(od.HUMIDITY),
    wind_kmh: od.TWS != null ? Math.round(od.TWS * KNOTS_TO_KMH) : null,
    gust_kmh: od.TWS_GUST != null ? Math.round(od.TWS_GUST * KNOTS_TO_KMH) : null,
    wind_dir: num(od.TWD),
    pressure_hpa: num(od.PRESSURE),
    precip_mm: null,
    sky_code: null,
  };
}

export interface WindStreamRow {
  station_id: string;
  observed_at: string;
  wind_kt: number;
  gust_kt: number | null;
  wind_dir: number | null;
}
export function oceanDriversLiveToWindStreamRow(station_id: string, payload: unknown): WindStreamRow | null {
  const od = payload as OceanDriversLive | null;
  if (!od || od.ACTIVE === 'OFF' || od.TWS == null || !od.TIME) return null;
  return {
    station_id,
    observed_at: new Date(od.TIME).toISOString(),
    wind_kt: Math.round(od.TWS * 10) / 10,
    gust_kt: od.TWS_GUST != null ? Math.round(od.TWS_GUST * 10) / 10 : null,
    wind_dir: od.TWD != null ? Math.round(od.TWD) : null,
  };
}
