/**
 * Wind — live measured wind stations (Wind tab). 2-col grid of Sweep-rosette
 * cards. Registry comes from the proxy; live readings are polled DIRECTLY from
 * OceanDrivers every ~4s for genuine real-time. Tap a card → detail sheet with a
 * wind/gust graph over 1h/6h/12h/24h. knots default + km/h toggle (persisted).
 *
 * Card layout: wind speed big & centered; gust as a smaller number just below it
 * (inside the rosette); direction (degrees + compass letter) outside, below the ring.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { WindHistoryPoint } from '@/types/weather';
import {
  applyOrder,
  fetchLiveDirect,
  fetchStationHistory,
  fetchStationRegistry,
  fmtSpeed,
  splitSpeed,
  loadWindUnit,
  saveOrder,
  saveWindUnit,
  toUnit,
  unitLabel,
  type StationMeta,
  type StationReading,
  type WindUnit,
} from '@/services/stations';
import { WindRosette, windColor } from '@/components/WindRosette';
import { WindHistoryChart } from '@/components/WindHistoryChart';

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const compass = (d: number) => COMPASS[Math.round((d % 360) / 22.5) % 16];
const LIVE_POLL_MS = 4000;

export function WindView() {
  const [registry, setRegistry] = useState<StationMeta[] | null>(null);
  const [readings, setReadings] = useState<Record<string, StationReading | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [unit, setUnit] = useState<WindUnit>(loadWindUnit);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  // Load registry once, applying the user's saved order.
  useEffect(() => {
    let alive = true;
    fetchStationRegistry()
      .then((r) => alive && setRegistry(applyOrder(r)))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'failed'));
    return () => {
      alive = false;
    };
  }, []);

  // Move a card up/down in edit mode; persist the new order.
  const move = useCallback((id: string, dir: -1 | 1) => {
    setRegistry((prev) => {
      if (!prev) return prev;
      const i = prev.findIndex((m) => m.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      saveOrder(next.map((m) => m.id));
      return next;
    });
  }, []);

  // Poll live readings direct from source, real-time. Pause when tab hidden.
  useEffect(() => {
    if (!registry || registry.length === 0) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (document.hidden) {
        timer = setTimeout(tick, LIVE_POLL_MS);
        return;
      }
      // Fire all in parallel but apply each as it lands → grid fills progressively,
      // fast stations don't wait on slow ones.
      await Promise.all(
        registry.map(async (m) => {
          const reading = await fetchLiveDirect(m);
          if (alive) setReadings((prev) => ({ ...prev, [m.id]: reading }));
        }),
      );
      if (alive) timer = setTimeout(tick, LIVE_POLL_MS);
    };
    void tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [registry]);

  const setUnitPersist = useCallback((u: WindUnit) => {
    setUnit(u);
    saveWindUnit(u);
  }, []);

  return (
    <div className="flex h-full w-full flex-col bg-[#0a0f1c] text-neutral-200">
      <div className="flex shrink-0 items-center justify-between px-4 pb-1 pt-3">
        <div className="flex items-center gap-2 text-[15px] font-semibold text-neutral-50">
          Live Wind
          <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-wider text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            LIVE
          </span>
        </div>
        <UnitToggle unit={unit} onChange={setUnitPersist} />
      </div>
      <div className="flex items-center justify-between px-4 pb-2">
        <span className="text-[12px] text-neutral-500">Bay of Palma · {registry?.length ?? '…'} stations · measured</span>
        {registry && registry.length > 1 && (
          <button
            onClick={() => setEditing((e) => !e)}
            className={`font-mono text-[11px] font-semibold ${editing ? 'text-emerald-400' : 'text-neutral-500'}`}
          >
            {editing ? 'Done' : 'Edit'}
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {error && !registry && <Centered>Couldn’t load stations — {error}</Centered>}
        {!registry && !error && <Centered>Loading stations…</Centered>}
        {registry && (
          <div className="grid grid-cols-2 gap-2.5">
            {registry.map((m, i) => (
              <StationCard
                key={m.id}
                meta={m}
                reading={readings[m.id] ?? null}
                unit={unit}
                onOpen={() => setOpenId(m.id)}
                editing={editing}
                canUp={i > 0}
                canDown={i < registry.length - 1}
                onMove={(dir) => move(m.id, dir)}
              />
            ))}
          </div>
        )}
      </div>

      {openId && (
        <StationDetail
          meta={registry?.find((m) => m.id === openId) ?? null}
          reading={readings[openId] ?? null}
          unit={unit}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

/**
 * Hero wind number. Integer part big (tabular so it doesn't jiggle as it ticks);
 * the .x rendered small and pulled in tight to kill the wide mono decimal gap.
 */
