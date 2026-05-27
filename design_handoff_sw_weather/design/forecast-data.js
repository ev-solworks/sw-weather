// forecast-data.js — realistic 48h Palma de Mallorca winter forecast
// Type: HourForecast { time, temperature, feelsLike, humidity, windSpeed,
// windDirection, windGust, precipProbability, precipAmount, uvIndex,
// cloudCover, description, waveHeight (m), wavePeriod (s), waveDirection (deg) }

window.PALMA_FORECAST = (() => {
  // Anchor "now" at 14:00 local on a Monday in February.
  const now = new Date('2026-02-09T14:00:00');
  const rows = [
    // h, T,  fl, hum, ws, wd,  wg, pp, pa,  uv, cc, desc            wh,  wp, wdir
    [ 0, 16, 14, 62, 22,  35, 38, 10, 0,    3, 45, 'Partly cloudy', 0.6,  4,  40],
    [ 1, 16, 13, 65, 24,  35, 41, 15, 0,    2, 55, 'Partly cloudy', 0.7,  4,  45],
    [ 2, 15, 12, 70, 26,  40, 44, 30, 0,    1, 75, 'Cloudy',        0.9,  5,  50],
    [ 3, 14, 11, 78, 28,  45, 47, 65, 0.4,  0, 90, 'Light rain',    1.1,  5,  55],
    [ 4, 13, 10, 86, 30,  45, 50, 80, 1.2,  0,100, 'Light rain',    1.4,  6,  55],
    [ 5, 13, 10, 90, 31,  45, 52, 90, 2.1,  0,100, 'Rain',          1.6,  6,  55],
    [ 6, 12,  9, 92, 29,  40, 48, 85, 1.8,  0,100, 'Rain',          1.7,  7,  50],
    [ 7, 12,  9, 88, 26,  10, 42, 60, 0.6,  0, 95, 'Light rain',    1.5,  7,  45],
    [ 8, 11,  9, 82, 22,   0, 35, 35, 0,    0, 80, 'Cloudy',        1.2,  7,  40],
    [ 9, 11,  9, 78, 18,   0, 28, 20, 0,    0, 70, 'Cloudy',        1.0,  6,  35],
    [10, 10,  8, 75, 15,   0, 22, 10, 0,    0, 50, 'Partly cloudy', 0.8,  6,  30],
    [11, 10,  7, 72, 14, 350, 20,  5, 0,    0, 40, 'Partly cloudy', 0.7,  5,  20],
    [12,  9,  6, 70, 13, 340, 19,  5, 0,    0, 30, 'Mostly clear',  0.6,  5,  10],
    [13,  9,  6, 68, 12, 340, 18,  5, 0,    0, 25, 'Mostly clear',  0.5,  5,   0],
    [14,  8,  5, 68, 11, 330, 17,  5, 0,    0, 20, 'Clear',         0.5,  4, 350],
    [15,  8,  5, 70, 10, 330, 16, 10, 0,    0, 25, 'Clear',         0.4,  4, 340],
    [16,  8,  5, 72, 10, 320, 15, 10, 0,    1, 30, 'Mostly clear',  0.4,  4, 330],
    [17,  9,  6, 68, 12, 310, 18,  5, 0,    2, 25, 'Mostly clear',  0.4,  4, 320],
    [18, 11,  8, 60, 14, 300, 21,  5, 0,    3, 20, 'Sunny',         0.4,  4, 310],
    [19, 13, 10, 55, 15, 290, 22,  5, 0,    4, 25, 'Sunny',         0.5,  4, 300],
    [20, 14, 11, 52, 16, 280, 24, 10, 0,    4, 35, 'Partly cloudy', 0.5,  4, 290],
    [21, 14, 11, 55, 17, 270, 25, 15, 0,    3, 50, 'Partly cloudy', 0.6,  5, 280],
    [22, 13, 10, 60, 18, 260, 27, 25, 0,    2, 65, 'Cloudy',        0.7,  5, 270],
    [23, 13, 10, 65, 19, 250, 30, 35, 0,    1, 80, 'Cloudy',        0.8,  5, 260],
    [24, 12, 10, 72, 21, 240, 33, 50, 0.2,  0, 90, 'Light rain',    1.0,  6, 250],
    [25, 12,  9, 78, 23, 230, 36, 70, 0.8,  0, 95, 'Light rain',    1.3,  6, 240],
    [26, 12,  9, 84, 26, 220, 41, 85, 1.6,  0,100, 'Rain',          1.6,  7, 230],
    [27, 11,  8, 88, 28, 220, 45, 92, 2.4,  0,100, 'Rain',          1.9,  8, 230],
    [28, 11,  8, 90, 29, 210, 48, 95, 3.1,  0,100, 'Heavy rain',    2.1,  9, 220],
    [29, 11,  8, 90, 28, 210, 46, 90, 2.7,  0,100, 'Heavy rain',    2.0,  9, 220],
    [30, 10,  7, 88, 25, 200, 41, 75, 1.4,  0,100, 'Rain',          1.7,  8, 210],
    [31, 10,  7, 84, 22, 190, 35, 55, 0.5,  0, 95, 'Light rain',    1.4,  7, 200],
    [32, 10,  7, 80, 19, 180, 30, 35, 0,    0, 85, 'Cloudy',        1.1,  7, 190],
    [33,  9,  6, 76, 16, 170, 25, 20, 0,    0, 70, 'Cloudy',        0.9,  6, 180],
    [34,  9,  6, 72, 14, 160, 22, 10, 0,    0, 55, 'Partly cloudy', 0.7,  6, 170],
    [35,  9,  6, 70, 12, 150, 19,  5, 0,    0, 40, 'Partly cloudy', 0.6,  5, 160],
    [36,  8,  5, 68, 11, 140, 17,  5, 0,    0, 30, 'Mostly clear',  0.5,  5, 150],
    [37,  8,  5, 70, 10, 130, 16,  5, 0,    0, 25, 'Mostly clear',  0.5,  5, 140],
    [38,  7,  4, 72, 10, 130, 15,  5, 0,    0, 20, 'Clear',         0.4,  4, 135],
    [39,  7,  4, 72,  9, 120, 14,  5, 0,    0, 20, 'Clear',         0.4,  4, 130],
    [40,  7,  4, 70,  9, 120, 13,  5, 0,    1, 25, 'Mostly clear',  0.4,  4, 125],
    [41,  8,  5, 65, 10, 110, 15,  5, 0,    2, 25, 'Mostly clear',  0.4,  4, 120],
    [42, 10,  7, 58, 12, 100, 18,  5, 0,    3, 25, 'Sunny',         0.4,  4, 115],
    [43, 12,  9, 52, 14,  90, 20,  5, 0,    4, 25, 'Sunny',         0.5,  4, 110],
    [44, 13, 10, 48, 15,  90, 22,  5, 0,    4, 30, 'Partly cloudy', 0.5,  4, 105],
    [45, 14, 11, 46, 16,  80, 23,  5, 0,    3, 35, 'Partly cloudy', 0.6,  5, 100],
    [46, 14, 11, 48, 16,  80, 24, 10, 0,    2, 45, 'Partly cloudy', 0.7,  5,  95],
    [47, 13, 10, 52, 17,  70, 26, 15, 0,    1, 55, 'Partly cloudy', 0.8,  5,  90],
  ];
  return rows.map(([h, T, fl, hum, ws, wd, wg, pp, pa, uv, cc, desc, wh, wp, wdir]) => ({
    time: new Date(now.getTime() + h * 3600 * 1000),
    temperature: T,
    feelsLike: fl,
    humidity: hum,
    windSpeed: ws,
    windDirection: wd,
    windGust: wg,
    precipProbability: pp,
    precipAmount: pa,
    uvIndex: uv,
    cloudCover: cc,
    description: desc,
    waveHeight: wh,
    wavePeriod: wp,
    waveDirection: wdir,
  }));
})();

