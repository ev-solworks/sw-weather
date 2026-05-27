# Design tokens

Every concrete value used in the design. **Treat this as the single source
of truth.** If something here disagrees with a value baked into the
prototypes, the prototypes are stale.

---

## 1 · Colors

### App shell (dark navy family)

| Token | Value | Used for |
|---|---|---|
| `--bg` | `#070b1a` | Main background — every view |
| `--bg-elev1` | `#0a0f1c` | Empty/sparse table cells |
| `--bg-elev2` | `#0c1428` | Card backgrounds (stats tiles, phase list, moon panel) |
| `--bg-elev3` | `#0f1628` | Icon-button background |
| `--border` | `#131a2e` | Default 1px rule between rows |
| `--border-strong` | `#1b2440` | Card borders |
| `--border-day` | `#2a3550` | Day-boundary divider in tables |
| `--border-section` | `#1f2a48` | Heavy section divider |

### Text

| Token | Value | Used for |
|---|---|---|
| `--text-hi` | `#fafafa` | Primary labels, big values |
| `--text` | `#e5e5e5` | Body |
| `--text-lo` | `#cfcfcf` | Secondary |
| `--text-xlo` | `#9a9a93` | Tertiary, units |
| `--text-mono-axis` | `#7a8aa3` | Axis labels, gutter subtitles (cool tint) |
| `--text-dim` | `#5a6485` | Watermarks, footnotes |
| `--text-disabled` | `#3a3a45` | "·" placeholders in sparse cells |
| `--text-on-warm` | `#070b1a` | Text on amber/yellow backgrounds |

### Accents

| Token | Value | Used for |
|---|---|---|
| `--accent-amber` | `#ffd06a` | "Today" highlight, NOW badge, solar noon dot |
| `--accent-amber-bg` | `#3a2f0f` | "Now" hour column tint in tables/graphs |
| `--accent-amber-glow` | `rgba(255,208,106,.08)` | Today row gradient sweep |
| `--accent-rain` | `#3a9cef` | Rain chip foreground, rain bars |
| `--accent-wind` | `#7fd02a` | Wind chip foreground |
| `--accent-wave` | `#9a4fd4` | Wave chip foreground |
| `--positive` | `#7fd02a` | "+X minutes longer" deltas |
| `--negative` | `#f49224` | "-X minutes shorter" deltas |

### Backdrop / condition palettes

Each `wxPalette[code]` returns `{ skyHi, skyLo, bg, sun, rain, fog }` —
used by `<WeatherBackdrop>` to tint the radial sky gradient and pick
foreground accents for that condition's motion layer.

| Code | skyHi | skyLo | bg | sun | rain | fog |
|---|---|---|---|---|---|---|
| `clear` (day) | `#1f3b6e` | `#0a1226` | `#070b1a` | `#ffd47a` | `rgba(190,210,255,.7)` | `rgba(180,200,230,.25)` |
| `clearNight` | `#0f1a36` | `#070b1a` | `#04060f` | `#dbe6ff` | — | `rgba(150,170,210,.18)` |
| `partly` | `#28406d` | `#0d152a` | `#070b1a` | `#ffcf6e` | `rgba(200,215,240,.7)` | `rgba(180,200,230,.25)` |
| `cloud` | `#2c3344` | `#11141c` | `#0a0c12` | `#aab3c4` | `rgba(190,205,225,.6)` | `rgba(170,185,210,.25)` |
| `rain` | `#1d2c44` | `#0a1322` | `#060a14` | `#5b78a8` | `rgba(140,180,235,.85)` | `rgba(140,170,210,.28)` |
| `heavy` | `#142136` | `#070d18` | `#04070e` | `#3b5476` | `rgba(120,170,235,.95)` | `rgba(110,150,200,.3)` |
| `snow` | `#384258` | `#161b27` | `#0c0f17` | `#dde6f4` | `rgba(230,238,250,.85)` | `rgba(210,220,235,.3)` |
| `fog` | `#3a3f49` | `#1a1d24` | `#0e1014` | `#b8bcc4` | `rgba(200,205,215,.5)` | `rgba(200,210,225,.45)` |

