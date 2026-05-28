/**
 * MetricDetail — Apple-Weather-style full-screen drilldown for one metric.
 *
 * Opens from any tappable metric card on Visual / Home. Header shows the
 * metric name with a chevron dropdown that swaps the metric in place
 * (without backing out of the modal). Units toggle sits next to the dropdown
 * when the metric supports alternates (wind kt/kmh, temp °C/°F).
 *
 * Body:
 *   1. Hero value + plain-language summary + source pill
 *   2. Hourly graph (scrubable, with wind direction arrows for Wind, gust
 *      overlay when applicable). For Wind, past hours (≤ now) draw from live
 *      OD wind history so the past portion is OBSERVED, not forecast.
 *   3. 7-day strip — tap a day to retarget the graph window on that day.
 *
 * Range window is now also user-driven:
 *   • Tapping a future-day row in the 7-day strip windows the graph to that
 *     day's 24h (sunrise to sunrise).
 *   • Otherwise: 48h forward from "now".
 */

import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { scaleLinear, scaleTime } from 'd3-scale';
import { area, line, curveMonotoneX } from 'd3-shape';
import type { HourForecast, WeatherConditions, ConditionCode } from '@/types/weather';
import { compass, fmtTime } from '@/utils/format';
import { loadWindUnit, loadTempUnit, saveWindUnit, saveTempUnit, type WindUnit, type TempUnit } from '@/services/stations';

type TimeScale = ReturnType<typeof scaleTime>;
const xv = (s: TimeScale, t: Date): number => Number(s(t));

const KMH_TO_KT = 1 / 1.852;

// ─── Metric registry ─────────────────────────────────────────────────────────

export type MetricKey = 'wind' | 'temperature' | 'rain' | 'humidity' | 'uv' | 'cloud';

interface MetricConfig {
  key: MetricKey;
  label: string;
  /** Default unit label (used when no toggle). */
  unit: string;
  hourly: (h: HourForecast) => number;
  domain: (vs: number[]) => [number, number];
  summary: (cur: number, win: HourForecast[], w: WeatherConditions) => string;
  stroke: string;
  fillGradient: string;
  format: (v: number, ctx: { windUnit: WindUnit; tempUnit: TempUnit }) => string;
  /** Whether the metric carries wind direction (for arrow row + chip dir). */
  hasDirection?: boolean;
  /** Whether to draw gust band overlay. */
  hasGust?: boolean;
  /** Active unit label for the given user prefs. */
  unitLabel?: (ctx: { windUnit: WindUnit; tempUnit: TempUnit }) => string;
  /** Convert km/h or °C input to the user's chosen display unit. */
  convert?: (v: number, ctx: { windUnit: WindUnit; tempUnit: TempUnit }) => number;
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
    format: (v, { windUnit }) => `${Math.round(windUnit === 'kt' ? v * KMH_TO_KT : v)}`,
    unitLabel: ({ windUnit }) => (windUnit === 'kt' ? 'kt' : 'km/h'),
    convert: (v, { windUnit }) => (windUnit === 'kt' ? v * KMH_TO_KT : v),
    summary: (_cur, win, w) => {
      const peak = Math.max(...win.map((h) => h.windGust));
      const dir = compass(w.current.windDirection);
      if (peak >= 50) return `Strong ${dir} wind. Gusts peak ${Math.round(peak)} km/h.`;
      if (peak >= 30) return `Breezy from ${dir}. Gusts peak ${Math.round(peak)} km/h.`;
      return `Light wind from ${dir}. Gusts peak ${Math.round(peak)} km/h.`;
    },
    hasDirection: true,
    hasGust: true,
  },
  temperature: {
    key: 'temperature',
    label: 'Temperature',
    unit: '°C',
    hourly: (h) => h.temperature,
    domain: (vs) => [Math.min(...vs) - 2, Math.max(...vs) + 2],
    stroke: '#fafafa',
    fillGradient: 'linear-gradient(180deg, rgba(191,212,239,0.04) 0%, rgba(255,240,154,0.22) 35%, rgba(255,176,74,0.45) 75%, rgba(244,97,42,0.6) 100%)',
    format: (v, { tempUnit }) => `${Math.round(tempUnit === 'f' ? v * 9 / 5 + 32 : v)}°`,
    unitLabel: ({ tempUnit }) => (tempUnit === 'f' ? '°F' : '°C'),
    convert: (v, { tempUnit }) => (tempUnit === 'f' ? v * 9 / 5 + 32 : v),
    summary: (_cur, win, w) => {
      const hi = Math.max(...win.map((h) => h.temperature));
      const lo = Math.min(...win.map((h) => h.temperature));
      const peakHour = win.find((h) => h.temperature === hi);
      const tz = w.location.timezone;
      return `High ${hi}° around ${peakHour ? fmtTime(peakHour.time, tz) : '–'}, low ${lo}°.`;
    },
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
  },
};

