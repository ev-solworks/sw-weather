# SW Weather

Personal weather PWA for SOLWORKS. Clean, ad-free, dark-mode forecasts for Spain (incl. Canary Islands) and Portugal (incl. Azores/Madeira). Replaces eltiempo.es.

**Stack:** React + Vite + TypeScript + Tailwind + vite-plugin-pwa, Bun for tooling.

## Quick start

```bash
bun install
cp .env.example .env       # then add your AEMET API key
bun run dev
```

## Project docs

- [CLAUDE.md](CLAUDE.md) — project guide for Claude Code sessions (stack, conventions, gotchas)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — full architecture (data sources, normalization model, all 6 phases)
- [docs/PHASES.md](docs/PHASES.md) — phase-by-phase build tracker
- [docs/API-NOTES.md](docs/API-NOTES.md) — AEMET / IPMA quirks and gotchas
- [docs/DECISIONS.md](docs/DECISIONS.md) — architectural decisions log
- [docs/KICKOFF-PROMPT.md](docs/KICKOFF-PROMPT.md) — original Claude Code kickoff brief

## Status

**Phase 1 — Core MVP** in progress. See [docs/PHASES.md](docs/PHASES.md).
