# Handoff: SW Weather

A weather/marine-conditions app for the Solworks "SW" suite. Forecasts for a fixed
location (current default: Palma de Mallorca, Illes Balears) with a strong
emphasis on **watersports-relevant data** — wave height/period/direction,
wind/gust, sun phases — alongside the usual temperature, rain, cloud, UV.

This handoff ships **both a standalone app and an embeddable module** that can
be dropped into the broader SW Client.

---

## 1 · About the design files in this bundle

The files under `design/` are **design references created in HTML/JSX** —
high-fidelity prototypes that show the intended look, behaviour, motion, and
data shape. They are **not production code to copy directly**.

The implementer's job is to **recreate these designs in the target codebase's
environment** (recommended: React + TypeScript — see `ARCHITECTURE.md`) using
real weather data and the host app's component / theming conventions.

Specifically: the prototypes use inline `<script type="text/babel">` JSX,
window-global components, ad-hoc inline `style={{}}` objects, and a fixture
dataset. None of those should ship to production.

## 2 · Fidelity

**High-fidelity.** Colors, type, spacing, motion, copy, scales, and
interaction states are all final and should be recreated pixel-accurately
in the new stack. The one exception is per-view *content* (real-data fields
may differ slightly from the fixture — e.g. an API may not give a wave
"period" — fall back gracefully where needed).

## 3 · What's in this package

| File | What it covers |
|---|---|
| `README.md` (this file) | Top-level orientation, deliverable summary |
| `ARCHITECTURE.md` | Recommended stack, project structure, data flow |
| `DESIGN_TOKENS.md` | Every color/font/scale value used, exhaustively |
| `VIEWS.md` | Per-screen layout & component breakdown |
| `INTEGRATION.md` | Standalone vs. SW Client embedding — what changes |
| `OPEN_QUESTIONS.md` | Decisions left to the implementer |
| `design/` | Original HTML/JSX prototypes, kept verbatim |

## 4 · The views, at a glance

| ID | Screen | Notes |
|---|---|---|
| `home` | Home / saved locations | List of cities, each with its own motion backdrop |
| `today/visual` | Today (centered hero) | Big condition icon + temp, motion backdrop, hour strip, sun-arc, metrics |
| `today/windguru` | Today · Windguru table | Dense colored-cell hourly table, 12+ rows × 48 hours |
| `today/graph` | Today · Graph mode | Stacked SVG charts sharing an hour axis |
| `today/sun` | Today · Sun & Moon | Arc, daylight stats, twilight strip, phase list, moon |
| `week` | Week · Forecast | 7-day list with temp-range bars and inline chips |

Two earlier "v1" Today layouts (`today/horizontal`, `today/vertical`) are
present in the source but **deprecated** — keep them only if you need to A/B
compare; do not port them.

## 5 · Two delivery contexts

- **Standalone app** — full mobile-web (or PWA / native) experience including
  all 6 canonical views, a tab bar (Home / Today / Week), search, and saved
  locations.

- **Embedded module inside SW Client** — surfaced as a top-level
  tab/section. Default integration is the **full app**, mounted in whatever
  shell SW Client provides. The module exposes a slimmer "Weather card"
  primitive (just the visual hero + hour strip) for dashboard embeds.
  See `INTEGRATION.md` for the contract.

## 6 · Recommended stack (defaults applied)

- **React 18 + TypeScript**
- **Vite** for the standalone build; the SW Client decides bundling for the
  embedded version
- **Open-Meteo** as the live data source (free, no key, has marine data via
  the marine API for wave height/period/direction)
- **No CSS-in-JS library** — keep the prototype's inline-style approach or
  migrate to CSS modules / Tailwind, whichever SW Client uses; just keep the
  token names from `DESIGN_TOKENS.md` stable
- **No animation library needed** — every motion effect is pure CSS keyframes
- See `ARCHITECTURE.md` for project structure and data flow

## 7 · Status of the design

- ✅ Design system established (dark navy shell `#070b1a`, Windguru rainbow
  cell palette, Inter + JetBrains Mono type pairing)
- ✅ All 6 canonical views designed and reviewed
- ✅ Motion backdrops working across 8 conditions
- ⏳ No real API wiring done yet
- ⏳ No internationalization done
- ⏳ No accessibility audit done (color contrast is approximately AA but
  unverified; mono numerics may need testing with screen readers)

---

## 8 · Next steps for the implementer

1. Read `ARCHITECTURE.md` first.
2. Browse `design/Today View.html` in a browser to see all views on one canvas
   (drag to pan, scroll to zoom; click an artboard label to focus it).
3. Pick one view (recommend `today/visual` — it's the smallest) and rebuild it
   end-to-end against Open-Meteo. Get type, spacing, and motion right before
   moving on.
4. Then `home` → `week` → `today/windguru` → `today/graph` → `today/sun`.
5. See `OPEN_QUESTIONS.md` for the explicit decisions that were left open.
