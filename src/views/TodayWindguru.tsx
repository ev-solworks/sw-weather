/**
 * Today · Windguru — dense, color-coded hourly forecast table (VIEWS.md §C).
 * Sticky metric-label column on the left; the hour columns sync-scroll across
 * all rows. ~16 rows × ~48 hours; each cell is memoized so re-renders stay cheap.
 *
 * Marine rows (wave/period/direction) show a dim "·" when a location has no wave
 * data (inland, or no source) — honest nulls, not faked zeros. Day/hour headers
 * render in the location's timezone.
 */

import { memo, useCallback, useEffect, useRef, type ReactNode } from 'react';
import type { HourForecast, WeatherConditions } from '@/types/weather';
import { WxIcon } from '@/components/WxIcon';
import { localHour } from '@/utils/format';
import {
  cloudScale,
  periodScale,
  rainMmScale,
  rainScale,
  tempScale,
  uvScale,
  waveScale,
  windScale,
  type CellColor,
} from '@/scales/wgScales';

const HOUR_W = 44;
const LABEL_W = 96;

export function TodayWindguru({ weather }: { weather: WeatherConditions }) {
  const { hours, location } = weather;
  const tz = location.timezone;
  const nowMs = Date.now();

  // index of the hour nearest "now"
  let nowIdx = hours.findIndex((h) => h.time.getTime() >= nowMs);
  if (nowIdx < 0) nowIdx = 0;

  // Sync horizontal scroll across all rows.
  const scrollers = useRef<Set<HTMLDivElement>>(new Set());
  const syncing = useRef(false);
  const register = useCallback((el: HTMLDivElement | null) => {
    if (el) scrollers.current.add(el);
  }, []);
  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (syncing.current) return;
    syncing.current = true;
    const x = e.currentTarget.scrollLeft;
    scrollers.current.forEach((el) => {
      if (el !== e.currentTarget) el.scrollLeft = x;
    });
    requestAnimationFrame(() => {
      syncing.current = false;
    });
  }, []);

  // Scroll to "now" on mount.
  useEffect(() => {
    const x = Math.max(0, nowIdx * HOUR_W - 8);
    scrollers.current.forEach((el) => {
      el.scrollLeft = x;
    });
  }, [nowIdx]);

  const dayBoundary = (i: number) =>
    i > 0 && localDateKey(hours[i].time, tz) !== localDateKey(hours[i - 1].time, tz);

  return (
    <div className="flex h-full w-full flex-col bg-[#070b1a] text-neutral-200">
      <div className="flex shrink-0 items-baseline gap-2 border-b border-[#131a2e] px-4 py-2.5">
        <span className="text-base font-semibold tracking-tight text-neutral-50">{location.name}</span>
        <span className="text-[11px] font-medium text-neutral-500">{location.region}</span>
        <span className="ml-auto font-mono text-[10px] text-neutral-600">{hours.length}h forecast</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {/* Header row */}
        <div className="sticky top-0 z-30 flex border-b border-[#1f2a48] bg-[#070b1a]">
          <div className="sticky left-0 z-20 flex shrink-0 flex-col justify-center border-r border-[#131a2e] bg-[#070b1a] px-3" style={{ width: LABEL_W }}>
            <div className="text-[11px] font-bold tracking-wide text-neutral-50">Forecast</div>
            <div className="font-mono text-[10px] tabular-nums text-neutral-600">hourly</div>
          </div>
          <div ref={register} onScroll={onScroll} className="flex-1 overflow-x-auto [scrollbar-width:none]">
            <div className="flex" style={{ width: hours.length * HOUR_W }}>
              {hours.map((h, i) => {
                const isNow = i === nowIdx;
                const newDay = i === 0 || dayBoundary(i);
                const hh = localHour(h.time, tz);
                const night = hh < 6 || hh >= 20;
                return (
                  <div
                    key={h.time.getTime()}
                    className="flex shrink-0 flex-col items-center justify-center gap-px py-1"
                    style={{
                      width: HOUR_W,
                      borderLeft: newDay && i > 0 ? '2px solid #2a3550' : '1px solid #131a2e',
                      background: isNow ? '#3a2f0f' : night ? '#0a1024' : '#0c1428',
                    }}
                  >
                    <div className="font-mono text-[9px] font-bold tracking-tight text-neutral-400">{newDay ? dayLabel(h.time, tz) : ' '}</div>
                    <div className="font-mono text-[12px] font-semibold tabular-nums tracking-tight text-neutral-50">
                      {String(hh).padStart(2, '0')}
                      <span className="text-[9px] font-medium text-neutral-600">h</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DataRow label="Wind" unit="km/h" hours={hours} nowIdx={nowIdx} register={register} onScroll={onScroll} dayBoundary={dayBoundary}
          render={(h) => <ScaleCell scale={windScale} v={h.windSpeed} bold={h.windSpeed >= 25} />} />
        <DataRow label="Gusts" unit="km/h" hours={hours} nowIdx={nowIdx} register={register} onScroll={onScroll} dayBoundary={dayBoundary}
          render={(h) => <ScaleCell scale={windScale} v={h.windGust} bold={h.windGust >= 30} />} />
        <DataRow label="Wind dir" hours={hours} nowIdx={nowIdx} register={register} onScroll={onScroll} dayBoundary={dayBoundary}
          render={(h) => <Cell bg="#0a0f1c" fg="#fafafa"><Arrow deg={h.windDirection} /></Cell>} />

        <DataRow label="Wave" unit="m" hours={hours} nowIdx={nowIdx} register={register} onScroll={onScroll} dayBoundary={dayBoundary}
          render={(h) => (h.waveHeight == null || h.waveHeight < 0.05 ? <Dot /> : <ScaleCell scale={waveScale} v={h.waveHeight} text={h.waveHeight.toFixed(1)} bold={h.waveHeight >= 1.5} />)} />
        <DataRow label="Wave per." unit="s" hours={hours} nowIdx={nowIdx} register={register} onScroll={onScroll} dayBoundary={dayBoundary}
          render={(h) => (h.wavePeriod == null ? <Dot /> : <ScaleCell scale={periodScale} v={h.wavePeriod} text={String(Math.round(h.wavePeriod))} bold={h.wavePeriod >= 10} />)} />
        <DataRow label="Wave dir" hours={hours} nowIdx={nowIdx} register={register} onScroll={onScroll} dayBoundary={dayBoundary}
          render={(h) => (h.waveDirection == null ? <Dot /> : <Cell bg="#0a0f1c" fg="#cfcfcf"><Arrow deg={h.waveDirection} small /></Cell>)} />

        <DataRow label="Temp" unit="°C" hours={hours} nowIdx={nowIdx} register={register} onScroll={onScroll} dayBoundary={dayBoundary}
          render={(h) => <ScaleCell scale={tempScale} v={h.temperature} bold={h.temperature >= 25 || h.temperature <= 0} />} />
        <DataRow label="Feels like" unit="°C" hours={hours} nowIdx={nowIdx} register={register} onScroll={onScroll} dayBoundary={dayBoundary}
          render={(h) => <ScaleCell scale={tempScale} v={h.feelsLike} muted />} />

        <DataRow label="Sky" hours={hours} nowIdx={nowIdx} register={register} onScroll={onScroll} dayBoundary={dayBoundary}
          render={(h) => <Cell bg="#0a0f1c" fg="#fafafa"><WxIcon desc={h.description} size={18} color="#cfcfcf" strokeWidth={1.5} night={h.isNight} /></Cell>} />

        <DataRow label="Rain prob" unit="%" hours={hours} nowIdx={nowIdx} register={register} onScroll={onScroll} dayBoundary={dayBoundary}
          render={(h) => (h.precipProbability < 5 ? <Dot /> : <ScaleCell scale={rainScale} v={h.precipProbability} bold={h.precipProbability >= 70} />)} />
        <DataRow label="Precip" unit="mm" hours={hours} nowIdx={nowIdx} register={register} onScroll={onScroll} dayBoundary={dayBoundary}
          render={(h) => (h.precipAmount < 0.05 ? <Dot /> : <ScaleCell scale={rainMmScale} v={h.precipAmount} text={h.precipAmount.toFixed(1)} bold={h.precipAmount >= 2} />)} />

        <DataRow label="Cloud" unit="%" hours={hours} nowIdx={nowIdx} register={register} onScroll={onScroll} dayBoundary={dayBoundary}
          render={(h) => (h.cloudCover < 5 ? <Dot /> : <ScaleCell scale={cloudScale} v={h.cloudCover} />)} />
        <DataRow label="UV" hours={hours} nowIdx={nowIdx} register={register} onScroll={onScroll} dayBoundary={dayBoundary}
          render={(h) => (h.uvIndex === 0 ? <Dot /> : <ScaleCell scale={uvScale} v={h.uvIndex} bold={h.uvIndex >= 8} />)} />
        <DataRow label="Humidity" unit="%" hours={hours} nowIdx={nowIdx} register={register} onScroll={onScroll} dayBoundary={dayBoundary} last
          render={(h) => <Cell bg="#0a0f1c" fg="#9a9a93">{h.humidity}</Cell>} />
      </div>

      <Legend />
    </div>
  );
}

// ── Row ──────────────────────────────────────────────────────────────────────

interface DataRowProps {
  label: string;
  unit?: string;
  hours: HourForecast[];
  nowIdx: number;
  register: (el: HTMLDivElement | null) => void;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  dayBoundary: (i: number) => boolean;
  render: (h: HourForecast) => ReactNode;
  last?: boolean;
}

function DataRow({ label, unit, hours, nowIdx, register, onScroll, dayBoundary, render, last }: DataRowProps) {
  return (
    <div className="flex min-h-[32px] items-stretch" style={{ borderBottom: last ? '1px solid #1f2a48' : '1px solid #101627' }}>
      <div className="sticky left-0 z-10 flex shrink-0 items-center border-r border-[#131a2e] bg-[#070b1a] pl-3.5 pr-2.5 text-[11px] font-medium text-neutral-200" style={{ width: LABEL_W }}>
        <span>{label}</span>
        {unit && <span className="ml-1 text-neutral-600">({unit})</span>}
      </div>
      <div ref={register} onScroll={onScroll} className="flex-1 overflow-x-auto [scrollbar-width:none]">
        <div className="flex" style={{ width: hours.length * HOUR_W }}>
          {hours.map((h, i) => (
            <CellWrap key={h.time.getTime()} newDay={dayBoundary(i)} isNow={i === nowIdx}>
              {render(h)}
            </CellWrap>
          ))}
        </div>
      </div>
    </div>
  );
}

const CellWrap = memo(function CellWrap({ children, newDay, isNow }: { children: ReactNode; newDay: boolean; isNow: boolean }) {
  return (
    <div
      className="flex shrink-0 items-stretch"
      style={{
        width: HOUR_W,
        borderLeft: newDay ? '2px solid #2a3550' : '1px solid #101627',
        boxShadow: isNow ? 'inset 2px 0 0 #fafafa' : 'none',
      }}
    >
      {children}
    </div>
  );
});

function Cell({ bg, fg, bold, muted, children }: { bg: string; fg: string; bold?: boolean; muted?: boolean; children: ReactNode }) {
  return (
    <div
      className="flex h-full w-full items-center justify-center font-mono text-[12px] tabular-nums"
      style={{ background: bg, color: fg, fontWeight: bold ? 700 : muted ? 400 : 500, opacity: muted ? 0.75 : 1, letterSpacing: '-0.2px' }}
    >
      {children}
    </div>
  );
}

function ScaleCell({ scale, v, text, bold, muted }: { scale: (v: number) => CellColor; v: number; text?: string; bold?: boolean; muted?: boolean }) {
  const c = scale(v);
  return (
    <Cell bg={c.bg} fg={c.fg} bold={bold} muted={muted}>
      {text ?? Math.round(v)}
    </Cell>
  );
}

function Dot() {
  return <Cell bg="#0a0f1c" fg="#3a3a45">·</Cell>;
}

function Arrow({ deg, small }: { deg: number; small?: boolean }) {
  return (
    <svg width={small ? 12 : 14} height={small ? 12 : 14} viewBox="0 0 14 14" style={{ transform: `rotate(${deg + 180}deg)` }}>
      <path d="M7 1.4 L11 11 L7 9.2 L3 11 Z" fill={small ? '#cfcfcf' : '#fafafa'} />
    </svg>
  );
}

// ── Legend ─────────────────────────────────────────────────────────────────

function Legend() {
  const chips: { label: string; colors: string[] }[] = [
    { label: 'Wind km/h', colors: ['#141414', '#bff0ee', '#2fd49a', '#7fd02a', '#f0c020', '#ee5b2a', '#cf3290', '#8a3fcc'] },
    { label: 'Wave m', colors: ['#1c2240', '#2b3268', '#4a4f9c', '#6f5fc8', '#9a4fd4'] },
    { label: 'Temp °C', colors: ['#bfd4ef', '#e8f5c8', '#fff09a', '#ffb04a', '#f4612a', '#cf3290'] },
    { label: 'Rain %', colors: ['#1a2c4a', '#2a4f8a', '#4a7ed1', '#3a9cef', '#7fc8ff'] },
  ];
  return (
    <div className="flex shrink-0 gap-2.5 overflow-x-auto border-t border-[#131a2e] bg-[#070b1a] px-3.5 py-2 [scrollbar-width:none]">
      {chips.map((c) => (
        <div key={c.label} className="flex min-w-[110px] shrink-0 flex-col gap-1">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-neutral-500">{c.label}</span>
          <div className="flex h-1.5 overflow-hidden rounded-sm border border-[#1b2440]">
            {c.colors.map((col, i) => (
              <div key={i} className="h-full flex-1" style={{ background: col }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── TZ helpers ───────────────────────────────────────────────────────────────

function localDateKey(d: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
function dayLabel(d: Date, tz: string): string {
  const wd = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short' }).format(d).slice(0, 2);
  const dom = new Intl.DateTimeFormat('en-GB', { timeZone: tz, day: 'numeric' }).format(d);
  return `${wd} ${dom}`;
}