// 7-day daily summary for the Week view. Aggregated metrics per day; the
// per-day values are stylised, not a true derivation, just enough for
// inline chips and bar visualisation.
window.PALMA_WEEK = (() => {
  const baseMs = new Date('2026-02-09T00:00:00').getTime();
  const rows = [
    // day, tHi, tLo, tCur, desc,          rainProb, rainMm, windAvg, gust, windDir, waveHi, period, uvMax, srH,srM, ssH,ssM
    [ 'Mon',  9,  7,  8,  'Rain',          85,  7.2, 26, 50, 220, 1.7, 7,  3,  7, 52, 18, 26],
    [ 'Tue', 12,  9, null,'Heavy rain',    95, 12.4, 29, 48, 215, 2.1, 9,  2,  7, 51, 18, 27],
    [ 'Wed', 14,  8, null,'Partly cloudy', 30,  0.4, 16, 28,  90, 1.0, 6,  4,  7, 50, 18, 28],
    [ 'Thu', 16,  7, null,'Sunny',         10,  0,   12, 20,  60, 0.6, 5,  5,  7, 49, 18, 30],
    [ 'Fri', 17,  9, null,'Mostly clear',  15,  0,   14, 22,  80, 0.7, 5,  5,  7, 48, 18, 31],
    [ 'Sat', 16, 10, null,'Partly cloudy', 35,  0.8, 18, 32, 110, 1.0, 6,  4,  7, 46, 18, 32],
    [ 'Sun', 13,  9, null,'Rain',          75,  4.5, 24, 42, 200, 1.5, 7,  3,  7, 45, 18, 33],
  ];
  return rows.map(([day, hi, lo, cur, desc, rp, rm, wa, wg, wd, wh, wp, uv, srH, srM, ssH, ssM], i) => {
    const date = new Date(baseMs + i * 24 * 3600 * 1000);
    return {
      date,
      day,
      dayName: i === 0 ? 'Today' : day,
      tempHi: hi,
      tempLo: lo,
      tempCurrent: cur,
      description: desc,
      rainProbability: rp,
      rainAmount: rm,
      windAvg: wa,
      windGust: wg,
      windDirection: wd,
      waveHeight: wh,
      wavePeriod: wp,
      uvMax: uv,
      sunrise: new Date(date.getFullYear(), date.getMonth(), date.getDate(), srH, srM),
      sunset:  new Date(date.getFullYear(), date.getMonth(), date.getDate(), ssH, ssM),
    };
  });
})();

