/**
 * Condition-code normalizers: map each provider's sky encoding to the canonical
 * `ConditionCode` string union. The normalize layer is where these explicit
 * choices live (per the type contract's design note).
 */

import type { ConditionCode } from '@/types/weather';

/**
 * WMO weather codes (Open-Meteo, IPMA shares the spirit) → ConditionCode.
 * From design_handoff_sw_weather/ARCHITECTURE.md.
 */
const WMO: Record<number, ConditionCode> = {
  0: 'Clear',
  1: 'Mostly clear',
  2: 'Partly cloudy',
  3: 'Cloudy',
  45: 'Fog',
  48: 'Fog',
  51: 'Light rain',
  53: 'Light rain',
  55: 'Light rain',
  56: 'Light rain',
  57: 'Light rain',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Light rain',
  67: 'Rain',
  71: 'Snow',
  73: 'Snow',
  75: 'Snow',
  77: 'Snow',
  80: 'Light rain',
  81: 'Rain',
  82: 'Heavy rain',
  85: 'Snow',
  86: 'Snow',
  95: 'Thunder',
  96: 'Thunder',
  99: 'Thunder',
};

export function wmoToCondition(code: number): ConditionCode {
  return WMO[code] ?? 'Cloudy';
}

/**
 * AEMET estadoCielo numeric code (night `n` suffix already stripped) → ConditionCode.
 * AEMET codes: 11 despejado, 12-13 poco nuboso, 14-17 nuboso/cubierto/nubes altas,
 * 23-26 lluvia, 33-36 nieve, 43-46 lluvia escasa, 51-54/61-64 tormenta, 81-83 niebla/bruma.
 * See https://www.aemet.es/ for the full table; we bucket into the union.
 */
export function aemetSkyToCondition(code: string): ConditionCode {
  // Official AEMET estadoCielo codes (night 'n' suffix already stripped):
  //  11 Despejado · 12 Poco nuboso · 13 Intervalos nubosos · 14 Nuboso
  //  15 Muy nuboso · 16 Cubierto · 17 Nubes altas (high cirrus — reads CLEAR)
  //  23–26 lluvia · 33–36 nieve · 43–46 lluvia escasa · 51–54/61–64 tormenta
  //  71–74 nieve escasa · 81 niebla · 82 bruma · 83 calima
  const n = Number(code);
  if (!Number.isFinite(n)) return 'Cloudy';
  switch (n) {
    case 11:
      return 'Clear';
    case 12:
    case 17: // Nubes altas — thin high cloud; on the ground it's a clear/sunny sky
      return 'Mostly clear';
    case 13:
    case 14:
      return 'Partly cloudy';
    case 15:
    case 16:
      return 'Cloudy';
  }
  if (n === 81 || n === 82 || n === 83) return 'Fog'; // niebla / bruma / calima
  if ((n >= 51 && n <= 54) || (n >= 61 && n <= 64)) return 'Thunder';
  if ((n >= 33 && n <= 36) || (n >= 71 && n <= 74)) return 'Snow';
  if (n === 25 || n === 26) return 'Heavy rain'; // muy nuboso/cubierto + lluvia
  if (n === 23 || n === 24 || (n >= 43 && n <= 46)) return 'Light rain';
  return 'Cloudy';
}

/**
 * IPMA idWeatherType → ConditionCode. IPMA ids (1 clear, 2-4 cloud grades,
 * 5-10 rain/showers, 11-13 fog/snow, 14+ thunder). Bucketed from
 * /weather-type-classe.json descriptions.
 */
export function ipmaTypeToCondition(id: number): ConditionCode {
  switch (id) {
    case 1:
      return 'Clear';
    case 2:
    case 3:
      return 'Mostly clear';
    case 4:
      return 'Cloudy';
    case 5:
    case 6:
    case 9:
    case 10:
      return 'Light rain';
    case 7:
    case 8:
      return 'Rain';
    case 11:
    case 12:
    case 13:
      return 'Heavy rain';
    case 14:
    case 15:
    case 16:
      return 'Fog';
    case 18:
    case 26:
    case 27:
      return 'Snow';
    case 19:
    case 20:
    case 23:
      return 'Thunder';
    default:
      return 'Cloudy';
  }
}

/** Compass point ('N','NE',…) → degrees (0 = from north). */
const COMPASS: Record<string, number> = {
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SO: 225, // AEMET uses SO for SW
  SW: 225,
  O: 270, // AEMET uses O for W
  W: 270,
  NO: 315, // AEMET uses NO for NW
  NW: 315,
};

export function compassToDegrees(dir: string | null | undefined): number | null {
  if (!dir) return null;
  return COMPASS[dir.toUpperCase()] ?? null;
}

/** Daytime presentation: swap Clear/Mostly clear → Sunny/Mostly sunny. */
export function dayVariant(code: ConditionCode, isNight: boolean): ConditionCode {
  if (isNight) return code;
  if (code === 'Clear') return 'Sunny';
  if (code === 'Mostly clear') return 'Mostly sunny';
  return code;
}
