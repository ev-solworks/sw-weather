/**
 * Display formatters. All time/date rendering goes through here so it always
 * happens in the LOCATION's timezone, never the device's (CLAUDE.md TZ rule).
 */

/** 'HH:MM' in the location's timezone. */
export function fmtTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/** Hour-of-day (0–23) for an instant in the location's timezone. */
export function localHour(date: Date, timezone: string): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', hour12: false }).format(date),
  );
}

/** 8-point compass label from degrees (0 = from north). */
export function compass(deg: number): string {
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round((deg % 360) / 45) % 8];
}

/** WHO UV band label for a UV index. */
export function uvLabel(uv: number): string {
  if (uv <= 2) return 'Low';
  if (uv <= 5) return 'Moderate';
  if (uv <= 7) return 'High';
  if (uv <= 10) return 'V.High';
  return 'Extreme';
}

/** Format a duration in ms as 'Hh MMm'. */
export function fmtDuration(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60000));
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
}