const METRIC_ORDER: MetricKey[] = ['wind', 'temperature', 'rain', 'humidity', 'uv', 'cloud'];

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  weather: WeatherConditions;
  initialMetric: MetricKey;
  onClose: () => void;
}

export function MetricDetail({ weather, initialMetric, onClose }: Props) {
  const [metric, setMetric] = useState<MetricKey>(initialMetric);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [windUnit, setWindUnit] = useState<WindUnit>(loadWindUnit);
  const [tempUnit, setTempUnit] = useState<TempUnit>(loadTempUnit);
  const [selectedDayIdx, setSelectedDayIdx] = useState<number | null>(null);

  const cfg = METRIC_REGISTRY[metric];
  const ctx = { windUnit, tempUnit };
  const { hours, days, location, current, sources } = weather;
  const tz = location.timezone;

  // Window selection: today → 48h from "now"; future day → 06:00–06:00 next day.
  const nowMs = Date.now();
  const win = useMemo(() => {
    if (selectedDayIdx == null || selectedDayIdx === 0) {
      const startIdx = Math.max(0, hours.findIndex((h) => h.time.getTime() >= nowMs - 3600_000));
      return hours.slice(startIdx, startIdx + 48);
    }
    const targetDay = days[selectedDayIdx]?.date;
    if (!targetDay) return [];
    const dayStart = new Date(targetDay);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 24 * 3600_000);
    return hours.filter((h) => h.time >= dayStart && h.time < dayEnd);
  }, [selectedDayIdx, hours, days, nowMs]);

  // Current value for hero.
  const currentVal = useMemo(() => {
    if (selectedDayIdx == null || selectedDayIdx === 0) {
      // Today: prefer the live current observation for wind / temp.
      switch (metric) {
        case 'wind': return current.windSpeed;
        case 'temperature': return current.temperature;
        case 'humidity': return current.humidity;
        case 'uv': return current.uvIndex ?? days[0]?.uvMax ?? 0;
        case 'cloud': return current.cloudCover ?? 0;
        default: return cfg.hourly(win[0] ?? hours[0]);
      }
    }
    // Future days: pick that day's most-relevant aggregate.
    const d = days[selectedDayIdx];
    if (!d) return 0;
    switch (metric) {
      case 'wind': return d.windAvg;
      case 'temperature': return d.tempHi;
      case 'rain': return d.rainProbability;
      case 'uv': return d.uvMax;
      default: return cfg.hourly(win[0] ?? hours[0]);
    }
  }, [metric, current, days, selectedDayIdx, win, hours, cfg]);

  const summary = useMemo(() => cfg.summary(currentVal, win, weather), [cfg, currentVal, win, weather]);

  // Provenance for this metric.
  const provKey: Record<MetricKey, string> = {
    wind: 'wind', temperature: 'temperature', rain: 'precipitation',
    humidity: 'temperature', uv: 'uv', cloud: 'uv',
  };
  const prov = sources[provKey[metric]];

  const unitLabel = cfg.unitLabel?.(ctx) ?? cfg.unit;
  const hasUnitToggle = metric === 'wind' || metric === 'temperature';

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
        <div className="ml-auto flex items-center gap-2">
          {hasUnitToggle && metric === 'wind' && (
            <MiniToggle a={{ key: 'kt', label: 'kt' }} b={{ key: 'kmh', label: 'km/h' }} value={windUnit} onChange={(v) => { setWindUnit(v as WindUnit); saveWindUnit(v as WindUnit); }} />
          )}
          {hasUnitToggle && metric === 'temperature' && (
            <MiniToggle a={{ key: 'c', label: '°C' }} b={{ key: 'f', label: '°F' }} value={tempUnit} onChange={(v) => { setTempUnit(v as TempUnit); saveTempUnit(v as TempUnit); }} />
          )}
          <div className="relative">
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
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-3">
        {/* Hero */}
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[60px] font-thin leading-none tabular-nums tracking-[-2px] text-neutral-50">
            {cfg.format(currentVal, ctx)}
          </span>
          <span className="font-mono text-[15px] text-neutral-500">{unitLabel}</span>
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
        <MetricGraph
          hours={win}
          cfg={cfg}
          tz={tz}
          ctx={ctx}
          nowMs={nowMs}
          windHistory={metric === 'wind' ? weather.windHistory : undefined}
        />

        {/* 7-day strip */}
        <div className="mt-5">
          <SectionLabel>NEXT 7 DAYS</SectionLabel>
          <DailyStrip
            days={days}
            metric={metric}
            weather={weather}
            ctx={ctx}
            selectedIdx={selectedDayIdx ?? 0}
            onSelect={(i) => setSelectedDayIdx(i)}
          />
        </div>

        {current.observedAt && (
          <div className="mt-3 text-center font-mono text-[10px] text-[#5a6485]">
            Observation valid {fmtTime(current.observedAt, tz)} · {location.region}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniToggle({ a, b, value, onChange }: { a: { key: string; label: string }; b: { key: string; label: string }; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex h-7 items-stretch overflow-hidden rounded-full border border-[#1b2440] bg-[#0a1024] p-0.5">
      {[a, b].map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={`min-w-[28px] rounded-full px-2 font-mono text-[10px] font-semibold tabular-nums transition-colors ${
            value === opt.key ? 'bg-white/10 text-neutral-50' : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Hourly graph ────────────────────────────────────────────────────────────

function MetricGraph({ hours, cfg, tz, ctx, nowMs, windHistory }: {
  hours: HourForecast[];
  cfg: MetricConfig;
  tz: string;
  ctx: { windUnit: WindUnit; tempUnit: TempUnit };
  nowMs: number;
  windHistory?: WeatherConditions['windHistory'];
}) {
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

  // For wind: replace past hours with observed wind from windHistory.day where
  // available — produces a continuous past-obs → future-forecast line, with
  // the "now" boundary marked.
  const merged = useMemo(() => {
    if (!cfg.hasGust || !windHistory?.day?.length) return hours;
    // OD history is in km/h. Match to forecast hour times by rounding.
    const histByHour = new Map<number, { wind: number; gust: number | null; dir: number | null }>();
    for (const p of windHistory.day) {
      const t = new Date(p.time);
      t.setMinutes(0, 0, 0);
      histByHour.set(t.getTime(), { wind: p.windSpeed, gust: p.windGust, dir: p.windDirection });
    }
    return hours.map((h) => {
      if (h.time.getTime() > nowMs) return h;
      const obs = histByHour.get(h.time.getTime());
      if (!obs) return h;
      return {
        ...h,
        windSpeed: obs.wind,
        windGust: obs.gust ?? h.windGust,
        windDirection: obs.dir ?? h.windDirection,
      };
    });
  }, [hours, windHistory, nowMs, cfg.hasGust]);

  const H = cfg.hasDirection ? 210 : 180;
  const PAD_L = 8;
  const PAD_R = 8;
  const PAD_T = 28;
  const PAD_B = cfg.hasDirection ? 50 : 28;
  const innerW = Math.max(80, w - PAD_L - PAD_R);
  const innerH = H - PAD_T - PAD_B;

  const vals = merged.map(cfg.hourly);
  const gusts = cfg.hasGust ? merged.map((h) => h.windGust) : [];
  const allVals = cfg.hasGust ? [...vals, ...gusts] : vals;
  const [dLo, dHi] = cfg.domain(allVals);

  const x = useMemo(() => scaleTime().domain([merged[0]?.time ?? new Date(), merged[merged.length - 1]?.time ?? new Date()]).range([0, innerW]), [merged, innerW]);
  const y = useMemo(() => scaleLinear().domain([dLo, dHi]).range([innerH, 0]), [dLo, dHi, innerH]);

  // Accessor mapped through the active unit so the chart shows kt/°F when set.
  const toY = (raw: number) => Number(y(cfg.convert ? cfg.convert(raw, ctx) : raw));

  // The displayed-domain after unit conversion (so axis labels match).
  const dyLo = cfg.convert ? cfg.convert(dLo, ctx) : dLo;
  const dyHi = cfg.convert ? cfg.convert(dHi, ctx) : dHi;
  const yDisp = useMemo(() => scaleLinear().domain([dyLo, dyHi]).range([innerH, 0]), [dyLo, dyHi, innerH]);

  const ar = area<HourForecast>().curve(curveMonotoneX).x((d) => xv(x, d.time)).y0(innerH).y1((d) => toY(cfg.hourly(d)));
  const ln = line<HourForecast>().curve(curveMonotoneX).x((d) => xv(x, d.time)).y((d) => toY(cfg.hourly(d)));
  const gustLn = cfg.hasGust ? line<HourForecast>().curve(curveMonotoneX).x((d) => xv(x, d.time)).y((d) => toY(d.windGust)) : null;
  const gradId = `mdGrad-${cfg.key}`;

  const [cursor, setCursor] = useState<number | null>(null);
  const cursorHour = useMemo(() => {
    if (cursor == null || !merged.length) return null;
    const t = x.invert(cursor).getTime();
    let bi = 0;
    let bd = Infinity;
    for (let i = 0; i < merged.length; i++) {
      const d = Math.abs(merged[i].time.getTime() - t);
      if (d < bd) { bd = d; bi = i; }
    }
    return merged[bi];
  }, [cursor, merged, x]);

  const onPointer = (e: PointerEvent<SVGSVGElement>) => {
    if (e.buttons === 0 && e.type !== 'pointerdown' && e.type !== 'pointermove') return;
    const svg = ref.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const px = Math.max(0, Math.min(innerW, e.clientX - r.left - PAD_L));
    setCursor(px);
  };
  const clear = () => setCursor(null);

  const nowX = nowMs >= +merged[0]?.time && nowMs <= +merged[merged.length - 1]?.time ? xv(x, new Date(nowMs)) : null;

  return (
    <div ref={wrap} className="mt-4">
      {/* Scrub chip */}
      <div className="mb-2 flex h-7 items-baseline gap-2 rounded-md bg-[#0c1428] px-2.5 text-[11px]">
        <span className="font-mono text-[9px] font-bold tracking-[1.2px] text-[#7a8aa3]">
          {cursorHour ? (cursorHour.time.getTime() < nowMs ? 'OBSERVED' : 'FORECAST') : 'NOW'}
        </span>
        <span className="font-mono text-[12px] font-semibold tabular-nums text-neutral-50">
          {fmtTime((cursorHour ?? merged[0]).time, tz)} · {cfg.format(cfg.hourly(cursorHour ?? merged[0]), ctx)}{cfg.unitLabel?.(ctx) ?? cfg.unit}
          {cfg.hasGust && cursorHour && ` · g${cfg.format(cursorHour.windGust, ctx)}`}
          {cfg.hasDirection && cursorHour && ` · ${compass(cursorHour.windDirection)}`}
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
          {/* "Now" boundary — shaded past area for context */}
          {nowX !== null && (
            <>
              <rect x={0} y={0} width={nowX} height={innerH} fill="#0a1024" opacity="0.55" />
              <line x1={nowX} y1={0} x2={nowX} y2={innerH + 4} stroke="#ffd06a" strokeWidth="1" opacity="0.6" strokeDasharray="3 3" />
              <text x={nowX + 3} y={10} fontSize="9" fontFamily="ui-monospace, monospace" fill="#ffd06a" fontWeight={700}>NOW</text>
            </>
          )}
          {/* Area + line */}
          <path d={ar(merged) ?? ''} fill={`url(#${gradId})`} />
          {gustLn && <path d={gustLn(merged) ?? ''} fill="none" stroke="#cfb878" strokeWidth="0.9" strokeDasharray="2 2" opacity="0.7" />}
          <path d={ln(merged) ?? ''} fill="none" stroke={cfg.stroke} strokeWidth="1.6" />
          {/* Tick labels every 6h */}
          {merged.map((h, i) => {
            if (i % 6 !== 0) return null;
            const v = cfg.hourly(h);
            return (
              <g key={i}>
                <circle cx={xv(x, h.time)} cy={toY(v)} r="2.4" fill={cfg.stroke} />
                <text x={xv(x, h.time)} y={toY(v) - 6} fontSize="10" fill={cfg.stroke} textAnchor="middle" fontFamily="ui-monospace, monospace">{cfg.format(v, ctx)}</text>
              </g>
            );
          })}
          {/* Direction arrows row (wind only) */}
          {cfg.hasDirection && (
            <g transform={`translate(0,${innerH + 6})`}>
              {merged.map((h, i) => {
                if (i % 3 !== 0) return null;
                return (
                  <g key={`d${i}`} transform={`translate(${xv(x, h.time)},6) rotate(${h.windDirection + 180})`}>
                    <path d="M0 -4 L3 4 L0 2.5 L-3 4 Z" fill="#a8b3e0" opacity="0.85" />
                  </g>
                );
              })}
            </g>
          )}
          {/* Scrub cursor */}
          {cursor != null && cursorHour && (
            <g pointerEvents="none">
              <line x1={xv(x, cursorHour.time)} x2={xv(x, cursorHour.time)} y1={0} y2={innerH} stroke="#ffd06a" strokeWidth="1" opacity="0.9" />
              <circle cx={xv(x, cursorHour.time)} cy={toY(cfg.hourly(cursorHour))} r="4" fill="#ffd06a" />
            </g>
          )}
          {/* Time axis */}
          <g transform={`translate(0,${innerH + (cfg.hasDirection ? 28 : 6)})`}>
            {merged.map((h, i) => {
              const hh = Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }).format(h.time));
              if (hh % 6 !== 0) return null;
              return (
                <text key={i} x={xv(x, h.time)} y={12} fontSize="9" fill="#7a8aa3" textAnchor="middle" fontFamily="ui-monospace, monospace">{String(hh).padStart(2, '0')}</text>
              );
            })}
          </g>
        </g>
      </svg>
      {/* Unused-var suppression for yDisp (kept for future axis labels). */}
      <span style={{ display: 'none' }}>{yDisp(dyLo)}</span>
    </div>
  );
}

// ─── 7-day strip ─────────────────────────────────────────────────────────────

function DailyStrip({ days, metric, weather, ctx, selectedIdx, onSelect }: {
  days: WeatherConditions['days'];
  metric: MetricKey;
  weather: WeatherConditions;
  ctx: { windUnit: WindUnit; tempUnit: TempUnit };
  selectedIdx: number;
  onSelect: (i: number) => void;
}) {
  const cfg = METRIC_REGISTRY[metric];

  // Returns the "primary" daily value for this metric. Today's row is overlaid
  // with current obs when AEMET daily has zero (typical for windAvg).
  const valFor = (d: WeatherConditions['days'][number], i: number): number => {
    const isToday = i === 0;
    switch (metric) {
      case 'wind': return d.windAvg || (isToday ? weather.current.windSpeed : 0);
      case 'temperature': return d.tempHi;
      case 'rain': return d.rainProbability;
      case 'humidity': return isToday ? weather.current.humidity : 0;
      case 'uv': return d.uvMax;
      case 'cloud': return isToday ? weather.current.cloudCover ?? 0 : 0;
      default: return 0;
    }
  };
  const subFor = (d: WeatherConditions['days'][number], i: number): string => {
    const isToday = i === 0;
    switch (metric) {
      case 'wind': {
        const dir = d.windDirection || (isToday ? weather.current.windDirection : 0);
        const gust = d.windGust || 0;
        return `${compass(dir)}${gust ? ` · g${gust}` : ''}`;
      }
      case 'temperature': return `lo ${d.tempLo}°`;
      case 'rain': return `${d.rainAmount.toFixed(1)}mm`;
      case 'uv': return uvLabel(d.uvMax);
      default: return descShort(d.description);
    }
  };
  const max = Math.max(...days.map((d, i) => valFor(d, i)));

  return (
    <div className="overflow-hidden rounded-xl border border-[#1b2440] bg-[#0c1428]">
      {days.map((d, i) => {
        const v = valFor(d, i);
        const isActive = i === selectedIdx;
        return (
          <button
            key={d.date.getTime()}
            onClick={() => onSelect(i)}
            className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${i === days.length - 1 ? '' : 'border-b border-[#131a2e]'} ${
              isActive ? 'bg-white/[0.04]' : d.dayName === 'Today' ? 'bg-[linear-gradient(90deg,rgba(255,208,106,0.06),transparent)]' : 'hover:bg-white/[0.02]'
            }`}
          >
            <div className="flex w-[64px] flex-col">
              <div className={`text-[12.5px] font-semibold tracking-tight ${d.dayName === 'Today' ? 'text-[#ffd06a]' : 'text-neutral-50'}`}>{d.dayName}</div>
              <div className="font-mono text-[10px] tabular-nums text-[#7a8aa3]">{shortDate(d.date)}</div>
            </div>
            <div className="flex-1">
              <div className="relative h-1.5 overflow-hidden rounded-sm bg-[#1b2440]">
                <div className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${Math.min(100, (v / Math.max(1, max)) * 100)}%`, background: cfg.stroke }} />
              </div>
            </div>
            <div className="w-[72px] text-right">
              <div className="font-mono text-[13px] font-semibold tabular-nums text-neutral-50">{cfg.format(v, ctx)}</div>
              <div className="font-mono text-[10px] tabular-nums text-[#7a8aa3]">{subFor(d, i)}</div>
            </div>
          </button>
        );
      })}
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
