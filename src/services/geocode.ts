/**
 * Geocoding via Open-Meteo's free, keyless geocoding API. Returns places
 * matching a search query, filtered to Spain + Portugal (the app's coverage).
 * Also handles reverse geocoding for "use my location".
 *
 * Why Open-Meteo: keyless, fast, returns timezone (we need IANA TZ for every
 * location), CORS-open, used by their own apps.
 *
 * Results are intentionally simple — `Location` shape minus the AEMET/IPMA
 * routing IDs (those are resolved server-side later, or omitted for now and
 * the forecast falls back to Open-Meteo on the edge).
 */

import type { CountryCode, Location } from '@/types/weather';

const GEOCODE_BASE = 'https://geocoding-api.open-meteo.com/v1';

interface OmGeocodeResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country_code: string; // ISO-3166 alpha-2
  country: string;
  admin1?: string; // first-level subdivision (e.g. 'Balearic Islands')
  admin2?: string;
  timezone: string; // IANA
  feature_code?: string; // 'PPL', 'PPLA', etc.
  population?: number;
}

interface OmGeocodeResponse {
  results?: OmGeocodeResult[];
}

/** Search by free-text query. Global — any country. Returns max 10 hits. */
export async function searchPlaces(query: string): Promise<Location[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = new URL(`${GEOCODE_BASE}/search`);
  url.searchParams.set('name', q);
  url.searchParams.set('count', '10');
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) throw new Error(`geocode ${res.status}`);
  const body = (await res.json()) as OmGeocodeResponse;
  return (body.results ?? []).map(toLocation);
}

/** Reverse-geocode (browser geolocation → nearest known place). */
export async function reverseGeocode(lat: number, lon: number): Promise<Location | null> {
  // Open-Meteo's "search" endpoint doesn't do reverse; their `reverse` route is
  // unsupported. Workaround: use BigDataCloud's free keyless reverse-geocode
  // (CORS-open), which returns city + country + admin region.
  const url = new URL('https://api.bigdatacloud.net/data/reverse-geocode-client');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set('localityLanguage', 'en');
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) return null;
  const body = (await res.json()) as {
    city?: string; locality?: string; principalSubdivision?: string;
    countryCode?: string; countryName?: string;
  };
  const code = body.countryCode ?? 'XX';
  const name = body.city || body.locality || 'Current location';
  // Reverse-geocode doesn't return IANA TZ — derive from coords (best effort).
  const tz = inferTimezone(code, lat, lon);
  return {
    id: slugForCoord(name, lat, lon),
    name,
    region: body.principalSubdivision ?? body.countryName ?? '',
    country: code,
    lat,
    lon,
    timezone: tz,
  };
}

/**
 * Best-effort IANA timezone from country + coordinates.
 * ES / PT get the precise mappings; everywhere else uses the device's TZ
 * (`Intl.DateTimeFormat().resolvedOptions().timeZone`) since 'use my location'
 * almost always means the user IS in that zone.
 */
function inferTimezone(country: CountryCode, lat: number, lon: number): string {
  if (country === 'PT') {
    if (lat < 35 && lon > -20) return 'Atlantic/Madeira';
    if (lat > 35 && lat < 41 && lon < -20) return 'Atlantic/Azores';
    return 'Europe/Lisbon';
  }
  if (country === 'ES') {
    if (lat < 30 && lat > 25 && lon < -10) return 'Atlantic/Canary';
    return 'Europe/Madrid';
  }
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function toLocation(r: OmGeocodeResult): Location {
  return {
    id: slugForCoord(r.name, r.latitude, r.longitude),
    name: r.name,
    region: r.admin1 ?? r.country,
    country: r.country_code as CountryCode,
    lat: r.latitude,
    lon: r.longitude,
    timezone: r.timezone || inferTimezone(r.country_code as CountryCode, r.latitude, r.longitude),
  };
}

/**
 * Stable id from name + 2-decimal coords. Two-decimal grid (~1 km) is enough
 * for "is this the same place?" while letting a user save both Palma (city)
 * and Palma airport without collisions.
 */
function slugForCoord(name: string, lat: number, lon: number): string {
  const base = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const la = Math.round(lat * 100);
  const lo = Math.round(lon * 100);
  return `${base}-${la}-${lo}`;
}

/** Wrap navigator.geolocation in a promise + reverse-geocode. */
export function getCurrentLocation(): Promise<Location | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          resolve(await reverseGeocode(pos.coords.latitude, pos.coords.longitude));
        } catch {
          resolve(null);
        }
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  });
}
