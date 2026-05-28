/**
 * Today · Graph — multi-band scrubable forecast canvas.
 *
 * One SVG, all bands sharing a single time scale that fits the viewport width
 * (no horizontal scroll). User picks the time range (24 / 48 / 72h) via a
 * segmented toggle. Drag horizontally on the chart → vertical cursor pins
 * every band's value at that hour and shows a floating chip with all metrics
 * for that time (production decisions: "Thu 11:00 → drone-safe, golden hour
 * 19:30, rain in 14 min").
 *
 * Bands (top → bottom):
 *   1. Temperature — feels-like as dashed undercurve, line + area, gradient
 *   2. Wind / gusts — line + gust band + direction arrows below
 *   3. Rain — probability area + precip-amount bars
 *   4. Cloud cover — bar
 *   5. UV index — dot-per-hour colored
 *
 * Overlays:
 *   • Night shading (subtle dark band across the full chart at every <06 / >=20 hr)
 *   • Golden hour shading (warm amber band from sunrise→goldenEnd and
 *     goldenStart→sunset; computed locally via suncalc)
 *   • New-day vertical lines
 *   • "Now" vertical marker
 *
 * Annotations are floating chips placed at peak gust, peak rain, sunrise,
 * sunset — anchored to their time and the relevant band.
 *
 * D3 used minimally: scaleLinear/scaleTime + area/line generators.
 */

