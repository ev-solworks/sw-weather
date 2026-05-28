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
  ConditionCode,
  CurrentConditions,
  DayForecast,
  FieldProvenance,
  HourForecast,
  Location,
  RainNowcast,
  SourceId,
  SourceMap,
  WeatherConditions,
  WindHistory,
  WindHistoryPoint,
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
import { fetchFromProxy, type OceanDriversHistory, type OceanDriversLive, type OceanDriversSeries, type ProxyPayloads } from '@/services/proxy';

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

/**
 * Build a RainNowcast from Open-Meteo's `minutely_15` block. Slots span the
 * next 60 min starting from the 15-min boundary at or before `now`. Falls
 * back to undefined when the block is missing or all-zero — the UI hides the
 * banner in that case.
 */
function rainNowcastFromOm(om: om.OpenMeteoForecast): RainNowcast | undefined {
  const m = om.minutely_15;
  if (!m?.time || !m.precipitation) return undefined;
  const now = Date.now();
  const slots: { time: Date; mm: number }[] = [];
  for (let i = 0; i < m.time.length; i++) {
    const t = omTime(m.time[i]);
    if (t.getTime() < now - 15 * 60_000) continue; // skip past slots
    slots.push({ time: t, mm: m.precipitation[i] ?? 0 });
    if (slots.length >= 4) break; // 4 × 15-min = 60 min
  }
  if (!slots.length) return undefined;
  return { source: 'open-meteo', slots };
}

/**
 * Overlay UV index + cloud cover from an Open-Meteo forecast onto AEMET-built
 * hours, matching by local-naive hour. Leaves the rest of the AEMET hour
 * untouched. Used for ES locations where AEMET has no per-hour UV.
 */
function overlayUvCloudFromOm(hours: HourForecast[], om: om.OpenMeteoForecast): HourForecast[] {
  const idx = new Map<string, number>();
  om.hourly.time.forEach((t, i) => idx.set(t, i));
  const key = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    return `${y}-${m}-${day}T${h}:00`;
  };
  return hours.map((h) => {
    const i = idx.get(key(h.time));
    if (i === undefined) return h;
    const uv = om.hourly.uv_index?.[i];
    const cc = om.hourly.cloud_cover?.[i];
    return {
      ...h,
      uvIndex: Number.isFinite(uv) ? Math.round(uv as number) : h.uvIndex,
      cloudCover: Number.isFinite(cc) ? (cc as number) : h.cloudCover,
    };
  });
}

/**
 * Append OM-only hours past the last AEMET hour so the Graph 72h+ range has
 * data to plot. AEMET municipal hourly forecasts only cover ~48h; OM covers 7
 * days. We keep AEMET hours unchanged (better accuracy) and add OM hours after.
 */
