/**
 * App shell — Stage 3 vertical slice. Loads Palma de Mallorca via useWeather and
 * renders Today · Visual. Router + tab bar + location switcher come next; for now
 * this proves the data layer → view contract against a real screen.
 */

import { useWeather } from '@/hooks/useWeather';
import { getSeedLocation } from '@/utils/locations';
import { TodayVisual } from '@/views/TodayVisual';

const PALMA = getSeedLocation('palma')!;

function App() {
  const { data, loading, error, stale } = useWeather(PALMA);

  if (loading && !data) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#0a0f1c]">
        <div className="animate-pulse text-sm text-neutral-500">Loading {PALMA.name}…</div>
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-2 bg-[#0a0f1c] px-6 text-center">
        <div className="text-sm font-medium text-neutral-200">Couldn’t load weather</div>
        <div className="text-xs text-neutral-500">{error}</div>
      </main>
    );
  }

  if (!data) return null;

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-[430px] flex-col overflow-hidden bg-[#0a0f1c] shadow-2xl">
      {stale && (
        <div className="bg-amber-900/40 px-4 py-1 text-center text-[11px] text-amber-200">
          Showing last known forecast (offline)
        </div>
      )}
      <TodayVisual weather={data} />
    </div>
  );
}

export default App;
