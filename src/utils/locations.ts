/**
 * Seed locations — DEV DATA, not a permanent hardcoded list. Geolocation +
 * search + add/remove are in scope (CLAUDE.md "Scope"); these are just the
 * known-good locations to develop against. User saved-locations will be
 * persisted to `sw.weather.locations` in localStorage.
 *
 * Source-routing IDs:
 * - ES locations carry `aemetMunicipio` (5-digit zero-padded STRING — never
 *   parseInt) and, once looked up, `aemetStation` (alphanumeric, e.g. 'B228').
 * - PT locations carry `ipmaGlobalIdLocal` (integer).
 * Coordinates are always present (Open-Meteo, marine, suncalc).
 *
 * `TBD` station/oceanography IDs get filled once the AEMET/IPMA clients can list
 * stations + sea-locations; track in docs/API-NOTES.md.
 */

import type { Location } from '@/types/weather';

export const SEED_LOCATIONS: Location[] = [
  {
    id: 'palma',
    name: 'Palma de Mallorca',
    region: 'Illes Balears',
    country: 'ES',
    lat: 39.5696,
    lon: 2.6502,
    timezone: 'Europe/Madrid',
    aemetMunicipio: '07040',
    aemetStation: 'B228', // Palma airport — confirmed in kickoff
    isCoastal: true,
  },
  {
    id: 'ibiza',
    name: 'Ibiza / Eivissa',
    region: 'Illes Balears',
    country: 'ES',
    lat: 38.9089,
    lon: 1.4328,
    timezone: 'Europe/Madrid',
    aemetMunicipio: '07026',
    // aemetStation: TBD
    isCoastal: true,
  },
  {
    id: 'santa-cruz-tenerife',
    name: 'Santa Cruz de Tenerife',
    region: 'Canarias',
    country: 'ES',
    lat: 28.4636,
    lon: -16.2518,
    timezone: 'Atlantic/Canary',
    aemetMunicipio: '38038',
    // aemetStation: TBD
    isCoastal: true,
  },
  {
    id: 'madrid',
    name: 'Madrid',
    region: 'Comunidad de Madrid',
    country: 'ES',
    lat: 40.4168,
    lon: -3.7038,
    timezone: 'Europe/Madrid',
    aemetMunicipio: '28079',
    // aemetStation: TBD (likely 3195 Retiro)
    isCoastal: false,
  },
  {
    id: 'lisboa',
    name: 'Lisboa',
    region: 'Lisboa',
    country: 'PT',
    lat: 38.7223,
    lon: -9.1393,
    timezone: 'Europe/Lisbon',
    ipmaGlobalIdLocal: 1110600,
    isCoastal: true,
  },
];

/** Look up a seed location by id. */
export function getSeedLocation(id: string): Location | undefined {
  return SEED_LOCATIONS.find((l) => l.id === id);
}