import { memo, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { scaleLinear, scaleTime } from 'd3-scale';
import { area, line, curveMonotoneX } from 'd3-shape';

// d3-scale's call signature returns NumberValue (typed `unknown`). We use
// these scales purely for numeric output (svg coordinates), so adopt a
// pre-narrowed `TimeScale` type and cast at the use sites with the `xv` /
// `lv` helpers — keeps every accessor return a plain `number`.
type TimeScale = ReturnType<typeof scaleTime>;
const xv = (s: TimeScale, t: Date): number => Number(s(t));
import type { HourForecast, WeatherConditions } from '@/types/weather';
import { compass, fmtTime, localHour } from '@/utils/format';
import { computeSunPhases } from '@/services/sun';

type RangeKey = '24h' | '48h' | '72h';
const RANGES: { key: RangeKey; label: string; hours: number }[] = [
  { key: '24h', label: '24h', hours: 24 },
  { key: '48h', label: '48h', hours: 48 },
  { key: '72h', label: '72h', hours: 72 },
];

// Band layout — vertical stack inside the chart area. Each band has its own
// y-axis. Heights tuned for a 6.1" iPhone (≈ 700px usable height after hero).
const BANDS = {
  temp:  { h: 96, label: 'Temp',  unit: '°C' },
  wind:  { h: 92, label: 'Wind',  unit: 'km/h' },
  rain:  { h: 70, label: 'Rain',  unit: '% · mm' },
  cloud: { h: 36, label: 'Cloud', unit: '%' },
  uv:    { h: 32, label: 'UV',    unit: '0-11' },
} as const;
type BandKey = keyof typeof BANDS;
const BAND_ORDER: BandKey[] = ['temp', 'wind', 'rain', 'cloud', 'uv'];
const BAND_GAP = 12;
const TIME_AXIS_H = 28;
const SIDE_PAD = 12;

export function TodayGraph({ weather }: { weather: WeatherConditions }) {
  const { hours, location, sun } = weather;
  const tz = location.timezone;

  const [range, setRange] = useState<RangeKey>('48h');
  const rangeHours = RANGES.find((r) => r.key === range)!.hours;

  // Window of hours centered on "now", clipped to forecast length.
  const nowMs = Date.now();
  const startIdx = Math.max(0, hours.findIndex((h) => h.time.getTime() >= nowMs - 3600_000));
  const windowHours = hours.slice(startIdx, startIdx + rangeHours);

  // Container sizing — we let the SVG fill the parent width responsively.
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(360);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Y-scales per band + shared X time scale.
  const innerW = Math.max(120, width - SIDE_PAD * 2);
  const tDomain = useMemo<[Date, Date]>(() => {
    if (!windowHours.length) return [new Date(nowMs), new Date(nowMs + 3600_000)];
    return [windowHours[0].time, windowHours[windowHours.length - 1].time];
  }, [windowHours, nowMs]);
  const x = useMemo(() => scaleTime().domain(tDomain).range([0, innerW]), [tDomain, innerW]);

  // Total chart height.
  const chartH = BAND_ORDER.reduce((s, k) => s + BANDS[k].h, 0) + BAND_GAP * (BAND_ORDER.length - 1) + TIME_AXIS_H;

  // Band Y offsets within the SVG (top→bottom).
  const bandTop = useMemo(() => {
    const map = {} as Record<BandKey, number>;
    let y = 0;
    for (const k of BAND_ORDER) {
      map[k] = y;
      y += BANDS[k].h + BAND_GAP;
    }
    return map;
  }, []);

  // Scrub state — pointer X (in chart-local pixels) determines selected hour.
  const [cursor, setCursor] = useState<number | null>(null);
  const cursorIdx = useMemo(() => {
    if (cursor == null || !windowHours.length) return null;
    const t = x.invert(cursor).getTime();
    let best = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < windowHours.length; i++) {
      const d = Math.abs(windowHours[i].time.getTime() - t);
      if (d < bestDiff) { bestDiff = d; best = i; }
    }
    return best;
  }, [cursor, windowHours, x]);

  const cursorHour = cursorIdx != null ? windowHours[cursorIdx] : null;
  const nowHour = useMemo(() => windowHours.find((_h, i) => i === windowHours.findIndex((hh) => hh.time.getTime() >= nowMs)), [windowHours, nowMs]);

  const handlePointer = (e: PointerEvent<SVGSVGElement>) => {
    if (e.buttons === 0 && e.type !== 'pointerdown' && e.type !== 'pointermove') return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = Math.max(0, Math.min(innerW, e.clientX - rect.left - SIDE_PAD));
    setCursor(px);
  };
  const clearCursor = () => setCursor(null);

  // Auto-clear scrub when range changes.
  useEffect(() => setCursor(null), [range]);

  // Per-day sun events across the visible window (sunrise/sunset/golden hours
  // change each day; recompute via suncalc so multi-day chart isn't biased
  // toward today's values).
  const perDaySun = useMemo(() => {
    if (!windowHours.length) return [];
    const out: { sunrise: Date; sunset: Date; goldenEnd: Date; goldenStart: Date }[] = [];
    const seen = new Set<string>();
    for (const h of windowHours) {
      const key = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(h.time);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(computeSunPhases(h.time, location.lat, location.lon));
    }
    return out;
  }, [windowHours, tz, location.lat, location.lon]);

  // Precompute overlays + annotations.
  const overlays = useMemo(() => computeOverlays(windowHours, tz, perDaySun, x), [windowHours, tz, perDaySun, x]);
  const annotations = useMemo(() => computeAnnotations(windowHours, sun, tz, x, bandTop), [windowHours, sun, tz, x, bandTop]);

  // Floating chip data — show now's data when no scrub, else cursor's.
  const chipHour = cursorHour ?? nowHour ?? windowHours[0];

  return (
    <div className="flex h-full w-full flex-col bg-[#070b1a] text-neutral-200">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[#131a2e] px-4 py-2.5">
        <span className="text-base font-semibold tracking-tight text-neutral-50">{location.name}</span>
        <span className="text-[11px] font-medium text-neutral-500">{location.region}</span>
        <div className="ml-auto flex rounded-md border border-[#1b2440] bg-[#0a1024] p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-[5px] px-2 py-1 font-mono text-[11px] font-semibold tabular-nums transition-colors ${
                range === r.key ? 'bg-white/10 text-neutral-50' : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Floating value chip — always visible; "Now" when no scrub */}
      {chipHour && <ValueChip h={chipHour} tz={tz} scrubbed={cursorHour != null} />}

      {/* Chart */}
      <div ref={wrapRef} className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-1">
        {windowHours.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-neutral-500">No forecast in range</div>
        ) : (
          <svg
            ref={svgRef}
            width={width}
            height={chartH + 8}
            onPointerDown={handlePointer}
            onPointerMove={handlePointer}
            onPointerUp={clearCursor}
            onPointerCancel={clearCursor}
            onPointerLeave={clearCursor}
            style={{ touchAction: 'pan-y', cursor: 'crosshair', userSelect: 'none', WebkitUserSelect: 'none' }}
            className="block"
          >
            <defs>
              <linearGradient id="tempGrad" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#bfd4ef" stopOpacity="0.04" />
                <stop offset="35%" stopColor="#fff09a" stopOpacity="0.22" />
                <stop offset="75%" stopColor="#ffb04a" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#f4612a" stopOpacity="0.6" />
              </linearGradient>
              <linearGradient id="windGrad" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#2a6a4f" stopOpacity="0.08" />
                <stop offset="60%" stopColor="#6a8e3a" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#d8a83a" stopOpacity="0.6" />
              </linearGradient>
              <linearGradient id="rainGrad" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#3a9cef" stopOpacity="0" />
                <stop offset="40%" stopColor="#3a9cef" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#7fc8ff" stopOpacity="0.65" />
              </linearGradient>
            </defs>

            <g transform={`translate(${SIDE_PAD},0)`}>
              {/* Global overlays: night shading + golden hour shading */}
              {overlays.night.map((seg, i) => (
                <rect key={`n${i}`} x={seg.x0} y={0} width={seg.x1 - seg.x0} height={chartH - TIME_AXIS_H} fill="#0a1024" opacity="0.5" />
              ))}
              {overlays.golden.map((seg, i) => (
                <rect key={`g${i}`} x={seg.x0} y={0} width={seg.x1 - seg.x0} height={chartH - TIME_AXIS_H} fill="#ffb04a" opacity="0.08" />
              ))}
              {/* Day boundaries */}
              {overlays.newDayX.map((p, i) => (
                <line key={`d${i}`} x1={p} y1={0} x2={p} y2={chartH - TIME_AXIS_H} stroke="#2a3550" strokeWidth="1" />
              ))}

              {/* Bands */}
              <g transform={`translate(0,${bandTop.temp})`}>
                <BandLabel label={BANDS.temp.label} unit={BANDS.temp.unit} />
                <TempBand hours={windowHours} x={x} h={BANDS.temp.h} />
              </g>
              <g transform={`translate(0,${bandTop.wind})`}>
                <BandLabel label={BANDS.wind.label} unit={BANDS.wind.unit} />
                <WindBand hours={windowHours} x={x} h={BANDS.wind.h} innerW={innerW} />
              </g>
              <g transform={`translate(0,${bandTop.rain})`}>
                <BandLabel label={BANDS.rain.label} unit={BANDS.rain.unit} />
                <RainBand hours={windowHours} x={x} h={BANDS.rain.h} innerW={innerW} />
              </g>
              <g transform={`translate(0,${bandTop.cloud})`}>
                <BandLabel label={BANDS.cloud.label} unit={BANDS.cloud.unit} />
                <CloudBand hours={windowHours} x={x} h={BANDS.cloud.h} innerW={innerW} />
              </g>
              <g transform={`translate(0,${bandTop.uv})`}>
                <BandLabel label={BANDS.uv.label} unit={BANDS.uv.unit} />
                <UvBand hours={windowHours} x={x} h={BANDS.uv.h} innerW={innerW} />
              </g>

              {/* Now marker */}
              {nowHour && (
                <line
                  x1={xv(x, nowHour.time)}
                  x2={xv(x, nowHour.time)}
                  y1={0}
                  y2={chartH - TIME_AXIS_H}
                  stroke="#fafafa"
                  strokeWidth="1"
                  strokeDasharray="2 3"
                  opacity="0.5"
                />
              )}

              {/* Annotations */}
              {annotations.map((a, i) => (
                <g key={i} transform={`translate(${a.x},${a.y})`}>
                  <rect x={-a.w / 2} y={-13} width={a.w} height={14} rx={3} fill="#0c1428" stroke={a.color} strokeWidth="0.8" />
                  <text x={0} y={-3} fontSize="9" fontFamily="ui-monospace, monospace" fill={a.color} textAnchor="middle" fontWeight={600}>{a.text}</text>
                </g>
              ))}

              {/* Scrub cursor — drawn last so it sits on top */}
              {cursor != null && cursorHour && (
                <g pointerEvents="none">
                  <line x1={xv(x, cursorHour.time)} x2={xv(x, cursorHour.time)} y1={0} y2={chartH - TIME_AXIS_H} stroke="#ffd06a" strokeWidth="1" opacity="0.9" />
                  <circle cx={xv(x, cursorHour.time)} cy={-2} r="3" fill="#ffd06a" />
                </g>
              )}

              {/* Time axis */}
              <g transform={`translate(0,${chartH - TIME_AXIS_H + 2})`}>
                <TimeAxis hours={windowHours} x={x} tz={tz} />
              </g>
            </g>
          </svg>
        )}
      </div>
    </div>
  );
}

