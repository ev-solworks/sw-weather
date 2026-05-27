/**
 * Normalize layer — the single source of truth for "what does our app think
 * weather data looks like". Takes a Location, fetches the right sources per the
 * per-region blend (DATA-SOURCES-RESEARCH.md), and assembles a WeatherConditions.
 *
 * Blend summary:
 * - ES: AEMET hourly+daily (land/temp/wind/UV, confidence HIGH). Waves from
 *   Open-Meteo Marine (AEMET marine is text-only). Pollen/AQI from OM Air Quality.
 * - PT + islands: IPMA daily (land, HIGH). Hourly from Open-Meteo (IPMA has none).
 *   Waves from IPMA oceanography (HIGH) with OM Marine as fill. Pollen from OM AQ.
 * - Sun/moon always local via suncalc.
 *
 * Provenance: every field group records its source + confidence in `sources`.
 */

import type {
  Confidence,
  CurrentConditions,
  DayForecast,
  FieldProvenance,
  HourForecast,
  Location,
  SourceId,
  SourceMap,
  WeatherConditions,
} from '@/types/weather';
import {
  aemetSkyToCondition,
  compassToDegrees,
  dayVariant,
  ipmaTypeToCondition,
  wmoToCondition,
} from '@/services/conditions';
import * as aemet from '@/services/aemet';
import * as ipma from '@/services/ipma';
import * as om from '@/services/openMeteo';
import { computeMoonInfo, computeSunPhases } from '@/services/sun';

function prov(source: SourceId, confidence: Confidence, model?: string): FieldProvenance {
  return { source, confidence, model, fetchedAt: new Date().toISOString() };
}

/** 'YYYY-MM-DD' for an instant in a given IANA timezone (en-CA gives ISO order). */
function localDateKey(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Day label in the LOCATION's timezone: 'Today' if it's today there, else the
 * short weekday. Never uses the runner/device TZ (CLAUDE.md TZ rule).
 */
function dayName(date: Date, timezone: string): string {
  if (localDateKey(date, timezone) === localDateKey(new Date(), timezone)) return 'Today';
  return new Intl.DateTimeFormat('en-GB', { timeZone: timezone, weekday: 'short' }).format(date);
}

/** Parse an Open-Meteo local-naive time string ('2026-05-27T14:00') to a Date. */
function omTime(s: string): Date {
  return new Date(s);
}

/** Build HourForecast[] from an Open-Meteo forecast + optional marine arrays. */
function hoursFromOpenMeteo(f: om.OpenMeteoForecast, marine: om.OpenMeteoMarine | null): HourForecast[] {
  const h = f.hourly;
  const marineIdx = new Map<string, number>();
  if (marine) marine.hourly.time.forEach((t, i) => marineIdx.set(t, i));

  return h.time.map((t, i) => {
    const isNight = h.is_day[i] === 0;
    const mi = marineIdx.get(t);
    return {
      time: omTime(t),
      temperature: Math.round(h.temperature_2m[i]),
      feelsLike: Math.round(h.apparent_temperature[i]),
      humidity: h.relative_humidity_2m[i],
      windSpeed: Math.round(h.wind_speed_10m[i]),
      windDirection: h.wind_direction_10m[i],
      windGust: Math.round(h.wind_gusts_10m[i]),
      precipProbability: h.precipitation_probability[i] ?? 0,
      precipAmount: h.precipitation[i] ?? 0,
      uvIndex: Math.round(h.uv_index[i] ?? 0),
      cloudCover: h.cloud_cover[i],
      description: dayVariant(wmoToCondition(h.weather_code[i]), isNight),
      isNight,
      waveHeight: mi !== undefined ? marine!.hourly.wave_height[mi] ?? null : null,
      wavePeriod: mi !== undefined ? marine!.hourly.wave_period[mi] ?? null : null,
      waveDirection: mi !== undefined ? marine!.hourly.wave_direction[mi] ?? null : null,
      seaTemperature: mi !== undefined ? marine!.hourly.sea_surface_temperature[mi] ?? null : null,
    };
  });
}

function currentFromHour(hour: HourForecast): CurrentConditions {
  return {
    temperature: hour.temperature,
    feelsLike: hour.feelsLike,
    humidity: hour.humidity,
    windSpeed: hour.windSpeed,
    windDirection: hour.windDirection,
    windGust: hour.windGust,
    pressure: null,
    visibility: null,
    cloudCover: hour.cloudCover,
    uvIndex: hour.uvIndex,
    description: hour.description,
    isNight: hour.isNight,
    observedAt: hour.time,
  };
}

/** Pick the forecast hour nearest to `now` as a stand-in current conditions. */
function nearestHour(hours: HourForecast[], now = Date.now()): HourForecast {
  let best = hours[0];
  let bestDiff = Infinity;
  for (const h of hours) {
    const diff = Math.abs(h.time.getTime() - now);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = h;
    }
  }
  return best;
}

