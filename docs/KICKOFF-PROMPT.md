# SW Weather App — Claude Code Kickoff Prompt

## Copy everything below this line into Claude Code:

---

## Context

I'm building a personal weather PWA called **SW Weather** for SOLWORKS. It replaces eltiempo.es with a clean, ad-free UI and professional-grade forecast accuracy for Spain (including Canary Islands) and Portugal.

The full architecture doc is at: `sw-weather-app-architecture.md` (I'll paste it into the project root or provide it as context). Read it fully before starting — it contains all API endpoints, data models, caching strategy, and build phases.

## What to build (Phase 1 — Core MVP)

Scaffold and build the core weather app with these specifications:

### Stack
- React + Vite + TypeScript + Tailwind CSS
- `vite-plugin-pwa` for PWA/installable support
- Bun as package manager
- Dark mode first (single theme for now)

### Project structure
```
sw-weather/
├── src/
│   ├── components/          # Reusable UI components
│   ├── views/               # Page-level views
│   │   ├── Home.tsx         # Current conditions + summary
│   │   ├── Today.tsx        # Hourly forecast timeline (48h)
│   │   └── Week.tsx         # 7-day daily forecast
│   ├── services/
│   │   ├── aemet.ts         # AEMET API client (Spain)
│   │   ├── ipma.ts          # IPMA API client (Portugal)
│   │   └── normalize.ts     # Unified data model + normalization
│   ├── hooks/               # Custom React hooks
│   ├── types/               # TypeScript interfaces
│   │   └── weather.ts       # WeatherConditions interface (see arch doc)
│   ├── utils/
│   │   ├── cache.ts         # Client-side caching layer
│   │   └── locations.ts     # Saved locations + lookup mappings
│   ├── App.tsx
│   └── main.tsx
├── public/
├── .env.example             # VITE_AEMET_API_KEY=
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── CLAUDE.md
```

### Data sources for Phase 1
1. **AEMET API** — Primary forecast for Spain. Implement the two-step fetch pattern (metadata → datos URL). Include:
   - Municipal hourly forecast (48h): `/prediccion/especifica/municipio/hora/{id}`
   - Municipal daily forecast (7d): `/prediccion/especifica/municipio/diaria/{id}`
   - Current station observations: `/observacion/convencional/todas`
   - API key passed via `api_key` query param
   - **Critical:** The datos URL in the response is temporary — cache the final data, not the URL

2. **IPMA API** — Primary forecast for Portugal. No API key needed.
   - Daily forecast: `/forecast/meteorology/cities/daily/{globalIdLocal}.json`
   - Open JSON endpoints, straightforward fetch

3. **Normalization layer** — Both sources must normalize to the unified `WeatherConditions` TypeScript interface defined in the architecture doc. Every view consumes normalized data, never raw API responses.

### Views to build

**Home / Now view:**
- Current conditions from nearest AEMET station (temperature, humidity, wind, pressure)
- "Feels like" temperature
- Weather description + icon
- Station name and distance from location
- How long ago the observation was taken
- Active alerts banner (if any — pull from AEMET `/avisos` if straightforward, otherwise defer)

**Today view:**
- Hourly timeline for next 48 hours
- Temperature, precipitation probability, wind speed + direction, UV index
- Scroll horizontally through hours
- Visual indicators for rain probability (color-coded bars or similar)

**Week view:**
- 7-day daily forecast cards
- Min/max temperature, precipitation probability, wind, icon
- Tap to expand and show hourly breakdown for that day

### Location management
- Start with a hardcoded set of saved locations:
  - Palma de Mallorca (AEMET municipio: 07040)
  - Ibiza / Eivissa (AEMET municipio: 07026)
  - Santa Cruz de Tenerife (AEMET municipio: 38038)
  - Madrid (AEMET municipio: 28079)
  - Lisboa (IPMA globalIdLocal: 1110600)
- Location switcher in the header/nav
- Store selected location in localStorage
- Each location needs: name, country (ES/PT), lat/lon, AEMET municipio ID or IPMA globalIdLocal, nearest AEMET station ID, timezone, isCoastal flag

### Caching
- AEMET forecasts: cache for 3 hours (they update 4x daily)
- AEMET station observations: cache for 30 minutes
- IPMA forecasts: cache for 6 hours
- Use a simple in-memory + localStorage cache with TTL checking
- On cache miss, fetch fresh data; on cache hit, return cached and optionally refresh in background

### Design requirements
- Dark mode, minimal chrome, data-dense but readable
- No ads, no tracking, no cookies beyond localStorage for preferences
- Mobile-first responsive layout (this will be used primarily on phone)
- Use a consistent weather icon set — either Meteocons, Weather Icons, or custom SVGs. Pick one and be consistent
- Navigation: bottom tab bar (Home / Today / Week) — more tabs will be added in later phases
- Loading skeleton states while data is fetching

### CLAUDE.md
Create a project CLAUDE.md that includes:
- Project overview and purpose
- Stack and key dependencies
- API keys needed (AEMET) and how to set them up (.env)
- Architecture overview (data flow: API → service → normalize → hook → view)
- The AEMET two-step fetch pattern explanation
- AEMET rate limit (50 req/min) — batch and cache aggressively
- Timezone handling notes (Spain mainland vs Canary Islands vs Portugal vs Azores)
- Phase overview (we're in Phase 1, phases 2-6 planned)
- Known gotchas and decisions made

### Important implementation notes
- **AEMET two-step fetch:** Every AEMET API call returns `{ datos: "https://...", metadatos: "https://..." }`. You must GET the `datos` URL to get actual forecast data. The datos URL expires, so never cache it — always cache the final resolved data.
- **AEMET rate limit:** 50 requests/minute. For the initial load of a Spain location, you'll need ~3 calls (hourly forecast + daily forecast + nearest station obs). That's fine, but be careful not to spam on rapid location switching.
- **Timezone handling:** Spain mainland = Europe/Madrid, Canary Islands = Atlantic/Canary (1h behind), Portugal = Europe/Lisbon (same as Canary), Azores = Atlantic/Azores (1h behind Lisbon). All times in the UI should be displayed in the location's local timezone.
- **AEMET municipality codes** are 5-digit strings (e.g., "07040" for Palma). Station IDs are alphanumeric (e.g., "B228" for Palma airport). I'll provide the station-to-location mapping — for now, hardcode the nearest station for each saved location.
- **IPMA location IDs** are 7-digit numbers. Their API returns weather type IDs that map to descriptions — you'll need their weather type lookup table.

### What NOT to do in Phase 1
- No Open-Meteo, Meteoblue, or RainViewer integration yet (Phase 2-3)
- No wind-specific view or Windguru embeds (Phase 2-3)
- No air quality, marine, or solar views (Phase 2-4)
- No Leaflet maps (Phase 3)
- No Capacitor / native iOS (Phase 6)
- No edge function proxy — use API keys directly in client for now (will proxy later)
- No user authentication or accounts

### Before you start
1. Read the full architecture doc if provided
2. Check the AEMET API docs at `https://opendata.aemet.es/dist/index.html` — fetch the OpenAPI spec or docs page to understand the exact response formats
3. Check the IPMA API at `https://api.ipma.pt` — test a few endpoints to see response shapes
4. Plan the data normalization layer first — this is the foundation everything else depends on
5. Scaffold the project, get a basic Vite + React + Tailwind app running, then build service layer → hooks → views incrementally
6. Test with real API calls early — don't build the entire UI against mocked data and then discover the API returns something unexpected
