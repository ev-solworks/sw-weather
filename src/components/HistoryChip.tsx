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
  // Atmospheric restyle: no card chrome. Inline row, hairline separates it
  // from the daylight arc above (the Hair sits in TodayVisual).
  const trendColor = diff > 1 ? '#fca5a5' : diff < -1 ? '#86efac' : 'rgba(255,255,255,0.65)';
  return (
    <div className="flex items-center gap-2 px-[18px] py-2 text-[11px]" style={{ color: 'rgba(255,255,255,0.78)' }}>
      <span className="font-mono text-[9px] font-semibold tracking-[1.4px]" style={{ color: 'rgba(255,255,255,0.45)' }}>LAST YEAR</span>
      <span className="font-mono tabular-nums" style={{ color: 'rgba(255,255,255,0.92)' }}>
        {last.tempMax}° / {last.tempMin}°{rainNote}
      </span>
      <span className="ml-auto font-mono tabular-nums font-medium" style={{ color: trendColor }}>
        {arrow} {diff >= 0 ? '+' : ''}{diff}°
      </span>
    </div>
  );
}
