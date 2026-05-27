# SW Weather — Claude Code Project Guide

This file is loaded into every Claude Code session in this directory. Keep it terse and current. Long-form context lives in [docs/](docs/).

## What this is

SW Weather is a personal weather PWA for SOLWORKS. It replaces eltiempo.es with a clean, ad-free, dark-mode UI and professional-grade forecasts for **Spain (incl. Canary Islands)** and **Portugal (incl. Azores/Madeira)**. Eventually wraps as a native iOS app via Capacitor for an AR sun/moon tracker (the only feature that actually needs native sensors).

Build plan (living): [.planning/BUILD-PLAN.md](.planning/BUILD-PLAN.md)
Full architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
Data sources & blend: [docs/DATA-SOURCES-RESEARCH.md](docs/DATA-SOURCES-RESEARCH.md)
API gotchas: [docs/API-NOTES.md](docs/API-NOTES.md)
Decisions log: [docs/DECISIONS.md](docs/DECISIONS.md)

## Stack

- **Runtime:** React 19 + Vite + TypeScript (strict). Built as a cleanly integratable module — sw-weather-app is intended to *replace the weather section of sw-client-app* and may later be embedded into it.
- **Styling:** Tailwind CSS 4, dark mode only (no theme toggle yet)
- **PWA:** `vite-plugin-pwa` (installable, offline cache via service worker)
- **Package manager:** **Bun** (not npm — `bun install`, `bun add`, `bun run dev`)
- **Backend / key proxy:** Supabase edge function (Deno) proxies the AEMET key and any keyed source — the key never ships in the client bundle. (Matches sw-client-app's pattern; drops the earlier Cloudflare-Worker idea.)
- **Deployment:** TBD — defer until first real views ship.

## Scope (current)

Building the **full design system from the claude.ai/design handoff** ([design_handoff_sw_weather/](design_handoff_sw_weather/)), not a thin MVP. All 6 views are in scope: Home dashboard, Today/Visual, Today/Windguru table, Today/Graph, Today/Sun (golden hour / twilight / moon, computed locally via `suncalc`), and a Details view. More views may come later (e.g. averages).

- **Marine / watersports is first-class** (waves: height/period/direction, sea temp), mainly in Details.
- **Geolocation + location search + add/remove locations are in scope now.** The 5 locations in this file are *dev seed data*, not a permanent hardcoded list.
- **Data sources:** AEMET (Spain) + IPMA (Portugal/islands) as MOS-corrected primaries; **Open-Meteo** as universal backfill (hourly for PT, waves for Spain, multi-altitude wind, pollen/AQI everywhere). Per-field provenance + a `confidence` signal are first-class in the type contract. Full blend in [docs/DATA-SOURCES-RESEARCH.md](docs/DATA-SOURCES-RESEARCH.md).

## How we work on this project (no GSD ceremony)

Solo developer, preview server one tab away, user is the verifier. Work in a sleek loop, not a phase-doc tree:

1. **Discuss** → align on goal + shape.
2. **Plan, if non-trivial** → write/update ONE doc in `.planning/<NAME>.md` (not a phase tree). Only when work spans 2+ sessions OR is an architecture shift. For 1-session features, the commit message is enough.
3. **Research via subagent** only when genuinely needed (web/doc lookups, deep cross-file analysis). Don't ceremonially spawn agents.
4. **Build** → direct edits + commits.
5. **Verify** → preview / actual output. The user catches misalignment visually.
6. **Update state** → `STATE_OF_THE_APP.md` (repo root) when ops state changes meaningfully.
7. **Move on.**

**Keep:** planning docs (in-place edits, prune when stale), decision records, commit messages with reasoning, cherry-picked code-review/security-audit on *risky* changes only (auth, secrets, migrations), subagents for real research.
**Drop:** `/gsd-plan-phase` / `/gsd-discuss-phase` / `/gsd-execute-phase` / `/gsd-verify-work` / `/gsd-new-milestone`, plan-checker/verifier loops, per-phase RESEARCH/PLAN/VERIFICATION/SUMMARY docs. Talk it through instead.

## API keys

**The client uses NO upstream keys.** All weather goes through the Supabase edge proxy (see [edge/README.md](edge/README.md) + [.planning/EDGE-PROXY.md](.planning/EDGE-PROXY.md)).

- Client `.env`: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (both public). `VITE_AEMET_API_KEY` is **no longer used client-side** — remove it.
- `AEMET_API_KEY` lives as a **Supabase edge-function secret** on the `sw_client_app` project. IPMA / Open-Meteo need no key.

## Architecture in one paragraph

```
cron → weather-refresh ─┐
                        ▼
   AEMET/IPMA/Open-Meteo → weather_cache (Supabase, raw payloads)
                        ▼
client: proxy.ts (weather-get) → normalize.ts → cache (utils/cache.ts) → useWeather → view
```

The edge proxy fetches upstream server-side and caches RAW payloads; the client
normalizes them. One server hits AEMET (low concurrency, immune to the per-device
IP block); all devices read the warm cache. Every view consumes the unified
`WeatherConditions` from [src/types/weather.ts](src/types/weather.ts) — views never touch raw payloads.
`current` for ES uses the **measured AEMET station observation** when available, else the forecast hour.

## AEMET — the two-step fetch (read this before touching aemet.ts)

Every AEMET endpoint returns `{ datos: "https://...", metadatos: "https://...", estado: 200 }`. The `datos` URL is a **temporary signed URL** (expires in seconds-to-minutes). You must:

1. GET the AEMET endpoint with `?api_key=KEY` → get the `datos` URL
2. GET the `datos` URL → get the actual forecast/observation JSON
3. **Cache the final JSON, NEVER the datos URL** (it'll be dead by the time you re-use it)

The two-step also means each "logical" fetch is two HTTP calls. Budget accordingly against the rate limit.

## AEMET rate limit: 50 req/min

Tightest constraint in the system. A single Spain location's full Phase-1 load is ~6 HTTP calls (3 endpoints × 2-step). Be conservative:
- Cache aggressively (TTLs in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#caching-strategy)).
- Debounce rapid location-switcher clicks.
- Don't poll on a timer — let the user trigger refresh, or refresh on app focus only.

## Timezone handling (easy to get wrong)

| Region | TZ | Offset note |
|---|---|---|
| Spain mainland + Balearics | `Europe/Madrid` | CET/CEST |
| Canary Islands | `Atlantic/Canary` | 1h behind mainland |
| Portugal mainland | `Europe/Lisbon` | WET/WEST, same offset as Canary |
| Madeira | `Atlantic/Madeira` | Own IANA zone; same offset as Lisbon |
| Azores | `Atlantic/Azores` | 1h behind Lisbon |

**Rule:** Every location object carries its own `timezone` string. All times in the UI render in the **location's** local time, not the user's device time. Use `Intl.DateTimeFormat` with the location's TZ.

## Seed locations (dev data, NOT a permanent hardcoded list)

Seed data for development — geolocation + search + add/remove are in scope (see Scope above). Defined in [src/utils/locations.ts](src/utils/locations.ts):

| Name | Country | AEMET municipio | AEMET station | IPMA globalIdLocal | TZ |
|---|---|---|---|---|---|
| Palma de Mallorca | ES | 07040 | B228 | — | Europe/Madrid |
| Ibiza / Eivissa | ES | 07026 | TBD | — | Europe/Madrid |
| Santa Cruz de Tenerife | ES | 38038 | TBD | — | Atlantic/Canary |
| Madrid | ES | 28079 | TBD | — | Europe/Madrid |
| Lisboa | PT | — | — | 1110600 | Europe/Lisbon |

`TBD` = nearest-station IDs need to be looked up from `/observacion/convencional/todas` once the AEMET client works. Track in [docs/API-NOTES.md](docs/API-NOTES.md).

## Caching TTLs

| What | TTL | Reason |
|---|---|---|
| AEMET municipal forecasts | 3h | Updates 4×/day at 00/06/12/18 UTC |
| AEMET station observations | 30min | Updates ~hourly |
| IPMA forecasts | 6h | Updates 2×/day |
| Open-Meteo (forecast/marine/AQ) | 1–3h | Model runs; see DATA-SOURCES-RESEARCH.md |

Implementation: in-memory Map + localStorage mirror, both keyed `{source}:{kind}:{locationId}`, TTL checked on read.

## Conventions

- **Files:** kebab-case for non-component files (`aemet.ts`, `normalize.ts`); PascalCase for components (`Home.tsx`).
- **Types:** PascalCase, prefer `interface` for object shapes that may be extended, `type` for unions/aliases.
- **Imports:** absolute via `@/` alias to `src/` (configure in `vite.config.ts` and `tsconfig.json`).
- **No `any`:** type the boundaries; use `unknown` then narrow if a third-party shape is genuinely unknown.
- **Error handling:** services throw typed errors; hooks expose `{ data, error, loading }`; views render error/skeleton states.

## Commands

```bash
bun install              # install deps
bun run dev              # vite dev server
bun run build            # production build
bun run preview          # preview production build
bun run typecheck        # tsc --noEmit
bun run lint             # eslint (configured in Phase 1 scaffold)
```

## Known gotchas / decisions

- **Bun vs npm:** Architecture doc says npm in places — ignore, we use Bun. See [docs/DECISIONS.md](docs/DECISIONS.md#d-001-package-manager).
- **Key proxy:** AEMET key goes behind a Supabase edge function (Deno), matching sw-client-app — not exposed in the client bundle, and not a Cloudflare Worker. (Supersedes the original brief, which exposed the key client-side and deferred a Worker.)
- **AEMET station IDs:** alphanumeric (e.g. `B228`). Municipality codes: 5-digit zero-padded strings (e.g. `07040`). Don't strip leading zeros — `parseInt`-ing a municipio ID is a bug.
- **IPMA weather type IDs:** integers that map to text descriptions via a separate lookup table. Cache the table; don't refetch per request.
