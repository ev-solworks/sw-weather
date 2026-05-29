/**
 * WeatherBackdrop — atmospheric image-based sky.
 *
 * Composition (back → front):
 *   1. Per-condition × hour painterly WebP image (8-20 KB each, served from
 *      /public/sky/). Carries the sun, moon, stars, clouds, rain visuals in
 *      a way procedural CSS never could.
 *   2. Graduated dark wash from upper half down so the content area always
 *      sits on a near-solid dark surface (legibility guarantee).
 *   3. Side vignette.
 *   4. Film grain overlay (~6% opacity, mix-blend overlay).
 *
 * Exports `atmPalette()` so the lower content panel can color text from the
 * sky's foreground value (atmospheric `fg`) — keeps everything chromatically
 * keyed to the current condition.
 *
 * Drop the procedural sun / moon / star / cloud / rain layers — image owns them.
 */

import type { ConditionCode } from '@/types/weather';

export interface AtmPalette {
  /** 3 gradient stops, top → bottom. */
  top: string;
  mid: string;
  bottom: string;
  /** Foreground text color, derived from the sky so text stays readable. */
  fg: string;
  /** Glow tint, kept for callers (sun arc etc.) that still need an accent. */
  glow: string;
}

/**
 * Sun-phase signature used to pick palette + image. When real sunrise/sunset
 * available, callers should compute `phaseFor(now, sunrise, sunset)`. Falls
 * back to crude hour bands when no sun data.
 */
export type SunPhase = 'night' | 'dawn' | 'day' | 'dusk';

/**
 * Compute the sun phase from real sunrise/sunset times. Bands relative to
 * sun, not the clock:
 *   • dawn:  90 min after sunrise (low warm light)
 *   • dusk:  90 min before sunset (golden hour → magic hour)
 *   • night: before sunrise OR after sunset
 *   • day:   the bulk in between
 */
export function phaseFor(nowMs: number, sunrise: Date, sunset: Date): SunPhase {
  const WINDOW = 90 * 60_000;
  const sr = sunrise.getTime();
  const ss = sunset.getTime();
  if (nowMs < sr || nowMs >= ss) return 'night';
  if (nowMs < sr + WINDOW) return 'dawn';
  if (nowMs >= ss - WINDOW) return 'dusk';
  return 'day';
}

/** Crude hour-band fallback when no sun phase is supplied. */
function phaseFromHour(hour: number): SunPhase {
  if (hour < 6 || hour >= 20) return 'night';
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'day';
}

/**
 * Per-condition × sun-phase palette. The fg color is the literal text color
 * to use on top of this sky.
 *
 * If `phase` omitted, falls back to hour-band inference (for callers that
 * don't have sun data yet).
 */
export function atmPalette(desc: ConditionCode, hour: number, phase?: SunPhase): AtmPalette {
  const ph = phase ?? phaseFromHour(hour);
  const night = ph === 'night';
  const dusk  = ph === 'dusk';
  const dawn  = ph === 'dawn';

  if (desc === 'Clear' || desc === 'Sunny' || desc === 'Mostly clear' || desc === 'Mostly sunny') {
    if (night) return { top: '#0a1428', mid: '#1a2a4a', bottom: '#2d3a5e', fg: '#e8e9f0', glow: 'rgba(255,240,200,0.4)' };
    if (dusk)  return { top: '#3a3060', mid: '#a45a55', bottom: '#e89968', fg: '#fbf1de', glow: 'rgba(255,180,120,0.7)' };
    if (dawn)  return { top: '#7d6890', mid: '#c08c7c', bottom: '#e8b89a', fg: '#fdf6ec', glow: 'rgba(255,200,150,0.6)' };
    return       { top: '#3a5a8c', mid: '#7ab2d8', bottom: '#c8dde9', fg: '#fdfeff', glow: 'rgba(255,230,180,0.8)' };
  }
  if (desc === 'Partly cloudy') {
    if (night) return { top: '#0e1a30', mid: '#243854', bottom: '#3a4a68', fg: '#e6e8ee', glow: 'rgba(180,200,230,0.4)' };
    return       { top: '#4a6c95', mid: '#8aa8c4', bottom: '#bdcfdc', fg: '#fcfdff', glow: 'rgba(255,255,255,0.5)' };
  }
  if (desc === 'Cloudy') {
    if (night) return { top: '#181c28', mid: '#2a2f3c', bottom: '#3a3f4c', fg: '#dadce2', glow: 'rgba(200,200,210,0.3)' };
    return       { top: '#5c6470', mid: '#8a909a', bottom: '#b0b5bc', fg: '#fafafa', glow: 'rgba(220,220,225,0.4)' };
  }
  if (desc === 'Heavy rain' || desc === 'Thunder') {
    return { top: '#15203a', mid: '#2a3650', bottom: '#3e4c6b', fg: '#d4d8e2', glow: 'rgba(120,150,200,0.4)' };
  }
  if (desc === 'Rain' || desc === 'Light rain') {
    return { top: '#1a2540', mid: '#2e3e5e', bottom: '#475a7c', fg: '#dde2ec', glow: 'rgba(140,170,210,0.5)' };
  }
  if (desc === 'Fog') {
    return { top: '#5a5e64', mid: '#797d83', bottom: '#9da1a6', fg: '#f0f1f3', glow: 'rgba(255,255,255,0.4)' };
  }
  if (desc === 'Haze') {
    return { top: '#6c5e58', mid: '#9a857a', bottom: '#c0a896', fg: '#fbf1de', glow: 'rgba(255,210,160,0.5)' };
  }
  if (desc === 'Snow') {
    return { top: '#3e4654', mid: '#6a7282', bottom: '#a8b0bc', fg: '#fcfdff', glow: 'rgba(255,255,255,0.6)' };
  }
  return { top: '#2a3550', mid: '#5a6e8c', bottom: '#9aabbe', fg: '#fafbfc', glow: 'rgba(255,255,255,0.4)' };
}