// ─── Floating chip ───────────────────────────────────────────────────────────

function ValueChip({ h, tz, scrubbed }: { h: HourForecast; tz: string; scrubbed: boolean }) {
  return (
    <div className={`flex shrink-0 items-center gap-3 border-b border-[#131a2e] px-4 py-2 transition-colors ${scrubbed ? 'bg-[#1a1410]' : 'bg-[#0c1428]'}`}>
      <div className="flex w-[88px] flex-col">
        <div className={`font-mono text-[10px] font-bold tracking-wider ${scrubbed ? 'text-[#ffd06a]' : 'text-[#7a8aa3]'}`}>
          {scrubbed ? 'SCRUBBING' : 'NOW'}
        </div>
        <div className="font-mono text-[13px] font-semibold tabular-nums text-neutral-50">
          {weekdayShort(h.time, tz)} {fmtTime(h.time, tz)}
        </div>
      </div>
      <div className="flex flex-1 gap-3 overflow-x-auto text-[11px] [scrollbar-width:none]">
        <ChipMetric icon="🌡" label={`${h.temperature}°`} sub={`feels ${h.feelsLike}°`} />
        <ChipMetric icon="💨" label={`${h.windSpeed}`} sub={`g${h.windGust} ${compass(h.windDirection)}`} />
        <ChipMetric icon="☔" label={`${h.precipProbability}%`} sub={h.precipAmount > 0 ? `${h.precipAmount.toFixed(1)}mm` : '–'} />
        <ChipMetric icon="☁" label={`${h.cloudCover}%`} sub="cloud" />
        <ChipMetric icon="☀" label={`UV ${h.uvIndex}`} sub={`hum ${h.humidity}%`} />
      </div>
    </div>
  );
}
function ChipMetric({ icon, label, sub }: { icon: string; label: string; sub: string }) {
  return (
    <div className="flex shrink-0 items-baseline gap-1 whitespace-nowrap">
      <span className="text-[12px]">{icon}</span>
      <span className="font-mono text-[12px] font-semibold tabular-nums text-neutral-50">{label}</span>
      <span className="font-mono text-[10px] text-neutral-500">{sub}</span>
    </div>
  );
}