// ── Per-region assembly ──────────────────────────────────────────────────────

async function normalizeSpain(loc: Location): Promise<WeatherConditions> {
  if (!loc.aemetMunicipio) throw new Error(`ES location ${loc.id} missing aemetMunicipio`);

  const [hourly, daily, marine, aq] = await Promise.all([
    aemet.fetchHourly(loc.aemetMunicipio),
    aemet.fetchDaily(loc.aemetMunicipio),
    loc.isCoastal ? om.fetchMarine(loc.lat, loc.lon, loc.timezone).catch(() => null) : Promise.resolve(null),
    om.fetchAirQuality(loc.lat, loc.lon, loc.timezone).catch(() => null),
  ]);
  void aq; // wired into a pollen/AQI block in a later stage

  const hours = aemetHourlyToHours(hourly, marine, loc.timezone);
  const days = aemetDailyToDays(daily, loc.timezone);
  const current = currentFromHour(nearestHour(hours));
  const sun = computeSunPhases(new Date(), loc.lat, loc.lon);
  const moon = computeMoonInfo(new Date(), loc.lat, loc.lon);

  const sources: SourceMap = {
    temperature: prov('aemet', 'high'),
    wind: prov('aemet', 'high'),
    precipitation: prov('aemet', 'high'),
    uv: prov('aemet', 'high'),
    sky: prov('aemet', 'high'),
    sun: prov('suncalc', 'high'),
  };
  if (marine) {
    const marineConf: Confidence = loc.timezone === 'Atlantic/Canary' ? 'low' : 'medium';
    sources.marine = prov('open-meteo-marine', marineConf, 'best_match');
  }

  return { location: loc, current, hours, days, sun, moon, alerts: [], sources, assembledAt: new Date().toISOString() };
}

async function normalizePortugal(loc: Location): Promise<WeatherConditions> {
  if (!loc.ipmaGlobalIdLocal) throw new Error(`PT location ${loc.id} missing ipmaGlobalIdLocal`);

  const seaId = loc.isCoastal ? await ipma.nearestSeaLocation(loc.lat, loc.lon) : null;

  const [ipmaDaily, weatherTypes, omForecast, marine, sea] = await Promise.all([
    ipma.fetchDaily(loc.ipmaGlobalIdLocal),
    ipma.fetchWeatherTypes(),
    om.fetchForecast(loc.lat, loc.lon, loc.timezone),
    loc.isCoastal ? om.fetchMarine(loc.lat, loc.lon, loc.timezone).catch(() => null) : Promise.resolve(null),
    seaId ? ipma.fetchSea(seaId, 3).catch(() => null) : Promise.resolve(null),
  ]);
  void weatherTypes; // IPMA hourly text not used (hourly comes from OM); kept for daily sky below

  // Hours: Open-Meteo (IPMA has no hourly). Waves: OM Marine fill.
  const hours = hoursFromOpenMeteo(omForecast, marine);
  // Days: IPMA land (HIGH) + IPMA sea waves where available.
  const days = ipmaDailyToDays(ipmaDaily, sea, loc.timezone);
  const current = currentFromHour(nearestHour(hours));
  const sun = computeSunPhases(new Date(), loc.lat, loc.lon);
  const moon = computeMoonInfo(new Date(), loc.lat, loc.lon);

  const islands = loc.timezone === 'Atlantic/Azores' || loc.timezone === 'Atlantic/Madeira';
  const sources: SourceMap = {
    temperature: prov('ipma', 'high'),
    sky: prov('ipma', 'high'),
    precipitation: prov('ipma', 'high'),
    wind: prov('ipma', 'high'),
    hourly: prov('open-meteo', islands ? 'low' : 'medium', 'best_match'),
    sun: prov('suncalc', 'high'),
  };
  if (sea) sources.marine = prov('ipma', 'high');
  else if (marine) sources.marine = prov('open-meteo-marine', islands ? 'low' : 'medium', 'best_match');

  return { location: loc, current, hours, days, sun, moon, alerts: [], sources, assembledAt: new Date().toISOString() };
}