/**
 * Pick the painterly WebP for the given condition + sun phase. If `phase`
 * omitted, falls back to hour-band inference.
 */
function skyImagePath(desc: ConditionCode, hour: number, phase?: SunPhase): string {
  const ph = phase ?? phaseFromHour(hour);
  const night = ph === 'night';
  const dusk  = ph === 'dusk';
  const dawn  = ph === 'dawn';

  if (desc === 'Clear' || desc === 'Sunny' || desc === 'Mostly clear' || desc === 'Mostly sunny') {
    if (night) return '/sky/clear-night.webp';
    if (dusk)  return '/sky/clear-dusk.webp';
    if (dawn)  return '/sky/clear-dawn.webp';
    return '/sky/clear-day.webp';
  }
  if (desc === 'Partly cloudy') {
    return night ? '/sky/partly-night.webp' : '/sky/partly-day.webp';
  }
  if (desc === 'Cloudy') {
    return night ? '/sky/cloudy-night.webp' : '/sky/cloudy-day.webp';
  }
  if (desc === 'Heavy rain' || desc === 'Thunder') return '/sky/heavy-rain.webp';
  if (desc === 'Rain' || desc === 'Light rain')   return '/sky/rain.webp';
  if (desc === 'Fog' || desc === 'Haze')          return '/sky/fog.webp';
  if (desc === 'Snow')                            return '/sky/cloudy-day.webp'; // fallback until snow image exists
  return '/sky/cloudy-day.webp';
}

const GRAIN_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.4' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

interface WeatherBackdropProps {
  desc: ConditionCode;
  hour: number;
  /** Optional sun phase — when supplied, palette + image select on this
   * instead of clock-hour bands. Use phaseFor(nowMs, sunrise, sunset). */
  phase?: SunPhase;
  fullBleed?: boolean;
}

export function WeatherBackdrop({ desc, hour, phase }: WeatherBackdropProps) {
  const p = atmPalette(desc, hour, phase);
  const ph = phase ?? phaseFromHour(hour);
  const isNight = ph === 'night';
  const imgSrc = skyImagePath(desc, hour, phase);

  return (
    <div
      aria-hidden
      className="absolute inset-0 overflow-hidden"
      style={{ pointerEvents: 'none', background: p.top }}
    >
      {/* 1. Painterly sky image — covers the whole backdrop. Top-aligned so
             the brightest part of the sky hits the hero zone (upper half).
             Image hosts the sun/moon/stars/clouds; we lean on it for atmosphere. */}
      <img
        src={imgSrc}
        alt=""
        className="absolute inset-0 h-full w-full"
        style={{ objectFit: 'cover', objectPosition: '50% 0%' }}
        loading="eager"
        decoding="async"
      />

      {/* 2. Featherweight wash — painterly skies own the legibility now;
             this is just a whisper of darkening to nudge text contrast. */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, transparent 60%, rgba(8,12,24,${isNight ? 0.08 : 0.12}) 80%, rgba(6,10,20,${isNight ? 0.15 : 0.22}) 100%)`,
        }}
      />

      {/* 3. Side vignette */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 110% 80% at 50% 30%, transparent 55%, rgba(0,0,0,0.18))' }}
      />

      {/* 4. Film grain */}
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.06,
          mixBlendMode: 'overlay',
          backgroundImage: GRAIN_URL,
        }}
      />
    </div>
  );
}
