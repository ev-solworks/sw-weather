/**
 * Home — dashboard of saved locations (VIEWS.md §A). Each card shows that
 * location's current conditions over its condition backdrop; the first card is
 * "featured" (taller, with an inline 6-hour strip). Tap a card → Today/Visual.
 *
 * Each card fetches via useWeather (cached per location, so revisits are instant).
 * Times render in each location's own timezone.
 */

import type { Location, WeatherConditions } from '@/types/weather';
import { useNav } from '@/app/navigation';
import { useWeather } from '@/hooks/useWeather';
import { useInView } from '@/hooks/useInView';
import { WeatherBackdrop } from '@/components/WeatherBackdrop';
import { WxIcon } from '@/components/WxIcon';
import { fmtTime, localHour } from '@/utils/format';

function greeting(hour: number): string {
  if (hour < 5) return 'Late night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function HomeView() {
  const { locations, openLocation } = useNav();
  const now = new Date();
  const greet = greeting(now.getHours());
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="flex h-full w-full flex-col bg-[#0a0f1c] text-neutral-200">
      <div
        className="flex shrink-0 items-start justify-between px-4 pb-1.5"
        style={{ paddingTop: `calc(env(safe-area-inset-top, 0px) + 12px)` }}
      >
        <div>
          <div className="text-[22px] font-semibold tracking-tight text-neutral-50">{greet}</div>
          <div className="mt-0.5 text-xs text-neutral-500">{dateStr}</div>
        </div>
        <div className="flex gap-2">
          <IconButton label="Search">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="7" cy="7" r="5" />
              <path d="M11 11l3 3" strokeLinecap="round" />
            </svg>
          </IconButton>
          <IconButton label="Add location">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M8 3v10M3 8h10" />
            </svg>
          </IconButton>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-3 pb-4 pt-1">
        {locations.map((loc, i) => (
          <LocationCard key={loc.id} location={loc} featured={i === 0} onOpen={() => openLocation(loc.id)} />
        ))}
        <div className="flex items-center justify-center gap-2 pb-1 pt-3 font-mono text-[11px] text-neutral-600">
          <span>{locations.length} locations</span>
          <span className="text-neutral-700">·</span>
          <span>Edit</span>
        </div>
      </div>
    </div>
  );
}

function IconButton({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-[#1d2533] bg-[#131c2a] text-neutral-300"
    >
      {children}
    </button>
  );
}

function LocationCard({ location, featured, onOpen }: { location: Location; featured: boolean; onOpen: () => void }) {
  const [ref, inView] = useInView<HTMLButtonElement>('300px');
  // Featured card is always on screen → fetch immediately; others wait until near.
  const { data, loading, error } = useWeather(location, featured || inView);

  return (
    <button
      ref={ref}
      onClick={onOpen}
      className={`relative w-full overflow-hidden rounded-2xl border border-white/5 text-left shadow-[0_8px_24px_rgba(0,0,0,.35)] ${
        featured ? 'h-[196px]' : 'h-[108px]'
      }`}
    >
      {data ? <CardContent weather={data} featured={featured} /> : <CardSkeleton location={location} loading={loading} error={error} />}
    </button>
  );
}

function CardContent({ weather, featured }: { weather: WeatherConditions; featured: boolean }) {
  const { location, current, hours, days } = weather;
  const tz = location.timezone;
  const hour = localHour(current.observedAt, tz);
  const today = days[0];

  // next 6 hours after the nearest-to-now hour
  const nowMs = Date.now();
  let startIdx = hours.findIndex((h) => h.time.getTime() >= nowMs);
  if (startIdx < 0) startIdx = 0;
  const next6 = hours.slice(startIdx, startIdx + 6);

  return (
    <>
      <WeatherBackdrop desc={current.description} hour={hour} />
      <div className="relative z-10 flex h-full flex-col justify-between p-4 text-neutral-50">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-lg font-semibold tracking-tight">
              <span>{location.name}</span>
            </div>
            <div className="mt-0.5 font-mono text-[11px] tabular-nums text-white/65">
              {fmtTime(new Date(), tz)}
              <span className="mx-1.5 text-white/30">·</span>
              <span className="text-white/60">{location.region}</span>
            </div>
          </div>
          <div className="text-[52px] font-extralight leading-[0.9] tracking-[-2px] tabular-nums">
            {current.temperature}
            <span className="font-thin text-white/55">°</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <WxIcon desc={current.description} size={16} color="#fafafa" strokeWidth={1.4} night={current.isNight} />
            <span className="text-[13px] font-medium">{current.description}</span>
          </div>
          {today && (
            <div className="flex gap-1.5 font-mono text-[11px] tabular-nums text-white/70">
              <span>H {today.tempHi}°</span>
              <span className="text-white/30">·</span>
              <span>L {today.tempLo}°</span>
            </div>
          )}
        </div>

        {featured && next6.length > 0 && (
          <div className="mt-2 grid grid-cols-6 rounded-xl bg-black/30 px-2 py-1.5 backdrop-blur">
            {next6.map((h) => (
              <div key={h.time.getTime()} className="flex flex-col items-center gap-0.5 font-mono">
                <span className="text-[10px] tabular-nums text-white/55">{fmtTime(h.time, tz).slice(0, 2)}</span>
                <span className="text-[13px] font-medium tabular-nums">{h.temperature}°</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function CardSkeleton({ location, loading, error }: { location: Location; loading: boolean; error: string | null }) {
  return (
    <div className="relative z-10 flex h-full flex-col justify-between bg-[#101826] p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-lg font-semibold text-neutral-100">{location.name}</div>
          <div className="mt-0.5 text-[11px] text-neutral-500">{location.region}</div>
        </div>
        {loading && <div className="h-3 w-3 animate-pulse rounded-full bg-neutral-600" />}
      </div>
      <div className="text-[11px] text-neutral-500">{error ? 'Unavailable' : 'Loading…'}</div>
    </div>
  );
}