// ── AEMET → canonical ────────────────────────────────────────────────────────

function aemetHourlyToHours(
  root: aemet.AemetForecastRoot<aemet.AemetHourlyDay>,
  marine: om.OpenMeteoMarine | null,
  _timezone: string,
): HourForecast[] {
  const marineIdx = new Map<string, number>();
  if (marine) marine.hourly.time.forEach((t, i) => marineIdx.set(t, i));

  const hours: HourForecast[] = [];
  for (const day of root.prediccion.dia) {
    const wind = aemet.pairWind(day.vientoAndRachaMax);
    const temp = indexByPeriodo(day.temperatura);
    const feels = indexByPeriodo(day.sensTermica);
    const hum = indexByPeriodo(day.humedadRelativa);
    const precip = indexByPeriodo(day.precipitacion);
    const precipProb = day.probPrecipitacion; // periodos are ranges like '0208'
    const sky = indexSky(day.estadoCielo);
    const datePart = day.fecha.slice(0, 10); // 'YYYY-MM-DD'

    for (const periodo of temp.keys()) {
      const hourNum = Number(periodo);
      if (!Number.isFinite(hourNum)) continue;
      const time = new Date(`${datePart}T${periodo.padStart(2, '0')}:00:00`);
      const skyEntry = sky.get(periodo);
      const condition = skyEntry ? aemetSkyToCondition(skyEntry.code) : 'Cloudy';
      const isNight = skyEntry?.isNight ?? false;
      const w = wind.get(periodo);
      const isoT = `${datePart}T${periodo.padStart(2, '0')}:00`;
      const mi = marineIdx.get(isoT);

      hours.push({
        time,
        temperature: aemet.aemetNum(temp.get(periodo)) ?? 0,
        feelsLike: aemet.aemetNum(feels.get(periodo)) ?? aemet.aemetNum(temp.get(periodo)) ?? 0,
        humidity: aemet.aemetNum(hum.get(periodo)) ?? 0,
        windSpeed: w?.speed ?? 0,
        windDirection: compassToDegrees(w?.direction) ?? 0,
        windGust: w?.gust ?? 0,
        precipProbability: precipProbForHour(precipProb, hourNum) ?? 0,
        precipAmount: aemet.aemetNum(precip.get(periodo)) ?? 0,
        uvIndex: 0, // AEMET hourly has no per-hour UV; daily uvMax used instead
        cloudCover: 0, // AEMET gives sky state, not %; left 0 (sky drives the icon)
        description: dayVariant(condition, isNight),
        isNight,
        waveHeight: mi !== undefined ? marine!.hourly.wave_height[mi] ?? null : null,
        wavePeriod: mi !== undefined ? marine!.hourly.wave_period[mi] ?? null : null,
        waveDirection: mi !== undefined ? marine!.hourly.wave_direction[mi] ?? null : null,
        seaTemperature: mi !== undefined ? marine!.hourly.sea_surface_temperature[mi] ?? null : null,
      });
    }
  }
  return hours.sort((a, b) => a.time.getTime() - b.time.getTime());
}

