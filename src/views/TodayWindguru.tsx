/**
 * Today · Detail (the Windguru-style table). Dense color-coded hourly forecast:
 * ~16 metric rows × ~48 hours. Single shared horizontal scroll (the table is one
 * wide grid; each row has a `position: sticky; left: 0` label column). This is
 * what native data-table sync-scroll uses — no JS handler, smooth on touch.
 *
 * Local controls: collapsible row labels (text ↔ icon), wind unit (kt/km·h), and
 * temperature unit (°C/°F). Marine rows show a dim "·" when a location has no
 * wave data — honest nulls.
 */

import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { HourForecast, WeatherConditions } from '@/types/weather';
import { WxIcon } from '@/components/WxIcon';
import { WatersportsSummary } from '@/components/WatersportsSummary';
import { localHour } from '@/utils/format';
import {
  loadTempUnit,
  loadWindUnit,
  saveTempUnit,
  saveWindUnit,
  tempUnitLabel,
  toTemp,
  unitLabel as windUnitLabel,
  type TempUnit,
  type WindUnit,
} from '@/services/stations';
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
const LABEL_W_EXPANDED = 100;
const LABEL_W_COLLAPSED = 38;

export function TodayWindguru({ weather }: { weather: WeatherConditions }) {
  const { hours, location } = weather;
  const tz = location.timezone;
  const nowMs = Date.now();
  let nowIdx = hours.findIndex((h) => h.time.getTime() >= nowMs);
  if (nowIdx < 0) nowIdx = 0;

  const [labelsOpen, setLabelsOpen] = useState(true);
  const [windUnit, setWindUnit] = useState<WindUnit>(loadWindUnit);
  const [tempUnit, setTempUnit] = useState<TempUnit>(loadTempUnit);
  const LABEL_W = labelsOpen ? LABEL_W_EXPANDED : LABEL_W_COLLAPSED;

  // Single shared scroll container — scroll once, sticky label column comes with it.
  const scrollerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    // Land on a whole-cell boundary so we never half-clip a column.
    el.scrollLeft = Math.max(0, nowIdx * HOUR_W);
  }, [nowIdx]);

  // Memoize per-hour layout flags + day boundaries.
  const flags = useMemo(
    () =>
      hours.map((h, i) => {
        const hh = localHour(h.time, tz);
        const newDay = i > 0 && localDateKey(h.time, tz) !== localDateKey(hours[i - 1].time, tz);
        return { hh, newDay, night: hh < 6 || hh >= 20, isNow: i === nowIdx };
      }),
    [hours, tz, nowIdx],
  );

  // wind in user unit (km/h → kt if chosen)
  const toW = (kmh: number) => (windUnit === 'kt' ? Math.round(kmh / 1.852) : kmh);

  return (
    <div className="flex h-full w-full flex-col bg-[#070b1a] text-neutral-200">
      <div className="flex shrink-0 items-center gap-2 border-b border-[#131a2e] px-4 py-2.5">
        <span className="text-base font-semibold tracking-tight text-neutral-50">{location.name}</span>
        <span className="text-[11px] font-medium text-neutral-500">{location.region}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <MiniToggle a={{ key: 'kt', label: 'kt' }} b={{ key: 'kmh', label: 'km/h' }} value={windUnit} onChange={(v) => { setWindUnit(v as WindUnit); saveWindUnit(v as WindUnit); }} />
          <MiniToggle a={{ key: 'c', label: '°C' }} b={{ key: 'f', label: '°F' }} value={tempUnit} onChange={(v) => { setTempUnit(v as TempUnit); saveTempUnit(v as TempUnit); }} />
          <button
            onClick={() => setLabelsOpen((v) => !v)}
            aria-label={labelsOpen ? 'Collapse row labels' : 'Expand row labels'}
            title={labelsOpen ? 'Collapse labels' : 'Expand labels'}
            className="ml-1 flex h-6 w-6 items-center justify-center rounded border border-[#1b2440] text-neutral-400 hover:border-[#2b3656] hover:text-neutral-200"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {labelsOpen ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
            </svg>
          </button>
        </div>
      </div>

      <WatersportsSummary weather={weather} />

      {/* SINGLE SCROLL CONTAINER — both axes — sticky header row + sticky label column. */}
      <div ref={scrollerRef} className="min-h-0 flex-1 overflow-auto [scrollbar-width:none]" style={{ WebkitOverflowScrolling: 'touch' as 'touch' }}>
        <div style={{ width: LABEL_W + hours.length * HOUR_W }}>
          {/* Header row (sticky top) */}
          <div className="sticky top-0 z-30 flex border-b border-[#1f2a48] bg-[#070b1a]">
            <div className="sticky left-0 z-40 flex shrink-0 items-center border-r border-[#131a2e] bg-[#070b1a] px-2.5" style={{ width: LABEL_W }}>
              <div>
                <div className="text-[11px] font-bold tracking-wide text-neutral-50">{labelsOpen ? 'Forecast' : 'Fc'}</div>
                {labelsOpen && <div className="font-mono text-[10px] tabular-nums text-neutral-600">hourly</div>}
              </div>
            </div>
            {hours.map((h, i) => {
              const f = flags[i];
              return (
                <div
                  key={h.time.getTime()}
                  className="flex shrink-0 flex-col items-center justify-center gap-px py-1"
                  style={{
                    width: HOUR_W,
                    borderLeft: f.newDay ? '2px solid #2a3550' : '1px solid #131a2e',
                    background: f.isNow ? '#3a2f0f' : f.night ? '#0a1024' : '#0c1428',
                  }}
                >
                  <div className="font-mono text-[9px] font-bold tracking-tight text-neutral-400">{f.newDay || i === 0 ? dayLabel(h.time, tz) : ' '}</div>
                  <div className="font-mono text-[12px] font-semibold tabular-nums tracking-tight text-neutral-50">
                    {String(f.hh).padStart(2, '0')}
                    <span className="text-[9px] font-medium text-neutral-600">h</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rows */}
          <Row label="Wind" icon={ICON.wind} unit={windUnitLabel(windUnit).toLowerCase()} labelsOpen={labelsOpen} labelW={LABEL_W} hours={hours} flags={flags}
            render={(h) => { const v = toW(h.windSpeed); return <ScaleCell scale={windScale} v={h.windSpeed} text={String(v)} bold={h.windSpeed >= 36} />; }} />
          <Row label="Gusts" icon={ICON.gust} unit={windUnitLabel(windUnit).toLowerCase()} labelsOpen={labelsOpen} labelW={LABEL_W} hours={hours} flags={flags}
            render={(h) => { const v = toW(h.windGust); return <ScaleCell scale={windScale} v={h.windGust} text={String(v)} bold={h.windGust >= 45} />; }} />
          <Row label="Wind dir" icon={ICON.compass} labelsOpen={labelsOpen} labelW={LABEL_W} hours={hours} flags={flags}
            render={(h) => <Cell bg="#0a0f1c" fg="#fafafa"><Arrow deg={h.windDirection} /></Cell>} />

          <Row label="Wave" icon={ICON.wave} unit="m" labelsOpen={labelsOpen} labelW={LABEL_W} hours={hours} flags={flags}
            render={(h) => (h.waveHeight == null || h.waveHeight < 0.05 ? <Dot /> : <ScaleCell scale={waveScale} v={h.waveHeight} text={h.waveHeight.toFixed(1)} bold={h.waveHeight >= 1.5} />)} />
          <Row label="Wave per." icon={ICON.period} unit="s" labelsOpen={labelsOpen} labelW={LABEL_W} hours={hours} flags={flags}
            render={(h) => (h.wavePeriod == null ? <Dot /> : <ScaleCell scale={periodScale} v={h.wavePeriod} text={String(Math.round(h.wavePeriod))} bold={h.wavePeriod >= 10} />)} />
          <Row label="Wave dir" icon={ICON.compass} labelsOpen={labelsOpen} labelW={LABEL_W} hours={hours} flags={flags}
            render={(h) => (h.waveDirection == null ? <Dot /> : <Cell bg="#0a0f1c" fg="#cfcfcf"><Arrow deg={h.waveDirection} small /></Cell>)} />

          <Row label="Temp" icon={ICON.temp} unit={tempUnitLabel(tempUnit)} labelsOpen={labelsOpen} labelW={LABEL_W} hours={hours} flags={flags}
            render={(h) => <ScaleCell scale={tempScale} v={h.temperature} text={String(toTemp(h.temperature, tempUnit))} bold={h.temperature >= 30 || h.temperature <= 0} />} />
          <Row label="Feels like" icon={ICON.feels} unit={tempUnitLabel(tempUnit)} labelsOpen={labelsOpen} labelW={LABEL_W} hours={hours} flags={flags}
            render={(h) => <ScaleCell scale={tempScale} v={h.feelsLike} text={String(toTemp(h.feelsLike, tempUnit))} muted />} />

          <Row label="Sky" icon={ICON.sky} labelsOpen={labelsOpen} labelW={LABEL_W} hours={hours} flags={flags}
            render={(h) => <Cell bg="#0a0f1c" fg="#fafafa"><WxIcon desc={h.description} size={18} color="#cfcfcf" strokeWidth={1.5} night={h.isNight} /></Cell>} />

          <Row label="Rain prob" icon={ICON.rainProb} unit="%" labelsOpen={labelsOpen} labelW={LABEL_W} hours={hours} flags={flags}
            render={(h) => (h.precipProbability < 5 ? <Dot /> : <ScaleCell scale={rainScale} v={h.precipProbability} bold={h.precipProbability >= 70} />)} />
          <Row label="Precip" icon={ICON.rain} unit="mm" labelsOpen={labelsOpen} labelW={LABEL_W} hours={hours} flags={flags}
            render={(h) => (h.precipAmount < 0.05 ? <Dot /> : <ScaleCell scale={rainMmScale} v={h.precipAmount} text={h.precipAmount.toFixed(1)} bold={h.precipAmount >= 2} />)} />

          <Row label="Cloud" icon={ICON.cloud} unit="%" labelsOpen={labelsOpen} labelW={LABEL_W} hours={hours} flags={flags}
            render={(h) => (h.cloudCover < 5 ? <Dot /> : <ScaleCell scale={cloudScale} v={h.cloudCover} />)} />
          <Row label="UV" icon={ICON.uv} labelsOpen={labelsOpen} labelW={LABEL_W} hours={hours} flags={flags}
            render={(h) => (h.uvIndex === 0 ? <Dot /> : <ScaleCell scale={uvScale} v={h.uvIndex} bold={h.uvIndex >= 8} />)} />
          <Row label="Humidity" icon={ICON.humidity} unit="%" labelsOpen={labelsOpen} labelW={LABEL_W} hours={hours} flags={flags} last
            render={(h) => <Cell bg="#0a0f1c" fg="#9a9a93">{h.humidity}</Cell>} />
        </div>
      </div>

      <Legend />
    </div>
  );
}

// ── Row ──────────────────────────────────────────────────────────────────────

type Flag = { hh: number; newDay: boolean; night: boolean; isNow: boolean };

interface RowProps {
  label: string;
  icon: ReactNode;
  unit?: string;
  labelsOpen: boolean;
  labelW: number;
  hours: HourForecast[];
  flags: Flag[];
  render: (h: HourForecast) => ReactNode;
  last?: boolean;
}

function Row({ label, icon, unit, labelsOpen, labelW, hours, flags, render, last }: RowProps) {
  return (
    <div className="flex min-h-[32px] items-stretch" style={{ borderBottom: last ? '1px solid #1f2a48' : '1px solid #101627' }}>
      <div
        className="sticky left-0 z-10 flex shrink-0 items-center gap-1.5 border-r border-[#131a2e] bg-[#070b1a] text-[11px] font-medium text-neutral-200"
        style={{ width: labelW, paddingLeft: labelsOpen ? 14 : 0, paddingRight: labelsOpen ? 10 : 0, justifyContent: labelsOpen ? 'flex-start' : 'center' }}
        title={labelsOpen ? undefined : label + (unit ? ` (${unit})` : '')}
      >
        <span className="text-neutral-400">{icon}</span>
        {labelsOpen && <span>{label}{unit && <span className="ml-1 text-neutral-600">({unit})</span>}</span>}
      </div>
      {hours.map((h, i) => (
        <CellWrap key={h.time.getTime()} newDay={flags[i].newDay} isNow={flags[i].isNow}>
          {render(h)}
        </CellWrap>
      ))}
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
function Dot() { return <Cell bg="#0a0f1c" fg="#3a3a45">·</Cell>; }
function Arrow({ deg, small }: { deg: number; small?: boolean }) {
  return (
    <svg width={small ? 12 : 14} height={small ? 12 : 14} viewBox="0 0 14 14" style={{ transform: `rotate(${deg + 180}deg)` }}>
      <path d="M7 1.4 L11 11 L7 9.2 L3 11 Z" fill={small ? '#cfcfcf' : '#fafafa'} />
    </svg>
  );
}

// ── Toolbar ─────────────────────────────────────────────────────────────────

function MiniToggle<T extends string>({ a, b, value, onChange }: {
  a: { key: T; label: string }; b: { key: T; label: string };
  value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-full border border-[#1b2440] font-mono text-[10px] font-semibold">
      {[a, b].map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={`px-2 py-[3px] ${value === opt.key ? 'bg-emerald-500/15 text-emerald-400' : 'bg-[#0c1428] text-neutral-500'}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Row icons (tiny, monochrome, used when labels collapsed too) ────────────

const ICON = (() => {
  return {
    wind: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h11a3 3 0 100-6"/><path d="M3 13h16a3 3 0 110 6"/><path d="M3 18h7"/></svg>,
    gust: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2 8h13a3 3 0 100-6"/><path d="M2 12h18"/><path d="M2 17h11a3 3 0 110 6"/></svg>,
    compass: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9"/><path d="M14 10l-2 6-2-6 2-2z" fill="currentColor"/></svg>,
    wave: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 14 C 5 10, 7 10, 10 14 S 17 18, 22 14"/><path d="M2 8 C 5 4, 7 4, 10 8 S 17 12, 22 8" opacity=".55"/></svg>,
    period: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>,
    temp: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M14 14V5a2 2 0 10-4 0v9a4 4 0 104 0z"/></svg>,
    feels: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 14V5a2 2 0 10-4 0v9a4 4 0 104 0z"/><path d="M18 6l3-3M21 6l-3-3" opacity=".6"/></svg>,
    sky: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M7 18a4 4 0 010-8 5 5 0 019.6-1.3A3.5 3.5 0 0117 18H7z"/></svg>,
    rainProb: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3c2 3 5 5 5 8a5 5 0 11-10 0c0-3 3-5 5-8z"/><text x="12" y="15" textAnchor="middle" fontSize="7" fontWeight="700" fill="currentColor" stroke="none">%</text></svg>,
    rain: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M7 14a4 4 0 010-8 5 5 0 019.6-1.3A3.5 3.5 0 0117 14H7z"/><path d="M9 18l-1 3M13 18l-1 3M17 18l-1 3"/></svg>,
    cloud: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M7 18a4 4 0 010-8 5 5 0 019.6-1.3A3.5 3.5 0 0117 18H7z"/></svg>,
    uv: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.5 4.5l2 2M17.5 17.5l2 2M4.5 19.5l2-2M17.5 6.5l2-2"/></svg>,
    humidity: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3c3 4 6 7 6 11a6 6 0 11-12 0c0-4 3-7 6-11z"/></svg>,
  };
})();

// ── Legend ──────────────────────────────────────────────────────────────────

function Legend() {
  const chips: { label: string; colors: string[] }[] = [
    { label: 'Wind km/h', colors: ['#1a2030', '#1f3a4d', '#214a4a', '#1f5a3a', '#3a6020', '#6a5e1a', '#8a4a1a', '#a8331e', '#a4205a', '#6a2899'] },
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
            {c.colors.map((col, i) => <div key={i} className="h-full flex-1" style={{ background: col }} />)}
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
