# Architecture

## Recommended stack

- **React 18 + TypeScript**
- **Vite** for standalone; whatever SW Client uses for embedded
- **Open-Meteo** for forecasts:
  - `https://api.open-meteo.com/v1/forecast` — hourly temp / wind / cloud /
    UV / precipitation
  - `https://marine-api.open-meteo.com/v1/marine` — wave height / period /
    direction
  - `https://api.sunrise-sunset.org/json` or compute locally with `suncalc` —
    sunrise/sunset/dawn/dusk/golden-hour phases
- **No state-management library** needed — `useState` + a small `LocationsContext`
  is enough. Reach for Zustand or Jotai only if `SW Client` already standardises
  on one.
- **No animation library** — every motion effect is CSS keyframes. See the
  `<style id="wx-bg-styles">` block in `design/weather-backdrop.jsx`.

## Project structure (proposed)

```
sw-weather/
├── package.json
├── tsconfig.json
├── vite.config.ts                     # standalone only
├── src/
│   ├── main.tsx                       # standalone bootstrap
│   ├── App.tsx                        # standalone shell — owns tab bar
│   ├── module.tsx                     # SW Client entry — exports <WeatherModule/>
│   │
│   ├── views/
│   │   ├── HomeView.tsx
│   │   ├── TodayVisual.tsx
│   │   ├── TodayWindguru.tsx
│   │   ├── TodayGraph.tsx
│   │   ├── TodaySun.tsx
│   │   └── WeekView.tsx
│   │
│   ├── components/
│   │   ├── WeatherBackdrop/           # split per-condition into files
│   │   │   ├── RainLayer.tsx
│   │   │   ├── SnowLayer.tsx
│   │   │   ├── CloudLayer.tsx
│   │   │   ├── ClearLayer.tsx
│   │   │   ├── PartlyLayer.tsx
│   │   │   ├── FogLayer.tsx
│   │   │   └── index.tsx
│   │   ├── WxIcon.tsx
│   │   ├── CompassRosette.tsx
│   │   ├── SunArc.tsx                 # the compact one in TodayVisual
│   │   ├── TabBar.tsx
│   │   └── shared/                    # chips, tiles, cells, etc.
│   │
│   ├── data/
│   │   ├── openMeteo.ts               # fetcher + zod parsing
│   │   ├── marine.ts
│   │   ├── sun.ts                     # suncalc adapter
│   │   ├── types.ts                   # HourForecast, DayForecast, Location, SunPhases
│   │   └── conditions.ts              # description-string normalizer + palette/icon map
│   │
│   ├── scales/                        # COLOR SCALES (CRITICAL — see DESIGN_TOKENS.md)
│   │   ├── wgScales.ts                # wind, temp, rain, cloud, UV, wave, period
│   │   └── wxPalette.ts               # backdrop palettes per condition
│   │
│   ├── styles/
│   │   ├── tokens.css                 # CSS vars from DESIGN_TOKENS.md
│   │   ├── motion.css                 # all @keyframes from weather-backdrop.jsx
│   │   └── reset.css
│   │
│   └── hooks/
│       ├── useForecast.ts
│       ├── useLocation.ts
│       └── useNow.ts                  # ticks every 60s for now-marker movement
└── public/
    └── icons, manifest, etc.
```

## Data flow

```
User opens app
  → useLocation() reads browser geolocation OR persisted "saved location"
  → useForecast(loc) fetches Open-Meteo + Marine in parallel
  → returns normalized { hours: HourForecast[], days: DayForecast[],
                         sun: SunPhases, moon: MoonInfo }
  → views consume the slice they need
```

### Canonical types (TypeScript)

