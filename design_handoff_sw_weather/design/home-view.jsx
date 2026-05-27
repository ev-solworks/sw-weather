// home-view.jsx — Home / saved locations dashboard.
// Stack of location cards, each with its own motion backdrop tinted to the
// city's current conditions. Featured (current location) is taller.

// ── Fake "saved locations" snapshot. Each entry is the current state
//    plus an inline mini-forecast for the next 6h (temp + desc only).
const SAVED_LOCATIONS = [
  {
    id: 'palma', name: 'Palma de Mallorca', region: 'Illes Balears',
    time: '14:00', temp: 8, desc: 'Clear', feels: 5, hi: 11, lo: 7,
    note: 'Rain band tonight 17–21',
    next: [
      { t: '15', T: 8 }, { t: '16', T: 8 }, { t: '17', T: 9 },
      { t: '18', T: 11 }, { t: '19', T: 13 }, { t: '20', T: 14 },
    ],
    featured: true, hour: 14,
  },
  {
    id: 'bcn', name: 'Barcelona', region: 'Catalunya',
    time: '14:00', temp: 11, desc: 'Cloudy', hi: 13, lo: 7,
    note: 'Overcast through evening',
    hour: 14,
  },
  {
    id: 'ldn', name: 'London', region: 'England',
    time: '13:00', temp: 6, desc: 'Light rain', hi: 8, lo: 3,
    note: 'Showers easing after 16:00',
    hour: 13,
  },
  {
    id: 'brl', name: 'Berlin', region: 'Germany',
    time: '14:00', temp: -1, desc: 'Snow', hi: 1, lo: -4,
    note: 'Light snow, settling',
    hour: 14,
  },
  {
    id: 'ath', name: 'Athens', region: 'Greece',
    time: '15:00', temp: 14, desc: 'Sunny', hi: 15, lo: 9,
    note: 'Calm and clear all day',
    hour: 15,
  },
  {
    id: 'sf', name: 'San Francisco', region: 'California',
    time: '05:00', temp: 11, desc: 'Fog', hi: 16, lo: 10,
    note: 'Fog lifts mid-morning',
    hour: 5,
  },
];

const HomeView = ({ now }) => {
  const greet = greeting(now.getHours());
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div style={hmStyles.root}>
      {/* Header */}
      <div style={hmStyles.header}>
        <div>
          <div style={hmStyles.greet}>{greet}</div>
          <div style={hmStyles.date}>{dateStr}</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button style={hmStyles.iconBtn} aria-label="Search">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="7" cy="7" r="5"/><path d="M11 11l3 3" strokeLinecap="round"/>
            </svg>
          </button>
          <button style={hmStyles.iconBtn} aria-label="Add">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M8 3v10M3 8h10"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Search bar (placeholder) */}
      <div style={hmStyles.searchWrap}>
        <div style={hmStyles.search}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{opacity:.5}}>
            <circle cx="7" cy="7" r="5"/><path d="M11 11l3 3" strokeLinecap="round"/>
          </svg>
          <span>Search city or airport</span>
        </div>
      </div>

      {/* Location cards */}
      <div style={hmStyles.list}>
        {SAVED_LOCATIONS.map((loc) => (
          <LocationCard key={loc.id} loc={loc}/>
        ))}
        <div style={hmStyles.footnote}>
          <span>{SAVED_LOCATIONS.length} locations</span>
          <span style={{color:'#3a3a3a'}}>·</span>
          <span>Edit</span>
        </div>
      </div>

      <TabBar active="home" theme={window.SW_THEMES.black}/>
    </div>
  );
};

