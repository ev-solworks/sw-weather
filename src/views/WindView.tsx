/**
 * Wind — live measured wind stations (Map tab). 2×3 grid of station cards, each a
 * Sweep rosette around a centered speed readout (knots default, km/h toggle).
 * Tap a card → bottom-sheet detail with the current reading + a wind/gust graph
 * over 1h / 6h / 12h / 24h. Data from the OceanDrivers network via the proxy.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { WindHistoryPoint } from '@/types/weather';
import {
  fetchStationDetail,
  fetchStations,
  loadWindUnit,
  saveWindUnit,
  toUnit,
  unitLabel,
  type Station,
  type StationMeta,
  type StationReading,
  type WindUnit,
} from '@/services/stations';
import { WindRosette, windColor } from '@/components/WindRosette';
import { WindHistoryChart } from '@/components/WindHistoryChart';

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const compass = (d: number) => COMPASS[Math.round((d % 360) / 22.5) % 16];

export function WindView() {
  const [stations, setStations] = useState<Station[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unit, setUnit] = useState<WindUnit>(loadWindUnit);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchStations()
      .then((s) => alive && setStations(s))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'failed'));
    return () => {
      alive = false;
    };
  }, []);

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
      <div className="px-4 pb-2 text-[12px] text-neutral-500">
        Bay of Palma · {stations?.length ?? '…'} stations · measured
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {error && !stations && <Centered>Couldn’t load stations — {error}</Centered>}
        {!stations && !error && <Centered>Loading stations…</Centered>}
        {stations && (
          <div className="grid grid-cols-2 gap-2.5">
            {stations.map((s) => (
              <StationCard key={s.id} station={s} unit={unit} onOpen={() => setOpenId(s.id)} />
            ))}
          </div>
        )}
      </div>

      {openId && <StationDetail id={openId} unit={unit} onClose={() => setOpenId(null)} />}
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

function StationCard({ station, unit, onOpen }: { station: Station; unit: WindUnit; onOpen: () => void }) {
  const r = station.reading;
  const online = !!r?.online;
  const col = online ? windColor(r!.windKt) : '#5a6480';
  return (
    <button
      onClick={onOpen}
      className={`relative flex flex-col items-center rounded-2xl border border-[#1b2440] px-2.5 pb-3 pt-3.5 text-left transition-transform active:scale-[.98] ${
        online ? '' : 'opacity-50'
      }`}
      style={{ background: 'radial-gradient(130% 110% at 50% -10%, #13213c 0%, #0c1428 68%)' }}
    >
      <div className="text-center text-[12.5px] font-semibold tracking-tight text-neutral-50">{station.name}</div>
      <div className="mt-0.5 font-mono text-[8.5px] uppercase tracking-wide text-neutral-600">{station.place}</div>

      <div className="relative my-2.5 h-[132px] w-[132px]">
        <WindRosette dir={r?.dir ?? 0} windKt={r?.windKt ?? 0} online={online} />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-mono text-[40px] font-extralight leading-[.9] tracking-tight tabular-nums" style={{ color: col }}>
            {online ? toUnit(r!.windKt, unit) : '—'}
          </div>
          <div className="mt-1 font-mono text-[8.5px] font-semibold tracking-[1.5px] text-neutral-500">
            {online ? `${unitLabel(unit)} · ${compass(r!.dir)}` : 'OFFLINE'}
          </div>
          {online && <div className="mt-0.5 font-mono text-[9px] font-semibold tabular-nums text-neutral-500">{r!.dir}°</div>}
        </div>
      </div>

      <div className="mt-1 flex items-center gap-2 font-mono text-[11px] font-semibold tabular-nums">
        {online && r!.gustKt != null ? (
          <>
            <span className="text-[#7fd02a]">
              gust <b className="text-[#7fd02a]">{toUnit(r!.gustKt, unit)}</b>
            </span>
            <span className="h-[3px] w-[3px] rounded-full bg-[#1b2440]" />
            <span className="flex items-center gap-1 text-neutral-600">
              <span className="h-[5px] w-[5px] rounded-full bg-emerald-400 shadow-[0_0_5px_#34d399]" />
              {freshness(r!.observedAt)}
            </span>
          </>
        ) : (
          <span className="text-neutral-600">no signal</span>
        )}
      </div>
    </button>
  );
}

function StationDetail({ id, unit, onClose }: { id: string; unit: WindUnit; onClose: () => void }) {
  const [data, setData] = useState<{ station: StationMeta; reading: StationReading | null; hour: WindHistoryPoint[]; day: WindHistoryPoint[] } | null>(null);
  const [range, setRange] = useState<'1' | '6' | '12' | '24'>('1');

  useEffect(() => {
    let alive = true;
    setData(null);
    fetchStationDetail(id).then((d) => alive && setData(d)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [id]);

  // 1h = minute series; 6/12/24h = slices of the hourly (24h) series.
  const points = useMemo<WindHistoryPoint[]>(() => {
    if (!data) return [];
    if (range === '1') return data.hour;
    const hours = Number(range);
    return data.day.slice(Math.max(0, data.day.length - hours));
  }, [data, range]);

  // Convert knots → display unit for the chart.
  const dispPoints = useMemo<WindHistoryPoint[]>(
    () => points.map((p) => ({ ...p, windSpeed: toUnit(p.windSpeed, unit), windGust: p.windGust != null ? toUnit(p.windGust, unit) : null })),
    [points, unit],
  );

  const r = data?.reading;
  const online = !!r?.online;
  const col = online ? windColor(r!.windKt) : '#8a93a8';

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end" role="dialog" aria-modal="true">
      <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 max-h-[80%] overflow-y-auto rounded-t-2xl border-t border-[#1b2440] bg-[#0d1422] pb-[env(safe-area-inset-bottom)]">
        <div className="sticky top-0 flex items-center justify-between border-b border-[#161f2e] bg-[#0d1422] px-[18px] py-3.5">
          <div>
            <div className="text-[17px] font-semibold text-neutral-50">{data?.station.name ?? '…'}</div>
            <div className="mt-0.5 font-mono text-[11px] uppercase tracking-wide text-neutral-500">{data?.station.place ?? ''}</div>
          </div>
          <button className="text-xs text-neutral-400" onClick={onClose}>
            Done
          </button>
        </div>

        <div className="flex items-center gap-[18px] px-[18px] pb-2 pt-4">
          <div className="font-mono text-[46px] font-extralight leading-none tabular-nums" style={{ color: col }}>
            {online ? toUnit(r!.windKt, unit) : '—'}
          </div>
          <div className="flex flex-col gap-[3px] font-mono text-[11px] font-semibold text-neutral-500">
            <span>
              {unitLabel(unit)} <b className="text-neutral-50">{online ? `${compass(r!.dir)} ${r!.dir}°` : '—'}</b>
            </span>
            <span className="text-[#7fd02a]">gust <b className="text-[#7fd02a]">{online && r!.gustKt != null ? `${toUnit(r!.gustKt, unit)} ${unitLabel(unit).toLowerCase()}` : '—'}</b></span>
            <span>updated <b className="text-neutral-50">{freshness(r?.observedAt ?? null)}</b></span>
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
          {!data ? (
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

function freshness(d: Date | null): string {
  if (!d) return '—';
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins <= 0) return 'now';
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h`;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[50svh] items-center justify-center px-6 text-center text-sm text-neutral-500">{children}</div>;
}
