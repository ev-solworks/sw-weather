# SW Weather App — Architecture & Build Plan

## Overview

Personal weather PWA for SOLWORKS, covering Spain (including Canary Islands), Portugal (including Azores/Madeira). Built to replace eltiempo.es with better UI, no ads, and professional-grade forecast accuracy through multi-source data blending.

**Stack:** React + Vite + TypeScript + Tailwind CSS (consistent with SW ecosystem)
**Deployment:** Cloudflare Pages or Vercel (TBD — align with other SW apps)
**PWA:** Yes — `vite-plugin-pwa` for installable mobile experience

---

## Data Sources

### Primary Forecast — Spain

**AEMET OpenData API**
- Endpoint base: `https://opendata.aemet.es/opendata/api/`
- Auth: API key (header `api_key`)
- Two-step pattern: initial request returns JSON with `datos` URL → GET that URL for actual data
- Rate limit: 50 requests/minute
- Coverage: 8,124 municipalities

| Data Type | Endpoint | Update Freq | Notes |
|-----------|----------|-------------|-------|
| Municipal daily forecast (7d) | `/prediccion/especifica/municipio/diaria/{municipio_id}` | 4x daily | Best local accuracy for Spain |
| Municipal hourly forecast (48h) | `/prediccion/especifica/municipio/hora/{municipio_id}` | 4x daily | Hourly resolution |
| Current station observations | `/observacion/convencional/datos/estacion/{station_id}` | ~1h | ~800 stations, ground truth |
| All stations latest obs | `/observacion/convencional/todas` | ~1h | Bulk current conditions |
| Weather alerts/warnings | `/avisos` | As issued | Official government warnings |
| Beach forecasts | `/prediccion/especifica/playa/{playa_id}` | Daily | UV, water temp, wave state |
| Marine forecasts | `/prediccion/maritima/costera/costa/{area_id}` | 2x daily | Coastal conditions |
| Radar imagery | Via AEMET maps/radar endpoints | ~10 min | Spanish radar network |
| UV index | Included in municipal forecasts | Daily | Spain-specific |

**Key implementation notes:**
- AEMET forecasts are MOS-corrected by meteorologists — this is why they're more accurate than raw model output
- The two-step API pattern (metadata → datos URL) requires careful async handling
- Station IDs and municipality codes need a lookup/mapping layer
- AEMET uses HARMONIE-AROME (high-res) and ECMWF models internally

### Primary Forecast — Portugal

**IPMA Open API**
- Endpoint base: `https://api.ipma.pt/open-data/`
- Auth: None required (open JSON endpoints)
- No rate limit documented

| Data Type | Endpoint | Update Freq | Notes |
|-----------|----------|-------------|-------|
| Daily forecast by location | `/forecast/meteorology/cities/daily/{globalIdLocal}.json` | 2x daily | ~300 locations |
| Daily forecast by day (all) | `/forecast/meteorology/cities/daily/hp-daily-forecast-day{idDay}.json` | 2x daily | idDay: 0-2 |
| 10-day + hourly forecast | Via IPMA website/app (check API availability) | 2x daily | Hourly for first 3 days |
| Weather warnings | `/forecast/warnings/warnings_www.json` | As issued | Official alerts |
| Sea state / marine | `/forecast/oceanography/daily/hp-daily-sea-forecast-day{idDay}.json` | 2x daily | Swell, wave height |

**Key implementation notes:**
- IPMA uses ECMWF + their own AROME high-res model
- Location IDs need lookup (capitais distrito e ilhas)
- Data updates ~9-10 AM and ~9-10 PM local time
- More limited than AEMET in granularity but solid accuracy

### Secondary Forecast (MOS-corrected quality layer)

**Meteoblue Free API**
- Auth: API key (register for free non-commercial use, 1-year validity)
- Uses their Learning MultiModel (mLM) — dynamically selects best model combination per location
- Ranked #1 globally for 12h-ahead temperature forecasts (0.9°C MAE)
- Free tier includes Basic, Current, and possibly MultiModel packages

