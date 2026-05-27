/**
 * Navigation + locations state via React context — no router. This is the single
 * nav model for both surfaces: standalone owns it here; the embedded module
 * (INTEGRATION.md) wraps the same provider, letting the host render us without a
 * <Router>. State-based nav also means instant tab switches (no URL round-trip).
 *
 * Saved locations persist to localStorage under `sw.weather.locations` (namespaced
 * so an embedding host can clear them). Seed locations bootstrap an empty store.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Location } from '@/types/weather';
import { SEED_LOCATIONS } from '@/utils/locations';

export type Tab = 'home' | 'today' | 'week' | 'map' | 'more';
export type TodaySubView = 'visual' | 'windguru' | 'graph' | 'sun';

const LOCATIONS_KEY = 'sw.weather.locations';

interface NavState {
  tab: Tab;
  todaySub: TodaySubView;
  locations: Location[];
  activeLocationId: string;
  activeLocation: Location;

  setTab: (tab: Tab) => void;
  setTodaySub: (sub: TodaySubView) => void;
  setActiveLocation: (id: string) => void;
  /** Navigate to a location's Today/Visual (used by Home cards). */
  openLocation: (id: string) => void;
  addLocation: (loc: Location) => void;
  removeLocation: (id: string) => void;
}

const NavContext = createContext<NavState | null>(null);

function loadLocations(): Location[] {
  try {
    const raw = globalThis.localStorage?.getItem(LOCATIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Location[];
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {
    // fall through to seed
  }
  return SEED_LOCATIONS;
}

function persist(locations: Location[]): void {
  try {
    globalThis.localStorage?.setItem(LOCATIONS_KEY, JSON.stringify(locations));
  } catch {
    // ignore quota/unavailable
  }
}

export function NavProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<Tab>('home');
  const [todaySub, setTodaySub] = useState<TodaySubView>('visual');
  const [locations, setLocations] = useState<Location[]>(loadLocations);
  const [activeLocationId, setActiveLocationId] = useState<string>(() => loadLocations()[0]?.id ?? '');

  const activeLocation = useMemo(
    () => locations.find((l) => l.id === activeLocationId) ?? locations[0],
    [locations, activeLocationId],
  );

  const setActiveLocation = useCallback((id: string) => setActiveLocationId(id), []);

  const openLocation = useCallback((id: string) => {
    setActiveLocationId(id);
    setTab('today');
    setTodaySub('visual');
  }, []);

  const addLocation = useCallback((loc: Location) => {
    setLocations((prev) => {
      if (prev.some((l) => l.id === loc.id)) return prev;
      const next = [...prev, loc];
      persist(next);
      return next;
    });
  }, []);

  const removeLocation = useCallback((id: string) => {
    setLocations((prev) => {
      const next = prev.filter((l) => l.id !== id);
      persist(next);
      return next;
    });
    setActiveLocationId((cur) => (cur === id ? (locations[0]?.id ?? '') : cur));
  }, [locations]);

  const value: NavState = {
    tab,
    todaySub,
    locations,
    activeLocationId,
    activeLocation,
    setTab,
    setTodaySub,
    setActiveLocation,
    openLocation,
    addLocation,
    removeLocation,
  };

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): NavState {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used within <NavProvider>');
  return ctx;
}