function WindNumber({ kt, unit, color, big = 42 }: { kt: number; unit: WindUnit; color: string; big?: number }) {
  const { int, dec } = splitSpeed(kt, unit);
  return (
    <div className="flex items-baseline font-mono font-extralight leading-[.85]" style={{ color }}>
      <span className="tabular-nums" style={{ fontSize: big, letterSpacing: '-0.04em' }}>{int}</span>
      {dec != null && (
        <span className="tabular-nums font-light" style={{ fontSize: big * 0.5, marginLeft: '-0.04em' }}>.{dec}</span>
      )}
    </div>
  );
}

function UnitToggle({ unit, onChange }: { unit: WindUnit; onChange: (u: WindUnit) => void }) {
  return (
    <div className="flex overflow-hidden rounded-full border border-[#1b2440] font-mono text-[11px] font-semibold">
      {(['kt', 'kmh'] as const).map((u) => (
        <button
          key={u}
          onClick={() => onChange(u)}
          className={`px-3 py-1.5 ${unit === u ? 'bg-emerald-500/15 text-emerald-400' : 'bg-[#0c1428] text-neutral-500'}`}
        >
          {u === 'kt' ? 'knots' : 'km/h'}
        </button>
      ))}
    </div>
  );
}

function StationCard({
  meta, reading, unit, onOpen, editing, canUp, canDown, onMove,
}: {
  meta: StationMeta; reading: StationReading | null; unit: WindUnit; onOpen: () => void;
  editing: boolean; canUp: boolean; canDown: boolean; onMove: (dir: -1 | 1) => void;
}) {
  const online = !!reading?.online;
  const loading = reading === null;
  const col = online ? windColor(reading!.windKt) : '#5a6480';
  return (
    <button
      onClick={() => !editing && onOpen()}
      className={`relative flex flex-col items-center rounded-2xl border px-2.5 pb-2.5 pt-3.5 text-left transition-transform active:scale-[.98] ${
        editing ? 'border-emerald-500/30' : 'border-[#1b2440]'
      } ${online || loading ? '' : 'opacity-50'}`}
      style={{ background: 'radial-gradient(130% 110% at 50% -10%, #13213c 0%, #0c1428 68%)' }}
    >
      {editing && (
        <div className="absolute inset-0 z-10 flex items-center justify-between rounded-2xl bg-[#0a0f1c]/70 px-3 backdrop-blur-[1px]">
          <MoveBtn dir={-1} disabled={!canUp} onClick={(e) => { e.stopPropagation(); onMove(-1); }} />
          <span className="font-mono text-[11px] font-semibold text-neutral-300">{meta.name}</span>
          <MoveBtn dir={1} disabled={!canDown} onClick={(e) => { e.stopPropagation(); onMove(1); }} />
        </div>
      )}
      <div className="text-center text-[12.5px] font-semibold tracking-tight text-neutral-50">{meta.name}</div>
      <div className="mt-0.5 font-mono text-[8.5px] uppercase tracking-wide text-neutral-600">{meta.place}</div>

      <div className="relative my-2 h-[150px] w-[150px]">
        <WindRosette dir={reading?.dir ?? 0} windKt={reading?.windKt ?? 0} online={online} size={150} />
        {/* center stack: wind (hero) + gust (smaller, below, inside) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {online ? (
            <WindNumber kt={reading!.windKt} unit={unit} color={col} />
          ) : (
            <div className="font-mono text-[42px] font-extralight leading-[.85] tracking-tight" style={{ color: col }}>
              {loading ? '·' : '—'}
            </div>
          )}
          {online && reading!.gustKt != null && (
            <div className="mt-1.5 font-mono text-[12px] font-semibold tabular-nums text-[#7fd02a]">
              <span className="text-[9px] font-medium text-neutral-500">G</span> {fmtSpeed(reading!.gustKt, unit)}
            </div>
          )}
          {!online && !loading && <div className="mt-1 font-mono text-[9px] tracking-widest text-neutral-600">OFFLINE</div>}
        </div>
      </div>

      {/* direction outside, below the ring: degrees + letter */}
      {online ? (
        <div className="flex items-baseline gap-1.5 font-mono tabular-nums">
          <span className="text-[15px] font-semibold text-neutral-100">{reading!.dir}°</span>
          <span className="text-[11px] font-medium text-neutral-500">{compass(reading!.dir)}</span>
        </div>
      ) : (
        <div className="font-mono text-[11px] text-neutral-600">{loading ? 'loading…' : 'no signal'}</div>
      )}
    </button>
  );
}

