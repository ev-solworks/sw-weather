/**
 * Canonical weather type contract for SW Weather.
 *
 * Single source of truth for "what does our app think weather data looks like".
 * Views consume ONLY these types — never raw AEMET / IPMA / Open-Meteo payloads.
 * The normalization layer (src/services/normalize.ts) maps every provider's
 * response into these shapes.
 *
 * Design lineage: the flat per-hour / per-day shape and field names come from the
 * claude.ai/design handoff (design_handoff_sw_weather/ARCHITECTURE.md) so the view
 * components drop in unchanged. Provenance/confidence come from the data-source
 * research (docs/DATA-SOURCES-RESEARCH.md) — the visible differentiator vs eltiempo.es.
 *
 * Units are fixed at this boundary (see each field). All `Date`s are absolute
 * instants; render them in the LOCATION's timezone (Location.timezone), never the
 * device's. Fields that a given location/source can't provide are `null`, never
 * faked to 0 (e.g. waves at an inland location).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Provenance & confidence
// ─────────────────────────────────────────────────────────────────────────────

/** Which upstream produced a value. Open-Meteo splits by sub-API (separate hosts). */
export type SourceId =
  | 'aemet' // Spain national, MOS-corrected
  | 'ipma' // Portugal + Atlantic islands national, MOS-corrected
  | 'open-meteo' // forecast API (Best Match / named models)
  | 'open-meteo-marine' // waves, sea-surface temp
  | 'open-meteo-aq' // pollen, AQI
  | 'oceandrivers' // live measured station (Bay of Palma), ~2–10s updates
  | 'suncalc'; // locally computed sun/moon (no network)

/**
 * Confidence in a field's value.
 * - `high`   national met service, MOS-corrected (AEMET / IPMA land fields)
 * - `medium` raw model output (Open-Meteo forecast/marine near coast)
 * - `low`    sparse/far grid (Open-Meteo marine far offshore, AQ over open ocean,
 *            or global-model fallback over the Canaries / Azores / Madeira)
 */
export type Confidence = 'high' | 'medium' | 'low';

/** Provenance for one field (or one coherent group of fields). */
export interface FieldProvenance {
  source: SourceId;
  /** Open-Meteo model when relevant, e.g. 'best_match' | 'icon_eu' | 'arome' | 'ecmwf'. */
  model?: string;
  confidence: Confidence;
  /** ISO instant the value was fetched; with the source TTL this governs staleness. */
  fetchedAt: string;
}

/**
 * Per-field provenance map, keyed by a field name from HourForecast / DayForecast /
 * CurrentConditions (e.g. 'temperature', 'waveHeight', 'precipProbability').
 * The UI reads this to badge "AEMET official" vs "model estimate" and to flag
 * low-confidence marine/altitude data. Not every numeric field needs an entry —
 * group by source where a provider supplies a coherent block (e.g. all marine
 * fields share one 'open-meteo-marine' entry under 'marine').
 */
export type SourceMap = Record<string, FieldProvenance>;

// ─────────────────────────────────────────────────────────────────────────────
// Condition codes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalized sky-condition string union (from the design). The normalize layer is
 * forced to make explicit choices (e.g. WMO 45/48 → 'Fog'); see
 * design_handoff_sw_weather/ARCHITECTURE.md for the WMO→ConditionCode map.
 * 'Sunny' / 'Mostly sunny' are daytime presentations of 'Clear' / 'Mostly clear';
 * pair with the `isNight` flag rather than emitting them at night.
 */
export type ConditionCode =
  | 'Clear'
  | 'Mostly clear'
  | 'Partly cloudy'
  | 'Cloudy'
  | 'Light rain'
  | 'Rain'
  | 'Heavy rain'
  | 'Thunder'
  | 'Snow'
  | 'Fog'
  | 'Haze'
  | 'Sunny'
  | 'Mostly sunny';

// ─────────────────────────────────────────────────────────────────────────────
// Hour / day forecast
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One hour of forecast. Drives Today/Visual, Today/Windguru, Today/Graph.
 * Marine fields are `null` for locations with no sea-state coverage (inland, or
 * where no provider supplies waves) — never 0.
 */
export interface HourForecast {
  time: Date; // hour-aligned absolute instant
  temperature: number; // °C
  feelsLike: number; // °C
  humidity: number; // 0–100 %
  windSpeed: number; // km/h
  windDirection: number; // degrees, 0 = FROM north
  windGust: number; // km/h
  precipProbability: number; // 0–100 %
  precipAmount: number; // mm in this hour
  uvIndex: number; // 0–11+
  cloudCover: number; // 0–100 %
  description: ConditionCode;
  isNight: boolean; // for icon/palette night-swap

  // Marine (nullable — region-dependent; see DATA-SOURCES-RESEARCH.md)
  waveHeight: number | null; // m
  wavePeriod: number | null; // s
  waveDirection: number | null; // degrees, 0 = FROM north
  seaTemperature: number | null; // °C (sea-surface)
}

/**
 * One day of forecast. Drives Home cards and the Week view.
 * `tempCurrent` is non-null only for today.
 */
export interface DayForecast {
  date: Date;
  dayName: string; // 'Today' | 'Mon' | … (presentation; localize in view)
  tempHi: number; // °C
  tempLo: number; // °C
  tempCurrent: number | null; // °C, today only
  description: ConditionCode;
  rainProbability: number; // 0–100 %
  rainAmount: number; // mm total for the day
  windAvg: number; // km/h
  windGust: number; // km/h
  windDirection: number; // degrees
  uvMax: number; // 0–11+
  sunrise: Date;
  sunset: Date;

