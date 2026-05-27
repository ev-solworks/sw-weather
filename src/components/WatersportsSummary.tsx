/**
 * WatersportsSummary — a practical "should I go out" read for coastal locations.
 * Plain-language current sea state (wave height @ period, direction), sea temp,
 * wind-vs-wave alignment (cross/onshore/offshore feel), and the marine source +
 * confidence badge (the eltiempo.es differentiator, surfaced for the first time).
 *
 * Renders nothing if the active hour has no wave data (inland / no source).
 */

import type { WeatherConditions } from '@/types/weather';
import { compass } from '@/utils/format';

/** Relationship of wind direction to wave direction (both "from" degrees). */
function windWaveRelation(windDeg: number, waveDeg: number): string {
  let diff = Math.abs(((windDeg - waveDeg + 180) % 360) - 180);
  if (diff <= 35) return 'Wind with swell';
  if (diff >= 145) return 'Offshore wind';
  return 'Cross wind';
}

/** Short swell-quality phrase from period. */
function swellQuality(periodS: number | null): string {
  if (periodS == null) return '';
  if (periodS >= 11) return 'clean groundswell';
  if (periodS >= 8) return 'organised swell';
  return 'short wind-chop';
}

export function WatersportsSummary({ weather }: { weather: WeatherConditions }) {
  const { hours, current, sources } = weather;
  const nowMs = Date.now();
  let idx = hours.findIndex((h) => h.time.getTime() >= nowMs);
  if (idx < 0) idx = 0;
  const h = hours[idx];
  if (!h || h.waveHeight == null) return null;

  const marine = sources.marine;
  const period = h.wavePeriod;
  const dir = h.waveDirection;
  const rel = dir != null ? windWaveRelation(current.windDirection, dir) : null;
  const quality = swellQuality(period);

  const summary =
    `${h.waveHeight.toFixed(1)}m` +
    (period != null ? ` @ ${Math.round(period)}s` : '') +
    (quality ? ` · ${quality}` : '') +
    (dir != null ? ` from ${compass(dir)}` : '');

  return (
    <div className="border-b border-[#131a2e] bg-[#0a1326] px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-semibold tracking-wide text-sky-300/80">WATERSPORTS · NOW</span>
        {marine && <ConfidenceBadge source={marine.source} confidence={marine.confidence} />}
      </div>
      <div className="mt-1 text-[15px] font-medium text-neutral-100">{summary}</div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-neutral-400">
        {rel && <span>{rel}</span>}
        <span>Wind {current.windSpeed} km/h {compass(current.windDirection)}</span>
        {h.seaTemperature != null && <span>Sea {Math.round(h.seaTemperature)}°</span>}
      </div>
    </div>
  );
}

function ConfidenceBadge({ source, confidence }: { source: string; confidence: 'high' | 'medium' | 'low' }) {
  const label =
    source === 'ipma' ? 'IPMA official' : source.startsWith('open-meteo') ? 'Model estimate' : source === 'aemet' ? 'AEMET official' : source;
  const tone =
    confidence === 'high'
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
      : confidence === 'medium'
        ? 'border-sky-500/40 bg-sky-500/10 text-sky-300'
        : 'border-amber-500/40 bg-amber-500/10 text-amber-300';
  return (
    <span className={`rounded-full border px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide ${tone}`}>
      {label} · {confidence}
    </span>
  );
}
