# Views — per-screen breakdown

Six canonical views, all at the 390 × 844 phone frame. Designed for one-handed
thumb use; vertical scroll where needed.

Two retired prototypes (`today-horizontal.jsx`, `today-vertical.jsx`) are in
the bundle but should not be ported.

Common chrome across **every** view:

| Region | Height | Contents |
|---|---|---|
| Status bar (iOS frame) | 47 | provided by host frame, ignore for module |
| App bar | 44 | small `SW` mono badge + view name + right-side actions |
| Location strip | 32 | location name, region |
| (view body) | flex | scrollable |
| Tab bar | 64 | Home / Today / Week tabs |

Tab bar items, in order: `Home` · `Today` · `Week` · `Map` (placeholder) ·
`More` (placeholder). Active state = filled icon + label in `--text-hi`;
inactive = stroke icon + `--text-xlo`.

---

## A · Home

**Purpose.** Dashboard of saved locations.

**Layout** (top → bottom, all `padding: 0 12–14px`):

1. **Header** — Big greeting line ("Good afternoon" by time of day), date
   below, search + add buttons right-aligned. ~70px tall.
2. **Search bar** (placeholder) — 36px tall, mono "Search city or airport".
3. **Location list** — vertical stack with 10px gap.
   - **Featured card** (first / "My Location"): 196px tall, has the
     condition motion backdrop full-bleed, location name with pulsing white
     dot, "My Location" label, big temp (52px) right-aligned, an inline
     6-hour temperature strip at bottom (transparent black bar with mono numbers).
   - **Regular cards**: 108px tall, same backdrop + condition pattern, no
     6h strip. Show name, time-zone-local time, short note, hi/lo, condition.
4. **Footnote** — "N locations · Edit" in mono.

**Component**: `<LocationCard loc featured?>` — every card uses
`<WeatherBackdrop desc palette night compact>` as its background layer.

**Interaction notes** for the implementer:
- Tap card → navigate to Today/Visual for that location.
- Long-press → reorder mode (TODO — design not yet specified).
- Pulsing white dot on featured card = real-time location.

---

## B · Today · Visual

**Purpose.** The default "what's it like now" screen. Image-led, big numbers.

**Sections**:

1. **Hero zone** — 360px tall, contains:
   - Motion backdrop full-bleed (rain streaks / drifting clouds / sun rays /
     etc, keyed to current condition + hour-of-day for day/night palette).
   - Top bar overlaid: location pill (chevron icon, glassy bg) on the left;
     search icon-button on the right.
   - Centered stack: `NOW · 14:00` mono tag → 84px condition glyph →
     temperature (96px thin) with smaller degree (48px) → condition name
     (15px) → `H X° · L X°` line (11px).
   - "Up next" pill near the bottom: tiny icon + plain-English label
     ("Rain incoming") + mono `in 3h` suffix. Sits centered.

2. **Lower panel** (dark navy, scroll target if content grows):
   - **"NEXT 12 HOURS"** mono section label, then a horizontal scrolling
     strip of 12 hour cells. Each cell: hour label / icon / rain % (when
     ≥30%) / temp. Current hour gets a soft elevated pill.
   - **Metrics row** — 3 tiles: Wind (with rendered compass rosette as
     icon, value + `km/h NW`), Humidity (drop glyph, `54%`), UV
     (sun-rays glyph, `4 Moderate`).
   - **Sun Arc panel** — compact mini version of the full Sun & Moon view.
     Shows "DAYLIGHT 10h 34m" header, horizon line with parabolic arc, a
     glowing sun marker positioned at the current daytime fraction, then
     a 3-column "Sunrise / Sets in / Sunset" row beneath.

**Hero text removed**: previously had a "Feels like X°" line — explicitly cut.

---

## C · Today · Windguru

**Purpose.** Dense forecaster's view — every metric, every hour, colour-coded.

**Layout**: navy app shell + a single sticky-headered table that
horizontally syncs across rows.

- **Sticky header row** (46px): "Forecast / 26 May · CET" gutter, then per-hour
  cells of `Tu 26.` (day, shown only at boundaries) over `14h` mono hour. Day
  boundaries draw a 2px `--border-day` divider; night hours have a slightly
  darker cell tint; now-hour cell tints amber.

- **Rows** (32px min height each):
  1. Wind speed (km/h)
  2. Wind gusts (km/h)
  3. Wind direction (filled white-on-navy arrow)
  4. **Wave** (m)
  5. **Wave period** (s)
  6. **Wave direction** (small grey arrow)
  7. Temperature (°C)
  8. Feels like (°C)
  9. Conditions (line icon)
  10. Rain probability (%)
  11. Precipitation (mm/1h)
  12. Cloud cover (%)
  13. UV index
  14. Humidity (%)
  15. SW rating (★, 0–5) — toy "comfort" score derived from wind/rain/temp/cloud

  Each row has a sticky 92px left label like `Wind speed (km/h)`; data cells
  are 44px wide. Now-column has an `inset 2px 0 0 #fafafa` left border in
  every row, so the current hour reads as one continuous vertical white
  thread across the rainbow.

- **Legend strip** — `Wind (km/h)`, `Wave (m)`, `Temp (°C)`, `Rain (%)`
  thumb-strips at the bottom. Horizontally scrollable.

