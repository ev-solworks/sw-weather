# Architectural Decisions

ADR-style log. Each entry: what we decided, when, why, and what we rejected. Append-only — when a decision is reversed, add a new entry that supersedes it rather than editing history.

---

## D-001 — Package manager: Bun

**Date:** 2026-05-05
**Status:** Active

Use **Bun** for install + script running. The architecture doc mentions npm in places; that's stale guidance.

**Why:** Faster installs and script execution. User runs Bun across other SW projects — consistency.
**Rejected:** npm (slower), pnpm (no compelling reason over Bun for this project's size).
**Caveat:** Some Vite plugins occasionally have rough edges with Bun. If a plugin breaks, fall back to npm for that plugin's lifecycle scripts only — don't switch the whole project.

---

## D-002 — Single dark theme in Phase 1

**Date:** 2026-05-05
**Status:** Active

No theme switcher in Phase 1. Dark only.

**Why:** This app is primarily used on phone outdoors and in dim light. Dark mode is the right default. Adding a theme switcher means adding a settings UI, persisting preference, and testing both — all overhead for zero current value.
**Future:** Phase 5 polish may add light mode if there's actual demand.

---

## D-003 — No edge proxy in Phase 1

**Date:** 2026-05-05
**Status:** Active (revisit Phase 2)

AEMET API key is exposed in client bundle in Phase 1. No Cloudflare Worker / Vercel Edge Function proxy yet.

**Why:** Personal app, single user, key can be revoked + reissued in 30 seconds if leaked. Proxy adds deployment complexity and a second moving piece before the core app even works.
**Phase 2:** Add the proxy alongside Meteoblue integration (Meteoblue's terms more strictly require server-side keys).
**Trigger to revisit early:** if we decide to share the URL with anyone else, proxy goes in immediately.

---

## D-004 — Hardcoded saved locations in Phase 1

**Date:** 2026-05-05
**Status:** Active (revisit Phase 5)

Five locations hardcoded in `src/utils/locations.ts`. No add/remove/edit UI.

**Why:** User has a fixed set of locations they care about. Build the data flow against real locations first; add CRUD when the data flow works.
**Phase 5:** Add custom location management.

---

## D-005 — Folder structure: feature-light, layer-heavy

**Date:** 2026-05-05
**Status:** Active

Folders organized by **layer** (`components/`, `hooks/`, `services/`, `views/`, `utils/`, `types/`) rather than by **feature** (no `features/weather/`, `features/radar/`).

**Why:** App is small (Phase 1 has 3 views). Layer-based is simpler to reason about at this size. Switch to feature-based if/when we hit ~10+ views or distinct domains.

---

## D-006 — Normalize at the service boundary, not in views

**Date:** 2026-05-05
**Status:** Active

All AEMET/IPMA responses are normalized to `WeatherConditions` in `src/services/normalize.ts`. Views consume only the normalized type.

**Why:** Three reasons.
1. Adding Phase 2 sources (Open-Meteo, Meteoblue) means changing normalize.ts and zero view code.
2. Tests can use plastic `WeatherConditions` fixtures without mocking HTTP.
3. View components stay stupid — they render data, they don't interpret it.

**Rule:** If a view component imports anything from `services/aemet.ts` or `services/ipma.ts` directly, that's a bug.

---

## D-007 — Weather icon set: deferred to scaffold completion

**Date:** 2026-05-05
**Status:** Open

Pick **one** icon set during Phase 1 scaffold and use it everywhere. Candidates:
- **Meteocons** (free, SVG, animated variants available) — leading candidate
- **Weather Icons** (font-based, large set, less modern feel)
- **Custom SVG** (full control, more work)

**Decision deadline:** before any view renders an icon. The `normalize.ts` icon mapping can't be written without knowing the target set.
