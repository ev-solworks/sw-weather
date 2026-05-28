/**
 * Windguru-style color ramps for the dense forecast table. Each returns a vivid
 * cell background + a readable foreground (dark text on bright fills, light on
 * deep ones). The app SHELL is dark; these cells stay saturated. From the design
 * handoff's wgScales (today-windguru.jsx).
 */

export interface CellColor {
  bg: string;
  fg: string;
}

/**
 * Wind ramp in km/h. Tuned softer than the first cut, closer to Windguru: low
 * chroma at calm/mid (so the table doesn't look like a wall of fluorescence on
 * a normal day), saturation reserved for strong winds where it actually warns.
 */
export function windScale(v: number): CellColor {
  if (v < 5) return { bg: '#1a2030', fg: '#6a7388' };   // calm — barely tinted
  if (v < 10) return { bg: '#1f3a4d', fg: '#9ccae0' };  // light air
  if (v < 15) return { bg: '#214a4a', fg: '#a8e0c8' };  // gentle
  if (v < 20) return { bg: '#1f5a3a', fg: '#b8e8b0' };  // moderate
  if (v < 25) return { bg: '#3a6020', fg: '#d8e89c' };  // fresh
  if (v < 30) return { bg: '#6a5e1a', fg: '#f0d878' };  // strong (planing range)
  if (v < 38) return { bg: '#8a4a1a', fg: '#fbb96a' };  // very strong
  if (v < 48) return { bg: '#a8331e', fg: '#ffdcb0' };  // near gale
  if (v < 60) return { bg: '#a4205a', fg: '#ffd6e0' };  // gale
  return { bg: '#6a2899', fg: '#ffd0ff' };               // storm
}

export function tempScale(v: number): CellColor {
  if (v < -5) return { bg: '#7fa8d9', fg: '#0a1a3a' };
  if (v < 0) return { bg: '#bfd4ef', fg: '#0a1a3a' };
  if (v < 5) return { bg: '#e8f5c8', fg: '#2a3a14' };
  if (v < 10) return { bg: '#f2f6a2', fg: '#3a3a14' };
  if (v < 14) return { bg: '#fff09a', fg: '#3a2a08' };
  if (v < 18) return { bg: '#ffd478', fg: '#3a2a08' };
  if (v < 22) return { bg: '#ffb04a', fg: '#3a2208' };
  if (v < 26) return { bg: '#ff8a2a', fg: '#3a1a04' };
  if (v < 30) return { bg: '#f4612a', fg: '#fff' };
  if (v < 34) return { bg: '#e23a2a', fg: '#fff' };
  if (v < 38) return { bg: '#cf3290', fg: '#fff' };
  return { bg: '#8a3fcc', fg: '#fff' };
}

export function cloudScale(v: number): CellColor {
  if (v < 25) return { bg: '#222220', fg: '#9a9a93' };
  if (v < 50) return { bg: '#4a4a45', fg: '#e0e0d8' };
  if (v < 75) return { bg: '#8a8a83', fg: '#0f0f0f' };
  if (v < 90) return { bg: '#c8c8c2', fg: '#0f0f0f' };
  return { bg: '#ececec', fg: '#0f0f0f' };
}

export function rainScale(v: number): CellColor {
  if (v < 30) return { bg: '#1a2c4a', fg: '#9bbeef' };
  if (v < 50) return { bg: '#2a4f8a', fg: '#dce6f6' };
  if (v < 70) return { bg: '#4a7ed1', fg: '#fff' };
  if (v < 85) return { bg: '#3a9cef', fg: '#0a1a3a' };
  return { bg: '#7fc8ff', fg: '#0a1a3a' };
}

export function rainMmScale(v: number): CellColor {
  if (v < 0.5) return { bg: '#1a2c4a', fg: '#9bbeef' };
  if (v < 1.5) return { bg: '#2a4f8a', fg: '#dce6f6' };
  if (v < 3) return { bg: '#3a9cef', fg: '#0a1a3a' };
  if (v < 6) return { bg: '#7fc8ff', fg: '#0a1a3a' };
  return { bg: '#bfe4ff', fg: '#0a1a3a' };
}

/** Waves run cooler than rain (lilac→violet→indigo) so the row reads as its own band. */
export function waveScale(m: number): CellColor {
  if (m < 0.5) return { bg: '#1c2240', fg: '#a8b3e0' };
  if (m < 1.0) return { bg: '#2b3268', fg: '#cfd8f5' };
  if (m < 1.5) return { bg: '#4a4f9c', fg: '#fff' };
  if (m < 2.0) return { bg: '#6f5fc8', fg: '#fff' };
  if (m < 3.0) return { bg: '#9a4fd4', fg: '#fff' };
  return { bg: '#cf3290', fg: '#fff' };
}

/** Period encodes swell quality — short = wind-chop, long = clean swell. */
export function periodScale(s: number): CellColor {
  if (s < 5) return { bg: '#0a0f1c', fg: '#7a7a93' };
  if (s < 8) return { bg: '#0a0f1c', fg: '#c8c8e0' };
  if (s < 11) return { bg: '#3a1f2a', fg: '#f5b8c8' };
  if (s < 14) return { bg: '#5a2a3a', fg: '#ffd0dc' };
  return { bg: '#7a3550', fg: '#fff' };
}

export function uvScale(v: number): CellColor {
  if (v <= 2) return { bg: '#2db765', fg: '#0a2614' };
  if (v <= 5) return { bg: '#f0c020', fg: '#2a1a04' };
  if (v <= 7) return { bg: '#f49224', fg: '#2a0e02' };
  if (v <= 10) return { bg: '#e8332f', fg: '#fff' };
  return { bg: '#8a3fcc', fg: '#fff' };
}
