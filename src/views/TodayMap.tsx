/**
 * Today · Map — Windy.com embed sub-view, layer selector at top.
 *
 * Reuses the same iframe pattern as sw-client-app's WeatherMap.tsx
 * (https://embed.windy.com/embed2.html?...) so the experience matches across
 * the two apps when SW Weather is embedded back into SW Client App.
 *
 * Layers exposed: wind, rain, temp, clouds, pressure. Each is a separate
 * `overlay` query param so the iframe reloads with the new map.
 */

import { useState, useMemo } from 'react';
import type { WeatherConditions } from '@/types/weather';

type Layer = { key: string; label: string; overlay: string };

const LAYERS: Layer[] = [
  { key: 'wind', label: 'Wind', overlay: 'wind' },
  { key: 'rain', label: 'Rain', overlay: 'rain' },
  { key: 'temp', label: 'Temp', overlay: 'temp' },
  { key: 'clouds', label: 'Clouds', overlay: 'clouds' },
  { key: 'pressure', label: 'Pressure', overlay: 'pressure' },
];

interface Props {
  weather: WeatherConditions;
}

export function TodayMap({ weather }: Props) {
  const [layer, setLayer] = useState<Layer>(LAYERS[0]);
  const { lat, lon } = weather.location;

  // Embed URL — mirrors sw-client-app/components/project/WeatherMap.tsx so the
  // same UX carries over when SW Weather is embedded back into SW Client App.
  const src = useMemo(() => {
    const u = new URL('https://embed.windy.com/embed2.html');
    u.searchParams.set('lat', String(lat));
    u.searchParams.set('lon', String(lon));
    u.searchParams.set('detailLat', String(lat));
    u.searchParams.set('detailLon', String(lon));
    u.searchParams.set('zoom', '9');
    u.searchParams.set('level', 'surface');
    u.searchParams.set('overlay', layer.overlay);
    u.searchParams.set('product', 'ecmwf');
    u.searchParams.set('menu', '');
    u.searchParams.set('message', '');
    u.searchParams.set('marker', 'true');
    u.searchParams.set('calendar', 'now');
    u.searchParams.set('pressure', '');
    u.searchParams.set('type', 'map');
    u.searchParams.set('location', 'coordinates');
    u.searchParams.set('detail', '');
    u.searchParams.set('metricWind', 'km%2Fh');
    u.searchParams.set('metricTemp', '%C2%B0C');
    u.searchParams.set('radarRange', '-1');
    return u.toString().replace(/%252F/g, '%2F').replace(/%25C2%25B0/g, '%C2%B0');
  }, [lat, lon, layer.overlay]);

  return (
    <div className="flex h-full w-full flex-col bg-[#070b1a]">
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-[#131a2e] px-3 py-2 [scrollbar-width:none]">
        {LAYERS.map((l) => {
          const active = l.key === layer.key;
          return (
            <button
              key={l.key}
              onClick={() => setLayer(l)}
              className={`shrink-0 rounded-full px-3 py-1 text-[11.5px] font-semibold transition-colors ${
                active ? 'bg-white/10 text-neutral-50' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {l.label}
            </button>
          );
        })}
      </div>
      <iframe
        title="Windy weather map"
        src={src}
        className="min-h-0 flex-1"
        style={{ border: 0 }}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <div className="shrink-0 border-t border-[#131a2e] bg-[#0a0f1c] px-3 py-1.5 text-[10px] text-neutral-500">
        Map: Windy.com · Model: ECMWF
      </div>
    </div>
  );
}
