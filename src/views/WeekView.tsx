/**
 * Week — N-day forecast (VIEWS.md §F). Summary tiles, a shared temperature scale,
 * and one row per day with a gradient range bar + condition icon + rain/wind/wave
 * chips. Ported from today-week.jsx to our WeatherConditions.days.
 *
 * Honesty about nullable data: marine chips/tiles only appear when a day actually
 * has wave data (coastal + a source). AEMET daily gives rain *probability* (%),
 * not mm — so the rain tile shows peak probability, and the chip shows per-day %.
 */

import type { DayForecast, WeatherConditions } from '@/types/weather';
import { useNav } from '@/app/navigation';
import { useWeather } from '@/hooks/useWeather';
import { WxIcon } from '@/components/WxIcon';
import { compass } from '@/utils/format';

export function WeekView() {
  const { activeLocation } = useNav();
  const { data, loading, error } = useWeather(activeLocation);

  return (
    <div className="flex h-full w-full flex-col bg-[#070b1a] text-neutral-200">
      <div
        className="flex shrink-0 items-baseline gap-2 border-b border-[#131a2e] px-4 pb-3"
        style={{ paddingTop: `calc(env(safe-area-inset-top, 0px) + 12px)` }}
      >
        <span className="text-base font-semibold tracking-tight text-neutral-50">{activeLocation.name}</span>
        <span className="text-[11px] font-medium text-neutral-500">{activeLocation.region}</span>
      </div>

      {loading && !data && <Centered>Loading {activeLocation.name}…</Centered>}
      {error && !data && <Centered>Couldn’t load forecast — {error}</Centered>}
      {data && <WeekBody weather={data} />}
    </div>
  );
}

function WeekBody({ weather }: { weather: WeatherConditions }) {
  const days = weather.days;
  if (!days.length) return <Centered>No forecast available</Centered>;

  const allTemps = days.flatMap((d) => [d.tempHi, d.tempLo]);
  const weekHi = Math.max(...allTemps);
  const weekLo = Math.min(...allTemps);
  const scaleMin = weekLo - 1;
  const scaleMax = weekHi + 1;
  const scaleRange = scaleMax - scaleMin || 1;

  const peakRain = Math.max(...days.map((d) => d.rainProbability));
  const waveDays = days.filter((d) => d.waveHeight != null);
  const maxWave = waveDays.length ? Math.max(...waveDays.map((d) => d.waveHeight as number)) : null;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Summary tiles */}
      <div className={`grid gap-1.5 px-3 pb-2 pt-2.5 ${maxWave != null ? 'grid-cols-4' : 'grid-cols-3'}`}>
        <Tile label="Week high" value={`${weekHi}°`} accent="#f4612a" />
        <Tile label="Week low" value={`${weekLo}°`} accent="#6a8aff" />
        <Tile label="Peak rain" value={`${peakRain}`} unit="%" accent="#3a9cef" />
        {maxWave != null && <Tile label="Peak wave" value={maxWave.toFixed(1)} unit="m" accent="#9a4fd4" />}
      </div>

      {/* Scale axis */}
      <div className="flex items-center gap-1.5 px-4 pb-1 pt-1.5">
        <span className="min-w-[22px] text-center font-mono text-[9px] font-semibold tabular-nums text-[#7a8aa3]">{scaleMin}°</span>
        <div className="h-[3px] flex-1 overflow-hidden rounded-sm">
          <div className="h-full w-full opacity-40" style={{ background: 'linear-gradient(to right,#cfe2ff,#f2f6a2,#ffd478,#ff8a2a,#f4612a,#cf3290)' }} />
        </div>
        <span className="min-w-[22px] text-center font-mono text-[9px] font-semibold tabular-nums text-[#7a8aa3]">{scaleMax}°</span>
      </div>

      {/* Day rows. Today's row is overlaid with current observed conditions
          so it matches Visual — AEMET's full-day summary often differs from
          right-now (zero wind, "Cloudy" when actually clear). */}
      <div className="mx-3 overflow-hidden rounded-xl border border-[#1b2440] bg-[#0c1428]">
        {days.map((d, i) => {
          const isToday = d.dayName === 'Today';
          const overlay = isToday
            ? {
                ...d,
                description: weather.current.description,
                windAvg: d.windAvg || weather.current.windSpeed,
                windDirection: d.windDirection || weather.current.windDirection,
              }
            : d;
          return (
            <DayRow key={d.date.getTime()} day={overlay} isToday={isToday} last={i === days.length - 1} scaleMin={scaleMin} scaleRange={scaleRange} />
          );
        })}
      </div>

      <div className="px-4 pb-4 pt-2.5 text-center font-mono text-[10px] text-[#5a6485]">
        {weather.location.country === 'PT' ? 'Daily from IPMA · hourly via Open-Meteo' : 'Daily from AEMET'}
      </div>
    </div>
  );
}

