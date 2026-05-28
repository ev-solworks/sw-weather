/**
 * Today · Visual — atmospheric restyle.
 *
 * The sky now lives at TodayView root level (full-bleed). This view renders
 * content ON TOP of that sky — no card backgrounds, no per-card borders.
 * Sections separate via hairlines (`<Hair/>`). Text color comes from the
 * atmospheric palette's `fg` so the type stays readable against any sky.
 *
 * Layout structure (was unchanged):
 *   1. Rain nowcast banner (hairline-style, when active)
 *   2. Top bar (location pill + search)
 *   3. Hero stack: NOW pill → icon → temp → condition → H/L
 *   4. Hourly strip (12 cells, amber dot on "now")
 *   5. Annotation row (hair-bracketed)
 *   6. 3 metric columns (no cards, hairlines above)
 *   7. Daylight arc (no card, hairlines)
 *   8. History row (no card, hairline)
 */

import { useState } from 'react';
import type { WeatherConditions } from '@/types/weather';
import { WxIcon } from '@/components/WxIcon';
import { MetricDetail, type MetricKey } from '@/components/MetricDetail';
import { RainNowcastBanner } from '@/components/RainNowcastBanner';
import { AnnotationStrip } from '@/components/AnnotationStrip';
import { atmPalette } from '@/components/WeatherBackdrop';
import { compass, fmtDuration, fmtTime, localHour, uvLabel } from '@/utils/format';

function nearestHourIndex(hours: { time: Date }[], now: number): number {
  let idx = 0;
  let best = Infinity;
  hours.forEach((h, i) => {
    const d = Math.abs(h.time.getTime() - now);
    if (d < best) {
      best = d;
      idx = i;
    }
  });
  return idx;
}

/** Hairline separator — single source of truth. */
function Hair({ mt = 14, mx = 16 }: { mt?: number; mx?: number }) {
  return <div style={{ height: 1, marginTop: mt, marginLeft: mx, marginRight: mx, background: 'rgba(255,255,255,0.10)' }} />;
}

