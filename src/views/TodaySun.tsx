/**
 * Today · Sun & Moon (VIEWS.md §E). Hero arc with named phases, daylight stats,
 * 24h twilight gradient strip, full phase list, and a moon panel with a
 * phase-accurate disc. Data is suncalc-derived (weather.sun / weather.moon).
 *
 * All times render in the LOCATION's timezone via fmtTime. moonrise/moonset are
 * nullable (suncalc returns null on days the moon doesn't cross) — guarded.
 */

import type { MoonInfo, SunPhases, WeatherConditions } from '@/types/weather';
import { fmtTime } from '@/utils/format';

const W = 360;
const HORIZON_Y = 140;
const ARC_LEFT = 30;
const ARC_RIGHT = 330;
const ARC_TOP = 30;

function fmtDur(ms: number): string {
  const total = Math.round(ms / 60000);
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, '0')}m`;
}
function fmtDelta(ms: number): string {
  const total = Math.round(ms / 60000);
  const sign = total >= 0 ? '+' : '−';
  const abs = Math.abs(total);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return h > 0 ? `${sign}${h}h ${m}m` : `${sign}${m}m`;
}

export function TodaySun({ weather }: { weather: WeatherConditions }) {
  const { sun, moon, location } = weather;
  const tz = location.timezone;
  const now = Date.now();
  const dayLen = sun.sunset.getTime() - sun.sunrise.getTime();
  const deltaYday = dayLen - sun.yesterdayLengthMs;
  const deltaTmw = sun.tomorrowLengthMs - dayLen;
  const t = (d: Date) => fmtTime(d, tz);

  return (
    <div className="flex flex-col bg-[#070b1a] text-neutral-200">
      <SunArcHero sun={sun} now={now} tz={tz} />

      {/* Countdown to the next sun event (sunrise or sunset) + length deltas. */}
      <NextEventBar sun={sun} now={now} tz={tz} />

      {/* Daylight stats */}
      <div className="mx-3.5 mb-3 mt-1 flex items-stretch rounded-xl border border-[#1b2440] bg-[#0c1428] px-1 py-2.5">
        <Stat label="Daylight" value={fmtDur(dayLen)} sub={`${fmtDelta(deltaYday)} vs yesterday`} subColor={deltaYday >= 0 ? '#7fd02a' : '#f49224'} />
        <Divider />
        <Stat label="Solar noon" value={t(sun.solarNoon)} sub="Sun at peak" />
        <Divider />
        <Stat label="Tomorrow" value={fmtDur(sun.tomorrowLengthMs)} sub={`${fmtDelta(deltaTmw)} vs today`} subColor={deltaTmw >= 0 ? '#7fd02a' : '#f49224'} />
      </div>

      <TwilightStrip sun={sun} now={now} tz={tz} />

      <div className="px-3.5 pb-3">
        <SectionLabel>PHASES</SectionLabel>
        <PhaseList sun={sun} now={now} tz={tz} />
      </div>

      <MoonPanel moon={moon} tz={tz} />
    </div>
  );
}

function SunArcHero({ sun, now, tz }: { sun: SunPhases; now: number; tz: string }) {
  const sunriseT = sun.sunrise.getTime();
  const sunsetT = sun.sunset.getTime();
  const dayLen = sunsetT - sunriseT || 1;

  const dayPos = (t: number) => {
    const u = (t - sunriseT) / dayLen;
    return { x: ARC_LEFT + u * (ARC_RIGHT - ARC_LEFT), y: HORIZON_Y - Math.sin(Math.PI * u) * (HORIZON_Y - ARC_TOP) };
  };
  const twilightPos = (t: number) => {
    const u = (t - sunriseT) / dayLen;
    const phase = u < 0 ? -u : u - 1;
    return { x: ARC_LEFT + u * (ARC_RIGHT - ARC_LEFT), y: HORIZON_Y + Math.sin(Math.PI * Math.min(phase / 0.35, 1)) * 35 };
  };

  const isDay = now >= sunriseT && now <= sunsetT;
  const sunPos = isDay ? dayPos(now) : twilightPos(now);
  const f = (d: Date) => fmtTime(d, tz);

  const markers = [
    { t: sun.sunrise, primary: true },
    { t: sun.goldenEnd, primary: false },
    { t: sun.solarNoon, primary: true },
    { t: sun.goldenStart, primary: false },
    { t: sun.sunset, primary: true },
  ];
  const twilights = [
    { t: sun.civilDawn, c: '#6a8aff' },
    { t: sun.nauticalDawn, c: '#4a5fcf' },
    { t: sun.astroDawn, c: '#2a3590' },
    { t: sun.civilDusk, c: '#6a8aff' },
    { t: sun.nauticalDusk, c: '#4a5fcf' },
    { t: sun.astroDusk, c: '#2a3590' },
  ];

  const mid = (ARC_LEFT + ARC_RIGHT) / 2;
  const arcPath = `M ${ARC_LEFT} ${HORIZON_Y} Q ${mid} ${2 * ARC_TOP - HORIZON_Y} ${ARC_RIGHT} ${HORIZON_Y}`;

  return (
    <div className="px-2 pt-2">
      <svg viewBox={`0 0 ${W} 200`} width="100%" className="block">
        <defs>
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a3a8a" stopOpacity="0.45" />
            <stop offset="55%" stopColor="#e6c25b" stopOpacity="0.25" />
            <stop offset="80%" stopColor="#f49224" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#070b1a" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="sunGlow">
            <stop offset="0%" stopColor="#ffe39a" stopOpacity="0.9" />
            <stop offset="45%" stopColor="#f4b03a" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#f4b03a" stopOpacity="0" />
          </radialGradient>
        </defs>

        <path d={`${arcPath} Z`} fill="url(#skyGrad)" />

        {[0.18, 0.27, 0.35].map((depth, i) => {
          const dy = depth * 100;
          return (
            <path
              key={i}
              d={`M ${ARC_LEFT - dy * 0.6} ${HORIZON_Y + dy} Q ${mid} ${HORIZON_Y + dy * 1.2} ${ARC_RIGHT + dy * 0.6} ${HORIZON_Y + dy}`}
              fill="none"
              stroke={['#3a4f8a', '#26305a', '#161e3a'][i]}
              strokeWidth="1"
              strokeDasharray="1 3"
              opacity="0.6"
            />
          );
        })}

        <line x1="0" y1={HORIZON_Y} x2={W} y2={HORIZON_Y} stroke="#3a4566" strokeWidth="1" />
        <text x="6" y={HORIZON_Y - 4} fontSize="8" fill="#5a6485" fontFamily="ui-monospace, monospace">HORIZON</text>

        <path d={arcPath} fill="none" stroke="#e6c25b" strokeWidth="1.8" opacity="0.55" />

        {markers.map((m, i) => {
          const p = dayPos(m.t.getTime());
          return (
            <g key={i}>
              <line x1={p.x} y1={HORIZON_Y} x2={p.x} y2={p.y} stroke={m.primary ? '#5a6485' : '#2a3550'} strokeWidth="1" strokeDasharray={m.primary ? '0' : '2 2'} />
              <circle cx={p.x} cy={p.y} r={m.primary ? 3 : 2} fill={m.primary ? '#fafafa' : '#7a8aa3'} />
            </g>
          );
        })}

        {twilights.map((m, i) => {
          const p = twilightPos(m.t.getTime());
          return <circle key={i} cx={p.x} cy={p.y} r="2" fill={m.c} />;
        })}

        <circle cx={sunPos.x} cy={sunPos.y} r="14" fill="url(#sunGlow)" />
        <circle cx={sunPos.x} cy={sunPos.y} r="5.5" fill={isDay ? '#ffd06a' : '#a8b3e0'} />

        <g fontFamily="ui-monospace, monospace" style={{ fontVariantNumeric: 'tabular-nums' }}>
          <text x={dayPos(sunriseT).x} y={HORIZON_Y + 14} textAnchor="middle" fontSize="9.5" fill="#cfcfcf" fontWeight="600">{f(sun.sunrise)}</text>
          <text x={dayPos(sun.solarNoon.getTime()).x} y={ARC_TOP - 10} textAnchor="middle" fontSize="10" fill="#ffd06a" fontWeight="600">{f(sun.solarNoon)}</text>
          <text x={dayPos(sunsetT).x} y={HORIZON_Y + 14} textAnchor="middle" fontSize="9.5" fill="#cfcfcf" fontWeight="600">{f(sun.sunset)}</text>
        </g>
        <text x={ARC_LEFT} y={HORIZON_Y + 26} textAnchor="middle" fontSize="9" fill="#7a8aa3" fontWeight="600">SUNRISE</text>
        <text x={ARC_RIGHT} y={HORIZON_Y + 26} textAnchor="middle" fontSize="9" fill="#7a8aa3" fontWeight="600">SUNSET</text>
      </svg>
    </div>
  );
}

function TwilightStrip({ sun, now, tz }: { sun: SunPhases; now: number; tz: string }) {
  // Day boundaries in the location's TZ: midnight before sunrise → +24h.
  const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(sun.sunrise);
  // Approximate location-midnight as the instant 24h-aligned; use offset from sunrise's local date.
  const localMidnight = localMidnightMs(sun.sunrise, tz);
  const dayStart = localMidnight;
  const dayEnd = dayStart + 24 * 3600 * 1000;
  const pct = (t: number) => ((t - dayStart) / (dayEnd - dayStart)) * 100;
  void dayKey;

  const stops = [
    { p: 0, c: '#070b1a' },
    { p: pct(sun.astroDawn.getTime()), c: '#0d1230' },
    { p: pct(sun.nauticalDawn.getTime()), c: '#1a2658' },
    { p: pct(sun.civilDawn.getTime()), c: '#3a3a88' },
    { p: pct(sun.sunrise.getTime()), c: '#e87a3a' },
    { p: pct(sun.goldenEnd.getTime()), c: '#ffd06a' },
    { p: pct(sun.solarNoon.getTime()), c: '#ffe79a' },
    { p: pct(sun.goldenStart.getTime()), c: '#ffd06a' },
    { p: pct(sun.sunset.getTime()), c: '#e87a3a' },
    { p: pct(sun.civilDusk.getTime()), c: '#3a3a88' },
    { p: pct(sun.nauticalDusk.getTime()), c: '#1a2658' },
    { p: pct(sun.astroDusk.getTime()), c: '#0d1230' },
    { p: 100, c: '#070b1a' },
  ].filter((s) => Number.isFinite(s.p));
  const grad = `linear-gradient(to right, ${stops.map((s) => `${s.c} ${Math.max(0, Math.min(100, s.p)).toFixed(1)}%`).join(', ')})`;
  const nowPct = Math.max(0, Math.min(100, pct(now)));

  return (
    <div className="px-3.5 pb-3">
      <SectionLabel>SKY · 24H</SectionLabel>
      <div className="relative h-[22px] overflow-hidden rounded-md border border-[#1b2440]">
        <div className="absolute inset-0" style={{ background: grad }} />
        {[6, 12, 18].map((h) => (
          <div key={h} className="absolute bottom-0 top-0 w-px bg-white/20" style={{ left: `${(h / 24) * 100}%` }} />
        ))}
        <div className="absolute -bottom-[3px] -top-[3px] w-0.5 bg-neutral-50 shadow-[0_0_8px_rgba(255,255,255,.6)]" style={{ left: `${nowPct}%` }} />
      </div>
      <div className="relative mt-1 h-3">
        {[0, 6, 12, 18, 24].map((h) => (
          <div key={h} className="absolute -translate-x-1/2 font-mono text-[9px] text-[#7a8aa3]" style={{ left: `${(h / 24) * 100}%` }}>
            {String(h).padStart(2, '0')}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Photographic terms instead of astronomy ones. Each row marks a MOMENT (not
 * a period), so the NOW badge attaches to the row whose time is closest to
 * `now` rather than treating phases as ranges (the previous logic mislabelled
 * "morning golden hour" as the active phase between 07:06 and solar noon).
 */
function PhaseList({ sun, now, tz }: { sun: SunPhases; now: number; tz: string }) {
  const phases = [
    { t: sun.astroDawn, name: 'First light', sub: 'Sky starts to glow', color: '#2a3590', dot: 'astro' as const },
    { t: sun.nauticalDawn, name: 'Pre-dawn blue', sub: 'Horizon becomes visible', color: '#4a5fcf', dot: 'naut' as const },
    { t: sun.civilDawn, name: 'Blue hour begins', sub: 'Deep blue sky, soft glow', color: '#6a8aff', dot: 'civil' as const },
    { t: sun.sunrise, name: 'Sunrise', sub: 'Sun crosses horizon', color: '#e87a3a', dot: 'sun' as const, big: true },
    { t: sun.goldenEnd, name: 'Golden hour ends', sub: 'Soft warm light fades', color: '#ffd06a', dot: 'golden' as const },
    { t: sun.solarNoon, name: 'Solar noon', sub: 'Sun at its peak', color: '#ffe79a', dot: 'noon' as const, big: true },
    { t: sun.goldenStart, name: 'Golden hour begins', sub: 'Soft warm light returns', color: '#ffd06a', dot: 'golden' as const },
    { t: sun.sunset, name: 'Sunset', sub: 'Sun crosses horizon', color: '#e87a3a', dot: 'sun' as const, big: true },
    { t: sun.civilDusk, name: 'Blue hour ends', sub: 'Last usable light', color: '#6a8aff', dot: 'civil' as const },
    { t: sun.nauticalDusk, name: 'Twilight ends', sub: 'Horizon fades', color: '#4a5fcf', dot: 'naut' as const },
    { t: sun.astroDusk, name: 'Last light', sub: 'True night begins', color: '#2a3590', dot: 'astro' as const },
  ];

  // "NOW" attaches to the NEXT upcoming phase (the one we're heading toward).
  // This reads naturally as "you're about to enter X" rather than "you're in X"
  // (the old logic, which collided with multi-hour gaps like the morning).
  const nextIdx = phases.findIndex((p) => p.t.getTime() > now);

  return (
    <div className="overflow-hidden rounded-xl border border-[#1b2440] bg-[#0c1428]">
      {phases.map((p, i) => {
        const tMs = p.t.getTime();
        const passed = now >= tMs;
        const isNext = i === nextIdx;
        return (
          <div
            key={i}
            className={`flex min-h-[36px] items-center gap-2.5 border-b border-[#131a2e] px-3 py-2 last:border-b-0 ${passed ? 'opacity-55' : ''}`}
          >
            <div className="w-11 font-mono text-[12px] font-semibold tabular-nums text-neutral-50">{fmtTime(p.t, tz)}</div>
            <PhaseDot kind={p.dot} color={p.color} />
            <div className="flex flex-1 flex-col">
              <div className={`text-[13px] leading-tight ${p.big ? 'font-semibold text-neutral-50' : 'font-medium text-neutral-200'}`}>{p.name}</div>
              <div className="mt-px text-[10px] text-[#7a8aa3]">{p.sub}</div>
            </div>
            {isNext && <div className="rounded-sm bg-[#ffd06a] px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wider text-[#0a0a0a]">NEXT</div>}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Countdown to the next sunrise or sunset. If between them: shows "Sunset in 7h
 * 12m". Pre-dawn: "Sunrise in 5h 02m". Post-dusk: "Sunrise tomorrow in 7h 30m".
 */
function NextEventBar({ sun, now, tz }: { sun: SunPhases; now: number; tz: string }) {
  const sr = sun.sunrise.getTime();
  const ss = sun.sunset.getTime();
  let label: string;
  let when: Date;
  let remainMs: number;
  if (now < sr) { label = 'Sunrise'; when = sun.sunrise; remainMs = sr - now; }
  else if (now < ss) { label = 'Sunset'; when = sun.sunset; remainMs = ss - now; }
  else {
    // Approximate next sunrise as today's sunrise + 24h. Suncalc's day-level
    // values are anchored to UTC midday so this is accurate within ~30s for
    // the next-day display.
    when = new Date(sr + 24 * 3600_000);
    label = 'Sunrise';
    remainMs = when.getTime() - now;
  }
  return (
    <div className="mx-3.5 mt-2 flex items-center justify-between rounded-xl border border-[#1b2440] bg-[#101a32] px-3.5 py-2.5">
      <div className="flex flex-col">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[1px] text-[#7a8aa3]">{label} in</div>
        <div className="mt-0.5 font-mono text-[20px] font-medium tabular-nums leading-none text-neutral-50">{fmtDur(remainMs)}</div>
      </div>
      <div className="flex flex-col items-end">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[1px] text-[#7a8aa3]">at</div>
        <div className="mt-0.5 font-mono text-[18px] font-medium tabular-nums leading-none text-[#ffd06a]">{fmtTime(when, tz)}</div>
      </div>
    </div>
  );
}

function PhaseDot({ kind, color }: { kind: 'sun' | 'noon' | 'golden' | 'civil' | 'naut' | 'astro'; color: string }) {
  if (kind === 'sun')
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="3.5" fill={color} />
        <g stroke={color} strokeWidth="1.2" strokeLinecap="round">
          <line x1="10" y1="2" x2="10" y2="4" /><line x1="10" y1="16" x2="10" y2="18" />
          <line x1="2" y1="10" x2="4" y2="10" /><line x1="16" y1="10" x2="18" y2="10" />
        </g>
      </svg>
    );
  if (kind === 'noon')
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="4" fill={color} />
        <g stroke={color} strokeWidth="1.4" strokeLinecap="round">
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return <line key={i} x1={10 + Math.cos(a) * 6} y1={10 + Math.sin(a) * 6} x2={10 + Math.cos(a) * 8} y2={10 + Math.sin(a) * 8} />;
          })}
        </g>
      </svg>
    );
  if (kind === 'golden')
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 14 L17 14" stroke="#4a4566" strokeWidth="1" />
        <circle cx="10" cy="14" r="3" fill={color} />
      </svg>
    );
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M3 12 L17 12" stroke="#4a4566" strokeWidth="1" />
      <circle cx="10" cy={kind === 'civil' ? 13 : kind === 'naut' ? 14.5 : 16} r="2.2" fill={color} />
    </svg>
  );
}

