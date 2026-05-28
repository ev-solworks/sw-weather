/**
 * WxIcon — full-color animated Meteocons glyph for a ConditionCode.
 *
 * Backed by @bybas/weather-icons (Meteocons fork, MIT). SVGs are loaded as
 * raw strings (Vite `?raw`) and inlined via `dangerouslySetInnerHTML` so the
 * embedded SMIL animations actually run — browsers disable SMIL when an SVG
 * is loaded via `<img src>`. Bundle cost: ~2-4 KB per icon, all tree-shaken.
 *
 * Resolution is keyed by `(desc, night)`. Daytime presentations
 * ('Sunny'/'Mostly sunny') always render day variants. Ambiguous codes
 * ('Clear', 'Partly cloudy') swap on `night`.
 *
 * `color` / `strokeWidth` props kept for API compat; ignored (full-color).
 */
import type { ConditionCode } from '@/types/weather';

// Raw SVG strings (so inline injection preserves SMIL animations).
import clearDay from '@bybas/weather-icons/design/fill/animation-ready/clear-day.svg?raw';
import clearNight from '@bybas/weather-icons/design/fill/animation-ready/clear-night.svg?raw';
import partlyDay from '@bybas/weather-icons/design/fill/animation-ready/partly-cloudy-day.svg?raw';
import partlyNight from '@bybas/weather-icons/design/fill/animation-ready/partly-cloudy-night.svg?raw';
import overcastDay from '@bybas/weather-icons/design/fill/animation-ready/overcast-day.svg?raw';
import overcastNight from '@bybas/weather-icons/design/fill/animation-ready/overcast-night.svg?raw';
import drizzle from '@bybas/weather-icons/design/fill/animation-ready/drizzle.svg?raw';
import rain from '@bybas/weather-icons/design/fill/animation-ready/rain.svg?raw';
import thunderstormsDay from '@bybas/weather-icons/design/fill/animation-ready/thunderstorms-day-rain.svg?raw';
import thunderstormsNight from '@bybas/weather-icons/design/fill/animation-ready/thunderstorms-night-rain.svg?raw';
import snow from '@bybas/weather-icons/design/fill/animation-ready/snow.svg?raw';
import fogDay from '@bybas/weather-icons/design/fill/animation-ready/fog-day.svg?raw';
import fogNight from '@bybas/weather-icons/design/fill/animation-ready/fog-night.svg?raw';
import hazeDay from '@bybas/weather-icons/design/fill/animation-ready/haze-day.svg?raw';
import hazeNight from '@bybas/weather-icons/design/fill/animation-ready/haze-night.svg?raw';
import notAvailable from '@bybas/weather-icons/design/fill/animation-ready/not-available.svg?raw';
import sunriseSvg from '@bybas/weather-icons/design/fill/animation-ready/sunrise.svg?raw';
import windSvg from '@bybas/weather-icons/design/fill/animation-ready/wind.svg?raw';
import thermoSvg from '@bybas/weather-icons/design/fill/animation-ready/thermometer.svg?raw';
import umbrellaSvg from '@bybas/weather-icons/design/fill/animation-ready/umbrella.svg?raw';

interface WxIconProps {
  desc: ConditionCode;
  size?: number;
  /** @deprecated kept for API compat, ignored (Meteocons are full-color). */
  color?: string;
  /** @deprecated kept for API compat, ignored. */
  strokeWidth?: number;
  night?: boolean;
  className?: string;
}

function svgFor(desc: ConditionCode, night: boolean): string {
  switch (desc) {
    case 'Sunny':         return clearDay;
    case 'Mostly sunny':  return partlyDay;
    case 'Clear':         return night ? clearNight : clearDay;
    case 'Mostly clear':  return night ? partlyNight : partlyDay;
    case 'Partly cloudy': return night ? partlyNight : partlyDay;
    case 'Cloudy':        return night ? overcastNight : overcastDay;
    case 'Light rain':    return drizzle;
    case 'Rain':          return rain;
    case 'Heavy rain':    return rain; // Meteocons has no 'extreme-rain'
    case 'Thunder':       return night ? thunderstormsNight : thunderstormsDay;
    case 'Snow':          return snow;
    case 'Fog':           return night ? fogNight : fogDay;
    case 'Haze':          return night ? hazeNight : hazeDay;
    default:              return notAvailable;
  }
}

/**
 * Force the SVG root to a given width/height so the inline icon scales
 * regardless of the file's native viewBox. The source SVGs ship 64×64; we
 * patch the opening `<svg ...>` to drop any width/height attrs and add ours.
 */
function sized(svg: string, size: number): string {
  return svg
    .replace(/<svg([^>]*)\swidth="[^"]*"/, '<svg$1')
    .replace(/<svg([^>]*)\sheight="[^"]*"/, '<svg$1')
    .replace(/<svg /, `<svg width="${size}" height="${size}" `);
}

/**
 * Non-condition Meteocons tags — wind/sun/thermo/umbrella. Useful when an
 * annotation refers to a phenomenon rather than a sky state (e.g. "Peak gust",
 * "Golden hour", "Cooling toward low").
 */
export type WxTag = 'wind' | 'sun' | 'thermo' | 'umbrella';
function svgForTag(tag: WxTag): string {
  switch (tag) {
    case 'wind': return windSvg;
    case 'sun': return sunriseSvg;
    case 'thermo': return thermoSvg;
    case 'umbrella': return umbrellaSvg;
    default: return notAvailable;
  }
}

export function WxTagIcon({ tag, size = 16, className }: { tag: WxTag; size?: number; className?: string }) {
  const html = sized(svgForTag(tag), size);
  return (
    <span
      role="img"
      aria-label={tag}
      className={className}
      style={{ display: 'inline-flex', width: size, height: size, lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function WxIcon({ desc, size = 24, night = false, className }: WxIconProps) {
  const html = sized(svgFor(desc, night), size);
  return (
    <span
      role="img"
      aria-label={desc}
      className={className}
      style={{ display: 'inline-flex', width: size, height: size, lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
