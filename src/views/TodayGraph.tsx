/**
 * Today · Graph (VIEWS.md §D) — Windguru "graph" mode. Stacked SVG panels sharing
 * one horizontal hour axis: temperature area, wind bars + gust outline + arrows,
 * rain probability area + precip bars, wave height area + period + arrows, cloud
 * bars. All panels sync-scroll with the time axis and auto-center on "now".
 *
 * Hours/days render in the location TZ. Wave panel hides when a location has no
 * wave data. Each panel is memoized so scroll re-renders stay cheap.
 */

import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { HourForecast, WeatherConditions, WindHistory } from '@/types/weather';
import { localHour } from '@/utils/format';
import { cloudScale, windScale } from '@/scales/wgScales';
import { WindHistoryChart } from '@/components/WindHistoryChart';

const HOUR_W = 28;

export function TodayGraph({ weather }: { weather: WeatherConditions }) {
  const { hours, location } = weather;
  const tz = location.timezone;
  const totalW = hours.length * HOUR_W;
  const nowMs = Date.now();
  let nowIdx = hours.findIndex((h) => h.time.getTime() >= nowMs);
  if (nowIdx < 0) nowIdx = 0;

  const hasWaves = hours.some((h) => h.waveHeight != null);

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
  useEffect(() => {
    const x = Math.max(0, nowIdx * HOUR_W - 60);
    scrollers.current.forEach((el) => {
      el.scrollLeft = x;
    });
  }, [nowIdx]);

  // Precompute per-hour layout flags in location TZ.
  const flags = hours.map((h, i) => {
    const hh = localHour(h.time, tz);
    const prevKey = i > 0 ? localDateKey(hours[i - 1].time, tz) : '';
    const newDay = i > 0 && localDateKey(h.time, tz) !== prevKey;
    return { hh, newDay, night: hh < 6 || hh >= 20, isNow: i === nowIdx };
  });

  return (
    <div className="flex h-full w-full flex-col bg-[#070b1a] text-neutral-200">
      <div className="flex shrink-0 items-baseline gap-2 border-b border-[#131a2e] px-4 py-2.5">
        <span className="text-base font-semibold tracking-tight text-neutral-50">{location.name}</span>
        <span className="text-[11px] font-medium text-neutral-500">{location.region}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {weather.windHistory && <LiveWindPanel history={weather.windHistory} tz={tz} />}
        <TimeAxis hours={hours} tz={tz} flags={flags} register={register} onScroll={onScroll} totalW={totalW} />
        <Panel title="Temperature" unit="°C" totalW={totalW} height={90} flags={flags} nowIdx={nowIdx} register={register} onScroll={onScroll}>
          {(innerH) => <TempPanel hours={hours} innerH={innerH} />}
        </Panel>
        <Panel title="Wind / Gusts" unit="km/h" totalW={totalW} height={100} flags={flags} nowIdx={nowIdx} register={register} onScroll={onScroll}>
          {(innerH) => <WindPanel hours={hours} innerH={innerH} flags={flags} />}
        </Panel>
        <Panel title="Rain" unit="% / mm" totalW={totalW} height={80} flags={flags} nowIdx={nowIdx} register={register} onScroll={onScroll}>
          {(innerH) => <RainPanel hours={hours} innerH={innerH} />}
        </Panel>
        {hasWaves && (
          <Panel title="Waves" unit="m · s" totalW={totalW} height={80} flags={flags} nowIdx={nowIdx} register={register} onScroll={onScroll}>
            {(innerH) => <WavePanel hours={hours} innerH={innerH} flags={flags} />}
          </Panel>
        )}
        <Panel title="Cloud cover" unit="%" totalW={totalW} height={50} flags={flags} nowIdx={nowIdx} register={register} onScroll={onScroll} last>
          {(innerH) => <CloudPanel hours={hours} innerH={innerH} />}
        </Panel>
      </div>
    </div>
  );
}