// ─── Bands ────────────────────────────────────────────────────────────────────

function BandLabel({ label, unit }: { label: string; unit: string }) {
  return (
    <g>
      <text x={2} y={10} fontSize="9.5" fontFamily="ui-monospace, monospace" fill="#7a8aa3" fontWeight={700} letterSpacing="0.5">
        {label.toUpperCase()}
      </text>
      <text x={2} y={20} fontSize="9" fontFamily="ui-monospace, monospace" fill="#9aa0b3" fontWeight={600}>{unit}</text>
    </g>
  );
}

const TempBand = memo(function TempBand({ hours, x, h }: { hours: HourForecast[]; x: TimeScale; h: number }) {
  const temps = hours.map((d) => d.temperature);
  const feels = hours.map((d) => d.feelsLike);
  const lo = Math.min(...temps, ...feels) - 1;
  const hi = Math.max(...temps, ...feels) + 1;
  const y = scaleLinear().domain([lo, hi]).range([h - 2, 14]);

  const ar = area<HourForecast>().curve(curveMonotoneX).x((d) => xv(x, d.time)).y0(h).y1((d) => y(d.temperature));
  const ln = line<HourForecast>().curve(curveMonotoneX).x((d) => xv(x, d.time)).y((d) => y(d.temperature));
  const fl = line<HourForecast>().curve(curveMonotoneX).x((d) => xv(x, d.time)).y((d) => y(d.feelsLike));

  return (
    <>
      <path d={ar(hours) ?? ''} fill="url(#tempGrad)" />
      <path d={fl(hours) ?? ''} fill="none" stroke="#9aa0b3" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
      <path d={ln(hours) ?? ''} fill="none" stroke="#fafafa" strokeWidth="1.5" />
      {/* Labels every 6h */}
      {hours.map((d, i) => {
        if (i % 6 !== 0) return null;
        return (
          <g key={i}>
            <circle cx={xv(x, d.time)} cy={y(d.temperature)} r="2.4" fill="#fafafa" />
            <text x={xv(x, d.time)} y={y(d.temperature) - 6} fontSize="10" fill="#fafafa" textAnchor="middle" fontFamily="ui-monospace, monospace">{d.temperature}°</text>
          </g>
        );
      })}
    </>
  );
});

