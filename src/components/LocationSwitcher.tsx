/**
 * Location switcher — bottom-sheet list of saved locations + search/add + "use
 * my location". Opened from the location pill in Today views.
 *
 * Search uses Open-Meteo geocoding (keyless, global coverage).
 * Geolocate uses navigator.geolocation + BigDataCloud reverse-geocode (keyless).
 * New locations are added to nav context (localStorage-persisted) and trigger
 * an edge-side row creation on first weather fetch.
 */

import { useEffect, useRef, useState } from 'react';
import { useNav } from '@/app/navigation';
import type { Location } from '@/types/weather';
import { getCurrentLocation, searchPlaces } from '@/services/geocode';

export function LocationSwitcher({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { locations, activeLocationId, setActiveLocation, addLocation, removeLocation } = useNav();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Location[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search.
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(() => {
      searchPlaces(query)
        .then((r) => { if (!cancelled) setResults(r); })
        .catch(() => { if (!cancelled) setResults([]); })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  // Reset state when re-opened.
  useEffect(() => {
    if (open) { setQuery(''); setResults([]); setEditing(false); inputRef.current?.focus(); }
  }, [open]);

  if (!open) return null;

  const handleAdd = (loc: Location) => {
    if (!locations.some((l) => l.id === loc.id)) addLocation(loc);
    setActiveLocation(loc.id);
    onClose();
  };

  const handleGeolocate = async () => {
    setLocating(true);
    try {
      const loc = await getCurrentLocation();
      if (loc) handleAdd(loc);
    } finally {
      setLocating(false);
    }
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Choose location">
      <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 flex max-h-[80%] flex-col rounded-t-2xl border-t border-[#1d2533] bg-[#0d1422] pb-[env(safe-area-inset-bottom)]">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#161f2c] px-4 py-3">
          <span className="font-mono text-[11px] font-semibold tracking-wide text-neutral-400">LOCATIONS</span>
          <div className="flex items-center gap-3">
            <button
              className="text-xs text-neutral-400 hover:text-neutral-200"
              onClick={() => setEditing((e) => !e)}
            >
              {editing ? 'Done' : 'Edit'}
            </button>
            <button className="text-xs text-neutral-400 hover:text-neutral-200" onClick={onClose}>Close</button>
          </div>
        </div>

        {/* Search */}
        <div className="flex shrink-0 items-center gap-2 border-b border-[#161f2c] px-3 py-2">
          <SearchIcon />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search city or town…"
            // 16px font is the threshold iOS Safari uses to decide whether to
            // auto-zoom on focus. Keep it ≥16 to prevent the zoom jump.
            className="min-w-0 flex-1 bg-transparent text-[16px] text-neutral-100 placeholder:text-neutral-500 focus:outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-neutral-200 hover:bg-white/[0.1] disabled:opacity-50"
            onClick={handleGeolocate}
            disabled={locating}
            title="Use my location"
          >
            <LocateIcon spinning={locating} />
            <span>{locating ? '…' : 'My location'}</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Search results */}
          {query.trim() && (
            <div className="px-2 py-2">
              <div className="px-2 pb-1 font-mono text-[10px] tracking-wider text-neutral-500">
                {searching ? 'SEARCHING…' : results.length ? 'RESULTS' : 'NO MATCH'}
              </div>
              <ul>
                {results.map((r) => (
                  <li key={r.id}>
                    <button
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left hover:bg-white/[0.03]"
                      onClick={() => handleAdd(r)}
                    >
                      <span className="flex flex-col">
                        <span className="text-[14px] font-medium text-neutral-100">{r.name}</span>
                        <span className="text-[11px] text-neutral-500">{r.region} · {r.country}</span>
                      </span>
                      <span className="text-[11px] text-sky-400">Add</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Saved list (hidden during active search) */}
          {!query.trim() && (
            <ul className="p-2">
              {locations.map((loc) => {
                const active = loc.id === activeLocationId;
                return (
                  <li key={loc.id}>
                    <div className={`flex items-center justify-between rounded-xl px-3 py-3 ${active ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'}`}>
                      <button
                        className="flex flex-1 flex-col items-start text-left"
                        onClick={() => { setActiveLocation(loc.id); onClose(); }}
                      >
                        <span className="text-[15px] font-medium text-neutral-100">{loc.name}</span>
                        <span className="text-[11px] text-neutral-500">{loc.region}</span>
                      </button>
                      {editing && locations.length > 1 ? (
                        <button
                          className="ml-2 rounded-full p-1.5 text-rose-400 hover:bg-rose-500/10"
                          onClick={() => removeLocation(loc.id)}
                          aria-label={`Remove ${loc.name}`}
                        >
                          <RemoveIcon />
                        </button>
                      ) : active ? (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-sky-400">
                          <path d="M3 8.5l3.5 3.5L13 4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="shrink-0 text-neutral-500">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}
function LocateIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={spinning ? 'animate-spin' : ''}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}
function RemoveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 6l12 12M6 18L18 6" />
    </svg>
  );
}
