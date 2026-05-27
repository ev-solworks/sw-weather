/**
 * Two-tier TTL cache: in-memory Map (fast, per-session) mirrored to localStorage
 * (survives reload, feeds offline last-known forecast). Both keyed
 * `{source}:{kind}:{locationId}`; TTL checked on read.
 *
 * Why both tiers: the Map avoids JSON.parse on every read within a session; the
 * localStorage mirror means a reload (or offline launch) still has the last
 * forecast. Critical for AEMET's 50 req/min budget — we cache final JSON, never
 * the ephemeral `datos` URL.
 *
 * localStorage keys are namespaced under `sw.weather.*` so an embedding host
 * (sw-client-app) can clear them in isolation (INTEGRATION.md §5).
 */

const NS = 'sw.weather.cache:';

interface Entry<T> {
  value: T;
  /** Epoch ms when this entry expires. */
  expiresAt: number;
}

const memory = new Map<string, Entry<unknown>>();

/** Build a stable cache key. `kind` is the logical fetch, e.g. 'aemet-hourly'. */
export function cacheKey(source: string, kind: string, locationId: string): string {
  return `${source}:${kind}:${locationId}`;
}

function lsKey(key: string): string {
  return NS + key;
}

/**
 * Read a cached value if present and unexpired. Falls back to the localStorage
 * mirror (rehydrating memory) when the in-memory entry is missing — e.g. after a
 * reload. Returns `undefined` on miss or expiry.
 */
export function cacheGet<T>(key: string): T | undefined {
  const now = Date.now();

  const mem = memory.get(key);
  if (mem) {
    if (mem.expiresAt > now) return mem.value as T;
    memory.delete(key); // expired — drop and check the mirror below
  }

  const raw = readLocalStorage(lsKey(key));
  if (raw === null) return undefined;

  try {
    const entry = JSON.parse(raw) as Entry<T>;
    if (entry.expiresAt > now) {
      memory.set(key, entry); // rehydrate the fast tier
      return entry.value;
    }
    // expired in storage too — clean up
    removeLocalStorage(lsKey(key));
  } catch {
    removeLocalStorage(lsKey(key)); // corrupt entry
  }
  return undefined;
}

/**
 * Read a cached value even if expired (for offline "last known" display). Returns
 * `{ value, stale }` so the UI can badge stale data, or `undefined` if absent.
 */
export function cacheGetAllowStale<T>(key: string): { value: T; stale: boolean } | undefined {
  const now = Date.now();

  const mem = memory.get(key);
  if (mem) return { value: mem.value as T, stale: mem.expiresAt <= now };

  const raw = readLocalStorage(lsKey(key));
  if (raw === null) return undefined;
  try {
    const entry = JSON.parse(raw) as Entry<T>;
    memory.set(key, entry);
    return { value: entry.value, stale: entry.expiresAt <= now };
  } catch {
    removeLocalStorage(lsKey(key));
    return undefined;
  }
}

/** Store a value with a TTL in milliseconds. Writes both tiers. */
export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  const entry: Entry<T> = { value, expiresAt: Date.now() + ttlMs };
  memory.set(key, entry);
  writeLocalStorage(lsKey(key), JSON.stringify(entry));
}

/** Drop one entry from both tiers. */
export function cacheDelete(key: string): void {
  memory.delete(key);
  removeLocalStorage(lsKey(key));
}

/** TTLs in ms, from CLAUDE.md / DATA-SOURCES-RESEARCH.md. */
export const TTL = {
  aemetForecast: 3 * 60 * 60 * 1000, // 3h — AEMET updates 4×/day
  aemetObservation: 30 * 60 * 1000, // 30min — ~hourly
  ipmaForecast: 6 * 60 * 60 * 1000, // 6h — 2×/day
  openMeteo: 1 * 60 * 60 * 1000, // 1h — model runs
  lookupTable: 24 * 60 * 60 * 1000, // 24h — IPMA weather-type etc. rarely change
} as const;

// localStorage access guarded — may be unavailable (SSR, private mode, quota).
function readLocalStorage(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // Quota or unavailable — memory tier still works for this session.
  }
}

function removeLocalStorage(key: string): void {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    // ignore
  }
}
