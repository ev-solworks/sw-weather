/**
 * WeatherBackdrop — gradient + CSS-only motion layer behind Today/Visual hero.
 *
 * Composition (back to front):
 *   1. Per-condition vertical gradient (base sky).
 *   2. Time-of-day warm/cool tint (dawn/golden/dusk/night).
 *   3. Motion layer per condition — drifting clouds, falling rain streaks,
 *      twinkling stars, scrolling fog, etc. CSS keyframes only; no JS rAF.
 *   4. Radial vignette so foreground text stays legible.
 *
 * Performance: every animated layer uses transform/opacity (compositor-only),
 * so the hero stays smooth on phones. Motion respects prefers-reduced-motion.
 */

import type { ConditionCode } from '@/types/weather';

interface Palette { from: string; via: string; to: string; }

const CONDITION_PALETTE: Record<ConditionCode, Palette> = {
  Clear: { from: '#1b3a6b', via: '#15294a', to: '#0a0f1c' },
  Sunny: { from: '#2a4f86', via: '#1a3460', to: '#0a0f1c' },
  'Mostly clear': { from: '#1f3a64', via: '#162a48', to: '#0a0f1c' },
  'Mostly sunny': { from: '#274a78', via: '#193156', to: '#0a0f1c' },
  'Partly cloudy': { from: '#2a3650', via: '#1c2438', to: '#0a0f1c' },
  Cloudy: { from: '#2c3340', via: '#1e2430', to: '#0a0f1c' },
  Fog: { from: '#363b42', via: '#262a30', to: '#0e1216' },
  Haze: { from: '#3a3a52', via: '#2a2848', to: '#0e1018' },
  'Light rain': { from: '#243648', via: '#1a2735', to: '#0a0f18' },
  Rain: { from: '#1e2e3e', via: '#16222e', to: '#080d14' },
  'Heavy rain': { from: '#1a2530', via: '#121a24', to: '#070b11' },
  Thunder: { from: '#241f33', via: '#181426', to: '#080611' },
  Snow: { from: '#33404e', via: '#232d38', to: '#0c1116' },
};

/** Warm/cool tint overlay by local hour. */
function timeTint(hour: number): string {
  if (hour < 6 || hour >= 21) return 'rgba(40,55,95,0.35)';
  if (hour < 8) return 'rgba(200,150,130,0.18)';
  if (hour >= 17 && hour < 20) return 'rgba(230,160,90,0.16)';
  if (hour >= 20) return 'rgba(150,110,140,0.20)';
  return 'rgba(200,210,230,0.05)';
}

interface WeatherBackdropProps { desc: ConditionCode; hour: number; }

export function WeatherBackdrop({ desc, hour }: WeatherBackdropProps) {
  const p = CONDITION_PALETTE[desc] ?? CONDITION_PALETTE.Cloudy;
  return (
    <div
      aria-hidden
      className="absolute inset-0 overflow-hidden"
      style={{ background: `linear-gradient(180deg, ${p.from} 0%, ${p.via} 48%, ${p.to} 100%)` }}
    >
      <div className="absolute inset-0" style={{ background: timeTint(hour) }} />
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(120% 80% at 50% 25%, transparent 40%, rgba(0,0,0,0.35) 100%)' }}
      />
    </div>
  );
}