function MoonPanel({ moon, tz }: { moon: MoonInfo; tz: string }) {
  const t = (d: Date | null) => (d ? fmtTime(d, tz) : '—');
  return (
    <div className="px-3.5 pb-4">
      <SectionLabel>MOON</SectionLabel>
      <div className="flex items-center gap-3.5 rounded-xl border border-[#1b2440] bg-[#0c1428] px-3.5 py-3">
        <MoonDisc fraction={moon.phaseFraction} size={64} />
        <div className="flex flex-1 flex-col gap-0.5">
          <div className="text-sm font-semibold text-neutral-50">{moon.phase}</div>
          <div className="font-mono text-[11px] tabular-nums text-[#9a9a93]">{moon.illumination}% illuminated</div>
          <div className="mt-1 flex gap-4 font-mono tabular-nums">
            <div><span className="mr-1.5 text-[9px] font-bold uppercase tracking-wide text-[#7a8aa3]">Rise</span><span className="text-[12px] font-medium text-neutral-50">{t(moon.moonrise)}</span></div>
            <div><span className="mr-1.5 text-[9px] font-bold uppercase tracking-wide text-[#7a8aa3]">Set</span><span className="text-[12px] font-medium text-neutral-50">{t(moon.moonset)}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MoonDisc({ fraction, size = 56 }: { fraction: number; size?: number }) {
  const r = size / 2;
  const phase = fraction * 2 * Math.PI;
  const cosP = Math.cos(phase);
  const rx = Math.abs(cosP) * r;
  const shadowFill = '#0d1124';
  const litFill = '#e3decc';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ filter: 'drop-shadow(0 4px 14px rgba(180,170,140,.15))' }}>
      <defs>
        <radialGradient id="moonSurface" cx="0.35" cy="0.35" r="0.7">
          <stop offset="0%" stopColor="#f4ecd6" />
          <stop offset="100%" stopColor="#bdb293" />
        </radialGradient>
        <clipPath id="moonClip"><circle cx={r} cy={r} r={r - 1} /></clipPath>
      </defs>
      <circle cx={r} cy={r} r={r - 1} fill="url(#moonSurface)" />
      <g clipPath="url(#moonClip)">
        {fraction < 0.5 ? <rect x="0" y="0" width={r} height={size} fill={shadowFill} /> : <rect x={r} y="0" width={r} height={size} fill={shadowFill} />}
        <ellipse cx={r} cy={r} rx={rx} ry={r - 1} fill={cosP > 0 ? shadowFill : litFill} />
      </g>
      <g opacity="0.18" fill="#3a3530">
        <circle cx={r - 6} cy={r - 4} r="3" /><circle cx={r + 3} cy={r + 5} r="2" /><circle cx={r - 2} cy={r + 7} r="1.5" />
      </g>
      <circle cx={r} cy={r} r={r - 1} fill="none" stroke="#3a3a3a" strokeWidth="0.5" opacity="0.4" />
    </svg>
  );
}

function Stat({ label, value, sub, subColor }: { label: string; value: string; sub: string; subColor?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-0.5">
      <div className="text-[9px] font-bold uppercase tracking-wide text-[#7a8aa3]">{label}</div>
      <div className="font-mono text-[17px] font-medium tabular-nums tracking-tight text-neutral-50">{value}</div>
      <div className="font-mono text-[10px]" style={{ color: subColor ?? '#9a9a93' }}>{sub}</div>
    </div>
  );
}
function Divider() {
  return <div className="my-0.5 w-px self-stretch bg-[#1b2440]" />;
}
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="pb-1.5 font-mono text-[9px] font-bold tracking-[1px] text-[#5a6485]">{children}</div>;
}

/** Milliseconds of the most recent local midnight in `tz` at or before `ref`. */
function localMidnightMs(ref: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(ref);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  let hh = get('hour');
  if (hh === 24) hh = 0; // some engines emit 24 at midnight
  const secsSinceMidnight = hh * 3600 + get('minute') * 60 + get('second');
  return ref.getTime() - secsSinceMidnight * 1000;
}
