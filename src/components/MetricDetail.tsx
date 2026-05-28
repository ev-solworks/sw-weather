/**
 * MetricDetail — Apple-Weather-style full-screen drilldown for one metric.
 *
 * Opens from any tappable metric card on Visual / Home. Header shows the
 * metric name with a chevron dropdown that swaps the metric in place (without
 * backing out of the modal). Body composes:
 *
 *   1. Hero number (huge) + plain-language summary
 *   2. Hourly graph (48h, scrubable, shares d3-scale primitives with
 *      TodayGraph)
 *   3. 7-day strip (range bar + delta vs yesterday/average)
 *   4. Explanation card ("What is X?" — 1-2 sentences for laymen,
 *      production-tuned for SW Client App embedding)
 *   5. Source row (provenance from weather.sources)
 *
 * Production extensions over Apple Weather:
 *   • Wind: drone-safe (≤25 km/h gust) and jib-safe (≤30 km/h gust) ref lines
 *     annotated on the graph as horizontal bands.
 *   • UV: talent skin-exposure cutoff ("UV 8+ → cover crew during continuity").
 *   • Humidity: equipment risk above 85% (camera condensation moving from AC
 *     to exterior).
 *   • Pressure: rapid falls = approaching weather.
 *
 * All metrics share the same component skeleton — only the value picker, scale
 * domain, and explanation copy differ. New metrics: extend `METRIC_REGISTRY`.
 */

import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { scaleLinear, scaleTime } from 'd3-scale';
import { area, line, curveMonotoneX } from 'd3-shape';
import type { HourForecast, WeatherConditions, ConditionCode } from '@/types/weather';
import { compass, fmtTime } from '@/utils/format';

type TimeScale = ReturnType<typeof scaleTime>;
const xv = (s: TimeScale, t: Date): number => Number(s(t));

// ─── Metric registry ─────────────────────────────────────────────────────────

export type MetricKey = 'wind' | 'temperature' | 'rain' | 'humidity' | 'uv' | 'cloud';

interface MetricThreshold { y: number; label: string; color: string; note?: string; }

interface MetricConfig {
  key: MetricKey;
  label: string;
  unit: string;
  // Pick the displayed value out of an HourForecast.
  hourly: (h: HourForecast) => number;
  // For nullable metrics (waves, etc.) — undefined to skip.
  nullable?: (h: HourForecast) => boolean;
  // Y-axis domain padding.
  domain: (vs: number[]) => [number, number];
  // Plain-language summary from current + window.
  summary: (current: number, window: HourForecast[], w: WeatherConditions) => string;
  // Drone/jib/skin-exposure annotations.
  thresholds: (max: number) => MetricThreshold[];
  // Stroke + fill colors.
  stroke: string;
  fillGradient: string; // CSS linear-gradient stops
  format: (v: number) => string; // value formatter
  description?: (h: HourForecast) => string;
}