  // Marine (nullable)
  waveHeight: number | null; // m (day max or representative)
  wavePeriod: number | null; // s
  seaTemperature: number | null; // °C

  /** True for far-horizon days where only global models exist (badge as uncertain). */
  lowConfidence?: boolean;
}

/**
 * Real-time current conditions. Prefer a national observation (AEMET station) where
 * available; otherwise the model "current" block. Distinct from HourForecast because
 * observations carry fields a forecast hour doesn't (pressure, visibility, lastUpdated).
 */
export interface CurrentConditions {
  temperature: number; // °C
  feelsLike: number; // °C
  humidity: number; // 0–100 %
  windSpeed: number; // km/h
  windDirection: number; // degrees
  windGust: number | null; // km/h
  pressure: number | null; // hPa / mb
  visibility: number | null; // km
  cloudCover: number | null; // 0–100 %
  uvIndex: number | null; // 0–11+
  description: ConditionCode;
  isNight: boolean;
  observedAt: Date; // when the observation/model-current is valid
}

// ─────────────────────────────────────────────────────────────────────────────
// Sun & moon (computed locally via suncalc — see services/sun.ts)
// ─────────────────────────────────────────────────────────────────────────────

export interface SunPhases {
  astroDawn: Date;
  nauticalDawn: Date;
  civilDawn: Date;
  sunrise: Date;
  goldenEnd: Date; // morning golden hour ends
  solarNoon: Date;
  goldenStart: Date; // evening golden hour starts
  sunset: Date;
  civilDusk: Date;
  nauticalDusk: Date;
  astroDusk: Date;
  yesterdayLengthMs: number;
  tomorrowLengthMs: number;
}

export type MoonPhase =
  | 'New'
  | 'Waxing crescent'
  | 'First quarter'
  | 'Waxing gibbous'
  | 'Full'
  | 'Waning gibbous'
  | 'Last quarter'
  | 'Waning crescent';

export interface MoonInfo {
  phase: MoonPhase;
  phaseFraction: number; // 0=new, 0.5=full, 1=new again
  illumination: number; // 0–100 %
  moonrise: Date | null;
  moonset: Date | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Alerts
// ─────────────────────────────────────────────────────────────────────────────

/** Official warning (AEMET avisos CAP / IPMA warnings, incl. Agitação Marítima). */
export interface WeatherAlert {
  id: string;
  source: 'aemet' | 'ipma';
  /** AEMET/IPMA both broadly use green/yellow/orange/red severity bands. */
  severity: 'yellow' | 'orange' | 'red';
  /** e.g. 'wind' | 'rain' | 'coastal' | 'snow' | 'heat' | 'cold'. */
  phenomenon: string;
  headline: string;
  description: string;
  onset: Date;
  expires: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Location
// ─────────────────────────────────────────────────────────────────────────────

export type CountryCode = 'ES' | 'PT';

/**
 * A place the app shows weather for. Carries the source-routing IDs so the
 * normalize layer knows which national service to call. `country` selects the
 * primary national source (ES→AEMET, PT→IPMA). Coordinates always present (used
 * for Open-Meteo, marine, and suncalc). Every location carries its own `timezone`.
 */
export interface Location {
  id: string;
  name: string;
  region: string;
  country: CountryCode;
  lat: number;
  lon: number;
  timezone: string; // IANA, e.g. 'Europe/Madrid' | 'Atlantic/Canary' | 'Atlantic/Azores'

  // Source-routing IDs (filled per country; the others stay undefined)
  aemetMunicipio?: string; // 5-digit zero-padded string, e.g. '07040' — DON'T parseInt
  aemetStation?: string; // alphanumeric, e.g. 'B228'
  ipmaGlobalIdLocal?: number; // e.g. 1110600

  /** Whether this location has meaningful sea-state coverage (drives marine UI). */
  isCoastal?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Top-level bundle
// ─────────────────────────────────────────────────────────────────────────────

/** One point of measured wind history (from a live station). Speeds in km/h. */
export interface WindHistoryPoint {
  time: Date;
  windSpeed: number;
  windGust: number | null;
  windDirection: number | null;
}

/**
 * Measured wind/gust history from a live station (e.g. OceanDrivers). Present only
 * for locations with a live station. `hour` = last 60 min (1-min); `day` = last 24h.
 */
export interface WindHistory {
  source: SourceId;
  hour: WindHistoryPoint[];
  day: WindHistoryPoint[];
}

/**
 * The normalized weather bundle for one location — the output of the normalize
 * layer and the input to the view hooks. Views consume the slice they need.
 *
 * `sources` is the per-field provenance map (keyed by field name) used to badge
 * official vs model data and flag low-confidence marine/altitude values.
 */
export interface WeatherConditions {
  location: Location;
  current: CurrentConditions;
  hours: HourForecast[]; // ~48h
  days: DayForecast[]; // ~7–14d
  sun: SunPhases;
  moon: MoonInfo;
  alerts: WeatherAlert[];
  sources: SourceMap;
  /** Live measured wind history (present only when a live station is configured). */
  windHistory?: WindHistory;
  /** ISO instant this bundle was assembled (for the "updated X ago" line). */
  assembledAt: string;
}