const WindBand = memo(function WindBand({ hours, x, h, innerW: _w }: { hours: HourForecast[]; x: TimeScale; h: number; innerW: number }) {
  // Drone/jib threshold annotations as horizontal reference lines (production cues).
  const DRONE_KMH = 25;
  const JIB_KMH = 30;
  const maxV = Math.max(40, ...hours.map((d) => d.windGust));
  const arrowZ = 11;
  const bandH = h - arrowZ - 2;
  const y = scaleLinear().domain([0, maxV]).range([bandH, 14]);

  const ar = area<HourForecast>().curve(curveMonotoneX).x((d) => xv(x, d.time)).y0(bandH).y1((d) => y(d.windGust));
  const lnSpeed = line<HourForecast>().curve(curveMonotoneX).x((d) => xv(x, d.time)).y((d) => y(d.windSpeed));
  const lnGust = line<HourForecast>().curve(curveMonotoneX).x((d) => xv(x, d.time)).y((d) => y(d.windGust));

  return (
    <>
      <path d={ar(hours) ?? ''} fill="url(#windGrad)" opacity="0.55" />
      {/* Threshold ref lines for production decisions. Labels nestle on the
          right edge so they don't fight the band label on the left. */}
      {DRONE_KMH <= maxV && (
        <g opacity="0.55">
          <line x1={0} x2={xv(x, hours[hours.length - 1].time)} y1={y(DRONE_KMH)} y2={y(DRONE_KMH)} stroke="#ffd06a" strokeWidth="0.7" strokeDasharray="2 2" />
          <text x={xv(x, hours[hours.length - 1].time) - 2} y={y(DRONE_KMH) - 2} fontSize="8" fontFamily="ui-monospace, monospace" fill="#ffd06a" textAnchor="end">DRONE 25</text>
        </g>
      )}
      {JIB_KMH <= maxV && (
        <g opacity="0.45">
          <line x1={0} x2={xv(x, hours[hours.length - 1].time)} y1={y(JIB_KMH)} y2={y(JIB_KMH)} stroke="#f4612a" strokeWidth="0.7" strokeDasharray="2 2" />
          <text x={xv(x, hours[hours.length - 1].time) - 2} y={y(JIB_KMH) - 2} fontSize="8" fontFamily="ui-monospace, monospace" fill="#f4612a" textAnchor="end">JIB 30</text>
        </g>
      )}
      <path d={lnGust(hours) ?? ''} fill="none" stroke="#cfb878" strokeWidth="0.9" strokeDasharray="2 2" opacity="0.7" />
      <path d={lnSpeed(hours) ?? ''} fill="none" stroke="#e8e6d8" strokeWidth="1.5" />
      {/* Direction arrows every 3 hours */}
      {hours.map((d, i) => {
        if (i % 3 !== 0) return null;
        return (
          <g key={`a${i}`} transform={`translate(${xv(x, d.time)},${bandH + arrowZ / 2 + 1}) rotate(${d.windDirection + 180})`}>
            <path d="M0 -4 L3 4 L0 2.5 L-3 4 Z" fill="#a8b3e0" opacity="0.85" />
          </g>
        );
      })}
      {/* Labels every 6h */}
      {hours.map((d, i) => {
        if (i % 6 !== 0) return null;
        return (
          <text key={i} x={xv(x, d.time)} y={y(d.windSpeed) - 5} fontSize="9.5" fill="#e8e6d8" textAnchor="middle" fontFamily="ui-monospace, monospace" fontWeight={d.windSpeed >= 25 ? 700 : 500}>
            {d.windSpeed}
          </text>
        );
      })}
      <line x1={0} x2={xv(x, hours[hours.length - 1].time)} y1={bandH} y2={bandH} stroke="#1f2a48" strokeWidth="1" />
    </>
  );
});