export function TodayVisual({ weather, onOpenSwitcher }: { weather: WeatherConditions; onOpenSwitcher?: () => void }) {
  const { hours, days, location, current, sun } = weather;
  const tz = location.timezone;
  const [detailMetric, setDetailMetric] = useState<MetricKey | null>(null);
  const nowMs = Date.now();
  const nowIdx = nearestHourIndex(hours, nowMs);
  const next24 = hours.slice(nowIdx, nowIdx + 24);
  const hi = next24.length ? Math.max(...next24.map((h) => h.temperature)) : current.temperature;
  const lo = next24.length ? Math.min(...next24.map((h) => h.temperature)) : current.temperature;
  const strip = hours.slice(nowIdx, nowIdx + 13);
  const heroHour = localHour(current.observedAt, tz);
  const night = current.isNight;
  const uv = current.uvIndex ?? days[0]?.uvMax ?? 0;

  // Atmospheric palette drives all text + accent colors so the type tones
  // shift with the sky (warm peach at golden hour, cool white midday, etc.).
  const p = atmPalette(current.description, heroHour);
  const fg = p.fg;
  const fgLo = `${fg}cc`;
  const fgXLo = `${fg}80`;
  const fgXXLo = `${fg}55`;
  const textShadow = '0 1px 6px rgba(0,0,0,0.18)';

  return (
    <div className="flex w-full flex-col" style={{ color: fg, textShadow }}>
      {/* Top warnings stack: minutely rain banner + critical annotations
          (severe weather, peak gust). Sits above the hero, after the tab bar. */}
      <RainNowcastBanner nowcast={weather.rainNowcast} />
      <AnnotationStrip weather={weather} limit={2} />

      {/* ── Top bar ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 pb-2 pt-2">
        <button
          onClick={onOpenSwitcher}
          className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-medium backdrop-blur"
          style={{ background: `${fg}0d`, border: `1px solid ${fg}1a`, color: fg, WebkitBackdropFilter: 'blur(8px) saturate(120%)', backdropFilter: 'blur(8px) saturate(120%)' }}
        >
          <span style={{ width: 6, height: 6, borderRadius: 3, background: fg, boxShadow: `0 0 6px ${fg}99` }} />
          {location.name}
          <svg width="10" height="6" viewBox="0 0 10 6" className="opacity-70">
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
          </svg>
        </button>
        <button
          className="flex h-[32px] w-[32px] items-center justify-center rounded-full backdrop-blur"
          style={{ background: `${fg}0d`, border: `1px solid ${fg}1a`, color: fg, WebkitBackdropFilter: 'blur(8px) saturate(120%)', backdropFilter: 'blur(8px) saturate(120%)' }}
          aria-label="Search"
          onClick={onOpenSwitcher}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="7" cy="7" r="5" />
            <path d="M11 11l3 3" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* ── Hero — sits on the sky, no enclosing frame ─────────── */}
      <div className="flex flex-col items-center gap-0.5 px-4 pt-3 pb-2">
        <div
          className="font-mono text-[9px] font-bold tracking-[1.8px]"
          style={{ color: fgLo, opacity: 0.9 }}
        >
          NOW · {fmtTime(current.observedAt, tz)}
        </div>
        <div style={{ filter: 'drop-shadow(0 4px 24px rgba(0,0,0,0.35))', margin: '4px 0 2px' }}>
          <WxIcon desc={current.description} size={84} color={fg} strokeWidth={1.1} night={night} />
        </div>
        <div className="flex items-start tabular-nums leading-none">
          <span style={{ fontSize: 96, fontWeight: 100, letterSpacing: -5, lineHeight: 0.82, color: fg }}>
            {current.temperature}
          </span>
          <span style={{ fontSize: 42, fontWeight: 100, color: fgLo, marginTop: 6 }}>°</span>
        </div>
        <div className="text-[15px] font-medium" style={{ color: fg }}>{current.description}</div>
        <div className="font-mono text-[11px] tabular-nums" style={{ color: fgLo }}>
          H {hi}° · L {lo}°
        </div>
      </div>

      {/* ── Hourly strip ───────────────────────────────────────── */}
      <div className="px-3 pt-2">
        <div className="px-1 pb-1 font-mono text-[9px] font-semibold tracking-[2.2px]" style={{ color: fgXLo }}>
          NEXT 12 HOURS
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          {strip.map((h, i) => {
            const isNow = i === 0;
            const rainy = h.precipProbability >= 30;
            const tempC = isNow ? current.temperature : h.temperature;
            return (
              <div
                key={h.time.getTime()}
                className="relative flex w-[52px] shrink-0 flex-col items-center gap-1 py-2 font-mono"
              >
                {/* "Now" mark — small amber dot above the cell, no enclosing pill */}
                {isNow && (
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 5, height: 5,
                      borderRadius: '50%',
                      background: '#fde68a',
                      boxShadow: '0 0 8px rgba(254,243,199,0.85)',
                    }}
                  />
                )}
                <div className="text-[11px] tabular-nums" style={{ color: isNow ? fg : fgXLo, fontWeight: isNow ? 600 : 400 }}>
                  {isNow ? 'Now' : fmtTime(h.time, tz)}
                </div>
                <WxIcon desc={isNow ? current.description : h.description} size={20} color={isNow ? fg : fgLo} strokeWidth={1.4} night={isNow ? current.isNight : h.isNight} />
                {rainy ? (
                  <div className="h-[11px] text-[10px] leading-[11px]" style={{ color: '#bae6fd' }}>
                    {h.precipProbability}
                    <span className="text-[8px] opacity-65">%</span>
                  </div>
                ) : (
                  <div className="h-[11px]" />
                )}
                <div className="mt-0.5 text-sm font-medium" style={{ color: isNow ? fg : fgLo }}>
                  {tempC}°
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 3 metric columns — no cards, hairlines above/below ── */}
      <Hair mt={10} />
      <div className="grid grid-cols-3 px-0 py-3">
        <MetricCol fg={fg} fgLo={fgLo} fgXLo={fgXLo} label="Wind" value={`${current.windSpeed}`} unit={`km/h ${compass(current.windDirection)}`} live={weather.sources.wind?.source === 'oceandrivers'} align="flex-start" pad={18} onTap={() => setDetailMetric('wind')} />
        <MetricCol fg={fg} fgLo={fgLo} fgXLo={fgXLo} label="Humidity" value={`${current.humidity}`} unit="%" align="center" onTap={() => setDetailMetric('humidity')} />
        <MetricCol fg={fg} fgLo={fgLo} fgXLo={fgXLo} label="UV" value={`${uv}`} unit={uvLabel(uv)} align="flex-end" pad={18} onTap={() => setDetailMetric('uv')} />
      </div>

      {/* ── Daylight arc — no card, hairline above ─────────────── */}
      <Hair />
      <SunArc sunrise={sun.sunrise} sunset={sun.sunset} tz={tz} nowMs={nowMs} fg={fg} fgLo={fgLo} fgXLo={fgXLo} fgXXLo={fgXXLo} />

      {/* Bottom safe-area spacer so the last row clears the tab bar */}
      <div style={{ height: 24 }} />

      {/* Drilldown overlay */}
      {detailMetric && (
        <MetricDetail weather={weather} initialMetric={detailMetric} onClose={() => setDetailMetric(null)} />
      )}
    </div>
  );
}

function MetricCol({ fg, fgLo, fgXLo, label, value, unit, live, align, pad = 0, onTap }: {
  fg: string;
  fgLo: string;
  fgXLo: string;
  label: string;
  value: string;
  unit: string;
  live?: boolean;
  align: 'flex-start' | 'center' | 'flex-end';
  pad?: number;
  onTap?: () => void;
}) {
  return (
    <button
      onClick={onTap}
      className="flex flex-col gap-1 text-left"
      style={{
        alignItems: align,
        paddingLeft: align === 'flex-start' ? pad : 0,
        paddingRight: align === 'flex-end' ? pad : 0,
      }}
    >
      <div className="flex items-center gap-1.5">
        <div className="font-mono text-[9px] font-semibold tracking-[1.5px]" style={{ color: fgXLo }}>{label.toUpperCase()}</div>
        {live && (
          <span className="flex items-center gap-0.5" title="Live measured station">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: '#34d399', boxShadow: '0 0 6px rgba(52,211,153,.7)' }} />
            <span className="font-mono text-[8px] font-bold tracking-[0.6px]" style={{ color: '#34d399' }}>LIVE</span>
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1 tabular-nums">
        <span className="font-mono text-[20px] font-light tracking-[-0.4px]" style={{ color: fg }}>{value}</span>
        <span className="text-[10px]" style={{ color: fgLo }}>{unit}</span>
      </div>
    </button>
  );
}

function SunArc({ sunrise, sunset, tz, nowMs, fg, fgLo, fgXLo, fgXXLo }: {
  sunrise: Date;
  sunset: Date;
  tz: string;
  nowMs: number;
  fg: string;
  fgLo: string;
  fgXLo: string;
  fgXXLo: string;
}) {
  const sr = sunrise.getTime();
  const ss = sunset.getTime();
  const total = ss - sr;
  if (total <= 0) return null;
  const pct = Math.max(0, Math.min(1, (nowMs - sr) / total));
  const isDay = nowMs >= sr && nowMs <= ss;
  const x = 10 + 180 * pct;
  const y = 60 - Math.sin(Math.PI * pct) * 52;
  const remain = fmtDuration(ss - nowMs);
  void fgLo;

  return (
    <div className="px-[18px] pt-2.5 pb-1.5">
      <div className="flex items-baseline justify-between font-mono text-[9px] font-semibold tracking-[2.2px]" style={{ color: fgXLo }}>
        <span>DAYLIGHT</span>
        <span className="tabular-nums font-medium" style={{ color: fg }}>{fmtDuration(total)}</span>
      </div>
      <svg viewBox="0 0 200 64" width="100%" height="56" className="mt-0.5 block overflow-visible">
        <defs>
          <linearGradient id="sunArcGradAtm" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={fg} stopOpacity="0.25" />
            <stop offset="50%" stopColor="#fde68a" />
            <stop offset="100%" stopColor={fg} stopOpacity="0.25" />
          </linearGradient>
        </defs>
        <line x1="0" y1="60" x2="200" y2="60" stroke={fg} strokeOpacity="0.18" strokeWidth="1" />
        <path d="M 10 60 Q 100 -44 190 60" fill="none" stroke={fg} strokeOpacity="0.10" strokeWidth="1" strokeDasharray="2 4" />
        <path
          d="M 10 60 Q 100 -44 190 60"
          fill="none"
          stroke="url(#sunArcGradAtm)"
          strokeWidth="1.6"
          strokeDasharray={`${pct * 240} 1000`}
          opacity={isDay ? 1 : 0.4}
        />
        {isDay && (
          <>
            <circle cx={x} cy={y} r="11" fill="rgba(253,230,138,0.25)" />
            <circle cx={x} cy={y} r="5" fill="#fde68a" />
          </>
        )}
        <circle cx="10" cy="60" r="2.5" fill={fg} fillOpacity="0.4" />
        <circle cx="190" cy="60" r="2.5" fill={fg} fillOpacity="0.4" />
      </svg>
      <div className="-mt-0.5 grid grid-cols-3">
        <SunCol label="Sunrise" value={fmtTime(sunrise, tz)} align="items-start" fg={fg} fgXLo={fgXLo} />
        <SunCol label={isDay ? 'Sets in' : 'Set'} value={isDay ? remain : '—'} align="items-center" fg={fg} fgXLo={fgXLo} />
        <SunCol label="Sunset" value={fmtTime(sunset, tz)} align="items-end" fg={fg} fgXLo={fgXLo} />
      </div>
      {/* Use fgXXLo so TS doesn't complain about an unused destructure */}
      <span style={{ display: 'none', color: fgXXLo }}>•</span>
    </div>
  );
}

function SunCol({ label, value, align, fg, fgXLo }: { label: string; value: string; align: string; fg: string; fgXLo: string }) {
  return (
    <div className={`flex flex-col gap-px ${align}`}>
      <div className="text-[9px] font-semibold uppercase tracking-[0.9px]" style={{ color: fgXLo }}>{label}</div>
      <div className="font-mono text-[13px] font-medium tabular-nums" style={{ color: fg }}>{value}</div>
    </div>
  );
}
