/**
 * Sun & moon — computed locally with suncalc, no network. Produces the canonical
 * `SunPhases` + `MoonInfo` for the Today/Sun view.
 *
 * All returned `Date`s are absolute instants (suncalc works in UTC internally);
 * render them in the LOCATION's timezone. Twilight phase names map to suncalc's
 * getTimes() keys; golden-hour start/end are suncalc's `goldenHour`/`goldenHourEnd`.
 */

import SunCalc from 'suncalc';
import type { MoonInfo, MoonPhase, SunPhases } from '@/types/weather';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Full twilight + golden-hour phases for a given date/coordinate. */
export function computeSunPhases(date: Date, lat: number, lon: number): SunPhases {
  const t = SunCalc.getTimes(date, lat, lon);
  const yesterday = SunCalc.getTimes(new Date(date.getTime() - DAY_MS), lat, lon);
  const tomorrow = SunCalc.getTimes(new Date(date.getTime() + DAY_MS), lat, lon);

  const lengthMs = (x: { sunrise: Date; sunset: Date }) => x.sunset.getTime() - x.sunrise.getTime();

  return {
    astroDawn: t.nightEnd, // astronomical dawn
    nauticalDawn: t.nauticalDawn,
    civilDawn: t.dawn,
    sunrise: t.sunrise,
    goldenEnd: t.goldenHourEnd, // morning golden hour ends
    solarNoon: t.solarNoon,
    goldenStart: t.goldenHour, // evening golden hour starts
    sunset: t.sunset,
    civilDusk: t.dusk,
    nauticalDusk: t.nauticalDusk,
    astroDusk: t.night, // astronomical dusk
    yesterdayLengthMs: lengthMs(yesterday),
    tomorrowLengthMs: lengthMs(tomorrow),
  };
}

const PHASE_NAMES: MoonPhase[] = [
  'New',
  'Waxing crescent',
  'First quarter',
  'Waxing gibbous',
  'Full',
  'Waning gibbous',
  'Last quarter',
  'Waning crescent',
];

/** Map suncalc's 0..1 phase fraction to a named phase. */
function phaseName(fraction: number): MoonPhase {
  // suncalc: 0 = new, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter.
  // Bucket into 8 names; the 4 cardinal points get a narrow band.
  const eps = 0.02;
  if (fraction < eps || fraction > 1 - eps) return 'New';
  if (Math.abs(fraction - 0.25) < eps) return 'First quarter';
  if (Math.abs(fraction - 0.5) < eps) return 'Full';
  if (Math.abs(fraction - 0.75) < eps) return 'Last quarter';
  const idx = Math.floor(fraction * 8 + 0.5) % 8;
  return PHASE_NAMES[idx];
}

export function computeMoonInfo(date: Date, lat: number, lon: number): MoonInfo {
  const illum = SunCalc.getMoonIllumination(date);
  const times = SunCalc.getMoonTimes(date, lat, lon);
  return {
    phase: phaseName(illum.phase),
    phaseFraction: illum.phase,
    illumination: Math.round(illum.fraction * 100),
    moonrise: times.rise ?? null,
    moonset: times.set ?? null,
  };
}
