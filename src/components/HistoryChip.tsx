/**
 * HistoryChip — single-line "Last year, this day" chip. Lazy-fetches from
 * Open-Meteo's archive API and renders nothing while loading or on miss.
 *
 * Rendered on Today/Visual below the metrics row. Compares last year's temp
 * range and rain total to set context ("Hotter than this day last year").
 */

import { useEffect, useState } from 'react';
import { getHistoryYearsAgo, type HistoryDay } from '@/services/history';
import type { WeatherConditions } from '@/types/weather';

interface Props {
  weather: WeatherConditions;
}

export function HistoryChip({ weather }: Props) {
  const [last, setLast] = useState<HistoryDay | undefined>();
  useEffect(() => {
    let cancelled = false;
    const ref = new Date();
    getHistoryYearsAgo(ref, weather.location.lat, weather.location.lon, 1)
      .then((v) => { if (!cancelled) setLast(v); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [weather.location.lat, weather.location.lon]);

  if (!last) return null;
  const todayHi = weather.days.find((d) => d.dayName === 'Today')?.tempHi ?? weather.current.temperature;
  const diff = todayHi - last.tempMax;
  const arrow = diff > 1 ? '↑' : diff < -1 ? '↓' : '→';
  const rainNote = last.rainMm >= 0.5 ? ` · rained ${last.rainMm}mm` : '';
  return (
    <div className="mx-3.5 mb-2 mt-1 flex items-center gap-1.5 rounded-lg border border-[#1b2440] bg-[#0c1428] px-3 py-1.5 text-[11px] text-neutral-400">
      <span className="font-mono text-[9px] font-bold tracking-[1px] text-[#7a8aa3]">LAST YEAR</span>
      <span className="font-mono tabular-nums text-neutral-300">
        {last.tempMax}° / {last.tempMin}°{rainNote}
      </span>
      <span className="ml-auto font-mono tabular-nums text-neutral-500">
        {arrow} {diff >= 0 ? '+' : ''}{diff}°
      </span>
    </div>
  );
}