function DayRow({ day, isToday, last, scaleMin, scaleRange }: { day: DayForecast; isToday: boolean; last: boolean; scaleMin: number; scaleRange: number }) {
  const loPct = ((day.tempLo - scaleMin) / scaleRange) * 100;
  const hiPct = ((day.tempHi - scaleMin) / scaleRange) * 100;
  const curPct = day.tempCurrent != null ? ((day.tempCurrent - scaleMin) / scaleRange) * 100 : null;
  const dateStr = `${day.date.getDate()} ${day.date.toLocaleString('en-GB', { month: 'short' })}`;

  return (
    <div
      className={`flex flex-col gap-1.5 px-3 py-2.5 ${last ? '' : 'border-b border-[#131a2e]'} ${
        isToday ? 'bg-[linear-gradient(90deg,rgba(255,208,106,.08),transparent)]' : ''
      }`}
    >
      <div className="grid grid-cols-[56px_32px_1fr] items-center gap-2.5">
        <div className="flex flex-col gap-px">
          <div className={`text-[13px] font-semibold tracking-tight ${isToday ? 'text-[#ffd06a]' : 'text-neutral-50'}`}>{day.dayName}</div>
          <div className="font-mono text-[10px] tabular-nums text-[#7a8aa3]">{dateStr}</div>
        </div>
        <div className="flex items-center justify-center">
          <WxIcon desc={day.description} size={26} color="#fafafa" strokeWidth={1.4} />
        </div>
        <div className="flex items-center gap-2">
          <span className="w-[26px] text-right font-mono text-[12px] font-medium tabular-nums text-[#9a9a93]">{day.tempLo}°</span>
          <div className="relative h-1.5 flex-1 rounded-sm bg-[#1b2440]">
            <div className="absolute bottom-0 top-0 rounded-sm" style={{ left: `${loPct}%`, width: `${Math.max(2, hiPct - loPct)}%`, background: tempGradient(day.tempLo, day.tempHi) }} />
            {curPct != null && (
              <div className="absolute -bottom-0.5 -top-0.5 w-[3px] -translate-x-1/2 rounded-sm bg-neutral-50 shadow-[0_0_6px_rgba(255,255,255,.7)]" style={{ left: `${curPct}%` }} />
            )}
          </div>
          <span className="w-[26px] text-left font-mono text-[13px] font-semibold tabular-nums text-neutral-50">{day.tempHi}°</span>
        </div>
      </div>

      <div className="flex flex-nowrap gap-1.5 overflow-hidden pl-16">
        <Chip color="#3a9cef" muted={day.rainProbability < 30}>
          <RainGlyph />
          <span>
            {day.rainProbability}
            <span className="ml-0.5 text-[9px] opacity-65">%</span>
          </span>
        </Chip>
        <Chip color="#7fd02a" muted={day.windAvg < 12}>
          <Arrow deg={day.windDirection} />
          <span>
            {day.windAvg}
            <span className="ml-0.5 text-[9px] opacity-65">km/h {compass(day.windDirection)}</span>
          </span>
        </Chip>
        {day.waveHeight != null && (
          <Chip color="#9a4fd4" muted={day.waveHeight < 0.7}>
            <WaveGlyph />
            <span>
              {day.waveHeight.toFixed(1)}
              <span className="ml-0.5 text-[9px] opacity-65">m</span>
            </span>
          </Chip>
        )}
      </div>
    </div>
  );
}

function Tile({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent: string }) {
  return (
    <div className="relative overflow-hidden rounded-[10px] border border-[#1b2440] bg-[#0c1428] py-2 pl-2.5 pr-2">
      <div className="absolute bottom-0 left-0 top-0 w-[3px]" style={{ background: accent }} />
      <div className="text-[9px] font-bold uppercase tracking-wide text-[#7a8aa3]">{label}</div>
      <div className="flex items-baseline gap-0.5 font-mono text-[17px] font-medium tabular-nums tracking-tight text-neutral-50">
        <span>{value}</span>
        {unit && <span className="text-[10px] font-medium text-neutral-500">{unit}</span>}
      </div>
    </div>
  );
}

function Chip({ color, muted, children }: { color: string; muted: boolean; children: React.ReactNode }) {
  return (
    <div
      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[11px] font-medium tabular-nums"
      style={{
        color: muted ? '#7a7a7a' : color,
        background: muted ? '#0c1428' : `${color}1a`,
        borderColor: muted ? '#1b2440' : `${color}33`,
      }}
    >
      {children}
    </div>
  );
}

const RainGlyph = () => (
  <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 1.5c1.5 2 3.5 4 3.5 6.5a3.5 3.5 0 11-7 0c0-2.5 2-4.5 3.5-6.5z" />
  </svg>
);
const WaveGlyph = () => (
  <svg width="12" height="11" viewBox="0 0 14 11" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
    <path d="M1 7 C 3 4, 4 4, 6 7 S 11 10, 13 7" />
    <path d="M1 3 C 3 1, 4 1, 6 3 S 11 5, 13 3" opacity="0.5" />
  </svg>
);
const Arrow = ({ deg }: { deg: number }) => (
  <svg width="11" height="11" viewBox="0 0 11 11" style={{ transform: `rotate(${deg + 180}deg)` }}>
    <path d="M5.5 1 L9 9 L5.5 7.5 L2 9 Z" fill="currentColor" />
  </svg>
);

function tempGradient(lo: number, hi: number): string {
  const colorAt = (t: number) => {
    if (t < -5) return '#bfd4ef';
    if (t < 0) return '#cfe2ff';
    if (t < 5) return '#e8f5c8';
    if (t < 10) return '#f2f6a2';
    if (t < 14) return '#fff09a';
    if (t < 18) return '#ffd478';
    if (t < 22) return '#ffb04a';
    if (t < 26) return '#ff8a2a';
    if (t < 30) return '#f4612a';
    return '#cf3290';
  };
  return `linear-gradient(to right, ${colorAt(lo)}, ${colorAt(hi)})`;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[60svh] items-center justify-center px-6 text-center text-sm text-neutral-500">{children}</div>;
}
