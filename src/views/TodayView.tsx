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

import { useEffect, useState } from 'react';
import { useNav, type TodaySubView } from '@/app/navigation';
import { useWeather } from '@/hooks/useWeather';
import { TodayVisual } from '@/views/TodayVisual';
import { TodaySun } from '@/views/TodaySun';
import { TodayWindguru } from '@/views/TodayWindguru';
import { TodayGraph } from '@/views/TodayGraph';
import { TodayMap } from '@/views/TodayMap';
import { LocationSwitcher } from '@/components/LocationSwitcher';
import { WeatherBackdrop, atmPalette, phaseFor } from '@/components/WeatherBackdrop';
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
  // Sun-phase derived from real sunrise/sunset, not a clock-hour heuristic.
  // This avoids "golden hour" appearing at 17:00 when sunset is 21:00.
  const phase = data && onVisual
    ? phaseFor(Date.now(), data.sun.sunrise, data.sun.sunset)
    : undefined;
  const palette = data && onVisual
    ? atmPalette(data.current.description, localHour(data.current.observedAt, data.location.timezone), phase)
    : null;
  const fg = palette?.fg ?? '#fafafa';

  // Dynamic <meta name="theme-color"> + body background so the iOS status bar
  // / dynamic island area blends with the current sky's top stop. iOS Safari
  // and PWA-standalone both honor this for the area above the web view.
  useEffect(() => {
    const skyColor = palette?.top ?? '#0a0f1c';
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = skyColor;
    // body bg ensures the area beneath the safe-area inset (under notch /
    // dynamic island when viewport-fit=cover is set) shows the sky color
    // instead of falling back to the default body bg.
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = skyColor;
    return () => { document.body.style.backgroundColor = prev; };
  }, [palette?.top]);

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* Full-bleed atmospheric sky — only on Visual; underneath everything */}
      {data && onVisual && (
        <div className="absolute inset-0 z-0">
          <WeatherBackdrop
            desc={data.current.description}
            hour={localHour(data.current.observedAt, data.location.timezone)}
            phase={phase}
            fullBleed
          />
        </div>
      )}
      {/* Solid dark base for the dense sub-views */}
      {!onVisual && <div className="absolute inset-0 z-0 bg-[#0a0f1c]" />}

      {/* Sub-view segmented control — translucent on Visual, solid on others.
          Top-padded by the safe-area inset so the tab text doesn't collide
          with the iPhone status bar / notch when viewport-fit=cover is on. */}
      <div
        className={`relative z-10 flex shrink-0 items-center gap-1 px-3 pb-2 ${
          onVisual ? '' : 'border-b border-[#141d2a] bg-[#0a0f1c]'
        }`}
        style={{ paddingTop: `calc(env(safe-area-inset-top, 0px) + 8px)` }}
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
