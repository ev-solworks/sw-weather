# Integration: Standalone vs. SW Client

Two delivery surfaces. They share **the same view code**, the same data
layer, and the same tokens — they differ only in shell.

---

## 1 · Standalone app

A self-contained mobile-web app (suitable for shipping as a PWA, or wrapping
with Capacitor for native). It owns:

- Geolocation acquisition + saved-locations management
- Theme = always dark navy (no light mode in this iteration)
- Top-level routing: `/` (Home) `/today/:location` `/week/:location` etc
- Tab bar (Home · Today · Week · Map · More)

**Entry point**: `src/main.tsx` mounts `<App/>` into `#root`. `App` owns
the router and the tab bar.

---

## 2 · Embedded module (inside SW Client)

The default embedded integration is the **full app** — every view, just
hosted in whatever shell SW Client provides. The host decides how it
appears in the main nav.

**Entry point**: `src/module.tsx` exports a top-level component:

```tsx
export default function WeatherModule(props: WeatherModuleProps) { … }

type WeatherModuleProps = {
  /** What to show. Default: 'full' (renders the same UX as standalone) */
  surface?: 'full' | 'card' | 'compact';

  /** If omitted, module uses its own geolocation flow. */
  location?: { lat: number; lon: number; name: string; region: string };

  /** Whether to render the tab bar. `false` if host has its own nav. */
  showTabBar?: boolean;

  /** Light/dark — currently only 'dark' is supported. */
  appearance?: 'dark';

  /** Callback fired when user opens a location detail (host can route). */
  onOpenLocation?: (id: string) => void;
};
```

### `surface='full'` (default)
Same UX as standalone but renders without `<Router>` — host owns routing.
Internal navigation is managed via a context (`<WeatherModuleProvider>`).

### `surface='card'`
A single compact card suitable for dashboard embeds. Renders just the
visual hero zone of `Today · Visual` — motion backdrop + condition icon +
temperature + condition name + hi/lo line. ~280px tall, fluid width.
No tab bar, no scroll.

### `surface='compact'`
A list-item-style strip — one row showing icon, temp, condition, hi/lo,
and a small "More →" affordance. ~64px tall. Suitable for SW Client's
dashboard "current snapshot" rows.

---

## 3 · Build artefacts

Two outputs from the same source tree:

```
sw-weather/
├── dist/standalone/      # Vite build, deployable as a PWA
│   ├── index.html
│   ├── assets/*
│   └── manifest.webmanifest
└── dist/module/          # Library build, consumable by SW Client
    ├── index.es.js
    ├── index.d.ts
    └── styles.css
```

Module build config (sketch): library mode, `react` + `react-dom`
externalised, CSS extracted to a single file the host can import once.

---

## 4 · What the host (SW Client) is responsible for

- Mounting `<WeatherModule/>` somewhere in its layout
- Passing a `location` (if it has one) or letting the module ask for it
- Providing routing if `showTabBar=false`
- (Future) Providing a shared theme context if SW Client unifies
  appearance across modules

## 5 · What the module is responsible for

- Fetching its own weather data
- Caching its own forecasts (recommended: 10 min for hourly, 60 min for daily)
- Persisting its own saved-locations (in `localStorage` keyed by
  `sw.weather.locations` — namespace, so SW Client can clear it if needed)

---

## 6 · Theming hooks (forward-looking)

For now, the design is dark-only. If SW Client introduces a light theme:
- Every value in `DESIGN_TOKENS.md` becomes a CSS variable
- A second token file `tokens-light.css` is added later
- The Windguru cell rainbow stays the same in both themes; only the shell
  changes (text colours, border colours, empty-cell bg)

Resist the urge to ship a light theme in this iteration — the rainbow
cells need a dark backdrop to read cleanly, and the user explicitly
preferred the dark-navy shell.