const RainBand = memo(function RainBand({ hours, x, h, innerW: _w }: { hours: HourForecast[]; x: TimeScale; h: number; innerW: number }) {
  // Dual axis: probability as area (left scale 0-100), precip mm as bars (right scale).
  const maxMm = Math.max(4, ...hours.map((d) => d.precipAmount));
  const yProb = scaleLinear().domain([0, 100]).range([h, 14]);
  const yMm = scaleLinear().domain([0, maxMm]).range([h, 14]);
  const probArea = area<HourForecast>().curve(curveMonotoneX).x((d) => xv(x, d.time)).y0(h).y1((d) => yProb(d.precipProbability));
  const probLine = line<HourForecast>().curve(curveMonotoneX).x((d) => xv(x, d.time)).y((d) => yProb(d.precipProbability));
  const last = hours[hours.length - 1];
  const totalSpanPx = xv(x, last.time);
  const barW = Math.max(2, Math.min(6, totalSpanPx / hours.length * 0.5));

  return (
    <>
      {/* Baseline at 0 so empty rain bands still read as a defined region. */}
      <line x1={0} y1={h} x2={xv(x, hours[hours.length - 1].time)} y2={h} stroke="#1f2a48" strokeWidth="1" />
      <path d={probArea(hours) ?? ''} fill="url(#rainGrad)" />
      <path d={probLine(hours) ?? ''} fill="none" stroke="#7fc8ff" strokeWidth="1.2" />
      {/* mm bars */}
      {hours.map((d, i) => {
        if (d.precipAmount < 0.05) return null;
        const bx = xv(x, d.time) - barW / 2;
        const by = yMm(d.precipAmount);
        return <rect key={i} x={bx} y={by} width={barW} height={h - by} fill="#bfe4ff" opacity="0.95" />;
      })}
      {/* peak prob label */}
      {(() => {
        let peak = 0;
        for (const d of hours) if (d.precipProbability > peak) peak = d.precipProbability;
        if (peak < 30) return null;
        const d = hours.find((dd) => dd.precipProbability === peak);
        if (!d) return null;
        return (
          <text x={xv(x, d.time)} y={yProb(peak) - 4} fontSize="9" fill="#bfe4ff" textAnchor="middle" fontFamily="ui-monospace, monospace" fontWeight={600}>
            {peak}%
          </text>
        );
      })()}
    </>
  );
});