```ts
type HourForecast = {
  time: Date;                 // hour-aligned
  temperature: number;        // °C
  feelsLike: number;
  humidity: number;           // 0–100
  windSpeed: number;          // km/h
  windDirection: number;      // degrees, 0 = from north
  windGust: number;           // km/h
  precipProbability: number;  // 0–100
  precipAmount: number;       // mm in this hour
  uvIndex: number;            // 0–11+
  cloudCover: number;         // 0–100
  description: ConditionCode; // see conditions.ts
  waveHeight: number;         // m
  wavePeriod: number;         // s
  waveDirection: number;      // degrees
};

type ConditionCode =
  | 'Clear' | 'Mostly clear' | 'Partly cloudy' | 'Cloudy'
  | 'Light rain' | 'Rain' | 'Heavy rain' | 'Thunder'
  | 'Snow' | 'Fog' | 'Sunny' | 'Mostly sunny';

type DayForecast = {
  date: Date;
  dayName: string;            // 'Today' | 'Mon' | ...
  tempHi: number;
  tempLo: number;
  tempCurrent: number | null; // only today
  description: ConditionCode;
  rainProbability: number;
  rainAmount: number;         // mm total for the day
  windAvg: number;
  windGust: number;
  windDirection: number;
  waveHeight: number;
  wavePeriod: number;
  uvMax: number;
  sunrise: Date;
  sunset: Date;
};

type SunPhases = {
  astroDawn: Date;
  nauticalDawn: Date;
  civilDawn: Date;
  sunrise: Date;
  goldenEnd: Date;            // morning golden hour ends
  solarNoon: Date;
  goldenStart: Date;          // evening golden hour starts
  sunset: Date;
  civilDusk: Date;
  nauticalDusk: Date;
  astroDusk: Date;
  yesterdayLengthMs: number;
  tomorrowLengthMs: number;
};

type MoonInfo = {
  phase: 'New' | 'Waxing crescent' | 'First quarter' | 'Waxing gibbous'
       | 'Full' | 'Waning gibbous' | 'Last quarter' | 'Waning crescent';
  phaseFraction: number;      // 0..1
  illumination: number;       // 0..100
  moonrise: Date | null;
  moonset: Date | null;
};

type Location = {
  id: string;
  name: string;
  region: string;
  lat: number;
  lon: number;
  timezone: string;
};
```

## Open-Meteo → ConditionCode mapping

Open-Meteo returns numeric WMO codes; the design references string codes.
Mapping (drop into `data/conditions.ts`):

```ts
const WMO: Record<number, ConditionCode> = {
  0: 'Clear',
  1: 'Mostly clear',
  2: 'Partly cloudy',
  3: 'Cloudy',
  45: 'Fog', 48: 'Fog',
  51: 'Light rain', 53: 'Light rain', 55: 'Light rain',
  56: 'Light rain', 57: 'Light rain',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  66: 'Light rain', 67: 'Rain',
  71: 'Snow', 73: 'Snow', 75: 'Snow', 77: 'Snow',
  80: 'Light rain', 81: 'Rain', 82: 'Heavy rain',
  85: 'Snow', 86: 'Snow',
  95: 'Thunder', 96: 'Thunder', 99: 'Thunder',
};
```

For sunny/mostly-sunny variants, use Clear/Mostly clear during daytime and
add a `night` flag separately if you need to swap icons or palette.

## Performance notes

- Motion backdrops use **CSS `transform` + `opacity`** only, no JS animation
  loop. Keep that — it lets 6+ Home cards animate at once on mobile.
- The Windguru table renders ~12 rows × 48 columns = 576 cells. Keep them as
  plain DOM (no virtualization needed at this size on modern devices) but
  memoize each `<Cell>` so re-renders on `now` ticking are cheap.
- Graph mode draws ~6 SVG panels. SVG is fine here — no canvas. Memoize each
  panel's `<path>` strings against `hours` reference equality.

## Accessibility checklist (do these before ship)

- [ ] Verify contrast: the dim "·" placeholders in Windguru cells need
      ≥3:1 against `#0a0f1c` background — they currently sit at borderline.
- [ ] All icons have `aria-label`s; bare SVGs need `role="img"` or
      `aria-hidden`.
- [ ] Tab bar items keyboard-navigable; current tab is `aria-current="page"`.
- [ ] Color is never the only signal — every data cell pairs a colour with a
      number (already true in the design).
- [ ] Respect `prefers-reduced-motion`: gate every `wx*` keyframe behind it.
      Suggested rule:
      ```css
      @media (prefers-reduced-motion: reduce) {
        .wx-rain-line, .wx-snow-dot, .wx-cloud-blob, .wx-fog-band { animation: none !important; }
      }
      ```
- [ ] Mono numerics on a screen reader: prefer `<span aria-label="14 degrees">14°</span>`
      over rendering the degree sign in a separate node.