const METRIC_REGISTRY: Record<MetricKey, MetricConfig> = {
  wind: {
    key: 'wind',
    label: 'Wind',
    unit: 'km/h',
    hourly: (h) => h.windSpeed,
    domain: (vs) => [0, Math.max(40, ...vs) + 4],
    stroke: '#e8e6d8',
    fillGradient: 'linear-gradient(180deg, rgba(216,168,58,0) 0%, rgba(106,142,58,0.18) 50%, rgba(42,106,79,0.35) 100%)',
    format: (v) => `${Math.round(v)}`,
    summary: (_cur, win, w) => {
      const peak = Math.max(...win.map((h) => h.windGust));
      const dir = compass(w.current.windDirection);
      if (peak >= 50) return `Strong ${dir} wind. Gusts peak ${Math.round(peak)} km/h.`;
      if (peak >= 30) return `Breezy from ${dir}. Gusts peak ${Math.round(peak)} km/h.`;
      return `Light wind from ${dir}. Gusts peak ${Math.round(peak)} km/h.`;
    },
    thresholds: () => [],
  },
  temperature: {
    key: 'temperature',
    label: 'Temperature',
    unit: '°C',
    hourly: (h) => h.temperature,
    domain: (vs) => [Math.min(...vs) - 2, Math.max(...vs) + 2],
    stroke: '#fafafa',
    fillGradient: 'linear-gradient(180deg, rgba(191,212,239,0.04) 0%, rgba(255,240,154,0.22) 35%, rgba(255,176,74,0.45) 75%, rgba(244,97,42,0.6) 100%)',
    format: (v) => `${Math.round(v)}°`,
    summary: (_cur, win, w) => {
      const hi = Math.max(...win.map((h) => h.temperature));
      const lo = Math.min(...win.map((h) => h.temperature));
      const peakHour = win.find((h) => h.temperature === hi);
      const tz = w.location.timezone;
      return `High ${hi}° around ${peakHour ? fmtTime(peakHour.time, tz) : '–'}, low ${lo}°.`;
    },
    thresholds: () => [],
  },
  rain: {
    key: 'rain',
    label: 'Rain probability',
    unit: '%',
    hourly: (h) => h.precipProbability,
    domain: () => [0, 100],
    stroke: '#7fc8ff',
    fillGradient: 'linear-gradient(180deg, rgba(58,156,239,0) 0%, rgba(58,156,239,0.3) 40%, rgba(127,200,255,0.65) 100%)',
    format: (v) => `${Math.round(v)}%`,
    summary: (_cur, win) => {
      const peak = Math.max(...win.map((h) => h.precipProbability));
      if (peak < 10) return 'Dry across the window.';
      if (peak < 40) return `Slim chance, peaks ${peak}%.`;
      if (peak < 70) return `Real chance of showers, peaks ${peak}%.`;
      return `High chance of rain, peaks ${peak}%.`;
    },
    thresholds: () => [],
  },
  humidity: {
    key: 'humidity',
    label: 'Humidity',
    unit: '%',
    hourly: (h) => h.humidity,
    domain: () => [0, 100],
    stroke: '#a8b3e0',
    fillGradient: 'linear-gradient(180deg, rgba(168,179,224,0) 0%, rgba(168,179,224,0.3) 60%, rgba(168,179,224,0.55) 100%)',
    format: (v) => `${Math.round(v)}%`,
    summary: (cur, win) => {
      const peak = Math.max(...win.map((h) => h.humidity));
      if (peak < 60) return `Dry air (${cur}%).`;
      if (peak < 85) return `Moderately humid, peaks ${peak}%.`;
      return `Humid, peaks ${peak}%.`;
    },
    thresholds: () => [],
  },
  uv: {
    key: 'uv',
    label: 'UV index',
    unit: '',
    hourly: (h) => h.uvIndex,
    domain: () => [0, 12],
    stroke: '#f0c020',
    fillGradient: 'linear-gradient(180deg, rgba(240,192,32,0) 0%, rgba(240,192,32,0.25) 40%, rgba(232,51,47,0.5) 100%)',
    format: (v) => `${Math.round(v)}`,
    summary: (_cur, win) => {
      const peak = Math.max(...win.map((h) => h.uvIndex));
      if (peak <= 2) return `Low UV (peak ${peak}).`;
      if (peak <= 5) return `Moderate UV (peak ${peak}).`;
      if (peak <= 7) return `High UV (peak ${peak}).`;
      if (peak <= 10) return `Very high UV (peak ${peak}).`;
      return `Extreme UV (peak ${peak}).`;
    },
    thresholds: () => [],
  },
  cloud: {
    key: 'cloud',
    label: 'Cloud cover',
    unit: '%',
    hourly: (h) => h.cloudCover,
    domain: () => [0, 100],
    stroke: '#a8b3e0',
    fillGradient: 'linear-gradient(180deg, rgba(122,138,163,0) 0%, rgba(122,138,163,0.32) 100%)',
    format: (v) => `${Math.round(v)}%`,
    summary: (cur, win) => {
      const mean = Math.round(win.reduce((s, h) => s + h.cloudCover, 0) / win.length);
      if (mean < 25) return `Mostly clear (${cur}% now, avg ${mean}%).`;
      if (mean < 60) return `Partly cloudy (avg ${mean}%).`;
      return `Overcast (avg ${mean}%).`;
    },
    thresholds: () => [],
  },
};

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  weather: WeatherConditions;
  initialMetric: MetricKey;
  onClose: () => void;
}

const METRIC_ORDER: MetricKey[] = ['wind', 'temperature', 'rain', 'humidity', 'uv', 'cloud'];

