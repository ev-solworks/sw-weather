# What Would Make SW Weather Stand Out

Personal weather PWA, watersports lean, ES + PT coverage. Competing against: Apple Weather (default), eltiempo.es (incumbent), AccuWeather, Windfinder, Windy, Meteoblue. The honest question — what reason does the user have to keep this app on the home screen instead of any of those?

## What's already there (foundation)

- **Multi-source blend with provenance** — AEMET (Spain) + IPMA (Portugal) + Open-Meteo backfill, per-field source/confidence stored, surfaced as "AEMET official" vs "model estimate" badges. Nobody else shows this. *Built.*
- **Obs-based sanity check** — when AEMET forecasts Fog/Haze but a nearby station says RH<90% or wind>10kt, override with surrounding-hour condition and badge "adjusted". Catches AEMET's well-known coastal fog false-positive. *Built today.*
- **Live wind, sub-10s cadence** — direct OceanDrivers polling, bypassing proxy cache. Same data Windguru paywalls. *Built.*
- **Per-model archive** — every hourly tick records what AEMET, IPMA, and 5 Open-Meteo models said for every future hour, alongside what stations actually measured. Foundation for empirical model scoring. *Built today.*
- **Watersports-grade detail view** — Windguru-style dense table with kt/kmh + °C/°F toggles, color-coded scales matching real meteo conventions. Marine fields (waves/period/sea-surface) first-class, not buried. *Built.*

## The two real moats

Most apps will copy a pretty UI. They won't copy these.

### 1. "Model confession" — first app that admits when it was wrong

After ~4-6 weeks of archive data, the app has empirical MAE per model per location per lead-time. Surface that as the differentiator.

> "Looking at the last 30 days for Palma:
>  • AEMET wins for 0-12h temperature (MAE 0.8°C vs Apple's source).
>  • AROME wins for coastal wind (MAE 2.1 kt vs ECMWF's 3.4).
>  • Apple Weather called rain 11 times that didn't happen. We called it 4 times."

This is unhostable by anyone without the archive. Apple, AccuWeather, Windfinder all show you a forecast and shut up about it. SW Weather shows you the forecast AND its track record.

UI: a one-line trust badge per metric ("AEMET, 73% hit rate last 30d") that taps into a per-location accuracy panel. Drives retention because users come back to check who was right.

**Cost**: 1-2 days SQL + a single new view. Wait until archive has ≥4 weeks signal, then ship.

### 2. "Watersports decisions, not weather observations"

Apple Weather tells you it's 24°C and 12 kt SW. That's a measurement, not a decision. The kitesurfer/sailor in Mallorca cares about:
- "Is the Embat going to fill in by 14:00?" (sea breeze diurnal pattern)
- "Will the surf at Sa Rapita be clean?" (wave period > 8s, offshore wind)
- "Is tomorrow a kitesurfing day or a foil day?" (10-18 kt vs >18 kt with gust ratio)

A "Conditions" overlay per location, expressed in the user's domain:
- **Kite**: ★★★★☆ — "Building thermal, peak 16-20 kt SW from 14:00 to 19:00, clean."
- **Foil**: ★★☆☆☆ — "Marginal, gusts to 22 kt could overpower 5-meter."
- **SUP**: ★★★★★ — "Glass at 09:00, dies by 11."
- **Sailing**: ★★★☆☆ — "Solid 12 kt but veering."

These are derived from the existing hourly forecast — no extra data needed. Just a config-driven rule engine: each activity has a sweet-spot window (wind kt, gust kt, wave m, period s, swell direction, hour of day). Compute fitness per hour, surface peak windows.

**Cost**: 2-3 days. One file `activities.ts` with the rules, one view `Conditions.tsx` that renders ratings + best-window pills. Massive perceived value vs build effort.

### 3. (Bonus) — Bay-of-Palma "Embat tracker"

Hyper-local feature only possible because of the OceanDrivers wind_stream archive. The Embat (sea breeze) has a daily rhythm: starts ~11:00, peaks 14:00-17:00, dies ~19:00. The archive shows the actual pattern for THIS week, THIS month, vs the climatology.

> "Today's Embat is 1h late and 3 kt weaker than the 30-day average."

Plus a tiny stripped-down "Embat today vs typical" chart on Home. Niche, local, defensible. Travelers who care about the bay (kiters, sailors, regatta crews) will tell each other about it.

**Cost**: 1 day once archive has ~2 weeks data.

## What NOT to chase

- **More icons / more animations / more themes.** Polish, not differentiation.
- **More locations.** ES+PT is enough. Going global means competing with everyone on coverage instead of beating them on depth.
- **Maps / radar.** Windy already won. Don't try.
- **AR sun tracker.** Cool, but it's a feature, not a moat. Build later, it's already scoped.
- **Push notifications.** "Rain in 30 min" is table stakes. Build only AFTER the model-confession data is good enough to make notifications more accurate than competitors.

## Order of attack (when you're ready to ship something new)

1. **Activities/Conditions view** (#2) — fastest win, no archive wait, zero new dependencies.
2. **Embat tracker** (#3) — 2 weeks after launch, archive has enough to render.
3. **Model confession** (#1) — 4-6 weeks after launch. Headline feature for v1.1.

## Tagline candidate

> "Real numbers from real stations. Honest about what models miss."

Or, more specifically for the audience:

> "Built in Palma for people who launch a board."

Picks a niche. Nobody else does. That's the entire point.