function greeting(h) {
  if (h < 5) return 'Late night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

// ── Card ──────────────────────────────────────────────────────────
const LocationCard = ({ loc }) => {
  const palette = window.wxPaletteFor(loc.desc, loc.hour);
  const isFeatured = !!loc.featured;
  return (
    <div style={{
      ...hmStyles.card,
      height: isFeatured ? 196 : 108,
    }}>
      <WeatherBackdrop desc={loc.desc} palette={palette} night={loc.hour < 6 || loc.hour >= 20} compact/>
      <div style={hmStyles.cardFg}>
        {/* Top row */}
        <div style={hmStyles.cardTop}>
          <div>
            <div style={hmStyles.cardName}>
              {isFeatured && <span style={hmStyles.dot}/>}
              <span>{loc.name}</span>
            </div>
            <div style={hmStyles.cardSub}>
              {isFeatured ? <span style={{color:'#fafafa',fontWeight:600}}>My Location</span> : loc.time}
              <span style={{color:'rgba(255,255,255,.3)',margin:'0 6px'}}>·</span>
              <span style={{color:'rgba(255,255,255,.6)'}}>{loc.note}</span>
            </div>
          </div>
          <div style={hmStyles.cardTempCol}>
            <div style={hmStyles.cardTemp}>
              {loc.temp}<span style={{color:'rgba(255,255,255,.55)',fontWeight:100}}>°</span>
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div style={hmStyles.cardBottom}>
          <div style={hmStyles.cardDescRow}>
            <WxIcon desc={loc.desc} size={16} color="#fafafa" strokeWidth={1.4}/>
            <span style={hmStyles.cardDesc}>{loc.desc}</span>
          </div>
          <div style={hmStyles.cardHiLo}>
            <span>H {loc.hi}°</span>
            <span style={{color:'rgba(255,255,255,.3)'}}>·</span>
            <span>L {loc.lo}°</span>
          </div>
        </div>

        {/* Featured inline 6h strip */}
        {isFeatured && loc.next && (
          <div style={hmStyles.miniStrip}>
            {loc.next.map((p, i) => (
              <div key={i} style={hmStyles.miniCell}>
                <div style={hmStyles.miniHour}>{p.t}</div>
                <div style={hmStyles.miniTemp}>{p.T}°</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const hmStyles = {
  root: {
    width: '100%', height: '100%',
    background: '#0a0a0a', color: '#e5e5e5',
    fontFamily: '"Inter", -apple-system, system-ui, sans-serif',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '12px 16px 6px', flexShrink: 0,
  },
  greet: {
    fontSize: 22, fontWeight: 600, letterSpacing: -0.4, color: '#fafafa',
  },
  date: { fontSize: 12, color: '#8a8a8a', marginTop: 2 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 17,
    background: '#141414', border: '1px solid #1d1d1d', color: '#cfcfcf',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  },

  searchWrap: { padding: '6px 16px 8px', flexShrink: 0 },
  search: {
    display: 'flex', alignItems: 'center', gap: 8,
    height: 36, padding: '0 12px',
    background: '#141414', border: '1px solid #1d1d1d', borderRadius: 10,
    color: '#7a7a7a', fontSize: 13,
  },

  list: {
    flex: 1, overflowY: 'auto', padding: '4px 12px 16px',
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  footnote: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    color: '#5a5a5a', fontSize: 11,
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    padding: '12px 0 4px',
  },

  card: {
    position: 'relative', borderRadius: 18, overflow: 'hidden',
    border: '1px solid rgba(255,255,255,.05)',
    boxShadow: '0 8px 24px rgba(0,0,0,.35)',
    flexShrink: 0,
  },
  cardFg: {
    position: 'relative', zIndex: 1, height: '100%',
    padding: '14px 16px',
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    color: '#fafafa',
  },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  cardName: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 18, fontWeight: 600, letterSpacing: -0.2,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3, background: '#fafafa',
    boxShadow: '0 0 6px rgba(255,255,255,.8)',
  },
  cardSub: {
    fontSize: 11, color: 'rgba(255,255,255,.65)', marginTop: 2,
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    fontVariantNumeric: 'tabular-nums',
  },
  cardTempCol: { display: 'flex', alignItems: 'flex-start' },
  cardTemp: {
    fontSize: 52, fontWeight: 200, lineHeight: 0.9, letterSpacing: -2,
    color: '#fafafa', fontFeatureSettings: '"tnum"',
  },
  cardBottom: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
  },
  cardDescRow: { display: 'flex', alignItems: 'center', gap: 6 },
  cardDesc: { fontSize: 13, fontWeight: 500, color: '#fafafa' },
  cardHiLo: {
    display: 'flex', gap: 6,
    fontSize: 11, color: 'rgba(255,255,255,.7)',
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    fontVariantNumeric: 'tabular-nums',
  },

  miniStrip: {
    display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)',
    background: 'rgba(0,0,0,.32)', backdropFilter: 'blur(8px)',
    borderRadius: 10, padding: '6px 8px', marginTop: 8,
  },
  miniCell: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
  },
  miniHour: { fontSize: 10, color: 'rgba(255,255,255,.55)', fontVariantNumeric: 'tabular-nums' },
  miniTemp: { fontSize: 13, color: '#fafafa', fontWeight: 500, fontVariantNumeric: 'tabular-nums' },
};

window.HomeView = HomeView;