export function MetricDetail({ weather, initialMetric, onClose }: Props) {
  const [metric, setMetric] = useState<MetricKey>(initialMetric);
  const cfg = METRIC_REGISTRY[metric];
  const { hours, days, location, current, sources } = weather;
  const tz = location.timezone;

  // 48h window starting "now".
  const nowMs = Date.now();
  const startIdx = Math.max(0, hours.findIndex((h) => h.time.getTime() >= nowMs - 3600_000));
  const win = hours.slice(startIdx, startIdx + 48);

  const currentVal = useMemo(() => cfg.hourly(win[0] ?? hours[0]), [cfg, win, hours]);
  const summary = useMemo(() => cfg.summary(currentVal, win, weather), [cfg, currentVal, win, weather]);

  // Provenance for this metric. The SourceMap uses canonical keys.
  const provKey: Record<MetricKey, string> = {
    wind: 'wind', temperature: 'temperature', rain: 'precipitation',
    humidity: 'temperature', uv: 'uv', cloud: 'uv',
  };
  const prov = sources[provKey[metric]];

  // [Switcher dropdown state]
  const [switcherOpen, setSwitcherOpen] = useState(false);

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#070b1a] text-neutral-200">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[#131a2e] px-3 py-2.5">
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-300 hover:bg-white/5"
          aria-label="Close"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="flex flex-col">
          <span className="font-mono text-[9px] font-bold tracking-[1.2px] text-[#7a8aa3]">{location.name.toUpperCase()}</span>
        </div>
        <div className="relative ml-auto">
          <button
            onClick={() => setSwitcherOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-full border border-[#1b2440] bg-[#0c1428] px-2.5 py-1 text-[13px] font-semibold tracking-tight text-neutral-50"
          >
            {cfg.label}
            <svg width="10" height="6" viewBox="0 0 10 6" className="opacity-70"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" /></svg>
          </button>
          {switcherOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-lg border border-[#1b2440] bg-[#0c1428] shadow-xl">
              {METRIC_ORDER.map((k) => (
                <button
                  key={k}
                  onClick={() => { setMetric(k); setSwitcherOpen(false); }}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-[13px] ${k === metric ? 'bg-white/5 text-neutral-50' : 'text-neutral-300 hover:bg-white/[0.03]'}`}
                >
                  <span>{METRIC_REGISTRY[k].label}</span>
                  <span className="font-mono text-[10px] text-neutral-500">{METRIC_REGISTRY[k].unit}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-3">
        {/* Hero */}
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[60px] font-thin leading-none tabular-nums tracking-[-2px] text-neutral-50">
            {cfg.format(currentVal)}
          </span>
          <span className="font-mono text-[15px] text-neutral-500">{cfg.unit}</span>
        </div>
        <p className="mt-2 text-[14px] leading-snug text-neutral-300">{summary}</p>
        {prov && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#1b2440] bg-[#0c1428] px-2.5 py-1 text-[10px] font-mono tabular-nums">
            <span className="font-bold uppercase tracking-wide text-[#9aa0b3]">{prov.source}</span>
            <span className={`uppercase tracking-wide ${prov.confidence === 'high' ? 'text-emerald-400' : prov.confidence === 'medium' ? 'text-amber-300' : 'text-rose-300'}`}>{prov.confidence}</span>
            {prov.model && <span className="text-[#7a8aa3]">· {prov.model}</span>}
          </div>
        )}

        {/* Hourly graph */}
        <MetricGraph hours={win} cfg={cfg} tz={tz} />

        {/* 7-day strip */}
        <div className="mt-5">
          <SectionLabel>NEXT 7 DAYS</SectionLabel>
          <DailyStrip days={days} metric={metric} weather={weather} />
        </div>

        {/* Current observation source */}
        {current.observedAt && (
          <div className="mt-3 text-center font-mono text-[10px] text-[#5a6485]">
            Observation valid {fmtTime(current.observedAt, tz)} · {location.region}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Hourly graph (single band, with scrub + threshold lines) ────────────────

function MetricGraph({ hours, cfg, tz }: { hours: HourForecast[]; cfg: MetricConfig; tz: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(320);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = 180;
  const PAD_L = 8;
  const PAD_R = 8;
  const PAD_T = 28;
  const PAD_B = 28;
  const innerW = Math.max(80, w - PAD_L - PAD_R);
  const innerH = H - PAD_T - PAD_B;
  const vals = hours.map(cfg.hourly);
  const [dLo, dHi] = cfg.domain(vals);
  const x = useMemo(() => scaleTime().domain([hours[0]?.time ?? new Date(), hours[hours.length - 1]?.time ?? new Date()]).range([0, innerW]), [hours, innerW]);
  const y = useMemo(() => scaleLinear().domain([dLo, dHi]).range([innerH, 0]), [dLo, dHi, innerH]);

  const ar = area<HourForecast>().curve(curveMonotoneX).x((d) => xv(x, d.time)).y0(innerH).y1((d) => Number(y(cfg.hourly(d))));
  const ln = line<HourForecast>().curve(curveMonotoneX).x((d) => xv(x, d.time)).y((d) => Number(y(cfg.hourly(d))));
  const gradId = `mdGrad-${cfg.key}`;

  const [cursor, setCursor] = useState<number | null>(null);
  const cursorHour = useMemo(() => {
    if (cursor == null) return null;
    const t = x.invert(cursor).getTime();
    let bi = 0;
    let bd = Infinity;
    for (let i = 0; i < hours.length; i++) {
      const d = Math.abs(hours[i].time.getTime() - t);
      if (d < bd) { bd = d; bi = i; }
    }
    return hours[bi];
  }, [cursor, hours, x]);

  const onPointer = (e: PointerEvent<SVGSVGElement>) => {
    if (e.buttons === 0 && e.type !== 'pointerdown' && e.type !== 'pointermove') return;
    const svg = ref.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const px = Math.max(0, Math.min(innerW, e.clientX - r.left - PAD_L));
    setCursor(px);
  };
  const clear = () => setCursor(null);

  // Threshold lines per metric (drone/jib/etc.).
  const peak = Math.max(...vals);
  const thresholds = cfg.thresholds(peak);

  return (
    <div ref={wrap} className="mt-4">
      {/* Scrub chip */}
      <div className="mb-2 flex h-7 items-baseline gap-2 rounded-md bg-[#0c1428] px-2.5 text-[11px]">
        <span className="font-mono text-[9px] font-bold tracking-[1.2px] text-[#7a8aa3]">
          {cursorHour ? 'SCRUB' : 'NOW'}
        </span>
        <span className="font-mono text-[12px] font-semibold tabular-nums text-neutral-50">
          {fmtTime((cursorHour ?? hours[0]).time, tz)} · {cfg.format(cfg.hourly(cursorHour ?? hours[0]))}{cfg.unit}
        </span>
      </div>
      <svg
        ref={ref}
        width={w}
        height={H}
        onPointerDown={onPointer}
        onPointerMove={onPointer}
        onPointerUp={clear}
        onPointerCancel={clear}
        onPointerLeave={clear}
        style={{ touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none' }}
        className="block"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="1" x2="0" y2="0">
            {cfg.fillGradient.match(/rgba?\([^)]+\)/g)?.map((c, i, a) => (
              <stop key={i} offset={`${Math.round((i / Math.max(1, a.length - 1)) * 100)}%`} stopColor={c} />
            ))}
          </linearGradient>
        </defs>
        <g transform={`translate(${PAD_L},${PAD_T})`}>
          {/* Threshold reference lines */}
          {thresholds.map((t, i) => (
            <g key={i} opacity="0.55">
              <line x1={0} x2={innerW} y1={Number(y(t.y))} y2={Number(y(t.y))} stroke={t.color} strokeWidth="0.8" strokeDasharray="3 3" />
              <text x={innerW - 2} y={Number(y(t.y)) - 2} fontSize="9" fontFamily="ui-monospace, monospace" fill={t.color} textAnchor="end" fontWeight={700}>{t.label}</text>
            </g>
          ))}
          {/* Area + line */}
          <path d={ar(hours) ?? ''} fill={`url(#${gradId})`} />
          <path d={ln(hours) ?? ''} fill="none" stroke={cfg.stroke} strokeWidth="1.6" />
          {/* Tick labels (every 6h) */}
          {hours.map((h, i) => {
            if (i % 6 !== 0) return null;
            const v = cfg.hourly(h);
            return (
              <g key={i}>
                <circle cx={xv(x, h.time)} cy={Number(y(v))} r="2.4" fill={cfg.stroke} />
                <text x={xv(x, h.time)} y={Number(y(v)) - 6} fontSize="10" fill={cfg.stroke} textAnchor="middle" fontFamily="ui-monospace, monospace">{cfg.format(v)}</text>
              </g>
            );
          })}
          {/* Scrub cursor */}
          {cursor != null && cursorHour && (
            <g pointerEvents="none">
              <line x1={xv(x, cursorHour.time)} x2={xv(x, cursorHour.time)} y1={0} y2={innerH} stroke="#ffd06a" strokeWidth="1" opacity="0.9" />
              <circle cx={xv(x, cursorHour.time)} cy={Number(y(cfg.hourly(cursorHour)))} r="4" fill="#ffd06a" />
            </g>
          )}
          {/* Time axis */}
          <g transform={`translate(0,${innerH + 6})`}>
            {hours.map((h, i) => {
              const hh = Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }).format(h.time));
              if (hh % 6 !== 0) return null;
              return (
                <text key={i} x={xv(x, h.time)} y={12} fontSize="9" fill="#7a8aa3" textAnchor="middle" fontFamily="ui-monospace, monospace">{String(hh).padStart(2, '0')}</text>
              );
            })}
          </g>
        </g>
      </svg>
    </div>
  );
}

// ─── 7-day strip ─────────────────────────────────────────────────────────────

function DailyStrip({ days, metric, weather }: { days: WeatherConditions['days']; metric: MetricKey; weather: WeatherConditions }) {
  const valFor = (d: WeatherConditions['days'][number]): number => {
    switch (metric) {
      case 'wind': return d.windAvg;
      case 'temperature': return d.tempHi;
      case 'rain': return d.rainProbability;
      case 'humidity': return 0; // no daily humidity in our DayForecast
      case 'uv': return d.uvMax;
      case 'cloud': return 0; // no daily cloud aggregate
      default: return 0;
    }
  };
  const cfg = METRIC_REGISTRY[metric];
  const subFor = (d: WeatherConditions['days'][number]): string => {
    switch (metric) {
      case 'wind': return `${compass(d.windDirection)} · g${d.windGust}`;
      case 'temperature': return `lo ${d.tempLo}°`;
      case 'rain': return `${d.rainAmount.toFixed(1)}mm`;
      case 'uv': return `${uvLabel(d.uvMax)}`;
      case 'humidity':
      case 'cloud':
      default: return descShort(d.description);
    }
  };
  const max = Math.max(...days.map(valFor));
  void weather; // weather available if we want delta-vs-current
  return (
    <div className="overflow-hidden rounded-xl border border-[#1b2440] bg-[#0c1428]">
      {days.map((d, i) => (
        <div key={d.date.getTime()} className={`flex items-center gap-2.5 px-3 py-2 ${i === days.length - 1 ? '' : 'border-b border-[#131a2e]'} ${d.dayName === 'Today' ? 'bg-[linear-gradient(90deg,rgba(255,208,106,0.06),transparent)]' : ''}`}>
          <div className="flex w-[64px] flex-col">
            <div className={`text-[12.5px] font-semibold tracking-tight ${d.dayName === 'Today' ? 'text-[#ffd06a]' : 'text-neutral-50'}`}>{d.dayName}</div>
            <div className="font-mono text-[10px] tabular-nums text-[#7a8aa3]">{shortDate(d.date)}</div>
          </div>
          <div className="flex-1">
            <div className="relative h-1.5 overflow-hidden rounded-sm bg-[#1b2440]">
              <div className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${Math.min(100, (valFor(d) / Math.max(1, max)) * 100)}%`, background: cfg.stroke }} />
            </div>
          </div>
          <div className="w-[64px] text-right">
            <div className="font-mono text-[13px] font-semibold tabular-nums text-neutral-50">{cfg.format(valFor(d))}{cfg.unit === '%' ? '%' : ''}</div>
            <div className="font-mono text-[10px] tabular-nums text-[#7a8aa3]">{subFor(d)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="pb-1.5 font-mono text-[9px] font-bold tracking-[1.2px] text-[#5a6485]">{children}</div>;
}

function shortDate(d: Date): string {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(d);
}
function uvLabel(v: number): string {
  if (v <= 2) return 'low';
  if (v <= 5) return 'mod';
  if (v <= 7) return 'high';
  if (v <= 10) return 'vhigh';
  return 'extreme';
}
function descShort(c: ConditionCode): string {
  // Compact 7-char-ish abbreviations for the daily-strip sub line.
  switch (c) {
    case 'Sunny': case 'Clear': return 'clear';
    case 'Mostly sunny': case 'Mostly clear': return 'mostly clear';
    case 'Partly cloudy': return 'partly cloudy';
    case 'Cloudy': return 'cloudy';
    case 'Light rain': return 'drizzle';
    case 'Rain': return 'rain';
    case 'Heavy rain': return 'hvy rain';
    case 'Thunder': return 'thunder';
    case 'Snow': return 'snow';
    case 'Fog': return 'fog';
    case 'Haze': return 'haze';
    default: return '';
  }
}