**Use case:** Cross-reference against AEMET/IPMA forecasts. Where they diverge significantly, Meteoblue's MOS-corrected data can provide a confidence signal. Not the primary display source, but the "second opinion."

### Fallback Forecast + Supplementary Data

**Open-Meteo**
- Endpoint base: `https://api.open-meteo.com/v1/`
- Auth: None required (free for non-commercial)
- No hard rate limit for reasonable use

| Data Type | Endpoint | Key Params | Notes |
|-----------|----------|------------|-------|
| Forecast | `/forecast` | `models=ecmwf_ifs025` | **Always specify model** — do NOT use `best_match` default for Iberian Peninsula |
| Air quality / pollen | `/v1/air-quality` | PM10, PM2.5, pollen types | CAMS data — good for calima/dust events |
| Marine | `/v1/marine` | Wave height, period, SST | Supplement AEMET/IPMA marine |
| Apparent temperature | In forecast endpoint | `apparent_temperature` | Feels-like accounting for wind + humidity |
| Ensemble (confidence) | `/v1/ensemble` | Multiple model runs | Probability distribution of outcomes |

**Critical:** For Spain/Portugal, use `models=ecmwf_ifs025` or `models=meteofrance_seamless`. The default `best_match` often selects ICON-D2 (German model) which is suboptimal for western Mediterranean / Atlantic islands.

### Radar Overlay

**RainViewer**
- Tile API: Free for personal/educational use, no API key required
- Coverage: 1,000+ global radars including EUMETNET (covers Spain + Portugal)
- Update: Every 5-10 minutes
- Format: Standard map tiles (Leaflet/Mapbox compatible)
- Data: Past 2h radar + 2h nowcast projection
- Limitation: Free tier is past radar only (no forecast/nowcast tiles), universal blue color scheme only

**Implementation:** Leaflet.js with RainViewer tile overlay. Animated playback of last 2 hours + nowcast.

### Solar Calculations (Client-side, no API)

- Sunrise / sunset
- Golden hour / blue hour (start + end times)
- Civil, nautical, astronomical twilight
- Solar elevation and azimuth
- Moon phase, moonrise, moonset

**Note:** Core sunrise/sunset logic already exists in SW Client App — port and extend for golden hour, blue hour, and twilight calculations. Library option: `suncalc` (npm) handles all of this.

### Wind Data + Maps

Wind forecasting draws from multiple sources already in the stack, plus optional Windguru embeds.

#### Native Wind Data (already covered by existing sources)

All primary forecast sources include wind data:

| Source | Wind Variables | Resolution | Notes |
|--------|---------------|------------|-------|
| AEMET municipal forecast | Speed, direction, gusts | Per municipality, hourly (48h) | Most locally accurate for Spain |
| IPMA forecast | Speed, direction | Per location, daily | Portugal coverage |
| Open-Meteo (`ecmwf_ifs025`) | Speed 10m/80m/120m, direction, gusts | 25km, hourly | Multi-altitude wind profiles |
| Open-Meteo (`icon_seamless`) | Speed, direction, gusts | 7km (ICON-EU), hourly | Higher resolution for Europe |
| Meteoblue | Speed, direction, gusts | MOS-corrected | Best post-processed accuracy |

