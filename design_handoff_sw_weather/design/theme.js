// theme.js — palette + time-of-day band logic
window.SW_THEMES = {
  black:   { name: 'Near black',  bg: '#0a0a0a', surface: '#141414', border: '#1a1a1a', text: '#e5e5e5', textHi: '#fafafa', textLo: '#8a8a8a', textXLo: '#5a5a5a', tabBg: '#0a0a0a' },
  slate:   { name: 'Cool slate',  bg: '#0d1117', surface: '#161c26', border: '#1d2533', text: '#dde3ec', textHi: '#f5f7fa', textLo: '#8a93a3', textXLo: '#525c6e', tabBg: '#0d1117' },
  warm:    { name: 'Warm graphite', bg: '#15110e', surface: '#1f1a15', border: '#27201a', text: '#e8e2d8', textHi: '#faf6ee', textLo: '#9a8f80', textXLo: '#5e544a', tabBg: '#15110e' },
  navy:    { name: 'Deep navy',   bg: '#0a1226', surface: '#131c33', border: '#1a253f', text: '#dbe1ed', textHi: '#f4f6fb', textLo: '#8995a8', textXLo: '#525d72', tabBg: '#0a1226' },
  plum:    { name: 'Plum',        bg: '#140d18', surface: '#1d1424', border: '#241a2c', text: '#e3dde7', textHi: '#f8f4fa', textLo: '#988a9c', textXLo: '#5a5263', tabBg: '#140d18' },
  moss:    { name: 'Mossy',       bg: '#0e1410', surface: '#161e18', border: '#1d2620', text: '#dde4df', textHi: '#f3f7f4', textLo: '#8a978f', textXLo: '#525d56', tabBg: '#0e1410' },
};

// Time-of-day band: returns a subtle bg overlay rgba per local hour.
// Curve: night → dawn (cool blue) → morning (cool warm) → midday (neutral) →
// golden (amber) → dusk (purple) → night.
window.bandForHour = (hour, intensity = 1) => {
  // Anchor colors at key hours, interpolate.
  const stops = [
    { h: 0,  c: [70, 90, 140] },   // late night cool blue
    { h: 5,  c: [110, 130, 180] }, // pre-dawn
    { h: 7,  c: [220, 170, 150] }, // dawn warm
    { h: 10, c: [200, 200, 210] }, // morning neutral
    { h: 13, c: [210, 215, 225] }, // midday neutral-cool
    { h: 17, c: [240, 180, 130] }, // golden hour amber
    { h: 19, c: [220, 130, 110] }, // sunset coral
    { h: 21, c: [120, 100, 160] }, // dusk purple
    { h: 23, c: [70,  80,  130] }, // night blue
    { h: 24, c: [70,  90,  140] }, // wrap
  ];
  let a = stops[0], b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (hour >= stops[i].h && hour <= stops[i + 1].h) { a = stops[i]; b = stops[i + 1]; break; }
  }
  const t = (hour - a.h) / (b.h - a.h || 1);
  const lerp = (x, y) => Math.round(x + (y - x) * t);
  const r = lerp(a.c[0], b.c[0]);
  const g = lerp(a.c[1], b.c[1]);
  const bl = lerp(a.c[2], b.c[2]);
  // Cap alpha low so it stays muted.
  return `rgba(${r},${g},${bl},${0.07 * intensity})`;
};

// Time-of-day label
window.tdLabel = (hour) => {
  if (hour < 5)  return 'NIGHT';
  if (hour < 7)  return 'DAWN';
  if (hour < 11) return 'MORNING';
  if (hour < 16) return 'DAY';
  if (hour < 19) return 'GOLDEN';
  if (hour < 21) return 'DUSK';
  return 'NIGHT';
};