const CloudBand = memo(function CloudBand({ hours, x, h, innerW: _w }: { hours: HourForecast[]; x: TimeScale; h: number; innerW: number }) {
  // Filled area for cloud cover percentage; quietest band visually.
  const yC = scaleLinear().domain([0, 100]).range([h, 14]);
  const ar = area<HourForecast>().curve(curveMonotoneX).x((d) => xv(x, d.time)).y0(h).y1((d) => yC(d.cloudCover));
  return (
    <>
      <path d={ar(hours) ?? ''} fill="#7a8aa3" opacity="0.32" />
      <path d={(line<HourForecast>().curve(curveMonotoneX).x((d) => xv(x, d.time)).y((d) => yC(d.cloudCover)))(hours) ?? ''} fill="none" stroke="#a8b3e0" strokeWidth="1" />
    </>
  );
});

const UvBand = memo(function UvBand({ hours, x, h, innerW: _w }: { hours: HourForecast[]; x: TimeScale; h: number; innerW: number }) {
  // UV per hour as a colored dot; baseline = bottom of band.
  const uvColor = (v: number) => {
    if (v <= 2) return '#2db765';
    if (v <= 5) return '#f0c020';
    if (v <= 7) return '#f49224';
    if (v <= 10) return '#e8332f';
    return '#8a3fcc';
  };
  const yU = scaleLinear().domain([0, 11]).range([h, 14]);
  return (
    <>
      <line x1={0} y1={h} x2={xv(x, hours[hours.length - 1].time)} y2={h} stroke="#1f2a48" strokeWidth="1" />
      {hours.map((d, i) => (
        <circle key={i} cx={xv(x, d.time)} cy={yU(d.uvIndex)} r={2.6} fill={uvColor(d.uvIndex)} opacity={d.uvIndex === 0 ? 0 : 0.95} />
      ))}
      {/* "peak UV" annotation */}
      {(() => {
        const peak = Math.max(...hours.map((d) => d.uvIndex));
        if (peak <= 4) return null;
        const d = hours.find((dd) => dd.uvIndex === peak);
        if (!d) return null;
        return <text x={xv(x, d.time)} y={yU(peak) - 5} fontSize="8.5" fill={uvColor(peak)} textAnchor="middle" fontFamily="ui-monospace, monospace" fontWeight={700}>{peak}</text>;
      })()}
    </>
  );
});

// ─── Overlays + annotations ───────────────────────────────────────────────────

function computeOverlays(
  hours: HourForecast[],
  tz: string,
  perDaySun: { sunrise: Date; sunset: Date; goldenEnd: Date; goldenStart: Date }[],
  x: TimeScale,
): { night: { x0: number; x1: number }[]; golden: { x0: number; x1: number }[]; newDayX: number[] } {
  if (!hours.length) return { night: [], golden: [], newDayX: [] };
  const start = hours[0].time;
  const end = hours[hours.length - 1].time;

  // Night = isNight runs. Coalesce consecutive isNight hours into ranges.
  const night: { x0: number; x1: number }[] = [];
  let i = 0;
  while (i < hours.length) {
    if (!hours[i].isNight) { i++; continue; }
    const seg0 = hours[i].time;
    while (i < hours.length && hours[i].isNight) i++;
    const seg1 = i < hours.length ? hours[i].time : new Date(hours[i - 1].time.getTime() + 3600_000);
    night.push({ x0: xv(x, seg0), x1: xv(x, seg1) });
  }

  // Golden hour bands — for every day visible in the window. sunrise→goldenEnd
  // (morning) and goldenStart→sunset (evening).
  const golden: { x0: number; x1: number }[] = [];
  const pushBand = (a: Date, b: Date) => {
    if (b <= start || a >= end) return;
    const a2 = a < start ? start : a;
    const b2 = b > end ? end : b;
    golden.push({ x0: xv(x, a2), x1: xv(x, b2) });
  };
  for (const s of perDaySun) {
    pushBand(s.sunrise, s.goldenEnd);
    pushBand(s.goldenStart, s.sunset);
  }

  // New day boundaries within the window (local tz).
  const newDayX: number[] = [];
  let prevKey = '';
  for (const h of hours) {
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(h.time);
    if (prevKey && key !== prevKey) newDayX.push(xv(x, h.time));
    prevKey = key;
  }
  return { night, golden, newDayX };
}

