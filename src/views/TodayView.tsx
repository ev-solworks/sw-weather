/**
 * Today — owns the active location's weather fetch and the sub-view switch
 * (Visual / Windguru / Graph / Sun). Only Visual is built; the rest show a
 * placeholder. Hosts the location switcher sheet (opened from the location pill).
 */

import { useState } from 'react';
import { useNav, type TodaySubView } from '@/app/navigation';
import { useWeather } from '@/hooks/useWeather';
import { TodayVisual } from '@/views/TodayVisual';
import { TodaySun } from '@/views/TodaySun';
import { TodayWindguru } from '@/views/TodayWindguru';
import { TodayGraph } from '@/views/TodayGraph';
import { LocationSwitcher } from '@/components/LocationSwitcher';

const SUB_VIEWS: { key: TodaySubView; label: string; enabled: boolean }[] = [
  { key: 'visual', label: 'Visual', enabled: true },
  { key: 'windguru', label: 'Windguru', enabled: true },
  { key: 'graph', label: 'Graph', enabled: true },
  { key: 'sun', label: 'Sun', enabled: true },
];

export function TodayView() {
  const { activeLocation, todaySub, setTodaySub } = useNav();
  const { data, loading, error, stale } = useWeather(activeLocation);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  return (
    <div className="relative flex h-full w-full flex-col bg-[#0a0f1c]">
      {/* Sub-view segmented control */}
      <div className="flex shrink-0 items-center gap-1 border-b border-[#141d2a] bg-[#0a0f1c] px-3 py-2">
        {SUB_VIEWS.map((s) => (
          <button
            key={s.key}
            disabled={!s.enabled}
            onClick={() => s.enabled && setTodaySub(s.key)}
            className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
              todaySub === s.key
                ? 'bg-white/10 text-neutral-50'
                : s.enabled
                  ? 'text-neutral-400'
                  : 'text-neutral-700'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className={`min-h-0 flex-1 ${todaySub === 'windguru' || todaySub === 'graph' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
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