**Cell rendering rules**:
- Empty/below-threshold cells render as a dim `·` on `--bg-elev1`. Never
  a coloured block for "nothing".
- Bold weight applied above row-specific high thresholds (e.g. wind ≥ 25,
  precip ≥ 2mm).
- See `DESIGN_TOKENS.md` § Windguru scales for every threshold and color.

---

## D · Today · Graph mode

**Purpose.** Visual reading of the same 48 hours.

**Stacked SVG panels**, all sync-scrolling horizontally, each ~80–100px tall:

1. **Time axis** (sticky, 46px) — major mark every 6h with hour labels;
   minor ticks every 3h. Day-boundary thicker line. Night hours have a
   darker background band; current hour amber.
2. **Temperature** — filled gradient area (cool→warm bottom-to-top) under
   the temperature polyline; dashed line for `feelsLike`; value dot+label
   every 6h.
3. **Wind / Gusts** — coloured bars (wind palette) for `windSpeed`, with
   a 0.4-opacity outline above for `windGust`. 8.5px mono number every
   3h. Direction arrows in a 12px strip beneath the baseline.
4. **Rain · prob & precip** — light-blue gradient area for `precipProbability`,
   thin solid line on top; on top of that, narrow 6px bars in lighter
   blue for `precipAmount` mm/h, scaled to panel max.
5. **Waves · height & period** — lilac/violet filled area for height,
   period number printed at each 6h tick (pink-accented if ≥10s for
   clean swell), direction arrows beneath.
6. **Cloud cover** — solid grey bars (cloud palette), one per hour at
   varying fill height proportional to %.

**Now-line**: a dashed `#fafafa` at 40% opacity vertical guide runs through
every panel.

---

## E · Today · Sun & Moon

**Purpose.** All sun-related data + moon panel.

1. **Hero arc** — semicircle representing the sun's path:
   - Horizon line at y=140 of a 360×200 viewBox.
   - Daylight arc from sunrise (left) to sunset (right), peaking at solar
     noon.
   - Filled under-arc gradient: indigo top → gold mid → orange bottom.
   - Below the horizon: three concentric dashed arcs representing civil /
     nautical / astronomical twilight depths, with small colored dots
     marking each dawn/dusk transition (`#6a8aff` civil, `#4a5fcf`
     nautical, `#2a3590` astro).
   - Phase markers on the daylight arc: golden hour bounds (dim dots),
     sunrise/noon/sunset (bright dots) with mono times.
   - **Current sun** — 14px golden glow + 5.5px solid disc at the current
     position. Switches to a pale moon-coloured dot below horizon at night.

2. **3-column stats card** — Daylight (`10h 34m`, delta vs yesterday in
   green/orange), Solar noon (time + "Sun at peak"), Tomorrow (length +
   delta).

3. **"SKY · 24H" twilight strip** — 22px-tall horizontal bar gradient-filled
   to the day's actual sky-color progression at every named phase boundary.
   Tick marks at 0/6/12/18/24h, a glowing white pin at `now`.

4. **PHASES list** — 11 rows in a navy card, one per named transition.
   Each row: `HH:MM` mono · custom icon (`sun`, `noon`, `golden`, `civil`,
   `naut`, `astro` variants) · name · short subtitle. Past phases are
   dimmed (opacity 0.55); the band that contains `now` gets a `NOW` badge
   (amber pill, mono text).

5. **Moon panel** — moon disc rendered as SVG (radial-gradient surface +
   shadow ellipse for the phase), phase name, illumination %, rise/set
   times in mono. Phase direction: shadow on the LEFT for waxing (frac
   <0.5), on the RIGHT for waning (frac ≥0.5).

---

## F · Week · Forecast

**Purpose.** 7-day at-a-glance.

**Layout**:

1. **Summary tiles** — 4 across the top, each a navy card with a 3px coloured
   accent stripe on the left: Week high (orange), Week low (blue), Total
   rain (blue), Peak wave (purple).
2. **Mini scale axis** — thin 3px-tall gradient bar with mono temp numbers
   at each end (e.g. `7°` … `17°`), representing the absolute scale used
   by every range bar below.
3. **Day list** — 7 rows in a navy card. Each row is a two-line layout:
   - **Top line** — grid `56px 32px 1fr`: day name (amber if Today)
     + date in mono · 28px weather icon · temp-range track on the right
     with `lo°` left of and `hi°` right of a 6px-tall track. The track has
     a gradient-filled bar from the day's lo→hi position; for Today, a
     pulsing white dot marker shows current temperature.
   - **Bottom line** — chip row, indented 64px so it aligns under the icon
     column. Three pill chips: rain `85%` (blue), wind `26 km/h` with
     direction arrow (green), wave `1.7 m` with wave glyph (purple). Each
     chip is muted (grey) when below threshold.
   - Today's row has a warm amber gradient sweep from left (8% opacity)
     and a slightly thicker bottom border.
4. **Footnote** — "Tap a day for hourly · long-press to pin".

---

## Retired (do not port)

- `today-horizontal.jsx` — v1 horizontal-table layout. Superseded by Windguru.
- `today-vertical.jsx` — v1 vertical-timeline layout. Superseded by Visual + Graph.