Use `night = hour < 6 || hour >= 20` to swap `clear` → `clearNight`.

---

## 2 · Windguru data-cell scales

**Critical.** These are the rainbow ramps the Windguru table + Graph mode use.
Each function returns `{ bg, fg }`. Port verbatim — the visual identity
depends on these exact stops.

### Wind speed (km/h)

| Range | bg | fg |
|---|---|---|
| `< 4` | `#141414` | `#5a5a55` |
| `4–6` | `#bff0ee` | `#0a3a3a` |
| `7–9` | `#7fe2d6` | `#0a2a2a` |
| `10–12` | `#2fd49a` | `#0a2614` |
| `13–15` | `#26c25c` | `#0a2614` |
| `16–18` | `#7fd02a` | `#1a2606` |
| `19–21` | `#cad42a` | `#26260a` |
| `22–24` | `#f0c020` | `#2a1a04` |
| `25–27` | `#f49224` | `#2a0e02` |
| `28–30` | `#ee5b2a` | `#fff` |
| `31–34` | `#e8332f` | `#fff` |
| `35–39` | `#cf3290` | `#fff` |
| `40+` | `#8a3fcc` | `#fff` |

### Temperature (°C)

| Range | bg | fg |
|---|---|---|
| `< -5` | `#7fa8d9` | `#0a1a3a` |
| `-5..-0.1` | `#bfd4ef` | `#0a1a3a` |
| `0..4` | `#e8f5c8` | `#2a3a14` |
| `5..9` | `#f2f6a2` | `#3a3a14` |
| `10..13` | `#fff09a` | `#3a2a08` |
| `14..17` | `#ffd478` | `#3a2a08` |
| `18..21` | `#ffb04a` | `#3a2208` |
| `22..25` | `#ff8a2a` | `#3a1a04` |
| `26..29` | `#f4612a` | `#fff` |
| `30..33` | `#e23a2a` | `#fff` |
| `34..37` | `#cf3290` | `#fff` |
| `38+` | `#8a3fcc` | `#fff` |

### Cloud cover (%)

| Range | bg | fg |
|---|---|---|
| `< 25` | `#222220` | `#9a9a93` |
| `25–49` | `#4a4a45` | `#e0e0d8` |
| `50–74` | `#8a8a83` | `#0f0f0f` |
| `75–89` | `#c8c8c2` | `#0f0f0f` |
| `90+` | `#ececec` | `#0f0f0f` |

### Rain probability (%)

| Range | bg | fg |
|---|---|---|
| `< 30` | `#1a2c4a` | `#9bbeef` |
| `30–49` | `#2a4f8a` | `#dce6f6` |
| `50–69` | `#4a7ed1` | `#fff` |
| `70–84` | `#3a9cef` | `#0a1a3a` |
| `85+` | `#7fc8ff` | `#0a1a3a` |

### Rain amount (mm/h)

| Range | bg | fg |
|---|---|---|
| `< 0.5` | `#1a2c4a` | `#9bbeef` |
| `0.5–1.4` | `#2a4f8a` | `#dce6f6` |
| `1.5–2.9` | `#3a9cef` | `#0a1a3a` |
| `3.0–5.9` | `#7fc8ff` | `#0a1a3a` |
| `6.0+` | `#bfe4ff` | `#0a1a3a` |

### Wave height (m)

| Range | bg | fg |
|---|---|---|
| `< 0.5` | `#1c2240` | `#a8b3e0` |
| `0.5–0.9` | `#2b3268` | `#cfd8f5` |
| `1.0–1.4` | `#4a4f9c` | `#fff` |
| `1.5–1.9` | `#6f5fc8` | `#fff` |
| `2.0–2.9` | `#9a4fd4` | `#fff` |
| `3.0+` | `#cf3290` | `#fff` |

### Wave period (s)

