// wx-icon.jsx — clean line-art weather glyphs.
// Single-stroke icons, no fills (except tiny snow dots) so they read on
// any backdrop including the animated motion backgrounds.
// Maps description → glyph; falls back to a small filled dot.

const WxIcon = ({ desc, size = 16, color = 'currentColor', strokeWidth = 1.4 }) => {
  const s = String(desc || '').toLowerCase();
  const common = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round',
    style: { display: 'block', flexShrink: 0 },
  };

  // Heavy rain / storms — cloud + 3 strong angled streaks
  if (s.includes('heavy rain') || s.includes('thunder') || s.includes('storm')) {
    return (
      <svg {...common}>
        <path d="M7 13.5a4 4 0 010-8 5.5 5.5 0 0110.5-1A4 4 0 0118 13.5H7z"/>
        <path d="M9 16.5l-1.4 3.8M13 16.5l-1.6 4M17 16.5l-1.4 3.8"/>
      </svg>
    );
  }
  // Rain — cloud + 2 angled drops
  if (s === 'rain' || (s.includes('rain') && !s.includes('light'))) {
    return (
      <svg {...common}>
        <path d="M7 14a4 4 0 010-8 5.5 5.5 0 0110.5-1A4 4 0 0118 14H7z"/>
        <path d="M9.5 17.5l-1.2 3.2M14.5 17.5l-1.2 3.2"/>
      </svg>
    );
  }
  // Light rain / drizzle — cloud + 1 single drop
  if (s.includes('light rain') || s.includes('drizzle') || s.includes('shower')) {
    return (
      <svg {...common}>
        <path d="M7 14a4 4 0 010-8 5.5 5.5 0 0110.5-1A4 4 0 0118 14H7z"/>
        <path d="M12 17.5l-1.2 3.2"/>
      </svg>
    );
  }
  // Snow — cloud + 3 small filled dots
  if (s.includes('snow') || s.includes('flurr')) {
    return (
      <svg {...common}>
        <path d="M7 14a4 4 0 010-8 5.5 5.5 0 0110.5-1A4 4 0 0118 14H7z"/>
        <circle cx="9.5"  cy="18.5" r="0.95" fill={color} stroke="none"/>
        <circle cx="12.5" cy="20"   r="0.95" fill={color} stroke="none"/>
        <circle cx="15.5" cy="18.5" r="0.95" fill={color} stroke="none"/>
      </svg>
    );
  }
  // Fog — three horizontal bars of varying length
  if (s.includes('fog') || s.includes('mist') || s.includes('haze')) {
    return (
      <svg {...common}>
        <path d="M4 8h14"/>
        <path d="M3 12.5h17"/>
        <path d="M5 17h11"/>
      </svg>
    );
  }
  // Cloudy — one rounded cloud, line only
  if (s === 'cloudy' || s.includes('overcast')) {
    return (
      <svg {...common}>
        <path d="M6.5 16.5a4.5 4.5 0 010-9 6 6 0 0111-1.5 4.5 4.5 0 011 10.5z"/>
      </svg>
    );
  }
  // Partly cloudy — small sun upper-left + cloud lower-right, both line-art
  if (s.includes('partly')) {
    return (
      <svg {...common}>
        {/* sun */}
        <circle cx="8.5" cy="7.5" r="2.6"/>
        <path d="M8.5 2.6v1.1M3.6 7.5h1.1M12.3 7.5h1.1M5 4l.8.8M11.2 4l-.8.8M5 11l.8-.8"/>
        {/* cloud */}
        <path d="M10 19a3 3 0 010-6 4 4 0 017.5-1A3 3 0 0118 19H10z"/>
      </svg>
    );
  }
  // Mostly clear / mostly sunny — sun with small cloud tucked under
  if (s.includes('mostly clear') || s.includes('mostly sunny')) {
    return (
      <svg {...common}>
        <circle cx="11" cy="10" r="3.2"/>
        <path d="M11 3.6v1.4M11 14.6V16M4.4 10h1.4M16.2 10h1.4M6.2 5.2l1 1M15 13.6l1 1M6.2 14.8l1-1M15 6.4l1-1"/>
        {/* small cloud */}
        <path d="M9.5 19.5a2.4 2.4 0 010-4.8 3 3 0 015.5-.4 2.4 2.4 0 01.7 4.7z"/>
      </svg>
    );
  }
  // Clear / sunny — sun with 8 rays
  if (s.includes('clear') || s.includes('sunny') || s.includes('fair')) {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4.2"/>
        <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M5.6 18.4l1.7-1.7M16.7 7.3l1.7-1.7"/>
      </svg>
    );
  }
  // Fallback dot
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="2" fill={color} stroke="none"/>
    </svg>
  );
};

window.WxIcon = WxIcon;
