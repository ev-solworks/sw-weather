/**
 * annotations.ts — top-banner warnings only.
 *
 * Surfaces ONLY things that need attention RIGHT NOW. No general info chips,
 * no temp-trend, no golden-hour reminders. The Visual hero is the answer to
 * "what's the weather"; this engine is the answer to "what's about to go wrong".
 *
 * Renders above the hero as banners (per-condition styling in AnnotationStrip).
 */

import type { WeatherConditions, HourForecast, ConditionCode } from '@/types/weather';
import { fmtTime } from '@/utils/format';

export type AnnotationKind = 'urgent' | 'info';

export interface Annotation {
  id: string;
  kind: AnnotationKind;
  text: string;
  icon?: ConditionCode | 'wind' | 'sun' | 'thermo' | 'umbrella';
  priority?: number;
  when?: Date;
}

export function getAnnotations(weather: WeatherConditions): Annotation[] {
  const tz = weather.location.timezone;
  const all: Annotation[] = [];
  const next8 = nextHours(weather.hours, 8);

  // Severe weather warnings from AEMET / IPMA — always urgent.
  for (const a of weather.alerts) {
    all.push({
      id: `alert-${a.id}`,
      kind: 'urgent',
      icon: 'Thunder',
      text: `${a.severity.toUpperCase()} · ${a.phenomenon} · ${a.headline}`,
      priority: a.severity === 'red' ? 100 : a.severity === 'orange' ? 80 : 60,
    });
  }

  // Dangerous gust within 8h.
  const peakGust = next8.reduce<HourForecast | null>((best, h) => (best && best.windGust >= h.windGust ? best : h), null);
  if (peakGust && peakGust.windGust >= 50) {
    all.push({
      id: 'peak-gust',
      kind: 'urgent',
      icon: 'wind',
      text: `Strong gust ${Math.round(peakGust.windGust)} km/h at ${fmtTime(peakGust.time, tz)}`,
      priority: 50,
      when: peakGust.time,
    });
  }

  // Rain onset (≥60% prob) within next 8h, only if the minutely banner isn't
  // already covering it.
  if (!weather.rainNowcast?.slots.some((s) => s.mm > 0.05)) {
    const rainHr = next8.find((h) => h.precipProbability >= 60);
    if (rainHr) {
      all.push({
        id: 'rain-onset',
        kind: 'info',
        icon: 'Rain',
        text: `Rain likely from ${fmtTime(rainHr.time, tz)} (${rainHr.precipProbability}%)`,
        priority: 30,
        when: rainHr.time,
      });
    }
  }

  return all.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

function nextHours(hours: HourForecast[], n: number): HourForecast[] {
  const now = Date.now();
  const idx = hours.findIndex((h) => h.time.getTime() >= now - 3600_000);
  if (idx < 0) return [];
  return hours.slice(idx, idx + n);
}
