# SW Weather — Feature Roadmap (Production-Focused)

Re-scoped for the **SW Client App embedding context**: SOLWORKS film/photo production. The app needs to serve **producers, DPs, ADs, location managers** on-set or pre-pro. Terminology is **production**, not watersports.

## Production audience cues

The user is checking weather for:
- **Pre-pro / recce**: "Is Thursday's recce day workable in Pollensa?"
- **Call sheet**: "Sunrise 06:27 → first light 05:55 → call 04:30 for golden-hour interior shoot through window."
- **On set, day of**: "Is this rain band blowing through in 20 min so we resume exterior?"
- **DP planning**: "When does sun hit the east wall of the chapel?" (sun-angle by hour)
- **Logistics**: "Wind > 30km/h → no jib / crane / drone."
- **Locations**: storm warning, road closure risk, talent comfort (heat / cold / humidity).

So the relevant frame is **decision moments**, expressed in production language:
- "Camera-ready window" not "kitesurf score"
- "Drone-safe" / "Jib-safe" wind thresholds
- "Talent comfort: hot" / "needs umbrellas"
- "Golden hour" / "blue hour" / "magic hour" — already done in Sun view ✅
- "Sunrise / sunset for tomorrow's call sheet"

---

## Confirmed scope (from user)

| # | Item | Status | Size |
|---|---|---|---|
| 1 | Metric drilldowns | YES | M |
| 2 | Tide tables | YES (Med = low priority but ok) | M |
| 3 | Minute-by-minute rain (60-min nowcast) | YES — AccuWeather-style | S-M |
| 4 | Custom alerts via Web Push | YES (interesting) | L |
| 5 | Two-tone precipitation (uncertainty band) | YES | S |
| 6 | Plain-language annotations | TRY | S |
| 7 | Windy map embed (reuse client app pattern) | YES | S |
| 8 | Historical look-back | INTERESTING | S |
| 9 | **Better graphs** | **HEAVY PRIORITY** | M-L |

Explicitly OUT:
- Activity / sport ratings (out)
- Spot-day scores (out)
- Anything watersports-flavored

---

## Order of attack

### Sprint 1 — depth + production utility

#### 1.1 Better graphs (highest priority per user)
**What's wrong with current.** Today/Graph view is thin. Detail view's grid table is dense but not a graph. Hourly strips show only 12h. No scrub gesture. No annotations.

**Target.**
- **Multi-metric stacked graph**: temp + wind + rain + cloud in a single 48-72h scrubable canvas. Each metric in its own band, time axis shared.
- **Touch-scrub**: drag horizontally → vertical cursor → all metrics' values at that hour in a floating chip.
- **Day boundary lines** (00:00 ticks), **golden hour shading** (warm overlay on the temp band), **night shading** (cool overlay).
- **Tap on a metric band** → expand it full-width, others collapse.
- **Annotation chips** floating on the graph: "Peak UV 14:00", "Rain starts ~16:30", "Wind gust 42 km/h".

**Tech.** Switch from divs to a Canvas/SVG approach. Either:
- D3 + SVG (heavier dep, full control) — **recommended**
- visx (React + D3 wrapper, type-safe)
- Hand-rolled SVG with `pointer` events for scrub (no dep)

**Size.** M-L.

---

#### 1.2 Metric drilldown pages
Same Apple-Weather pattern. Tap any metric on Visual → full-page detail with hero number → hourly graph → 7-day strip → plain-language summary → source attribution.

**Production extensions:**
- **Wind drilldown**: "Drone-safe ≤25 km/h gust" / "Jib-safe ≤30 km/h" thresholds annotated on the graph as horizontal bands. User-configurable.
- **UV drilldown**: "Talent skin-exposure cutoff" notes ("UV 8+ → cover crew during continuity holds").
- **Humidity drilldown**: "Equipment risk above 85% (camera condensation when entering AC)."
- **Pressure drilldown**: "Falling rapidly → storm approaching." Useful for outdoor shoots.

Top-right metric dropdown swaps in place (Apple pattern). **Source pill** below hero (`AEMET • obs-adjusted`) — taps open the model breakdown.

