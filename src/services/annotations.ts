/**
 * annotations.ts — plain-language annotation rule engine.
 *
 * Surfaces useful at-a-glance cues from the forecast bundle. Hand-authored
 * rules, no LLM. Each rule examines WeatherConditions and emits zero or more
 * annotations, ordered by priority.
 *
 * Output kinds:
 *   • `urgent`  — banner-worthy (severe wx)
 *   • `info`    — secondary chip beneath hero (peak gust, rain onset,
 *     golden-hour window, temp trend)
 *   • `compare` — historical / cross-window comparisons
 *
 * Render rules:
 *   • At most one `urgent`
 *   • Up to three `info`
 *   • One `compare`
 *
 * Production-specific cues (drone window, jib threshold, talent cover) live
 * elsewhere or have been removed — annotations stay neutral.
 */

import type { WeatherConditions, HourForecast, ConditionCode } from '@/types/weather';
import { fmtTime } from '@/utils/format';

export type AnnotationKind = 'urgent' | 'info' | 'compare';

export interface Annotation {
  id: string;
  kind: AnnotationKind;
  text: string;
  /** Canonical ConditionCode for icon, or one of the synthetic 'wind' / 'sun' / 'thermo' / 'umbrella' tags. */
  icon?: ConditionCode | 'wind' | 'sun' | 'thermo' | 'umbrella';
  /** Priority (higher = more important). Default 0. */
  priority?: number;
  /** Optional time the annotation refers to (for graph positioning). */
  when?: Date;
}

/** Public API: get all annotations sorted by priority desc. */
export function getAnnotations(weather: WeatherConditions): Annotation[] {
  const tz = weather.location.timezone;
  const all: Annotation[] = [];
  const next8 = nextHours(weather.hours, 8);

  // ── Urgent ────────────────────────────────────────────────────────────────

  // Severe weather alerts (from AEMET/IPMA).
  for (const a of weather.alerts) {
    all.push({
      id: `alert-${a.id}`,
      kind: 'urgent',
      icon: 'Thunder',
      text: `${a.severity.toUpperCase()} · ${a.phenomenon} · ${a.headline}`,
      priority: a.severity === 'red' ? 100 : a.severity === 'orange' ? 80 : 60,
    });
  }

  // ── Info ─────────────────────────────────────────────────────────────────

  // Peak gust within next 8h (any significant value).
  const peakGust = next8.reduce<HourForecast | null>((best, h) => (best && best.windGust >= h.windGust ? best : h), null);
  if (peakGust && peakGust.windGust >= 30) {
    all.push({
      id: 'peak-gust',
      kind: 'info',
      icon: 'wind',
      text: `Gust ${Math.round(peakGust.windGust)} km/h at ${fmtTime(peakGust.time, tz)}`,
      priority: peakGust.windGust >= 50 ? 75 : 55,
      when: peakGust.time,
    });
  }

  // Rain onset within next 8h (and not already captured by the minutely banner).
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

  // ── Compare ──────────────────────────────────────────────────────────────

  // Current vs day's max — "Still warming" / "Past peak" etc.
  const today = weather.days.find((d) => d.dayName === 'Today');
  if (today) {
    const hereAndNow = weather.current.temperature;
    const diff = today.tempHi - hereAndNow;
    if (diff >= 3) all.push({ id: 'temp-warming', kind: 'compare', icon: 'thermo', text: `Still warming — high of ${today.tempHi}° expected`, priority: 10 });
    else if (diff <= -1) all.push({ id: 'temp-cooling', kind: 'compare', icon: 'thermo', text: `Past day's peak — cooling toward low ${today.tempLo}°`, priority: 10 });
  }

  return all.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nextHours(hours: HourForecast[], n: number): HourForecast[] {
  const now = Date.now();
  const idx = hours.findIndex((h) => h.time.getTime() >= now - 3600_000);
  if (idx < 0) return [];
  return hours.slice(idx, idx + n);
}

