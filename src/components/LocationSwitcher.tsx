/**
 * Location switcher — a bottom-sheet list of saved locations. Opened from the
 * location pill in Today views. Selecting one sets it active and closes.
 * Search/add wiring (Open-Meteo geocoding) is a follow-up; this covers switching
 * between saved locations.
 */

import { useNav } from '@/app/navigation';

export function LocationSwitcher({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { locations, activeLocationId, setActiveLocation } = useNav();
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Choose location">
      <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 max-h-[70%] overflow-y-auto rounded-t-2xl border-t border-[#1d2533] bg-[#0d1422] pb-[env(safe-area-inset-bottom)]">
        <div className="sticky top-0 flex items-center justify-between border-b border-[#161f2c] bg-[#0d1422] px-4 py-3">
          <span className="font-mono text-[11px] font-semibold tracking-wide text-neutral-400">LOCATIONS</span>
          <button className="text-xs text-neutral-400" onClick={onClose}>
            Done
          </button>
        </div>
        <ul className="p-2">
          {locations.map((loc) => {
            const active = loc.id === activeLocationId;
            return (
              <li key={loc.id}>
                <button
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left ${
                    active ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                  }`}
                  onClick={() => {
                    setActiveLocation(loc.id);
                    onClose();
                  }}
                >
                  <span className="flex flex-col">
                    <span className="text-[15px] font-medium text-neutral-100">{loc.name}</span>
                    <span className="text-[11px] text-neutral-500">{loc.region}</span>
                  </span>
                  {active && (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-sky-400">
                      <path d="M3 8.5l3.5 3.5L13 4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