window.PALMA_LOCATION = {
  name: 'Palma de Mallorca',
  region: 'Illes Balears',
  now: new Date('2026-02-09T14:00:00'),
  summary: 'Rain band 17:00–21:00 today, clearing overnight. Second front Tuesday afternoon.',
  // Sun phases for Feb 9, 2026 at ~39.57°N — astronomical times.
  sun: {
    astroDawn:  new Date('2026-02-09T06:23:00'),
    nauticalDawn: new Date('2026-02-09T06:55:00'),
    civilDawn:  new Date('2026-02-09T07:25:00'),
    sunrise:    new Date('2026-02-09T07:52:00'),
    goldenEnd:  new Date('2026-02-09T08:30:00'),
    solarNoon:  new Date('2026-02-09T13:09:00'),
    goldenStart:new Date('2026-02-09T17:48:00'),
    sunset:     new Date('2026-02-09T18:26:00'),
    civilDusk:  new Date('2026-02-09T18:53:00'),
    nauticalDusk:new Date('2026-02-09T19:23:00'),
    astroDusk:  new Date('2026-02-09T19:55:00'),
    yesterdayLengthMs: (10 * 60 + 31) * 60 * 1000,
    tomorrowLengthMs:  (10 * 60 + 37) * 60 * 1000,
  },
  // Moon — waning gibbous on this date.
  moon: {
    phase: 'Waning gibbous',
    phaseFraction: 0.78, // 0=new, 0.5=full, 1=new again
    illumination: 64,
    moonrise: new Date('2026-02-09T20:14:00'),
    moonset:  new Date('2026-02-09T09:08:00'), // happened in the morning
  },
  // Kept for backward compat with sun-arc strip in Today · Visual.
  sunrise: new Date('2026-02-09T07:52:00'),
  sunset:  new Date('2026-02-09T18:26:00'),
};

// ── Color scales (used by both variants) ────────────────────────────
window.WX_SCALES = {
  // Precip probability bands → bg + text colors
  precip(p) {
    if (p < 20)  return { bg: 'transparent',           fg: '#6b6b6b', accent: 'transparent' };
    if (p < 50)  return { bg: 'rgba(56,114,224,0.10)', fg: '#8aa9d9', accent: 'rgba(56,114,224,0.35)' };
    if (p < 80)  return { bg: 'rgba(56,142,232,0.20)', fg: '#a9c8ee', accent: 'rgba(56,142,232,0.55)' };
    return         { bg: 'rgba(56,189,248,0.32)',     fg: '#bae6fd', accent: 'rgba(56,189,248,0.75)' };
  },
  // UV index → standard WHO color scale
  uv(u) {
    if (u <= 2)  return { bg: '#1f3d1f', fg: '#86c97f', label: 'Low' };       // green
    if (u <= 5)  return { bg: '#4a3f17', fg: '#e6c25b', label: 'Moderate' };  // yellow
    if (u <= 7)  return { bg: '#4a2f17', fg: '#e69a4f', label: 'High' };      // orange
    if (u <= 10) return { bg: '#4a1f1f', fg: '#e66464', label: 'V. High' };   // red
    return         { bg: '#3a1f4a', fg: '#c084fc', label: 'Extreme' };        // purple
  },
};

window.compass = (deg) => {
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(((deg % 360) / 45)) % 8];
};

window.fmtHour = (d) => `${String(d.getHours()).padStart(2,'0')}:00`;
window.fmtDay  = (d) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
window.fmtDayShort = (d) => d.toLocaleDateString('en-GB', { weekday: 'short' });
