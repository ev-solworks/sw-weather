/**
 * AEMET OpenData client (Spain). Returns lightly-typed, source-shaped data; the
 * mapping into the canonical `WeatherConditions` happens in normalize.ts.
 *
 * THE TWO-STEP FETCH (read docs/API-NOTES.md before touching this):
 *   1. GET an endpoint with `?api_key=KEY` → `{ datos, metadatos, estado }`.
 *   2. GET the `datos` URL → the actual payload. `datos` is a SIGNED URL that
 *      expires in minutes — we cache the resolved JSON, never the URL.
 *
 * Other live-verified gotchas (probed 2026-05-27 against municipio 07040):
 * - Payloads can be Latin-1 despite an application/json content-type → decode
 *   responseBytes as latin1 when the UTF-8 decode produces mojibake.
 * - Hourly values are STRINGS ("19", "0"); empty string "" means "no data" → null.
 * - estadoCielo.value carries an `n` suffix at night, e.g. "17n" → night flag.
 * - Hourly `vientoAndRachaMax` ALTERNATES: a wind entry {direccion[],velocidad[]}
 *   then a gust entry {value}, both tagged with the same `periodo` (hour "HH").
 * - Daily endpoint is period-based (00-24/00-12/…), not hourly: use it for hi/lo,
 *   uvMax, day wind. Hourly endpoint is the real per-hour source.
 *
 * Rate limit: 50 req/min hard. Each logical fetch is 2 HTTP calls. Cache (TTL in
 * utils/cache.ts) and never poll on a timer.
 *
 * Auth: currently the key is read from VITE_AEMET_API_KEY. Stage 2 moves this
 * behind a Supabase edge function — `aemetFetch` is the single seam to reroute.
 */

const BASE = 'https://opendata.aemet.es/opendata/api';

export class AemetError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'AemetError';
    this.status = status;
  }
}

// ── Source-shaped response types (subset we consume) ─────────────────────────

interface AemetEnvelope {
  estado: number;
  descripcion: string;
  datos?: string;
  metadatos?: string;
}

/** A `{ value, periodo }` cell; many AEMET arrays share this shape. */
interface PeriodValue {
  value: string;
  periodo: string;
}

/** Hourly wind entry (direccion/velocidad arrays) — gust comes as a sibling. */
interface HourlyWind {
  direccion?: string[];
  velocidad?: string[];
  value?: string; // present on the gust (rachaMax) sibling entries
  periodo: string;
}

export interface AemetDailyDay {
  fecha: string; // naive ISO, interpret in location TZ
  temperatura: { maxima: number; minima: number };
  uvMax?: number;
  estadoCielo: Array<{ value: string; periodo: string; descripcion: string }>;
  probPrecipitacion: Array<{ value: number | string; periodo: string }>;
  viento: Array<{ direccion: string; velocidad: number; periodo: string }>;
}

export interface AemetHourlyDay {
  fecha: string;
  orto?: string; // sunrise "HH:MM"
  ocaso?: string; // sunset "HH:MM"
  estadoCielo: Array<{ value: string; periodo: string; descripcion: string }>;
  temperatura: PeriodValue[];
  sensTermica: PeriodValue[];
  humedadRelativa: PeriodValue[];
  precipitacion: PeriodValue[];
  probPrecipitacion: PeriodValue[]; // periodo is a RANGE like "0208"
  vientoAndRachaMax: HourlyWind[];
}

export interface AemetForecastRoot<TDay> {
  nombre: string;
  provincia: string;
  elaborado: string;
  prediccion: { dia: TDay[] };
}

// ── Fetch primitives ─────────────────────────────────────────────────────────

function getApiKey(): string {
  const key = import.meta.env.VITE_AEMET_API_KEY as string | undefined;
  if (!key) throw new AemetError('VITE_AEMET_API_KEY is not set');
  return key;
}

/** Decode a response body, falling back to Latin-1 when UTF-8 yields mojibake. */
async function decodeBody(res: Response): Promise<string> {
  const buf = await res.arrayBuffer();
  const utf8 = new TextDecoder('utf-8').decode(buf);
  // The replacement char (U+FFFD) signals a bad UTF-8 decode of Latin-1 bytes.
  if (utf8.includes('�')) {
    return new TextDecoder('iso-8859-1').decode(buf);
  }
  return utf8;
}

