/**
 * Today — owns the active location's weather fetch and the sub-view switch.
 *
 * Visual sub-view gets a full-bleed atmospheric backdrop (`WeatherBackdrop
 * fullBleed`) behind the tab bar AND content. Other sub-views (Detail / Graph
 * / Sun / Map) are dense data tools and stay on the solid dark surface.
 *
 * Tab bar is translucent (no fill, no border): active = underline + foreground
 * color; inactive = 45% white. Color tokens come from atmPalette when on
 * Visual; otherwise neutral white.
 */

import { useState } from 'react';
import { useNav, type TodaySubView } from '@/app/navigation';
import { useWeather } from '@/hooks/useWeather';
import { TodayVisual } from '@/views/TodayVisual';
import { TodaySun } from '@/views/TodaySun';
import { TodayWindguru } from '@/views/TodayWindguru';
import { TodayGraph } from '@/views/TodayGraph';
import { TodayMap } from '@/views/TodayMap';
import { LocationSwitcher } from '@/components/LocationSwitcher';
import { WeatherBackdrop, atmPalette } from '@/components/WeatherBackdrop';
import { localHour } from '@/utils/format';

const SUB_VIEWS: { key: TodaySubView; label: string; enabled: boolean }[] = [
  { key: 'visual', label: 'Visual', enabled: true },
  { key: 'windguru', label: 'Detail', enabled: true },
  { key: 'graph', label: 'Graph', enabled: true },
  { key: 'sun', label: 'Sun', enabled: true },
  { key: 'map', label: 'Map', enabled: true },
];

export function TodayView() {
  const { activeLocation, todaySub, setTodaySub } = useNav();
  const { data, loading, error, stale } = useWeather(activeLocation);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const onVisual = todaySub === 'visual';
  // Foreground color for tabs comes from the sky palette when Visual is active.
  const palette = data && onVisual
    ? atmPalette(data.current.description, localHour(data.current.observedAt, data.location.timezone))
    : null;
  const fg = palette?.fg ?? '#fafafa';

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* Full-bleed atmospheric sky — only on Visual; underneath everything */}
      {data && onVisual && (
        <div className="absolute inset-0 z-0">
          <WeatherBackdrop
            desc={data.current.description}
            hour={localHour(data.current.observedAt, data.location.timezone)}
            fullBleed
          />
        </div>
      )}
      {/* Solid dark base for the dense sub-views */}
      {!onVisual && <div className="absolute inset-0 z-0 bg-[#0a0f1c]" />}

      {/* Sub-view segmented control — translucent on Visual, solid on others */}
      <div
        className={`relative z-10 flex shrink-0 items-center gap-1 px-3 py-2 ${
          onVisual ? '' : 'border-b border-[#141d2a] bg-[#0a0f1c]'
        }`}
      >
        {SUB_VIEWS.map((s) => {
          const active = todaySub === s.key;
          return (
            <button
              key={s.key}
              disabled={!s.enabled}
              onClick={() => s.enabled && setTodaySub(s.key)}
              className="relative px-3 py-1 text-[12px] font-medium transition-colors"
              style={{
                color: active ? fg : `${fg}73`, // 45% alpha
                fontWeight: active ? 600 : 400,
              }}
            >
              {s.label}
              {active && (
                <span
                  aria-hidden
                  className="absolute left-1/2 -bottom-0.5 h-0.5 -translate-x-1/2 rounded-sm"
                  style={{ width: 14, background: fg, opacity: 0.85 }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className={`relative z-10 min-h-0 flex-1 ${todaySub === 'windguru' || todaySub === 'graph' || todaySub === 'map' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {loading && !data && <Centered>Loading {activeLocation.name}…</Centered>}
        {error && !data && <Centered>Couldn’t load weather — {error}</Centered>}
        {data && (
          <>
            {stale && (
              <div className="bg-amber-900/40 px-4 py-1 text-center text-[11px] text-amber-200">
                Showing last known forecast (offline)
              </div>
            )}
            {todaySub === 'visual' && <TodayVisual weather={data} onOpenSwitcher={() => setSwitcherOpen(true)} />}
            {todaySub === 'sun' && <TodaySun weather={data} />}
            {todaySub === 'windguru' && <TodayWindguru weather={data} />}
            {todaySub === 'graph' && <TodayGraph weather={data} />}
            {todaySub === 'map' && <TodayMap weather={data} />}
          </>
        )}
      </div>

      <LocationSwitcher open={switcherOpen} onClose={() => setSwitcherOpen(false)} />
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[60svh] items-center justify-center px-6 text-center text-sm text-neutral-500">{children}</div>;
}