/** Live measured wind/gust from a station (OceanDrivers), with hour/24h toggle. */
function LiveWindPanel({ history, tz }: { history: WindHistory; tz: string }) {
  const [range, setRange] = useState<'hour' | 'day'>('hour');
  const points = range === 'hour' ? history.hour : history.day;
  return (
    <div className="border-b border-[#141d2a] bg-[#0a1326] px-3.5 py-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-wide text-emerald-300/80">
          LIVE WIND · MEASURED
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
        </span>
        <div className="flex gap-1">
          {(['hour', 'day'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${range === r ? 'bg-white/10 text-neutral-50' : 'text-neutral-500'}`}
            >
              {r === 'hour' ? '1h' : '24h'}
            </button>
          ))}
        </div>
      </div>
      <WindHistoryChart points={points} tz={tz} height={120} />
      <div className="mt-1 flex justify-end gap-3 font-mono text-[9px] text-neutral-500">
        <span><span className="text-emerald-400">━</span> wind</span>
        <span><span className="text-[#7fd02a]">┄</span> gust</span>
        <span className="text-neutral-600">km/h</span>
      </div>
    </div>
  );
}

type Flag = { hh: number; newDay: boolean; night: boolean; isNow: boolean };

function TimeAxis({ hours, tz, flags, register, onScroll, totalW }: { hours: HourForecast[]; tz: string; flags: Flag[]; register: (el: HTMLDivElement | null) => void; onScroll: (e: React.UIEvent<HTMLDivElement>) => void; totalW: number }) {
  return (
    <div className="sticky top-0 z-30 flex min-h-[46px] border-b border-[#1f2a48] bg-[#070b1a]">
      <Gutter title="Time" sub="local" />
      <div ref={register} onScroll={onScroll} className="flex-1 overflow-x-auto [scrollbar-width:none]">
        <svg width={totalW} height={42} className="block">
          {hours.map((h, i) => {
            const x = i * HOUR_W;
            const f = flags[i];
            const isMajor = f.hh % 6 === 0;
            return (
              <g key={h.time.getTime()}>
                {f.night && <rect x={x} y={0} width={HOUR_W} height={42} fill="#0a1024" />}
                {f.isNow && <rect x={x} y={0} width={HOUR_W} height={42} fill="#3a2f0f" />}
                {f.newDay && <line x1={x} y1={0} x2={x} y2={42} stroke="#2a3550" strokeWidth="1.5" />}
                {f.newDay && (
                  <text x={x + 4} y={14} fontSize="9" fill="#9a9a93" fontWeight="700" fontFamily="ui-monospace, monospace">{dayShort(h.time, tz)}</text>
                )}
                {isMajor && (
                  <text x={x + HOUR_W / 2} y={32} fontSize="10" fill={f.isNow ? '#fafafa' : '#cfcfcf'} textAnchor="middle" fontFamily="ui-monospace, monospace" fontWeight={f.isNow ? 700 : 500}>
                    {String(f.hh).padStart(2, '0')}
                  </text>
                )}
                {!isMajor && f.hh % 3 === 0 && <line x1={x + HOUR_W / 2} y1={36} x2={x + HOUR_W / 2} y2={40} stroke="#4a5070" strokeWidth="1" />}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function Panel({ title, unit, totalW, height, flags, nowIdx, register, onScroll, last, children }: { title: string; unit: string; totalW: number; height: number; flags: Flag[]; nowIdx: number; register: (el: HTMLDivElement | null) => void; onScroll: (e: React.UIEvent<HTMLDivElement>) => void; last?: boolean; children: (innerH: number) => ReactNode }) {
  const pad = 6;
  const fullH = height + pad * 2;
  return (
    <div className="flex items-stretch" style={{ borderBottom: last ? '1px solid #1f2a48' : '1px solid #101627' }}>
      <Gutter title={title} sub={unit} />
      <div ref={register} onScroll={onScroll} className="flex-1 overflow-x-auto [scrollbar-width:none]">
        <svg width={totalW} height={fullH} className="block">
          {flags.map((f, i) => {
            const x = i * HOUR_W;
            return (
              <g key={i}>
                {f.night && <rect x={x} y={0} width={HOUR_W} height={fullH} fill="#0a1024" />}
                {f.isNow && <rect x={x} y={0} width={HOUR_W} height={fullH} fill="#3a2f0f" opacity="0.55" />}
                {f.newDay && <line x1={x} y1={0} x2={x} y2={fullH} stroke="#2a3550" strokeWidth="1.5" />}
                {f.hh % 6 === 0 && !f.newDay && <line x1={x} y1={0} x2={x} y2={fullH} stroke="#131a2e" strokeWidth="1" />}
              </g>
            );
          })}
          {nowIdx >= 0 && <line x1={nowIdx * HOUR_W + 0.5} y1={0} x2={nowIdx * HOUR_W + 0.5} y2={fullH} stroke="#fafafa" strokeWidth="1" opacity="0.4" strokeDasharray="2 3" />}
          <g transform={`translate(0,${pad})`}>{children(height)}</g>
        </svg>
      </div>
    </div>
  );
}

function Gutter({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="sticky left-0 z-10 flex w-[88px] shrink-0 flex-col justify-center gap-px border-r border-[#131a2e] bg-[#070b1a] py-1.5 pl-3.5 pr-2">
      <div className="text-[11px] font-bold tracking-tight text-neutral-50">{title}</div>
      <div className="font-mono text-[10px] text-neutral-500">{sub}</div>
    </div>
  );
}

// ── Panels (memoized against `hours` reference) ──────────────────────────────

const TempPanel = memo(function TempPanel({ hours, innerH }: { hours: HourForecast[]; innerH: number }) {
  const temps = hours.map((h) => h.temperature);
  const feels = hours.map((h) => h.feelsLike);
  const tMin = Math.min(...temps, ...feels) - 1;
  const tMax = Math.max(...temps, ...feels) + 1;
  const span = tMax - tMin || 1;
  const y = (v: number) => innerH - ((v - tMin) / span) * innerH;
  const cx = (i: number) => i * HOUR_W + HOUR_W / 2;
  const linePts = temps.map((v, i) => `${cx(i)},${y(v).toFixed(1)}`).join(' ');
  const feelPts = feels.map((v, i) => `${cx(i)},${y(v).toFixed(1)}`).join(' ');
  const areaPath = `M 0,${innerH} L ${temps.map((v, i) => `${cx(i)},${y(v).toFixed(1)}`).join(' L ')} L ${cx(hours.length - 1)},${innerH} Z`;
  return (
    <>
      <defs>
        <linearGradient id="tempGrad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#bfd4ef" stopOpacity="0.0" />
          <stop offset="20%" stopColor="#bfd4ef" stopOpacity="0.15" />
          <stop offset="55%" stopColor="#fff09a" stopOpacity="0.35" />
          <stop offset="85%" stopColor="#ffb04a" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#f4612a" stopOpacity="0.7" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#tempGrad)" />
      <polyline points={feelPts} fill="none" stroke="#9a9a93" strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />
      <polyline points={linePts} fill="none" stroke="#fafafa" strokeWidth="1.6" />
      {hours.map((h, i) =>
        i % 6 === 0 ? (
          <g key={i}>
            <circle cx={cx(i)} cy={y(h.temperature)} r="2.4" fill="#fafafa" />
            <text x={cx(i)} y={y(h.temperature) - 6} fontSize="10" fill="#fafafa" textAnchor="middle" fontFamily="ui-monospace, monospace">{h.temperature}°</text>
          </g>
        ) : null,
      )}
    </>
  );
});

const WindPanel = memo(function WindPanel({ hours, innerH, flags }: { hours: HourForecast[]; innerH: number; flags: Flag[] }) {
  const arrowZ = 12;
  const barH = innerH - arrowZ - 2;
  const maxV = Math.max(45, ...hours.map((h) => h.windGust));
  const y = (v: number) => barH - (v / maxV) * barH;
  return (
    <>
      {hours.map((h, i) => {
        const x = i * HOUR_W + 2;
        const w = HOUR_W - 4;
        const c = windScale(h.windSpeed);
        return (
          <g key={i}>
            <rect x={x} y={y(h.windGust)} width={w} height={barH - y(h.windGust)} fill="none" stroke="#fafafa" strokeWidth="0.8" opacity="0.4" />
            <rect x={x} y={y(h.windSpeed)} width={w} height={barH - y(h.windSpeed)} fill={c.bg} />
            {flags[i].hh % 3 === 0 && (
              <text x={x + w / 2} y={y(h.windSpeed) - 2} fontSize="8.5" fill={c.fg === '#fff' ? '#fafafa' : c.fg} textAnchor="middle" fontFamily="ui-monospace, monospace" fontWeight={h.windSpeed >= 25 ? 700 : 500}>{h.windSpeed}</text>
            )}
            <g transform={`translate(${i * HOUR_W + HOUR_W / 2},${innerH - arrowZ / 2 + 1}) rotate(${h.windDirection + 180})`}>
              <path d="M0 -4 L3 4 L0 2.5 L-3 4 Z" fill="#cfcfcf" />
            </g>
          </g>
        );
      })}
      <line x1="0" y1={barH} x2={hours.length * HOUR_W} y2={barH} stroke="#1f2a48" strokeWidth="1" />
    </>
  );
});

const RainPanel = memo(function RainPanel({ hours, innerH }: { hours: HourForecast[]; innerH: number }) {
  const maxMm = Math.max(4, ...hours.map((h) => h.precipAmount));
  const cx = (i: number) => i * HOUR_W + HOUR_W / 2;
  const probY = (p: number) => innerH - (p / 100) * innerH;
  const pts = hours.map((h, i) => `${cx(i)},${probY(h.precipProbability).toFixed(1)}`).join(' ');
  const areaPath = `M 0,${innerH} L ${hours.map((h, i) => `${cx(i)},${probY(h.precipProbability).toFixed(1)}`).join(' L ')} L ${cx(hours.length - 1)},${innerH} Z`;
  return (
    <>
      <defs>
        <linearGradient id="rainGrad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#3a9cef" stopOpacity="0" />
          <stop offset="40%" stopColor="#3a9cef" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#7fc8ff" stopOpacity="0.7" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#rainGrad)" />
      <polyline points={pts} fill="none" stroke="#7fc8ff" strokeWidth="1.3" />
      {hours.map((h, i) => {
        if (h.precipAmount < 0.05) return null;
        const barH = (h.precipAmount / maxMm) * innerH;
        return <rect key={i} x={cx(i) - 3} y={innerH - barH} width={6} height={barH} fill="#bfe4ff" opacity="0.9" />;
      })}
    </>
  );
});

const WavePanel = memo(function WavePanel({ hours, innerH, flags }: { hours: HourForecast[]; innerH: number; flags: Flag[] }) {
  const arrowZ = 10;
  const h2 = innerH - arrowZ - 2;
  const maxM = Math.max(3, ...hours.map((h) => h.waveHeight ?? 0));
  const cx = (i: number) => i * HOUR_W + HOUR_W / 2;
  const y = (m: number) => h2 - (m / maxM) * h2;
  const pts = hours.map((h, i) => `${cx(i)},${y(h.waveHeight ?? 0).toFixed(1)}`).join(' ');
  const areaPath = `M 0,${h2} L ${hours.map((h, i) => `${cx(i)},${y(h.waveHeight ?? 0).toFixed(1)}`).join(' L ')} L ${cx(hours.length - 1)},${h2} Z`;
  return (
    <>
      <defs>
        <linearGradient id="waveGrad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#4a4f9c" stopOpacity="0.1" />
          <stop offset="60%" stopColor="#6f5fc8" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#9a4fd4" stopOpacity="0.85" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#waveGrad)" />
      <polyline points={pts} fill="none" stroke="#cfb8ff" strokeWidth="1.3" />
      {hours.map((h, i) => {
        if (flags[i].hh % 6 !== 0 || h.wavePeriod == null) return null;
        const fg = h.wavePeriod >= 10 ? '#f5b8c8' : '#cfb8ff';
        return (
          <text key={i} x={cx(i)} y={y(h.waveHeight ?? 0) - 4} fontSize="9" fill={fg} textAnchor="middle" fontFamily="ui-monospace, monospace" fontWeight="600">{Math.round(h.wavePeriod)}s</text>
        );
      })}
      {hours.map((h, i) => (
        <g key={`a${i}`} transform={`translate(${cx(i)},${innerH - arrowZ / 2 + 1}) rotate(${(h.waveDirection ?? 0) + 180})`}>
          <path d="M0 -3 L2.4 3 L0 1.8 L-2.4 3 Z" fill="#a8b3e0" opacity="0.85" />
        </g>
      ))}
      <line x1="0" y1={h2} x2={hours.length * HOUR_W} y2={h2} stroke="#1f2a48" strokeWidth="1" />
    </>
  );
});

const CloudPanel = memo(function CloudPanel({ hours, innerH }: { hours: HourForecast[]; innerH: number }) {
  return (
    <>
      {hours.map((h, i) => {
        const v = h.cloudCover;
        const bh = (v / 100) * innerH;
        const cc = cloudScale(v);
        return <rect key={i} x={i * HOUR_W} y={innerH - bh} width={HOUR_W} height={bh} fill={cc.bg} opacity={v < 5 ? 0.15 : 1} />;
      })}
    </>
  );
});

// ── TZ helpers ───────────────────────────────────────────────────────────────

function localDateKey(d: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
function dayShort(d: Date, tz: string): string {
  const wd = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short' }).format(d).slice(0, 2);
  const dom = new Intl.DateTimeFormat('en-GB', { timeZone: tz, day: 'numeric' }).format(d);
  return `${wd} ${dom}.`;
}