function StationDetail({ meta, reading, unit, onClose }: { meta: StationMeta | null; reading: StationReading | null; unit: WindUnit; onClose: () => void }) {
  const [hist, setHist] = useState<{ hour: WindHistoryPoint[]; day: WindHistoryPoint[] } | null>(null);
  const [range, setRange] = useState<'1' | '6' | '12' | '24'>('1');
  const liveReading = useRef(reading);
  liveReading.current = reading; // keep latest poll value for the header

  useEffect(() => {
    if (!meta) return;
    let alive = true;
    setHist(null);
    fetchStationHistory(meta.id).then((h) => alive && setHist(h)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [meta]);

  const points = useMemo<WindHistoryPoint[]>(() => {
    if (!hist) return [];
    if (range === '1') return hist.hour;
    return hist.day.slice(Math.max(0, hist.day.length - Number(range)));
  }, [hist, range]);

  const dispPoints = useMemo<WindHistoryPoint[]>(
    () => points.map((p) => ({ ...p, windSpeed: toUnit(p.windSpeed, unit), windGust: p.windGust != null ? toUnit(p.windGust, unit) : null })),
    [points, unit],
  );

  const online = !!reading?.online;
  const col = online ? windColor(reading!.windKt) : '#8a93a8';

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end" role="dialog" aria-modal="true">
      <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 max-h-[80%] overflow-y-auto rounded-t-2xl border-t border-[#1b2440] bg-[#0d1422] pb-[env(safe-area-inset-bottom)]">
        <div className="sticky top-0 flex items-center justify-between border-b border-[#161f2e] bg-[#0d1422] px-[18px] py-3.5">
          <div>
            <div className="text-[17px] font-semibold text-neutral-50">{meta?.name ?? '…'}</div>
            <div className="mt-0.5 font-mono text-[11px] uppercase tracking-wide text-neutral-500">{meta?.place ?? ''}</div>
          </div>
          <button className="text-xs text-neutral-400" onClick={onClose}>Done</button>
        </div>

        <div className="flex items-center gap-[18px] px-[18px] pb-2 pt-4">
          {online ? (
            <WindNumber kt={reading!.windKt} unit={unit} color={col} big={46} />
          ) : (
            <div className="font-mono text-[46px] font-extralight leading-none" style={{ color: col }}>—</div>
          )}
          <div className="flex flex-col gap-[3px] font-mono text-[11px] font-semibold text-neutral-500">
            <span>{unitLabel(unit)} <b className="text-neutral-50">{online ? `${compass(reading!.dir)} ${reading!.dir}°` : '—'}</b></span>
            <span className="text-[#7fd02a]">gust <b className="text-[#7fd02a]">{online && reading!.gustKt != null ? `${fmtSpeed(reading!.gustKt, unit)} ${unitLabel(unit).toLowerCase()}` : '—'}</b></span>
            <span className="flex items-center gap-1.5">live <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /></span>
          </div>
        </div>

        <div className="flex gap-1.5 px-[18px] pb-2.5 pt-1.5">
          {(['1', '6', '12', '24'] as const).map((rng) => (
            <button
              key={rng}
              onClick={() => setRange(rng)}
              className={`flex-1 rounded-full border py-1.5 font-mono text-[12px] font-semibold ${
                range === rng ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400' : 'border-[#1b2440] bg-[#0c1428] text-neutral-500'
              }`}
            >
              {rng}h
            </button>
          ))}
        </div>

        <div className="px-3.5 pt-1">
          {!hist ? (
            <div className="flex h-[150px] items-center justify-center text-[11px] text-neutral-600">Loading…</div>
          ) : (
            <WindHistoryChart points={dispPoints} tz={'Europe/Madrid'} height={150} />
          )}
        </div>
        <div className="flex justify-end gap-3.5 px-[18px] pt-1.5 font-mono text-[10px] text-neutral-500">
          <span className="text-emerald-400">━ wind</span>
          <span className="text-[#7fd02a]">┄ gust</span>
          <span className="text-neutral-600">{unitLabel(unit).toLowerCase()}</span>
        </div>
      </div>
    </div>
  );
}

function MoveBtn({ dir, disabled, onClick }: { dir: -1 | 1; disabled: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === -1 ? 'Move earlier' : 'Move later'}
      className={`flex h-9 w-9 items-center justify-center rounded-full border ${
        disabled ? 'border-[#1b2440] text-neutral-700' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 active:scale-90'
      }`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {dir === -1 ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
      </svg>
    </button>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[50svh] items-center justify-center px-6 text-center text-sm text-neutral-500">{children}</div>;
}