**Implementation:** Build a Windguru-style wind table using Open-Meteo data with multiple models (`ecmwf_ifs025`, `icon_seamless`). Color-code wind speed cells using Beaufort scale or custom thresholds. Show wind direction with arrows/icons. Allow model comparison side-by-side (like Windguru's multi-table layout).

Key Open-Meteo wind parameters:
```
GET /v1/forecast?latitude=X&longitude=Y
  &models=ecmwf_ifs025,icon_seamless
  &hourly=wind_speed_10m,wind_speed_80m,wind_direction_10m,wind_gusts_10m
```

#### Windguru Embeds (supplementary)

Windguru does not offer a public forecast API. However, it provides embeddable widgets for websites.

**Widget integration approach:**
- Windguru widgets are JavaScript-based (`<script>` embeds) or iframe-based
- Can be embedded in a dedicated "Windguru" tab/view within the app
- Widget URL format: `https://www.windguru.cz/int/distr_iframe.php?u={USER_ID}&s={SPOT_ID}&c={CHECKSUM}`
- Widgets are configurable: spot, model selection, display parameters

**Restyling strategy:**
- Embed Windguru widget in a container `<div>` with CSS overrides where possible
- Use `iframe` with `postMessage` for any interaction, or overlay a custom header/frame
- For deeper restyling: wrap the iframe in a styled container that matches the app's dark theme — add custom header bar with spot name, model selector, and link to full Windguru page
- Note: iframe content itself cannot be restyled (cross-origin), but the surrounding chrome can be made consistent with the app design

**Windguru PRO consideration:**
- Free tier: GFS 13km only — adequate for trends but not hyperlocal
- PRO (~€28/year): Unlocks WRF 3km, ICON 7km, Zephyr-HD 3km, AI-enhanced forecasts
- For personal use, PRO is worth it if wind accuracy matters (production shoots, water sports)
- PRO also removes ads from widgets

#### Animated Wind Map

Two options for the particle-flow wind visualization:

**Option A: Windy.com embed (fast, free)**
- Windy offers a free embeddable widget with animated wind particle maps
- Configurable: map layer, zoom, location, marker
- Supports ECMWF, GFS, ICON models
- Embed URL: `https://embed.windy.com/embed.html?type=map&location=coordinates&...`
- Limitation: free for media/website use, commercial use unclear — fine for personal app

**Option B: Custom wind particle renderer (full control, more work)**
- Use Open-Meteo grid wind data to render particle animation on HTML Canvas
- Open-source reference: `earth.nullschool.net` style (based on Cameron Beccario's project)
- Libraries: `leaflet-velocity` or custom WebGL particle system
- Full control over styling, model selection, and interaction
- Significantly more build effort — defer to later phase unless critical

**Recommendation:** Start with Windy.com embed for the animated map (Phase 3, alongside radar). Build the custom wind table using Open-Meteo data (Phase 1-2). Add Windguru widget embed as an optional "expert wind view" for users who want the Windguru multi-model table format.

---

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────┐
│                   Frontend (PWA)                 │
│         React + Vite + TypeScript + Tailwind     │
│                                                  │
│  ┌─────────┐  ┌──────────┐  ┌────────────────┐  │
│  │ Current  │  │ Forecast │  │  Map + Radar   │  │
│  │ Condtns  │  │  Views   │  │   (Leaflet)    │  │
│  └────┬─────┘  └────┬─────┘  └───────┬────────┘  │
│       │              │                │           │
│  ┌────┴──────────────┴────────────────┴────────┐  │
│  │           Data Service Layer                │  │
│  │    (fetch, cache, merge, normalize)         │  │
│  └────┬──────────────┬────────────────┬────────┘  │
└───────┼──────────────┼────────────────┼───────────┘
        │              │                │
   ┌────┴────┐   ┌─────┴─────┐   ┌─────┴──────┐
   │  AEMET  │   │ Open-Meteo│   │ RainViewer │
   │  IPMA   │   │ Meteoblue │   │   Tiles    │
   │(forecast│   │(supplement│   │  (radar)   │
   │  + obs) │   │  + AQ)    │   │            │
   └─────────┘   └───────────┘   └────────────┘
```

### API Key Management

- **AEMET:** Environment variable (`VITE_AEMET_API_KEY`) — consider proxying through a lightweight edge function to avoid exposing key in client bundle
- **Meteoblue:** Same approach — proxy recommended
- **IPMA:** No key needed
- **Open-Meteo:** No key needed
- **RainViewer:** No key needed

**Recommendation:** Use Cloudflare Workers or Vercel Edge Functions as a thin proxy for AEMET and Meteoblue calls. This also lets you add caching at the edge (AEMET forecasts only update 4x/day, so aggressive caching is fine).

### Caching Strategy

| Source | Cache TTL | Reason |
|--------|-----------|--------|
| AEMET municipal forecast | 3 hours | Updates 4x daily (00, 06, 12, 18 UTC) |
| AEMET station observations | 30 min | Updates ~hourly, want near-real-time feel |
| AEMET alerts | 15 min | Safety-critical, needs freshness |
| IPMA forecast | 6 hours | Updates 2x daily |
| Open-Meteo forecast | 1 hour | Models update every 1-6 hours |
| Open-Meteo air quality | 1 hour | |
| Meteoblue | 3 hours | Secondary source, less critical |
| RainViewer tiles | No cache | Real-time animation |
| Solar calculations | 24 hours | Only changes daily for a given location |

Use Service Worker (via vite-plugin-pwa) for offline support — cache last-known forecast so the app is useful even without connectivity.

### Data Normalization

All sources return different formats. Normalize to a unified internal model:

```typescript
interface WeatherConditions {
  // Current (from station observations)
  current: {
    temperature: number;        // °C
    feelsLike: number;          // °C (apparent)
    humidity: number;           // %
    windSpeed: number;          // km/h
    windDirection: number;      // degrees
    windGust: number;           // km/h
    pressure: number;           // hPa
    precipitation: number;      // mm (last hour)
    description: string;        // normalized condition text
    icon: string;               // mapped to consistent icon set
    stationId: string;          // source station
    stationName: string;
    stationDistance: number;     // km from requested location
    observedAt: Date;
  };

  // Hourly forecast (up to 48h)
  hourly: Array<{
    time: Date;
    temperature: number;
    feelsLike: number;
    humidity: number;
    windSpeed: number;
    windDirection: number;
    precipProbability: number;  // %
    precipAmount: number;       // mm
    uvIndex: number;
    cloudCover: number;         // %
    icon: string;
    source: 'aemet' | 'ipma' | 'openmeteo' | 'meteoblue';
  }>;

  // Daily forecast (up to 7-14d)
  daily: Array<{
    date: Date;
    tempMax: number;
    tempMin: number;
    precipProbability: number;
    precipAmount: number;
    windSpeed: number;
    windDirection: number;
    uvIndex: number;
    sunrise: Date;
    sunset: Date;
    goldenHourAM: { start: Date; end: Date };
    goldenHourPM: { start: Date; end: Date };
    blueHourAM: { start: Date; end: Date };
    blueHourPM: { start: Date; end: Date };
    moonPhase: number;          // 0-1
    icon: string;
    source: 'aemet' | 'ipma' | 'openmeteo' | 'meteoblue';
  }>;

  // Alerts
  alerts: Array<{
    severity: 'yellow' | 'orange' | 'red';
    type: string;               // rain, wind, heat, etc.
    headline: string;
    description: string;
    start: Date;
    end: Date;
    source: 'aemet' | 'ipma';
  }>;

  // Air quality
  airQuality: {
    aqi: number;                // European AQI
    pm25: number;
    pm10: number;               // Important for calima/Saharan dust
    pollen: {
      grass: number;
      olive: number;            // Very relevant for southern Spain
      birch: number;
    };
    source: 'openmeteo';
  };

  // Marine (when applicable)
  marine?: {
    waveHeight: number;         // m
    wavePeriod: number;         // s
    waveDirection: number;      // degrees
    seaSurfaceTemp: number;     // °C
    source: 'aemet' | 'ipma' | 'openmeteo';
  };
}
```

---

## UI Concepts

### Views

1. **Home / Now** — Current conditions (station data), "feels like", next-hour precipitation indicator, active alerts banner
2. **Today** — Hourly timeline with temp, precip probability, wind. Golden hour / blue hour markers on timeline
3. **Week** — 7-day daily forecast cards. Tap to expand hourly
4. **Wind** — Windguru-style color-coded wind table (speed, direction, gusts) with multi-model comparison. Embedded Windguru widget as "expert view". Animated wind map (Windy.com embed or custom)
5. **Radar** — Full-screen map with animated precipitation overlay (RainViewer)
6. **Air Quality** — AQI, PM levels, pollen. Calima alert when PM10 spikes
7. **Marine** — Wave height, period, sea temp, wind (for coastal locations)
8. **Solar** — Sunrise/sunset, golden hour, blue hour, twilight times, moon phase. Production planning view

### Design Principles

- Dark mode first (outdoor readability in bright conditions)
- Minimal chrome, data-dense but not cluttered
- No ads, no tracking, no cookies
- Location-first: saved locations with quick switcher (Mallorca, Ibiza, Tenerife, Madrid, Lisbon, etc.)
- Offline-capable via Service Worker
- Instant load — aggressive caching, skeleton UI while fetching

### Location Management

```typescript
interface SavedLocation {
  id: string;
  name: string;                    // "Palma" / "Santa Cruz de Tenerife"
  country: 'ES' | 'PT';
  lat: number;
  lon: number;
  aemetMunicipioId?: string;       // e.g., "07040" for Palma
  aemetStationId?: string;         // Nearest AEMET station
  ipmaGlobalIdLocal?: number;      // e.g., 1110600 for Lisboa
  isCoastal: boolean;              // Show marine data?
  timezone: string;                // e.g., "Europe/Madrid", "Atlantic/Canary"
}
```

---

## Build Phases

### Phase 1 — Core MVP
- [ ] Project scaffold (Vite + React + TS + Tailwind + PWA)
- [ ] AEMET API integration (forecast + current observations)
- [ ] IPMA API integration (forecast)
- [ ] Data normalization layer
- [ ] Home/Now view with current conditions
- [ ] Today view with hourly forecast
- [ ] Week view with daily forecast
- [ ] Location management (hardcoded initial set, then add/remove)
- [ ] Basic dark mode UI

### Phase 2 — Enhanced Data + Wind
- [ ] Open-Meteo integration (air quality, pollen, apparent temp, marine)
- [ ] Wind view: Windguru-style color-coded wind table (Open-Meteo multi-model)
- [ ] Wind view: model comparison (ECMWF vs ICON side-by-side)
- [ ] Meteoblue free tier integration
- [ ] AEMET alerts / IPMA warnings
- [ ] Air quality view (with calima/dust alerting)
- [ ] Marine view for coastal locations
- [ ] Edge function proxy for API key protection + caching

### Phase 3 — Radar + Wind Maps + Embeds
- [ ] Leaflet integration with RainViewer tiles
- [ ] Animated radar playback (last 2h + nowcast)
- [ ] Station map showing nearest observation points
- [ ] Windy.com animated wind map embed
- [ ] Windguru widget embed (restyled container, dark theme wrapper)
- [ ] Windguru spot ID mapping for saved locations

### Phase 4 — Solar + Production Tools
- [ ] Port sunrise/sunset from SW Client App
- [ ] Extend with golden hour, blue hour, twilight calculations
- [ ] Moon phase and moonrise/moonset
- [ ] Production planning view (shoot-day weather summary)

### Phase 5 — Polish
- [ ] Offline support (Service Worker caching)
- [ ] Push notifications for alerts (ntfy.sh integration)
- [ ] Widget-style compact view
- [ ] Performance optimization
- [ ] Geolocation for "current location" weather

### Phase 6 — Native iOS (Capacitor) + AR Solar Tracker
- [ ] Apple Developer Program enrollment ($99/year)
- [ ] Capacitor integration (wrap existing PWA)
- [ ] Native Swift plugin: sensor fusion (CMMotionManager + CLLocationManager)
- [ ] AR Sun Tracker view (camera overlay with sun path)
- [ ] AR Moon Tracker (same engine, different ephemeris)
- [ ] Deploy to personal device via Xcode (no App Store needed)
- [ ] TestFlight setup for OTA updates to own device
- [ ] iOS widgets (Lock Screen + Home Screen) for current conditions
- [ ] Apple Watch complication (stretch goal)

---

## Native iOS / Capacitor Architecture

### Why Capacitor (not pure native or React Native)

The weather app is 90% data views — forecasts, charts, radar maps, air quality — which work perfectly as web. The only feature that *requires* native sensor access is the AR solar tracker. Capacitor lets us:

1. Keep the entire weather UI as React/TypeScript (one codebase, also serves as PWA)
2. Add native Swift plugins only for features that need hardware access
3. Ship to the App Store with full native capabilities
4. Access iOS-specific features: widgets, notifications, background refresh

### AR Solar Tracker — Why PWA Can't Do This

The AR sun/moon position overlay requires:

| Capability | PWA (Safari) | Native (Swift) |
|-----------|-------------|----------------|
| Compass heading | `webkitCompassHeading` — non-standard, ±10° accuracy, drift | `CLLocationManager.heading` — true north, <3° accuracy |
| Gyroscope | `DeviceMotionEvent` — permission-gated, no sensor fusion control | `CMMotionManager.deviceMotion` — full sensor fusion, attitude quaternions |
| Magnetometer correction | No access to raw magnetometer | `CMMagneticField` — can filter interference |
| Game rotation (drift-free) | Not available | `CMAttitudeReferenceFrame.xArbitraryCorrectedZVertical` — gyro-only, zero drift |
| Camera AR overlay | Limited WebRTC, no ARKit | Full ARKit or AVCaptureSession + SceneKit/RealityKit |
| Sensor fusion | Browser decides, no control | Custom Kalman filter or Apple's built-in fusion |
| Update rate | ~60Hz max, often throttled | Up to 100Hz, consistent |

**The core drift problem:** Safari's DeviceOrientationEvent uses magnetometer-based absolute orientation, which drifts when near metal objects (buildings, cars, tripods). Native iOS offers `CMAttitudeReferenceFrame.xArbitraryCorrectedZVertical` which uses gyroscope-only rotation (no magnetometer drift) and periodically snaps to magnetic north for absolute reference. This is what apps like Sun Seeker and PhotoPills use — it's simply not available via web APIs.

### Capacitor Project Structure

```
sw-weather/
├── src/                          # React app (shared web + native)
│   ├── components/
│   ├── services/
│   │   ├── weather/              # AEMET, IPMA, Open-Meteo, Meteoblue
│   │   ├── solar/                # Sunrise/sunset calculations (pure TS)
│   │   └── native/               # Capacitor plugin bridges
│   │       ├── ar-tracker.ts     # JS interface to native AR plugin
│   │       └── sensors.ts        # JS interface to native sensors
│   └── views/
│       ├── Home.tsx
│       ├── Forecast.tsx
│       ├── Radar.tsx
│       ├── AirQuality.tsx
│       ├── Marine.tsx
│       ├── Solar.tsx              # Non-AR solar data (works in PWA too)
│       └── ARTracker.tsx          # AR camera view (native only, hidden in PWA)
├── ios/                           # Capacitor iOS project
│   └── App/
│       └── Plugins/
│           └── SolarARPlugin/
│               ├── SolarARPlugin.swift       # Plugin entry point
│               ├── SunPositionEngine.swift   # Ephemeris calculations
│               ├── SensorFusionManager.swift # CMMotionManager + heading
│               └── AROverlayRenderer.swift   # Camera + sun path overlay
├── capacitor.config.ts
├── vite.config.ts
├── package.json
└── CLAUDE.md
```

### Native Swift Plugin — SolarARPlugin

```swift
// Key interfaces the plugin would expose to the JS layer:

// 1. Start AR tracking session
// Returns real-time heading, pitch, roll + sun/moon positions
startTracking(date: Date, location: CLLocationCoordinate2D)

// 2. Get current device orientation (fused sensors)
// Uses CMMotionManager with game rotation + periodic mag correction
getCurrentOrientation() -> { heading: Double, pitch: Double, roll: Double, accuracy: Double }

// 3. Calculate sun position for given date/time/location
// Pure ephemeris — can also run in JS but native is faster for animation
getSunPosition(date: Date, lat: Double, lon: Double) -> { azimuth: Double, elevation: Double }

// 4. Get sun path for full day (array of positions)
// Used to render the arc overlay on camera view
getSunPath(date: Date, lat: Double, lon: Double, intervalMinutes: Int) -> [SunPosition]
```

### Sensor Fusion Strategy (Native)

```
┌──────────────────────────────────────────┐
│           Sensor Fusion Manager          │
│                                          │
│  ┌─────────┐  ┌──────────┐  ┌────────┐  │
│  │  Gyro   │  │  Accel   │  │  Mag   │  │
│  │ (100Hz) │  │ (100Hz)  │  │(~10Hz) │  │
│  └────┬────┘  └────┬─────┘  └───┬────┘  │
│       │             │            │        │
│  ┌────┴─────────────┴────┐  ┌───┴─────┐  │
│  │  Game Rotation Vector │  │ Compass │  │
│  │  (drift-free, fast)   │  │ Heading │  │
│  │  CMAttitudeReference  │  │  (true  │  │
│  │  .xArbitraryCorr...  │  │  north) │  │
│  └──────────┬────────────┘  └───┬─────┘  │
│             │                   │         │
│  ┌──────────┴───────────────────┴──────┐  │
│  │  Complementary Filter / Kalman     │  │
│  │  - Fast updates from gyro (smooth) │  │
│  │  - Periodic correction from mag    │  │
│  │  - Reject mag when accuracy < 20°  │  │
│  └──────────────┬─────────────────────┘  │
│                 │                         │
│       Fused heading + attitude            │
│       (smooth, accurate, low drift)       │
└──────────────────────────────────────────┘
```

### What the AR View Would Show

```
┌─────────────────────────────────┐
│  Camera feed (live)             │
│                                 │
│         ☀ (current sun)         │
│        ╱                        │
│  ·····•·····•·····•·····•····   │  ← Sun path arc (today)
│  6AM  8AM  10AM  12PM   2PM     │
│                                 │
│  ───────────────────────────    │  ← Horizon line
│                                 │
│  🌅 Golden Hour: 19:42-20:18   │  ← Info overlay
│  N 42°  ↑ Elev: 62°            │  ← Heading + solar elevation
└─────────────────────────────────┘
```

Features:
- Live camera with sun path arc overlay
- Scrub timeline to see sun position at any hour/date
- Golden hour and blue hour zones highlighted on the arc
- Shadow direction indicator (useful for location scouting)
- Tap to drop a pin: "sun will be here at 16:30 on June 15th"
- Save scouting screenshots with metadata (location, date, heading)

### iOS-Specific Features (Beyond AR)

**Lock Screen Widgets (WidgetKit)**
- Current temp + conditions (compact)
- Sunrise/sunset countdown
- Next golden hour countdown (photography widget)

**Home Screen Widgets**
- Today's forecast summary
- 3-day mini forecast
- Air quality / calima alert

**Background App Refresh**
- Fetch updated AEMET/IPMA forecasts periodically
- Trigger push notification for new weather alerts

**Shortcuts Integration**
- "What's the weather at [location]?" Siri shortcut
- "When is golden hour today?" shortcut

### Build Approach for Phase 6

1. **First:** Enroll in Apple Developer Program ($99/year) — needed for annual certificates, TestFlight, WidgetKit
2. **Second:** Add Capacitor to existing Vite project (`npm install @capacitor/core @capacitor/cli`)
3. **Third:** Build the native Swift plugin for sensor fusion + AR (this is the hard part)
4. **Fourth:** Create the AR view in React that communicates with the plugin via Capacitor bridge
5. **Fifth:** Add WidgetKit extensions (separate Swift target in Xcode)
6. **Sixth:** Deploy to personal device via Xcode (Run) or TestFlight for OTA updates

**Key dependency:** Capacitor 6+ supports Vite out of the box. The existing React app becomes the web view, and native code lives in `ios/App/`.

### iOS Distribution (Personal Use — No App Store Required)

This app is for personal use. No App Store submission needed.

**Development deployment (Xcode direct):**
- Plug iPhone in via USB or enable wireless debugging (same Wi-Fi)
- In Xcode: select device → Run → app installs and launches
- With paid Apple Developer ($99/year): certificate lasts 1 year
- Without paid account: certificate expires every 7 days (not practical)

**OTA updates (TestFlight):**
- Upload build to App Store Connect → push to TestFlight
- Install/update on phone without plugging in
- Builds expire after 90 days — just upload a new build
- Can invite up to 10,000 testers (overkill for personal, but useful if sharing with crew)

**Workflow after initial setup:**
```
1. Edit React code (weather views, features)
2. npx cap sync ios           # Sync web assets to native project
3. Open ios/App/App.xcworkspace in Xcode
4. Run (⌘R) → deploys to phone
   — or —
   Archive → Upload to TestFlight → update OTA
```

**EU Alternative App Marketplaces:**
Since iOS 17.4, the EU allows third-party app stores. Not needed for personal use, but available as an option if you ever wanted to distribute without Apple's App Store review process.

---

## Reference: API Endpoints Quick Reference

### AEMET (requires API key)
```
Base: https://opendata.aemet.es/opendata/api

GET /prediccion/especifica/municipio/diaria/{id}?api_key=KEY    → 7-day daily
GET /prediccion/especifica/municipio/hora/{id}?api_key=KEY      → 48h hourly
GET /observacion/convencional/todas?api_key=KEY                  → All stations latest
GET /observacion/convencional/datos/estacion/{id}?api_key=KEY   → Specific station
GET /avisos?api_key=KEY                                          → Active warnings
GET /prediccion/especifica/playa/{id}?api_key=KEY               → Beach forecast
GET /prediccion/maritima/costera/costa/{id}?api_key=KEY         → Marine coastal

Note: All return { datos: "URL", metadatos: "URL" } — must GET the datos URL for actual data
```

### IPMA (no key needed)
```
Base: https://api.ipma.pt/open-data

GET /forecast/meteorology/cities/daily/{globalIdLocal}.json     → Location forecast
GET /forecast/meteorology/cities/daily/hp-daily-forecast-day{0-2}.json → All locations by day
GET /forecast/warnings/warnings_www.json                         → Active warnings
GET /forecast/oceanography/daily/hp-daily-sea-forecast-day{0-2}.json → Sea state
```

### Open-Meteo (no key needed)
```
Base: https://api.open-meteo.com

GET /v1/forecast?latitude=X&longitude=Y&models=ecmwf_ifs025&hourly=temperature_2m,...
GET /v1/air-quality?latitude=X&longitude=Y&hourly=pm10,pm2_5,european_aqi,...
GET /v1/marine?latitude=X&longitude=Y&hourly=wave_height,...
GET /v1/ensemble?latitude=X&longitude=Y&models=icon_seamless&hourly=temperature_2m
```

### RainViewer (no key needed)
```
GET https://api.rainviewer.com/public/weather-maps.json         → Available frames
Tiles: https://tilecache.rainviewer.com/v2/radar/{timestamp}/{size}/{z}/{x}/{y}/{color}/{options}.png
```

---

## Notes

- **AEMET rate limit (50 req/min)** is the tightest constraint — batch requests and cache aggressively
- **Timezone handling** is critical: Spain mainland vs Canary Islands (1h offset), Portugal mainland vs Azores (1-2h offset)
- **Icon mapping** needed: each source uses different condition codes/icons — normalize to a single icon set (consider Meteocons or custom SVGs)
- **Sunrise/sunset code** from SW Client App should be extracted as a shared utility — potentially useful across other SW tools
- **AEMET two-step fetch** pattern: always fetch metadata first, then the `datos` URL. The datos URL is temporary and expires, so don't cache the URL itself, cache the final data