| Range | bg | fg |
|---|---|---|
| `< 5` | `#0a0f1c` | `#7a7a93` |
| `5–7` | `#0a0f1c` | `#c8c8e0` |
| `8–10` | `#3a1f2a` | `#f5b8c8` |
| `11–13` | `#5a2a3a` | `#ffd0dc` |
| `14+` | `#7a3550` | `#fff` |

### UV index

| Range | bg | fg |
|---|---|---|
| `0–2` | `#2db765` | `#0a2614` |
| `3–5` | `#f0c020` | `#2a1a04` |
| `6–7` | `#f49224` | `#2a0e02` |
| `8–10` | `#e8332f` | `#fff` |
| `11+` | `#8a3fcc` | `#fff` |

---

## 3 · Typography

### Font families

| Use | Stack |
|---|---|
| UI / labels / body | `"Inter", -apple-system, system-ui, sans-serif` |
| Numerics, times, axis labels, monospaced UI tags | `"JetBrains Mono", ui-monospace, monospace` |

Always set `font-variant-numeric: tabular-nums` on any monospaced number (so
single-digit days don't shift adjacent text).

### Sizes (px)

| Use | Size | Weight |
|---|---|---|
| Hero temperature | `96` | `100` (Inter Thin) |
| Hero temperature degree | `48` | `100` |
| Big numeric value (stat tile) | `17` | `500` |
| Section heading | `18` | `600` |
| Row primary label | `13` | `500–600` |
| Row secondary label | `11–12` | `500` |
| Metric cell value (Windguru) | `12` | `500` (bold variant `700`) |
| Hour header (table) | `12` | `600` |
| Day header (table) | `9` | `700` |
| Caption / footnote | `10–11` | `500` |
| MONO TAG (e.g. `NOW`, `DAYLIGHT`) | `9–10` | `700`, letter-spacing 1px+ |

---

## 4 · Spacing

Loose 4-step scale based on what the prototypes converged on:

| Step | Value | Examples |
|---|---|---|
| `1` | `4px` | gap between mono tag and value |
| `2` | `6–8px` | chip gaps, intra-row gutters |
| `3` | `12px` | card padding inner |
| `4` | `14–16px` | screen edge padding |

---

## 5 · Radii & elevation

| Token | Value | Used for |
|---|---|---|
| `--r-sm` | `3–4px` | mono tags, pill backgrounds |
| `--r-md` | `10px` | search bar, icon buttons |
| `--r-lg` | `12–14px` | metric tiles, cards |
| `--r-xl` | `18px` | location card |
| `--r-pill` | `999px` | chips, location pills, upcoming badge |

No shadows in the dark UI — depth is achieved with elevation backgrounds
(`--bg-elev1/2/3`) and 1px borders only. The motion backdrops are the only
"shimmer".

---

## 6 · Motion / keyframes

All defined in `weather-backdrop.jsx` as `wxRain`, `wxSnow`, `wxCloudA`,
`wxCloudB`, `wxSunSpin`, `wxSunPulse`, `wxFogDrift`, `wxStarTwinkle`,
`wxBoltFlash`. Port them as a `motion.css` file in the new codebase, gated
behind `prefers-reduced-motion`.

Durations summary:
- Rain streak fall: `0.55–1.25s`
- Snowflake fall: `4–10s`
- Cloud drift: `60–110s`
- Sun spin (ray rotation): `80s`
- Sun pulse: `7s`
- Fog drift: `22–37s`
- Star twinkle: `2–6s`
- Bolt flash: `7s` cycle, flash for `~0.1s`

---

## 7 · Iconography

All weather icons are line-only SVG, stroke `1.4–1.5px`, rounded caps and
joins, viewBox `0 0 24 24`. Stroke = `currentColor`. **No fills** except the
small snow dots. See `design/wx-icon.jsx` for the full set:
`clear`, `mostly clear`, `partly cloudy`, `cloudy`, `light rain`, `rain`,
`heavy rain`, `thunder`, `snow`, `fog`.

UI / metric icons (wind compass, droplet, sun rays, search, plus) live
inline in each view file. Port them as named exports from a single
`components/icons.tsx`.
