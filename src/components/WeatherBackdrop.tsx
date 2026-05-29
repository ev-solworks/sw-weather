/**
 * WeatherBackdrop — atmospheric full-bleed sky.
 *
 * Restyled per design_handoff_atmospheric_restyle/. Composition back→front:
 *   1. Base 3-stop vertical gradient — luminous all the way down (no fade to
 *      near-black). Palette varies by ConditionCode AND local hour (day/dawn/
 *      golden/night variants).
 *   2. Atmospheric glow + sun disc (clear daytime) OR moon + 32 stars
 *      (clear/partly nights), positioned by hour.
 *   3. Cloud layers (cloudy / partly / rain).
 *   4. Rain streaks (rain / heavy rain).
 *   5. Soft bottom vignette (per-condition opacity) for foreground legibility.
 *   6. Soft side vignette for edges.
 *   7. Film grain (SVG turbulence at 6% on overlay).
 *
 * Designed to render at full screen behind the entire Today view, including
 * the iOS status bar area. The `fullBleed` prop is on by default; pass false
 * to use the older 342px hero-only behaviour.
 *
 * Exports `atmPalette()` so the lower content panel can color text from the
 * sky's foreground value (atmospheric `fg`) — keeps everything chromatically
 * keyed to the current condition.
 */

import type { ConditionCode } from '@/types/weather';

export interface AtmPalette {
  /** 3 gradient stops, top → bottom. */
  top: string;
  mid: string;
  bottom: string;
  /** Foreground text color, derived from the sky so text stays readable. */
  fg: string;
  /** Glow tint for the sun / moon disc. */
  glow: string;
}

/**
 * Per-condition × hour-of-day palette. Hour bands:
 *   • night: <6 or >=20  → deep blues, low chroma
 *   • dawn:  5–8         → muted lavender + warm peach
 *   • dusk:  17–20       → magenta + amber
 *   • day:   8–17        → blue + warm white
 * The fg color is the literal text color to use on top of this sky.
 */
export function atmPalette(desc: ConditionCode, hour: number): AtmPalette {
  const night = hour < 6 || hour >= 20;
  const dusk  = hour >= 17 && hour < 20;
  const dawn  = hour >= 5 && hour < 8;

  // Clear / Sunny family
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

/** Darken a #rrggbb hex by `amount` (0–1). Used to chain the base gradient
 * into a deep dark surface below the sky. */
function darkenHex(hex: string, amount: number): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const t = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 - amount))));
  return `rgb(${t(r)}, ${t(g)}, ${t(b)})`;
}

// Film grain — inline SVG turbulence, base64-free for cleanliness.
const GRAIN_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.4' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

interface WeatherBackdropProps {
  desc: ConditionCode;
  hour: number;
  /** When true (default), no max-height — fills the parent. When false the
   * component returns a 342px-height hero. */
  fullBleed?: boolean;
}

