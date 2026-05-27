/**
 * Today · Visual — centered, image-led current-conditions view. Ported from the
 * design handoff (today-visual.jsx) to React + Tailwind + our WeatherConditions.
 * Hero motion zone (static gradient for now) with glyph + big temp; next-12h
 * strip; wind/humidity/UV metrics; daylight sun arc. All times in location TZ.
 */

import type { WeatherConditions } from '@/types/weather';
import { WeatherBackdrop } from '@/components/WeatherBackdrop';
import { WxIcon } from '@/components/WxIcon';
import { WindHistoryChart } from '@/components/WindHistoryChart';
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

export function TodayVisual({ weather, onOpenSwitcher }: { weather: WeatherConditions; onOpenSwitcher?: () => void }) {
  const { hours, days, location, current, sun } = weather;
  const tz = location.timezone;
  const nowMs = Date.now();
  const nowIdx = nearestHourIndex(hours, nowMs);
  const next24 = hours.slice(nowIdx, nowIdx + 24);
  const hi = next24.length ? Math.max(...next24.map((h) => h.temperature)) : current.temperature;
  const lo = next24.length ? Math.min(...next24.map((h) => h.temperature)) : current.temperature;
  const strip = hours.slice(nowIdx, nowIdx + 13);
  const heroHour = localHour(current.observedAt, tz);
  const night = current.isNight;
  // AEMET hourly has no per-hour UV; fall back to today's daily uvMax.
  const uv = current.uvIndex ?? days[0]?.uvMax ?? 0;

  return (
    <div className="flex w-full flex-col bg-[#0a0f1c] text-neutral-200">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="relative h-[360px] shrink-0 overflow-hidden">
        <WeatherBackdrop desc={current.description} hour={heroHour} />

        <div className="relative z-10 flex h-full flex-col px-4 pb-3 pt-2 text-neutral-50">
          {/* Top bar */}
          <div className="flex items-center justify-between">
            <button
              onClick={onOpenSwitcher}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[13px] font-medium backdrop-blur"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-neutral-50 shadow-[0_0_6px_rgba(255,255,255,.6)]" />
              {location.name}
              <svg width="10" height="6" viewBox="0 0 10 6" className="opacity-60">
                <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
              </svg>
            </button>
            <button
              className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-white/15 bg-white/10 backdrop-blur"
              aria-label="Search"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="7" cy="7" r="5" />
                <path d="M11 11l3 3" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Stack */}
          <div className="flex flex-1 flex-col items-center justify-center">
            <div className="mb-1.5 rounded-sm bg-black/25 px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-[1.4px] text-white/85">
              NOW · {fmtTime(current.observedAt, tz)}
            </div>
            <div className="drop-shadow-[0_4px_24px_rgba(0,0,0,.4)]">
              <WxIcon desc={current.description} size={108} color="#fafafa" strokeWidth={1.1} night={night} />
            </div>
            <div className="mt-1 flex items-start tabular-nums">
              <span className="text-[96px] font-thin leading-[0.9] tracking-[-5px] text-neutral-50">
                {current.temperature}
              </span>
              <span className="mt-1.5 text-5xl font-thin leading-none text-white/55">°</span>
            </div>
            <div className="mt-0.5 text-[15px] font-medium text-neutral-50">{current.description}</div>
            <div className="mt-0.5 text-[11px] tabular-nums text-white/65">
              H {hi}° · L {lo}°
            </div>
          </div>
        </div>
      </div>

      {/* ── Lower panel ───────────────────────────────────────── */}
      <div className="flex flex-1 flex-col bg-[#0a0f1c] pt-1">
        {/* Hourly strip */}
        <div className="pt-1">
          <div className="px-4 pb-2 font-mono text-[10px] font-semibold tracking-[1px] text-neutral-500">
            NEXT 12 HOURS
          </div>
          <div className="flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none]">
            {strip.map((h, i) => {
              const isNow = i === 0;
              const rainy = h.precipProbability >= 30;
              return (
                <div
                  key={h.time.getTime()}
                  className={`flex w-[52px] shrink-0 flex-col items-center gap-1 rounded-xl py-2.5 font-mono ${
                    isNow ? 'bg-white/[0.06] shadow-[inset_0_0_0_1px_rgba(255,255,255,.08)]' : ''
                  }`}
                >
                  <div className={`text-[11px] tabular-nums ${isNow ? 'font-semibold text-neutral-50' : 'text-neutral-500'}`}>
                    {isNow ? 'Now' : fmtTime(h.time, tz)}
                  </div>
                  <WxIcon desc={h.description} size={20} color={isNow ? '#fafafa' : '#cfcfcf'} strokeWidth={1.4} night={h.isNight} />
                  {rainy ? (
                    <div className="h-[11px] text-[10px] leading-[11px] text-sky-300">
                      {h.precipProbability}
                      <span className="text-[8px] opacity-60">%</span>
                    </div>
                  ) : (
                    <div className="h-[11px]" />
                  )}
                  <div className={`mt-0.5 text-sm font-medium ${isNow ? 'text-neutral-50' : 'text-neutral-200'}`}>
                    {h.temperature}°
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-2 px-4 pb-3.5 pt-2">
          <Metric label="Wind" value={`${current.windSpeed}`} unit={`km/h ${compass(current.windDirection)}`} live={weather.sources.wind?.source === 'oceandrivers'} />
          <Metric label="Humidity" value={`${current.humidity}`} unit="%" />
          <Metric label="UV" value={`${uv}`} unit={uvLabel(uv)} />
        </div>

        {/* Live wind sparkline (last hour) — only when a live station is present */}
        {weather.windHistory && weather.windHistory.hour.length > 1 && (
          <div className="mx-4 mb-1 rounded-xl border border-[#1d2533] bg-[#101826] px-3 py-2">
            <div className="mb-0.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-wide text-neutral-400">
                WIND · LAST HOUR
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              </span>
              <span className="font-mono text-[10px] text-neutral-500">
                <span className="text-emerald-400">━</span> wind <span className="ml-1.5 text-[#7fd02a]">┄</span> gust
              </span>
            </div>
            <WindHistoryChart points={weather.windHistory.hour} tz={tz} height={56} sparkline />
          </div>
        )}

        {/* Sun arc */}
        <SunArc sunrise={sun.sunrise} sunset={sun.sunset} tz={tz} nowMs={nowMs} />
      </div>
    </div>
  );
}

function Metric({ label, value, unit, live }: { label: string; value: string; unit: string; live?: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-[#1d2533] bg-[#131c2a] px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <div className="font-mono text-[10px] font-semibold tracking-[1px] text-neutral-500">{label}</div>
        {live && (
          <span className="flex items-center gap-0.5" title="Live measured station">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,.7)]" />
            <span className="font-mono text-[8px] font-bold tracking-wide text-emerald-400">LIVE</span>
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="font-mono text-lg font-medium tabular-nums text-neutral-50">{value}</span>
        <span className="text-[10px] text-neutral-500">{unit}</span>
      </div>
    </div>
  );
}

function SunArc({ sunrise, sunset, tz, nowMs }: { sunrise: Date; sunset: Date; tz: string; nowMs: number }) {
  const sr = sunrise.getTime();
  const ss = sunset.getTime();
  const total = ss - sr;
  if (total <= 0) return null;
  const pct = Math.max(0, Math.min(1, (nowMs - sr) / total));
  const isDay = nowMs >= sr && nowMs <= ss;
  const x = 10 + 180 * pct;
  const y = 60 - Math.sin(Math.PI * pct) * 52;
  const remain = fmtDuration(ss - nowMs);

  return (
    <div className="mx-4 mb-1 mt-2 rounded-2xl border border-[#1a2533] bg-[#0f1622] px-3 pb-2 pt-2.5">
      <div className="flex items-baseline justify-between font-mono text-[10px] font-semibold tracking-[1px] text-neutral-400">
        <span>DAYLIGHT</span>
        <span className="tabular-nums text-neutral-50">{fmtDuration(total)}</span>
      </div>
      <svg viewBox="0 0 200 64" width="100%" height="60" className="block overflow-visible">
        <defs>
          <linearGradient id="sunArcGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3a3a3a" />
            <stop offset="50%" stopColor="#e6c25b" />
            <stop offset="100%" stopColor="#3a3a3a" />
          </linearGradient>
        </defs>
        <line x1="0" y1="60" x2="200" y2="60" stroke="#1a2330" strokeWidth="1" />
        <path d="M 10 60 Q 100 -44 190 60" fill="none" stroke="#1c2734" strokeWidth="1" strokeDasharray="2 4" />
        <path
          d="M 10 60 Q 100 -44 190 60"
          fill="none"
          stroke="url(#sunArcGrad)"
          strokeWidth="1.5"
          strokeDasharray={`${pct * 240} 1000`}
          opacity={isDay ? 1 : 0.4}
        />
        {isDay && (
          <>
            <circle cx={x} cy={y} r="9" fill="rgba(230,194,91,.18)" />
            <circle cx={x} cy={y} r="5" fill="#e6c25b" />
          </>
        )}
        <circle cx="10" cy="60" r="2.5" fill="#5a5a5a" />
        <circle cx="190" cy="60" r="2.5" fill="#5a5a5a" />
      </svg>
      <div className="-mt-1 grid grid-cols-3">
        <SunCol label="Sunrise" value={fmtTime(sunrise, tz)} align="items-start" />
        <SunCol label={isDay ? 'Sets in' : 'Set'} value={isDay ? remain : '—'} align="items-center" />
        <SunCol label="Sunset" value={fmtTime(sunset, tz)} align="items-end" />
      </div>
    </div>
  );
}

function SunCol({ label, value, align }: { label: string; value: string; align: string }) {
  return (
    <div className={`flex flex-col gap-px ${align}`}>
      <div className="text-[9px] font-semibold uppercase tracking-[0.8px] text-neutral-400">{label}</div>
      <div className="font-mono text-[13px] font-medium tabular-nums text-neutral-50">{value}</div>
    </div>
  );
}