**Size.** M.

---

#### 1.3 Minute-by-minute rain nowcast
60-min nowcast banner: "Rain in 14 min, light, lasting ~25 min." Surface on Home + Today/Visual.

**Data source options (research):**

| Source | Coverage ES/PT | Quality | Cost |
|---|---|---|---|
| Open-Meteo `minutely_15` | ICON-D2 (DE/NL/AT/CH only) → interpolated elsewhere for Spain | Mediocre for IB peninsula | Free |
| AEMET | Has 5-min radar but no public minutely API | n/a | n/a |
| RainViewer API | Tile-based radar (past 2h + future ~30 min), free | Good for past, weak for >30min | Free |
| MeteoBlue | minutely API, Europe coverage, paid | Best | Paid |
| **AEMET radar tiles** | Free, official, 10-min update | Best for current band tracking | Free |

**Recommended:** **RainViewer + AEMET radar tiles combo.**
- Show 60-min forecast as a banner using RainViewer's `nowcast` (their free API does this).
- Show animated radar on the upcoming map view.

**Size.** S for banner, M for the radar integration.

---

### Sprint 2 — graphs + sources + transparency

#### 2.1 Two-tone precipitation (Yr.no model)
Confidence band from our 5 archived Open-Meteo models. Light shade = model spread. Solid line = blended median.

**Implementation.** Edge endpoint `model-spread` returns p25/p50/p75 from `forecast_archive` for the location + hour range. Client renders as a two-tone area chart.

**Size.** S once archive has 1 week of data (already accumulating).

---

#### 2.2 Source pill + provenance modal
Below every metric: `AEMET • high` chip. Tap → modal showing which models contributed + last update.

Critical for SW Client App embedding — clients/producers want to know "where did this number come from."

**Size.** S.

---

#### 2.3 Plain-language annotations
Hand-authored rule registry. Examples:
- "Rain stopping in 12 min" (from minutely)
- "Above-average UV for May" (from archive vs current)
- "Cloud clearing through sunset" (from cloud_pct delta)
- **Production-specific:** "Drone window opens 11:00 (wind drops below 25 km/h)"
- **Production-specific:** "Golden hour window: 19:30–20:45 today"
- **Production-specific:** "Sun on east wall: 07:00–10:30" (computed from sun azimuth at location)

Stored as `services/annotations.ts` — small JSON of rules + matcher. **No LLM.**

**Size.** S-M.

---

### Sprint 3 — push + maps + history

#### 3.1 Custom alerts (Web Push)
Templates aimed at production crews:
- **Drone window**: wind drops below 25 km/h sustained + 35 km/h gust → push
- **Rain start**: rain begins within 60 min on shoot day → push
- **Severe alert**: AEMET/IPMA yellow/orange/red within X km → push
- **Magic-hour reminder**: 30 min before golden hour at active location → push
- **Sunrise call**: configurable lead before sunrise (for AD scheduling) → push

**Tech.** Service worker + Web Push (VAPID) + Supabase edge fn for subscription management. Standard pattern.

**Size.** L (Web Push setup + subscription UI + matcher cron + edge fn).

---

#### 3.2 Windy map (reuse client app pattern)
Reuse the `WeatherMap.tsx` iframe pattern from sw-client-app:
```
https://embed.windy.com/embed2.html?lat={lat}&lon={lon}&overlay={layer}&product=ecmwf
```
Layers: wind, rain, temp, pressure, clouds. Layer selector tabs at top.

Mount as new tab in Today (`map`) or replace `Wind` tab with a Map view.

**Size.** S (iframe + layer selector, mirrors existing client code).

---

#### 3.3 Historical look-back
"This day last year: max 19°C / rained 4mm." Open-Meteo archive API (`https://archive-api.open-meteo.com`).

Surface as a small chip on Visual hero ("Last year: 22° · clear") + on Week view ("Same week last year: cooler by 3°").

**Size.** S.

---

