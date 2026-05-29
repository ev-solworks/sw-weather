/**
 * Bottom tab bar — Home · Today · Week · Map · More (VIEWS.md). Map/More are
 * placeholders (disabled). Active = filled-ish icon + bright label; inactive =
 * stroke icon + dim label. Reads/writes nav via context.
 */

import type { Tab } from '@/app/navigation';
import { useNav } from '@/app/navigation';

interface TabDef {
  key: Tab;
  label: string;
  icon: (active: boolean) => React.ReactNode;
  enabled: boolean;
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const TABS: TabDef[] = [
  {
    key: 'home',
    label: 'Home',
    enabled: true,
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" {...stroke} fill={a ? 'currentColor' : 'none'} fillOpacity={a ? 0.15 : 0}>
        <path d="M3 11l9-7 9 7" />
        <path d="M5 10v9a1 1 0 001 1h12a1 1 0 001-1v-9" />
      </svg>
    ),
  },
  {
    key: 'today',
    label: 'Today',
    enabled: true,
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" {...stroke} fill={a ? 'currentColor' : 'none'} fillOpacity={a ? 0.15 : 0}>
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
      </svg>
    ),
  },
  {
    key: 'week',
    label: 'Week',
    enabled: true,
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" {...stroke} fill={a ? 'currentColor' : 'none'} fillOpacity={a ? 0.15 : 0}>
        <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
        <path d="M3 9h18M8 2.5v4M16 2.5v4" />
      </svg>
    ),
  },
  {
    key: 'map',
    label: 'Wind',
    enabled: true,
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" {...stroke} fill={a ? 'currentColor' : 'none'} fillOpacity={a ? 0.15 : 0}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
        <path d="M12 12 L15 6" strokeWidth="2" />
      </svg>
    ),
  },
  {
    key: 'more',
    label: 'More',
    enabled: false,
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
        <circle cx="5" cy="12" r="1.4" fill="currentColor" />
        <circle cx="12" cy="12" r="1.4" fill="currentColor" />
        <circle cx="19" cy="12" r="1.4" fill="currentColor" />
      </svg>
    ),
  },
];

export function TabBar() {
  const { tab, setTab } = useNav();
  return (
    <nav
      className="relative flex shrink-0 items-stretch border-t border-[#1a2533] bg-[#0a0f1c]"
      style={{ paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + 8px)` }}
      aria-label="Primary"
    >
      {TABS.map((t) => {
        const active = tab === t.key;
        return (
          <button
            key={t.key}
            type="button"
            disabled={!t.enabled}
            onClick={() => t.enabled && setTab(t.key)}
            aria-current={active ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[10px] font-medium transition-colors ${
              active ? 'text-neutral-50' : t.enabled ? 'text-neutral-500' : 'text-neutral-700'
            }`}
          >
            {t.icon(active)}
            <span className="tracking-wide">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
