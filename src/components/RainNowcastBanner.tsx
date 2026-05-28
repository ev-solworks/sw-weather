/**
 * RainNowcastBanner — "Rain in 14 min, light, ~25 min" style banner.
 *
 * Data: Open-Meteo `minutely_15` precipitation (4 × 15-min slots, next 60 min).
 * Returns null when no precip in the window — caller can render unconditionally.
 *
 * Production framing: this is the Dark-Sky-style nowcast everyone misses. For
 * SW Client App embedding, the line is "rain starts in 14 min, light, lasting
 * ~25 min" — actionable on-set ("call B-cover").
 */

import type { RainNowcast } from '@/types/weather';

interface Props {
  nowcast?: RainNowcast;
}

export function RainNowcastBanner({ nowcast }: Props) {
  const event = nowcast ? computeRainEvent(nowcast) : null;
  if (!event) return null;

  return (
    <div className={`flex shrink-0 items-center gap-2 px-3 py-1.5 text-[12px] ${event.kind === 'start' ? 'bg-sky-900/40 text-sky-200' : 'bg-emerald-900/40 text-emerald-200'}`}>
      <RainGlyph />
      <span className="font-medium">{event.text}</span>
    </div>
  );
}

interface RainEvent {
  kind: 'start' | 'stop';
  text: string;
}

/**
 * Synthesize a plain-language event from the nowcast slots.
 *   • Currently dry → first non-zero slot = "Rain starts in N min"
 *   • Currently raining → first zero slot after non-zero run = "Rain stops in N min"
 *   • Currently raining and no stop in 60 min = "Rain continuing through next hour"
 *   • All-zero → null (banner hidden)
 *
 * Intensity classification (mm in a 15-min window):
 *   < 0.1 = trace · 0.1–0.5 = drizzle · 0.5–2 = light · 2–5 = moderate · 5+ = heavy
 */
function computeRainEvent(nc: RainNowcast): RainEvent | null {
  if (!nc.slots.length) return null;
  const now = Date.now();
  const intensityWord = (mm: number) => {
    if (mm < 0.1) return 'trace';
    if (mm < 0.5) return 'drizzle';
    if (mm < 2) return 'light';
    if (mm < 5) return 'moderate';
    return 'heavy';
  };
  const minsUntil = (t: Date) => Math.max(0, Math.round((t.getTime() - now) / 60_000));

  // Slot 0 contains "now" (the 15-min boundary at or before now).
  const currentlyRaining = nc.slots[0].mm > 0.05;

  if (!currentlyRaining) {
    // Find the first wet slot.
    const firstWet = nc.slots.findIndex((s) => s.mm > 0.05);
    if (firstWet === -1) return null; // dry next hour
    const startSlot = nc.slots[firstWet];
    // Find first dry slot AFTER firstWet to estimate duration.
    let durationSlots = 1;
    for (let i = firstWet + 1; i < nc.slots.length; i++) {
      if (nc.slots[i].mm > 0.05) durationSlots++;
      else break;
    }
    const intensity = intensityWord(Math.max(...nc.slots.slice(firstWet, firstWet + durationSlots).map((s) => s.mm)));
    const mins = minsUntil(startSlot.time);
    const dur = durationSlots * 15;
    const durTxt = durationSlots >= nc.slots.length - firstWet ? 'continuing past the hour' : `lasting ~${dur} min`;
    return { kind: 'start', text: `Rain in ${mins} min · ${intensity} · ${durTxt}` };
  }

  // Currently raining — find first dry slot.
  const firstDry = nc.slots.findIndex((s) => s.mm <= 0.05);
  if (firstDry === -1 || firstDry === 0) {
    return { kind: 'stop', text: `Rain ongoing · continuing through next hour` };
  }
  const stopSlot = nc.slots[firstDry];
  const mins = minsUntil(stopSlot.time);
  return { kind: 'stop', text: `Rain stops in ~${mins} min` };
}

function RainGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 14a4 4 0 010-8 5 5 0 019.6-1.3A3.5 3.5 0 0117 14H7z" />
      <path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3" />
    </svg>
  );
}