### Sprint 4 — tides (lower priority since Med)
Open-Meteo Marine `sea_level_height_msl` → 24h tide curve component. Render in Detail view + a section in Visual when coastal. Tide range typically 40 cm in Mallorca but useful for Tarifa / Atlantic locations.

**Size.** M.

---

## Graphs deep-dive (since it's the priority)

### Current state

| View | Graph | Notes |
|---|---|---|
| Visual hero | None | Just numbers + icon |
| Hourly strip | Horizontal cards | Not a graph |
| Detail | Grid table | Cells colored by scale |
| Graph | TodayGraph.tsx | Existing, but thin |
| Sun | Arc | Custom SVG |
| Wind | WindRosette + WindHistoryChart | The most graph-like |

### Target graph spec

```
┌─ Today · Graph ──────────────────────────────────┐
│ ◁ Palma de Mallorca                  72h ⌄  Now │
├──────────────────────────────────────────────────┤
│ HOURLY CHIP (active on scrub)                    │
│ Thu 14:00  ☀ 28°  💨 14 km/h SW  ☔ 0%  UV 7    │
├──────────────────────────────────────────────────┤
│ TEMPERATURE BAND  ───────────────────────  29°   │
│   filled area chart, golden-hour overlay         │
│                                          18°    │
├──────────────────────────────────────────────────┤
│ WIND BAND  ──────────────────────────────  35 kmh│
│   line + gust shading + arrows below              │
│                                          ↓SW    │
├──────────────────────────────────────────────────┤
│ RAIN BAND  ──────────────────────────────  3 mm  │
│   bars + uncertainty band (two-tone)             │
├──────────────────────────────────────────────────┤
│ CLOUD + UV BAND  ────────────────────────        │
│   cloud as area chart, UV as colored dot per hr  │
├──────────────────────────────────────────────────┤
│ TIME AXIS                                        │
│ Thu 12   Fri 00   Fri 12   Sat 00   Sat 12      │
│  └─ day-boundary line       └─ night shading    │
└──────────────────────────────────────────────────┘
```

**Interactions:**
- Pinch/drag to zoom time range (24h / 48h / 72h / 7d)
- Tap-and-hold anywhere → vertical cursor → top chip updates with all metrics at that time
- Tap a band's label → that band expands to full height, others collapse to 1 line
- Annotation chips ("peak gust", "sunset", "rain starts") float on bands at their times
- Day boundaries are 1px white lines
- Night = soft dark blue overlay across all bands; golden hour = warm amber overlay

**Tech recommendation:**
- **D3 + React** (manual SVG render with React for layout, D3 for scales). No big chart lib.
- Time scale shared across bands; each band has its own y-scale.
- Touch via React's `onPointerDown/Move/Up` (works iOS + Android + mouse).
- ~1 day for the multi-band canvas, ~1 day for scrub + annotations.

---

## Removed from previous version

- Sports day scores
- Spot comparisons (watersports framing)
- Activity templates (kitesurf/foil/sail)
- Bay-of-Palma Embat tracker (was on differentiation doc — keep as personal extension, but not the headline)
- Webcam thumbnails (lower priority without watersports framing)

---

## Anti-pattern watchlist

- **Drop-in chart library bloat** (Chart.js, Recharts, ApexCharts) — they're heavy and ugly. Hand-roll with D3 + SVG.
- **Generic Apple-Weather clone** — we need to be sharper for production. Add drone/jib/sun-angle thresholds.
- **Ad-hoc rain banners** — make sure minutely data is actually accurate for ES/PT before promising "Rain in 14 min."
- **Hidden sources** — opposite of our ethos. Show provenance everywhere.

---

## Next concrete step

Pick one to start. Two natural openings:

**A. Start with Better Graphs** (user-stated priority). Build the multi-band scrubable canvas as a replacement for `TodayGraph.tsx`. Get the interaction right. Then drilldowns reuse the band component.

**B. Start with Wind Drilldown** as a proof-of-pattern for metric detail pages, then graph upgrade. Smaller scope, faster ship.

Recommend **A** — graphs are the highest-leverage UX move and drilldowns reuse them.