/**
 * Rate limiter. ONLY the AEMET API endpoint (step 1) counts toward the 50 req/min
 * limit — the `datos` URL (step 2) is a separate, unmetered host, so we don't
 * throttle it. We use a 60s sliding window capped at 45 (safe margin under 50)
 * plus a concurrency cap. This lets a cold burst (e.g. Home loading several
 * locations) fire in parallel instead of being serialized by a fixed delay.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 45;
const MAX_CONCURRENT = 6;

let active = 0;
const recent: number[] = []; // timestamps of recent metered calls
const waiters: Array<() => void> = [];

function pruneWindow(now: number): void {
  while (recent.length && now - recent[0] >= WINDOW_MS) recent.shift();
}

function tryAdmit(): boolean {
  const now = Date.now();
  pruneWindow(now);
  if (active < MAX_CONCURRENT && recent.length < MAX_PER_WINDOW) {
    active++;
    recent.push(now);
    return true;
  }
  return false;
}

function acquireMetered(): Promise<void> {
  return new Promise((resolve) => {
    if (tryAdmit()) return resolve();
    waiters.push(resolve);
    scheduleDrain();
  });
}

let drainTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleDrain(): void {
  if (drainTimer) return;
  // Wake when either a slot frees (polled) or the oldest window entry expires.
  const now = Date.now();
  const untilWindow = recent.length >= MAX_PER_WINDOW ? Math.max(50, WINDOW_MS - (now - recent[0])) : 80;
  drainTimer = setTimeout(() => {
    drainTimer = null;
    while (waiters.length && tryAdmit()) waiters.shift()!();
    if (waiters.length) scheduleDrain();
  }, untilWindow);
}

function releaseMetered(): void {
  active = Math.max(0, active - 1);
  while (waiters.length && tryAdmit()) waiters.shift()!();
}

/** Throttled fetch for the metered API endpoint (step 1). */
async function meteredFetch(url: string): Promise<Response> {
  await acquireMetered();
  try {
    return await fetch(url);
  } finally {
    releaseMetered();
  }
}

/**
 * Run the AEMET two-step and return the parsed `datos` payload. Throttled to stay
 * under the 50/min limit; retries once on 429 after a backoff. This is the single
 * seam to reroute through the Supabase edge function in Stage 2.
 */
async function aemetFetch<T>(path: string, retryOn429 = true): Promise<T> {
  const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}api_key=${encodeURIComponent(getApiKey())}`;

  const step1 = await meteredFetch(url);
  if (step1.status === 429) {
    if (retryOn429) {
      await new Promise((r) => setTimeout(r, 2000));
      return aemetFetch<T>(path, false);
    }
    throw new AemetError('AEMET rate limit (50/min) exceeded', 429);
  }
  if (!step1.ok) throw new AemetError(`AEMET endpoint ${path} failed`, step1.status);

  const envelope = JSON.parse(await decodeBody(step1)) as AemetEnvelope;
  if (envelope.estado !== 200 || !envelope.datos) {
    throw new AemetError(`AEMET ${path}: ${envelope.descripcion} (estado ${envelope.estado})`, envelope.estado);
  }

  // The datos URL is a separate, UNMETERED host — fetch directly (no rate limit).
  const step2 = await fetch(envelope.datos);
  if (!step2.ok) throw new AemetError(`AEMET datos URL failed (expired?)`, step2.status);

  return JSON.parse(await decodeBody(step2)) as T;
}

// ── Public API ─────────────────────────────────────────────────────────────

/** 7-day daily forecast for a municipio. `municipio` is a zero-padded string. */
export async function fetchDaily(municipio: string): Promise<AemetForecastRoot<AemetDailyDay>> {
  const root = await aemetFetch<AemetForecastRoot<AemetDailyDay>[]>(
    `/prediccion/especifica/municipio/diaria/${municipio}`,
  );
  return root[0];
}

/** Hourly (≈48h, 2 days) forecast for a municipio. */
export async function fetchHourly(municipio: string): Promise<AemetForecastRoot<AemetHourlyDay>> {
  const root = await aemetFetch<AemetForecastRoot<AemetHourlyDay>[]>(
    `/prediccion/especifica/municipio/horaria/${municipio}`,
  );
  return root[0];
}

// ── Helpers for the normalize layer ──────────────────────────────────────────

/** Parse an AEMET numeric string; "" / undefined → null. */
export function aemetNum(value: string | number | undefined | null): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Strip the night `n` suffix from an estadoCielo code; report whether it was night. */
export function parseSkyCode(value: string): { code: string; isNight: boolean } {
  const isNight = value.endsWith('n');
  return { code: isNight ? value.slice(0, -1) : value, isNight };
}

/**
 * Pair AEMET's alternating wind/gust hourly entries by `periodo`. Returns a map
 * hour → { direction, speed, gust } (all nullable, speed/gust in km/h as given).
 */
export function pairWind(entries: HourlyWind[]): Map<string, { direction: string | null; speed: number | null; gust: number | null }> {
  const out = new Map<string, { direction: string | null; speed: number | null; gust: number | null }>();
  for (const e of entries) {
    const cur = out.get(e.periodo) ?? { direction: null, speed: null, gust: null };
    if (e.direccion?.length || e.velocidad?.length) {
      cur.direction = e.direccion?.[0] ?? cur.direction;
      cur.speed = aemetNum(e.velocidad?.[0]) ?? cur.speed;
    } else if (e.value !== undefined) {
      cur.gust = aemetNum(e.value) ?? cur.gust;
    }
    out.set(e.periodo, cur);
  }
  return out;
}