function extendHoursWithOm(hours: HourForecast[], om: om.OpenMeteoForecast, marine: om.OpenMeteoMarine | null): HourForecast[] {
  if (!hours.length) return hoursFromOpenMeteo(om, marine);
  const lastT = hours[hours.length - 1].time.getTime();
  const omAll = hoursFromOpenMeteo(om, marine);
  const extra = omAll.filter((h) => h.time.getTime() > lastT);
  return extra.length ? hours.concat(extra) : hours;
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

/** Build DayForecast[] from an Open-Meteo daily block. Used by the OM fallback. */
function daysFromOpenMeteo(f: om.OpenMeteoForecast, timezone: string): DayForecast[] {
  const d = f.daily;
  return d.time.map((t, i) => {
    const date = new Date(t + 'T00:00:00');
    return {
      date,
      dayName: dayName(date, timezone),
      tempHi: Math.round(d.temperature_2m_max[i]),
      tempLo: Math.round(d.temperature_2m_min[i]),
      tempCurrent: null,
      description: wmoToCondition(d.weather_code[i]),
      rainProbability: d.precipitation_probability_max[i] ?? 0,
      rainAmount: d.precipitation_sum[i] ?? 0,
      windAvg: Math.round(d.wind_speed_10m_max[i] ?? 0),
      windGust: Math.round(d.wind_gusts_10m_max[i] ?? 0),
      windDirection: d.wind_direction_10m_dominant[i] ?? 0,
      uvMax: Math.round(d.uv_index_max[i] ?? 0),
      sunrise: new Date(d.sunrise[i]),
      sunset: new Date(d.sunset[i]),
      waveHeight: null,
      wavePeriod: null,
      seaTemperature: null,
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

/** AEMET conventional station observation reading (subset we use). */
interface AemetObsReading {
  fint?: string; // ISO observation time
  ta?: number; // air temperature °C
  hr?: number; // relative humidity %
  pres?: number; // pressure hPa
  vv?: number; // wind speed m/s (10-min mean)
}

/** Parsed AEMET obs summary (latest non-null reading for each field). */
interface AemetObs {
  ta: number | null;
  hr: number | null;
  pres: number | null;
  windKmh: number | null; // m/s → km/h
  fint: Date | null;
}

/**
 * Pick the latest usable reading from an AEMET station obs payload (array of
 * hourly readings). Returns measured temp/humidity/pressure/wind + obs time.
 */
function parseAemetObs(payload: unknown): AemetObs | null {
  if (!Array.isArray(payload) || payload.length === 0) return null;
  // Last reading with a numeric air temperature.
  for (let i = payload.length - 1; i >= 0; i--) {
    const r = payload[i] as AemetObsReading;
    if (typeof r?.ta === 'number') {
      return {
        ta: Math.round(r.ta),
        hr: typeof r.hr === 'number' ? Math.round(r.hr) : null,
        pres: typeof r.pres === 'number' ? Math.round(r.pres) : null,
        windKmh: typeof r.vv === 'number' ? Math.round(r.vv * 3.6) : null,
        fint: r.fint ? new Date(r.fint) : null,
      };
    }
  }
  return null;
}

const KNOTS_TO_KMH = 1.852;

/** Zip an OceanDrivers series ({"0":v,…} parallel objects) into WindHistoryPoint[]. */
function parseWindSeries(series: OceanDriversSeries | null | undefined): WindHistoryPoint[] {
  if (!series?.TIME || !series.TWS) return [];
  const n = series.length ?? Object.keys(series.TIME).length;
  const pts: WindHistoryPoint[] = [];
  for (let i = 0; i < n; i++) {
    const k = String(i);
    const t = series.TIME[k];
    const ws = series.TWS[k];
    if (t == null || ws == null) continue;
    const gust = series.TWS_GUST?.[k];
    const dir = series.TWD?.[k];
    pts.push({
      time: new Date(t),
      windSpeed: Math.round(ws * KNOTS_TO_KMH),
      windGust: gust != null ? Math.round(gust * KNOTS_TO_KMH) : null,
      windDirection: dir != null ? Math.round(dir) : null,
    });
  }
  return pts;
}

/** Build WindHistory from the oceandrivers-history payload, or undefined. */
function parseWindHistory(h: OceanDriversHistory | undefined): WindHistory | undefined {
  if (!h) return undefined;
  const hour = parseWindSeries(h.hour);
  const day = parseWindSeries(h.day);
  if (!hour.length && !day.length) return undefined;
  return { source: 'oceandrivers', hour, day };
}

/** Parse an OceanDrivers live reading → measured wind in km/h. Null if inactive/absent. */
function parseOceanDrivers(
  od: OceanDriversLive | undefined,
): { windSpeed: number; windDirection: number; windGust: number | null; observedAt: Date | null; station: string } | null {
  if (!od || od.ACTIVE === 'OFF' || typeof od.TWS !== 'number' || typeof od.TWD !== 'number') return null;
  const gustKt = od.TWS_GUST ?? (od.TWS_GUST_MAX?.VALUE != null ? Number(od.TWS_GUST_MAX.VALUE) : null);
  return {
    windSpeed: Math.round(od.TWS * KNOTS_TO_KMH),
    windDirection: Math.round(od.TWD),
    windGust: gustKt != null && Number.isFinite(gustKt) ? Math.round(gustKt * KNOTS_TO_KMH) : null,
    observedAt: od.TIME ? new Date(od.TIME) : null,
    station: 'live-station',
  };
}

/** Stamp the current temperature onto today's day row (drives the Week marker). */
function stampTodayCurrent(days: DayForecast[], currentTemp: number): void {
  const today = days.find((d) => d.dayName === 'Today');
  if (today) today.tempCurrent = currentTemp;
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

async function normalizeSpain(loc: Location, p: ProxyPayloads): Promise<WeatherConditions> {
  const hourly = p['aemet-hourly']?.[0];
  const daily = p['aemet-daily']?.[0];
  // User-added ES locations (no AEMET municipio) fall back to Open-Meteo —
  // same path as Portugal. AEMET-by-coords resolver is a follow-up.
  if (!hourly || !daily) {
    if (p['om-forecast']) return normalizeOpenMeteoFallback(loc, p);
    throw new Error(`ES location ${loc.id}: missing AEMET data`);
  }
  const marine = p['om-marine'] ?? null;

  let hours = aemetHourlyToHours(hourly, marine, loc.timezone);
  const days = aemetDailyToDays(daily, loc.timezone);

  // AEMET hourly has no per-hour UV index or cloud_cover %. Overlay them from
  // Open-Meteo where the times align. Keeps AEMET's MOS-corrected temp/wind/
  // precip/sky as primary — OM only fills the gaps.
  if (p['om-forecast']) hours = overlayUvCloudFromOm(hours, p['om-forecast']);

  // AEMET hourly only covers ~48h. Extend the array with OM-only hours past
  // the AEMET tail so the Graph view's 72h+ range has data to plot.
  if (p['om-forecast']) hours = extendHoursWithOm(hours, p['om-forecast'], marine);

  // Obs-based plausibility check: override AEMET Fog/Haze blocks when nearby
  // stations report dry air (RH<90%) or breeze (>10 kt) — fog can't physically
  // form in those conditions, so trust the station over the model.
  const obs = parseAemetObs(p['aemet-obs']);
  hours = plausibilityCheckSky(hours, obs, p.oceandrivers, loc.timezone);
  let current = currentFromHour(nearestHour(hours));

  // Overlay measured station observation onto current where available (temp/
  // humidity/pressure). Sky + wind stay from the forecast hour (the conventional
  // station feed has no sky code and often no wind). Provenance reflects which.
  let tempIsObserved = false;
  if (obs) {
    current = {
      ...current,
      temperature: obs.ta ?? current.temperature,
      feelsLike: obs.ta ?? current.feelsLike, // station has no apparent temp; use measured air temp
      humidity: obs.hr ?? current.humidity,
      pressure: obs.pres ?? current.pressure,
      observedAt: obs.fint ?? current.observedAt,
    };
    tempIsObserved = obs.ta != null;
  }
  stampTodayCurrent(days, current.temperature);
  const sun = computeSunPhases(new Date(), loc.lat, loc.lon);
  const moon = computeMoonInfo(new Date(), loc.lat, loc.lon);

  const sources: SourceMap = {
    temperature: prov('aemet', 'high'),
    wind: prov('aemet', 'high'),
    precipitation: prov('aemet', 'high'),
    // UV + cloud come from OM when overlay applied (AEMET has no per-hour UV).
    uv: prov(p['om-forecast'] ? 'open-meteo' : 'aemet', p['om-forecast'] ? 'medium' : 'high', 'best_match'),
    sky: prov('aemet', 'high'),
    sun: prov('suncalc', 'high'),
    current: prov('aemet', 'high', tempIsObserved ? 'station-obs' : 'forecast'),
  };
  if (marine) {
    const marineConf: Confidence = loc.timezone === 'Atlantic/Canary' ? 'low' : 'medium';
    sources.marine = prov('open-meteo-marine', marineConf, 'best_match');
  }

  // Live measured wind from a nearby OceanDrivers station (Bay of Palma) — beats
  // the AEMET forecast hour for current wind. Overlays current.wind* + provenance.
  const live = parseOceanDrivers(p.oceandrivers);
  if (live) {
    current = { ...current, windSpeed: live.windSpeed, windDirection: live.windDirection, windGust: live.windGust ?? current.windGust, observedAt: live.observedAt ?? current.observedAt };
    sources.wind = prov('oceandrivers', 'high', live.station);
  }
  const windHistory = parseWindHistory(p['oceandrivers-history']);
  const rainNowcast = p['om-forecast'] ? rainNowcastFromOm(p['om-forecast']) : undefined;

  return { location: loc, current, hours, days, sun, moon, alerts: [], sources, windHistory, rainNowcast, assembledAt: new Date().toISOString() };
}

/**
 * Generic Open-Meteo-only normalization for user-added locations without a
 * national-service ID (no AEMET municipio for ES, no IPMA globalIdLocal for PT).
 * Hourly + daily both from OM `best_match`; marine when coastal. Confidence
 * `medium` (no MOS correction, no station overlay).
 */
async function normalizeOpenMeteoFallback(loc: Location, p: ProxyPayloads): Promise<WeatherConditions> {
  const omForecast = p['om-forecast'];
  if (!omForecast) throw new Error(`${loc.id}: missing om-forecast (fallback)`);
  const marine = p['om-marine'] ?? null;
  const hours = hoursFromOpenMeteo(omForecast, marine);
  const days = daysFromOpenMeteo(omForecast, loc.timezone);
  const current = currentFromHour(nearestHour(hours));
  stampTodayCurrent(days, current.temperature);
  const sun = computeSunPhases(new Date(), loc.lat, loc.lon);
  const moon = computeMoonInfo(new Date(), loc.lat, loc.lon);

  const sources: SourceMap = {
    temperature: prov('open-meteo', 'medium', 'best_match'),
    wind: prov('open-meteo', 'medium', 'best_match'),
    precipitation: prov('open-meteo', 'medium', 'best_match'),
    uv: prov('open-meteo', 'medium', 'best_match'),
    sky: prov('open-meteo', 'medium', 'best_match'),
    sun: prov('suncalc', 'high'),
    current: prov('open-meteo', 'medium', 'best_match'),
  };
  if (marine) sources.marine = prov('open-meteo-marine', 'medium', 'best_match');
  const rainNowcast = rainNowcastFromOm(omForecast);
  return { location: loc, current, hours, days, sun, moon, alerts: [], sources, rainNowcast, assembledAt: new Date().toISOString() };
}

async function normalizePortugal(loc: Location, p: ProxyPayloads): Promise<WeatherConditions> {
  const ipmaDaily = p['ipma-daily']?.data;
  const omForecast = p['om-forecast'];
  if (!ipmaDaily || !omForecast) throw new Error(`PT location ${loc.id}: missing forecast data`);
  const marine = p['om-marine'] ?? null;
  const sea = p['ipma-sea'] ?? null;

  // Hours: Open-Meteo (IPMA has no hourly). Waves: OM Marine fill.
  const hours = hoursFromOpenMeteo(omForecast, marine);
  // Days: IPMA land (HIGH) + IPMA sea waves where available.
  const days = ipmaDailyToDays(ipmaDaily, sea, loc.timezone);
  const current = currentFromHour(nearestHour(hours));
  stampTodayCurrent(days, current.temperature);
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
  const rainNowcast = rainNowcastFromOm(omForecast);

  return { location: loc, current, hours, days, sun, moon, alerts: [], sources, rainNowcast, assembledAt: new Date().toISOString() };
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
  const sorted = hours.sort((a, b) => a.time.getTime() - b.time.getTime());
  return smoothIsolatedFog(sorted);
}

/**
 * AEMET's automated model often forecasts an isolated `Niebla`/`Bruma` hour
 * sandwiched between clear hours (atmospherically implausible — fog doesn't form
 * and dissipate inside a single hour while the sky is clear on either side).
 * If a single Fog/Haze hour sits between two CLEAR/Mostly-clear/Sunny hours,
 * demote it to the surrounding condition. Multi-hour fog blocks are left alone.
 */
function smoothIsolatedFog(hs: HourForecast[]): HourForecast[] {
  const clear = new Set<ConditionCode>(['Clear', 'Mostly clear', 'Sunny', 'Mostly sunny']);
  const muddy = new Set<ConditionCode>(['Fog', 'Haze']);
  for (let i = 1; i < hs.length - 1; i++) {
    const prev = hs[i - 1].description;
    const cur = hs[i].description;
    const next = hs[i + 1].description;
    if (muddy.has(cur) && clear.has(prev) && clear.has(next)) {
      hs[i] = { ...hs[i], description: prev };
    }
  }
  return hs;
}

/**
 * Find the nearest non-Fog/Haze description in either direction. Falls back to
 * 'Mostly clear' when nothing is available within the window (rare — only at
 * the array edges, where this still beats keeping a wrong Fog code).
 */
function nearestClearDescription(hs: HourForecast[], i: number): ConditionCode {
  const muddy = new Set<ConditionCode>(['Fog', 'Haze']);
  for (let step = 1; step < hs.length; step++) {
    const before = hs[i - step];
    if (before && !muddy.has(before.description)) return before.description;
    const after = hs[i + step];
    if (after && !muddy.has(after.description)) return after.description;
  }
  return 'Mostly clear';
}

/**
 * Obs-based fog/haze plausibility check. AEMET's automated MOS sometimes calls
 * coastal Fog/Haze for full multi-hour blocks when nearby station observations
 * say the air is dry and breezy — meteorologically incompatible with fog.
 *
 * Rule: for each Fog/Haze hour ON THE SAME LOCAL DAY as a station reading
 * (within ~3h of the obs instant), if any nearby station shows
 *   - relative humidity < 90%, OR
 *   - wind > 10 kt (~18.5 km/h)
 * override the description to the nearest non-muddy hour's value, stamping
 * `adjusted` with the original code + reason so the UI can badge it.
 *
 * Station sources used (in order): OceanDrivers live (Bay of Palma) > AEMET
 * conventional station obs (RH + 10-min mean wind in m/s).
 */
function plausibilityCheckSky(
  hs: HourForecast[],
  obs: AemetObs | null,
  live: OceanDriversLive | undefined,
  timezone: string,
): HourForecast[] {
  // Gather best-available RH + wind from station obs.
  let rh: number | null = null;
  let windKmh: number | null = null;
  let obsTime: Date | null = null;

  if (live && live.ACTIVE !== 'OFF') {
    if (typeof live.HUMIDITY === 'number') rh = Math.round(live.HUMIDITY);
    if (typeof live.TWS === 'number') windKmh = Math.round(live.TWS * KNOTS_TO_KMH);
    if (live.TIME) obsTime = new Date(live.TIME);
  }
  if (obs) {
    if (rh == null && obs.hr != null) rh = obs.hr;
    if (windKmh == null && obs.windKmh != null) windKmh = obs.windKmh;
    if (obsTime == null && obs.fint) obsTime = obs.fint;
  }
  if (rh == null && windKmh == null) return hs; // nothing to test against

  const dry = rh != null && rh < 90;
  const breezy = windKmh != null && windKmh > 18.5; // 10 kt
  if (!dry && !breezy) return hs; // obs supports fog; trust forecast

  const obsDayKey = obsTime ? localDateKey(obsTime, timezone) : localDateKey(new Date(), timezone);
  const muddy = new Set<ConditionCode>(['Fog', 'Haze']);
  const reasonBits: string[] = [];
  if (rh != null) reasonBits.push(`RH ${rh}%`);
  if (windKmh != null) reasonBits.push(`wind ${Math.round(windKmh / KNOTS_TO_KMH)} kt`);
  const reason = `station obs: ${reasonBits.join(', ')}`;

  return hs.map((h, i) => {
    if (!muddy.has(h.description)) return h;
    // Only override hours on the obs day; far-future fog stays as forecast.
    if (localDateKey(h.time, timezone) !== obsDayKey) return h;
    const replacement = nearestClearDescription(hs, i);
    return {
      ...h,
      description: replacement,
      adjusted: { from: h.description, reason },
    };
  });
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

async function assemble(loc: Location): Promise<WeatherConditions> {
  // Pass full location metadata so the edge auto-registers user-added places
  // (geocoded results) on first call. Idempotent for seed rows.
  const { payloads } = await fetchFromProxy(loc.id, {
    name: loc.name, region: loc.region, country: loc.country,
    lat: loc.lat, lon: loc.lon, timezone: loc.timezone,
  });
  // ES + PT have national-service primaries; anywhere else falls back to OM.
  if (loc.country === 'ES') return normalizeSpain(loc, payloads);
  if (loc.country === 'PT') return normalizePortugal(loc, payloads);
  return normalizeOpenMeteoFallback(loc, payloads);
}

/**
 * In-flight de-duplication: if a bundle for this location is already being
 * fetched (e.g. a Home card and the Today view mounting at once), share the same
 * promise instead of firing a duplicate set of upstream calls.
 */
const inFlight = new Map<string, Promise<WeatherConditions>>();

/** Fetch + normalize a full WeatherConditions bundle for a location (deduped). */
export function getWeather(loc: Location): Promise<WeatherConditions> {
  const existing = inFlight.get(loc.id);
  if (existing) return existing;
  const p = assemble(loc).finally(() => inFlight.delete(loc.id));
  inFlight.set(loc.id, p);
  return p;
}