interface AnnotationItem {
  x: number;
  y: number;
  text: string;
  color: string;
  w: number;
}

function computeAnnotations(
  hours: HourForecast[],
  sun: WeatherConditions['sun'],
  tz: string,
  x: TimeScale,
  bandTop: Record<BandKey, number>,
): AnnotationItem[] {
  const out: AnnotationItem[] = [];
  if (!hours.length) return out;
  const start = hours[0].time;
  const end = hours[hours.length - 1].time;
  const pushIfInRange = (t: Date, y: number, text: string, color: string) => {
    if (t < start || t > end) return;
    out.push({ x: xv(x, t), y, text, color, w: Math.max(40, text.length * 6.2) });
  };
  // Peak gust at top of wind band.
  let peakGust = 0;
  let peakHour: HourForecast | undefined;
  for (const h of hours) {
    if (h.windGust > peakGust) { peakGust = h.windGust; peakHour = h; }
  }
  if (peakHour && peakGust >= 30) pushIfInRange(peakHour.time, bandTop.wind + 8, `gust ${peakGust}`, '#f4b03a');

  // Sunrise + sunset markers sit just below the temp band — they ARE the
  // production-relevant times (call sheet, magic hour). Y placed so they don't
  // collide with the temp band labels or the WIND label below.
  const sunY = bandTop.wind - 1;
  pushIfInRange(sun.sunrise, sunY, `↑ ${fmtTime(sun.sunrise, tz)}`, '#ffd06a');
  pushIfInRange(sun.sunset, sunY, `↓ ${fmtTime(sun.sunset, tz)}`, '#ffd06a');

  return out;
}

// ─── Time axis ────────────────────────────────────────────────────────────────

function TimeAxis({ hours, x, tz }: { hours: HourForecast[]; x: TimeScale; tz: string }) {
  const ticks: { t: Date; major: boolean }[] = [];
  for (let i = 0; i < hours.length; i++) {
    const hh = localHour(hours[i].time, tz);
    if (hh % 6 === 0) ticks.push({ t: hours[i].time, major: true });
    else if (hh % 3 === 0) ticks.push({ t: hours[i].time, major: false });
  }
  // Date labels per local day
  const dayLabels: { t: Date; label: string }[] = [];
  let prevKey = '';
  for (const h of hours) {
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(h.time);
    if (key !== prevKey) { dayLabels.push({ t: h.time, label: dayShort(h.time, tz) }); prevKey = key; }
  }
  return (
    <>
      {dayLabels.map((d, i) => (
        <text key={`dl${i}`} x={xv(x, d.t) + 3} y={10} fontSize="9" fontFamily="ui-monospace, monospace" fontWeight={700} fill="#9a9a93">{d.label}</text>
      ))}
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={xv(x, t.t)} x2={xv(x, t.t)} y1={0} y2={t.major ? 6 : 3} stroke="#4a5070" strokeWidth="0.8" />
          {t.major && (
            <text x={xv(x, t.t)} y={20} fontSize="9.5" fill="#cfcfcf" textAnchor="middle" fontFamily="ui-monospace, monospace">
              {String(localHour(t.t, tz)).padStart(2, '0')}
            </text>
          )}
        </g>
      ))}
    </>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function dayShort(d: Date, tz: string): string {
  const wd = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short' }).format(d).slice(0, 2);
  const dom = new Intl.DateTimeFormat('en-GB', { timeZone: tz, day: 'numeric' }).format(d);
  return `${wd} ${dom}.`;
}
function weekdayShort(d: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short' }).format(d);
}
