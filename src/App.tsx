/**
 * App shell — standalone surface. Provides nav context, renders the active tab's
 * view inside a mobile max-width frame, with the bottom tab bar. The embedded
 * module (future src/module.tsx) will reuse NavProvider + the same view switch.
 */

import { NavProvider, useNav } from '@/app/navigation';
import { TabBar } from '@/components/TabBar';
import { HomeView } from '@/views/HomeView';
import { TodayView } from '@/views/TodayView';
import { WeekView } from '@/views/WeekView';
import { ComingSoon } from '@/views/ComingSoon';

function CurrentView() {
  const { tab } = useNav();
  switch (tab) {
    case 'home':
      return <HomeView />;
    case 'today':
      return <TodayView />;
    case 'week':
      return <WeekView />;
    case 'map':
      return <ComingSoon title="Map" />;
    case 'more':
      return <ComingSoon title="More" />;
  }
}

function Shell() {
  return (
    <div className="mx-auto flex h-svh w-full max-w-[430px] flex-col overflow-hidden bg-[#0a0f1c] shadow-2xl">
      <div className="min-h-0 flex-1">
        <CurrentView />
      </div>
      <TabBar />
    </div>
  );
}

function App() {
  return (
    <NavProvider>
      <Shell />
    </NavProvider>
  );
}

export default App;