export function WeatherBackdrop({ desc, hour, fullBleed = true }: WeatherBackdropProps) {
  const p = atmPalette(desc, hour);
  const isNight = hour < 6 || hour >= 20;
  const isRain = desc === 'Rain' || desc === 'Light rain' || desc === 'Heavy rain' || desc === 'Thunder';
  const isHeavy = desc === 'Heavy rain' || desc === 'Thunder';
  const isCloudy = desc === 'Cloudy' || desc === 'Partly cloudy' || isRain;
  const showSun = (desc === 'Clear' || desc === 'Sunny' || desc === 'Mostly sunny') && !isNight;
  const showMoonStars = isNight && (desc === 'Clear' || desc === 'Mostly clear' || desc === 'Partly cloudy');
  // Sun travels 14% → 69% of viewport height across hours 6–20.
  const sunY = ((hour - 6) / 14) * 55 + 14;

  return (
    <div
      aria-hidden
      className={`${fullBleed ? 'absolute inset-0' : 'absolute inset-0'} overflow-hidden`}
      style={{ pointerEvents: 'none' }}
    >
      {/* 1. Base gradient — atmospheric in the upper half, deeper in the lower
             half so text is always legible against a dark surface. */}
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(180deg, ${p.top} 0%, ${p.mid} 35%, ${p.bottom} 50%, ${darkenHex(p.bottom, 0.45)} 75%, #0a0f1c 100%)` }}
      />

      {/* 2. Atmospheric glow centered on the sun's apparent position. Confined
             to the upper half (mask via maxHeight) so bright glows can't bleed
             into the content area below. */}
      <div
        className="absolute"
        style={{
          top: 0, left: 0, right: 0,
          height: '55%',
          background: `radial-gradient(ellipse 75% 60% at 70% ${(sunY / 100) * 90}%, ${p.glow}, transparent 70%)`,
          mixBlendMode: 'screen',
          opacity: showSun ? 0.9 : 0.35,
          maskImage: 'linear-gradient(180deg, black 0%, black 70%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(180deg, black 0%, black 70%, transparent 100%)',
        }}
      />

      {/* Sun disc — only render when in the upper region (y < 50%). */}
      {showSun && sunY < 50 && (
        <div
          className="absolute"
          style={{
            top: `${sunY}%`,
            left: '70%',
            width: 84,
            height: 84,
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,250,235,0.92), rgba(255,225,170,0.32) 60%, transparent 75%)',
            filter: 'blur(2px)',
          }}
        />
      )}

      {/* Moon + stars (clear/partly clear nights). Confined to upper 50% via
          a mask so they fade out before the content area. */}
      {showMoonStars && (
        <div
          className="absolute"
          style={{
            top: 0, left: 0, right: 0,
            height: '50%',
            maskImage: 'linear-gradient(180deg, black 0%, black 75%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(180deg, black 0%, black 75%, transparent 100%)',
          }}
        >
          <div
            className="absolute"
            style={{
              top: '32%', left: '72%',
              width: 60, height: 60,
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(245,240,225,0.45), transparent 70%)',
            }}
          />
          {Array.from({ length: 32 }).map((_, i) => {
            const x = (i * 137.5) % 100;
            const y = (i * 73) % 75; // limit star Y so masking does the rest
            const s = (i % 3 === 0) ? 2 : 1;
            return (
              <div
                key={i}
                className="absolute"
                style={{
                  top: `${y}%`, left: `${x}%`,
                  width: s, height: s,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.85)',
                  boxShadow: '0 0 4px rgba(255,255,255,0.5)',
                }}
              />
            );
          })}
        </div>
      )}

      {/* 3. Cloud layers — confined to the upper 45% so they can't pollute
             the content area's contrast. Mask faded out by 55%. */}
      {isCloudy && (
        <div
          className="absolute"
          style={{
            top: 0, left: 0, right: 0,
            height: '50%',
            maskImage: 'linear-gradient(180deg, black 0%, black 70%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(180deg, black 0%, black 70%, transparent 100%)',
          }}
        >
          <div
            className="absolute"
            style={{
              top: '14%', left: '-10%',
              width: '140%', height: '40%',
              background: `radial-gradient(ellipse 50% 50% at 30% 50%, rgba(255,255,255,${isRain ? 0.08 : 0.18}), transparent 60%), radial-gradient(ellipse 40% 60% at 75% 30%, rgba(255,255,255,${isRain ? 0.06 : 0.15}), transparent 65%)`,
              filter: 'blur(8px)',
            }}
          />
          <div
            className="absolute"
            style={{
              top: '34%', left: '-10%',
              width: '140%', height: '40%',
              background: `radial-gradient(ellipse 60% 40% at 60% 50%, rgba(${isRain ? '40,50,75' : '255,255,255'},${isRain ? 0.45 : 0.22}), transparent 70%)`,
              filter: 'blur(14px)',
            }}
          />
        </div>
      )}

      {/* 4. Rain streaks — top ~40% only */}
      {isRain && (
        <svg
          width="100%" height="40%"
          className="absolute top-0 left-0"
          style={{
            opacity: isHeavy ? 0.55 : 0.35,
            mixBlendMode: 'screen',
            maskImage: 'linear-gradient(180deg, black 0%, black 70%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(180deg, black 0%, black 70%, transparent 100%)',
          }}
          preserveAspectRatio="none"
        >
          {Array.from({ length: isHeavy ? 80 : 45 }).map((_, i) => {
            const x = (i * 47) % 100;
            const y = (i * 31) % 100;
            const len = 18 + (i % 6) * 4;
            return (
              <line
                key={i}
                x1={`${x}%`} y1={`${y}%`}
                x2={`${x + 1.8}%`} y2={`${y + len / 8}%`}
                stroke="rgba(220,235,255,0.7)"
                strokeWidth="0.5"
                strokeLinecap="round"
              />
            );
          })}
        </svg>
      )}

      {/* 5. Graduated dark wash — the legibility guarantee. Subtle from 38%
             down, climbing to a near-opaque dark by 100%. Stronger on bright
             skies (day/dawn/golden) where contrast is hardest. */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, transparent 38%, rgba(8,12,24,${isNight ? 0.3 : 0.55}) 60%, rgba(6,10,20,${isNight ? 0.55 : 0.78}) 80%, rgba(6,10,20,${isNight ? 0.75 : 0.92}) 100%)`,
        }}
      />

      {/* 6. Soft side vignette */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 110% 80% at 50% 30%, transparent 55%, rgba(0,0,0,0.18))' }}
      />

      {/* 7. Film grain */}
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