function aemetDailyToDays(root: Awaited<ReturnType<typeof aemet.fetchDaily>>, timezone: string): DayForecast[] {
  return root.prediccion.dia.map((day) => {
    const date = new Date(day.fecha.slice(0, 10) + 'T00:00:00');
    const fullDay = day.probPrecipitacion.find((p) => p.periodo === '00-24');
    const windFull = day.viento?.find((w) => w.periodo === '00-24') ?? day.viento?.[0];
    const skyFull = day.estadoCielo.find((s) => s.periodo === '00-24') ?? day.estadoCielo[0];
    return {
      date,
      dayName: dayName(date, timezone),
      tempHi: day.temperatura.maxima,
      tempLo: day.temperatura.minima,
      tempCurrent: null,
      description: skyFull ? aemetSkyToCondition(skyFull.value) : 'Cloudy',
      rainProbability: aemet.aemetNum(fullDay?.value as string | undefined) ?? 0,
      rainAmount: 0, // AEMET daily gives probability, not mm total
      windAvg: windFull?.velocidad ?? 0,
      windGust: 0,
      windDirection: compassToDegrees(windFull?.direccion) ?? 0,
      uvMax: day.uvMax ?? 0,
      sunrise: date, // AEMET daily lacks orto/ocaso; sun view uses suncalc
      sunset: date,
      waveHeight: null,
      wavePeriod: null,
      seaTemperature: null,
    };
  });
}

// ── IPMA → canonical ─────────────────────────────────────────────────────────

function ipmaDailyToDays(
  days: ipma.IpmaDailyDay[],
  sea: (ipma.IpmaSeaDay | null)[] | null,
  timezone: string,
): DayForecast[] {
  return days.map((d, i) => {
    const date = new Date(d.forecastDate + 'T00:00:00');
    const s = sea?.[i] ?? null;
    return {
      date,
      dayName: dayName(date, timezone),
      tempHi: Math.round(Number(d.tMax)),
      tempLo: Math.round(Number(d.tMin)),
      tempCurrent: null,
      description: ipmaTypeToCondition(d.idWeatherType),
      rainProbability: Math.round(Number(d.precipitaProb)),
      rainAmount: 0,
      windAvg: 0, // IPMA gives an ordinal classWindSpeed, not km/h; OM fills hourly wind
      windGust: 0,
      windDirection: compassToDegrees(d.predWindDir) ?? 0,
      uvMax: 0,
      sunrise: date,
      sunset: date,
      waveHeight: s ? Number(s.waveHighMax) : null,
      wavePeriod: s ? Number(s.wavePeriodMax) : null,
      seaTemperature: s ? Number(s.sstMax) : null,
    };
  });
}

// ── Small helpers ────────────────────────────────────────────────────────────

function indexByPeriodo(arr: Array<{ value: string; periodo: string }>): Map<string, string> {
  return new Map(arr.map((x) => [x.periodo, x.value]));
}

/**
 * AEMET hourly precip probability is given over RANGE periods ('0208' = 02–08).
 * Find the range containing `hour` and return its value. Prefer the narrowest
 * (shortest) matching range so a 6h block doesn't shadow a finer one.
 */
function precipProbForHour(
  ranges: Array<{ value: string; periodo: string }>,
  hour: number,
): number | null {
  let best: { span: number; value: number } | null = null;
  for (const r of ranges) {
    if (r.periodo.length !== 4) continue;
    const start = Number(r.periodo.slice(0, 2));
    let end = Number(r.periodo.slice(2, 4));
    if (end === 0) end = 24; // '0024' wraps to end-of-day
    if (hour >= start && hour < end) {
      const v = aemet.aemetNum(r.value);
      const span = end - start;
      if (v !== null && (!best || span < best.span)) best = { span, value: v };
    }
  }
  return best?.value ?? null;
}

function indexSky(
  arr: Array<{ value: string; periodo: string }>,
): Map<string, { code: string; isNight: boolean }> {
  return new Map(arr.map((x) => [x.periodo, aemet.parseSkyCode(x.value)]));
}

// ── Entry point ──────────────────────────────────────────────────────────────

/** Fetch + normalize a full WeatherConditions bundle for a location. */
export async function getWeather(loc: Location): Promise<WeatherConditions> {
  return loc.country === 'ES' ? normalizeSpain(loc) : normalizePortugal(loc);
}
