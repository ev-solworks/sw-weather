// today-visual.jsx — centered, image-led Today view.
// Hero zone is a motion backdrop matched to current conditions; large glyph
// + huge temperature stack on top. Hour strip + metrics row beneath.

const TodayVisual = ({ hours, location, now }) => {
  const nowIdx = hours.findIndex((h) => h.time.getTime() === now.getTime());
  const cur = hours[nowIdx];
  const hour = now.getHours();
  const palette = window.wxPaletteFor(cur.description, hour);

  // Find the next notable rain block for the "up next" line.
  const upcoming = findUpcoming(hours, nowIdx);

  // Trim hour strip to next 12.
  const strip = hours.slice(nowIdx, nowIdx + 13);

  return (
    <div style={tvStyles.root}>
      {/* ── Hero motion zone (≈55% of screen) ──────────────────── */}
      <div style={tvStyles.hero}>
        <WeatherBackdrop desc={cur.description} palette={palette} night={hour < 6 || hour >= 20}/>

        {/* Foreground content */}
        <div style={tvStyles.heroFg}>
          {/* Top bar */}
          <div style={tvStyles.topBar}>
            <button style={tvStyles.locBtn}>
              <span style={{width:6,height:6,borderRadius:3,background:'#fafafa',boxShadow:'0 0 6px rgba(255,255,255,.6)'}}/>
              <span>{location.name}</span>
              <svg width="10" height="6" viewBox="0 0 10 6" style={{opacity:.6}}>
                <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
              </svg>
            </button>
            <button style={tvStyles.iconBtn} aria-label="Search">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="7" cy="7" r="5"/><path d="M11 11l3 3" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Stack: tag + icon + temp + condition */}
          <div style={tvStyles.heroStack}>
            <div style={tvStyles.nowTag}>NOW · {fmtHour(cur.time)}</div>
            <div style={tvStyles.iconWrap}>
              <WxIcon desc={cur.description} size={120} color="#fafafa" strokeWidth={1.1}/>
            </div>
            <div style={tvStyles.tempWrap}>
              <span style={tvStyles.temp}>{cur.temperature}</span>
              <span style={tvStyles.tempDeg}>°</span>
            </div>
            <div style={tvStyles.cond}>{cur.description}</div>
            <div style={tvStyles.feels}>H {Math.max(...hours.slice(nowIdx, nowIdx+24).map(h=>h.temperature))}° · L {Math.min(...hours.slice(nowIdx, nowIdx+24).map(h=>h.temperature))}°</div>
          </div>

          {/* Up-next pill */}
          {upcoming && (
            <div style={tvStyles.upNext}>
              <WxIcon desc={upcoming.desc} size={14} color="#fafafa" strokeWidth={1.6}/>
              <span>{upcoming.label}</span>
              <span style={tvStyles.upNextHour}>in {upcoming.inHours}h</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Lower panel ────────────────────────────────────────── */}
      <div style={tvStyles.lower}>
        {/* Hourly strip */}
        <div style={tvStyles.stripWrap}>
          <div style={tvStyles.stripLabel}>NEXT 12 HOURS</div>
          <div style={tvStyles.strip}>
            {strip.map((h, i) => {
              const isNow = i === 0;
              const rainy = h.precipProbability >= 30;
              return (
                <div key={i} style={{
                  ...tvStyles.stripCell,
                  ...(isNow ? tvStyles.stripCellNow : null),
                }}>
                  <div style={{...tvStyles.stripTime, color: isNow ? '#fafafa' : '#8a8a8a', fontWeight: isNow ? 600 : 500}}>
                    {isNow ? 'Now' : fmtHour(h.time).slice(0,5)}
                  </div>
                  <WxIcon desc={h.description} size={20} color={isNow ? '#fafafa' : '#cfcfcf'} strokeWidth={1.4}/>
                  {rainy ? (
                    <div style={tvStyles.stripRain}>{h.precipProbability}<span style={{fontSize:8,opacity:.6}}>%</span></div>
                  ) : <div style={{height:11}}/>}
                  <div style={{...tvStyles.stripTemp, color: isNow ? '#fafafa' : '#e5e5e5'}}>
                    {h.temperature}°
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Metrics row */}
        <div style={tvStyles.metrics}>
          <Metric icon={<CompassRosette deg={cur.windDirection}/>} label="Wind"
            value={`${cur.windSpeed}`} unit={`km/h ${compass(cur.windDirection)}`}/>
          <Metric icon={<DropGlyph/>} label="Humidity" value={`${cur.humidity}`} unit="%"/>
          <Metric icon={<UvGlyph/>} label="UV" value={`${cur.uvIndex}`} unit={WX_SCALES.uv(cur.uvIndex).label}/>
        </div>

        {/* Sun arc — placed below the metrics row */}
        <SunArc location={location} now={now}/>
      </div>

      <TabBar active="today" theme={window.SW_THEMES.black}/>
    </div>
  );
};

// ── helpers ────────────────────────────────────────────────────────
function findUpcoming(hours, nowIdx) {
  // Look forward up to 24h for the first hour with ≥50% precip OR a description change to rain/snow/storm.
  const cur = hours[nowIdx].description.toLowerCase();
  for (let i = nowIdx + 1; i < Math.min(hours.length, nowIdx + 24); i++) {
    const h = hours[i];
    const d = h.description.toLowerCase();
    if (h.precipProbability >= 50 || /(heavy rain|thunder|storm|snow)/.test(d) || (d !== cur && /rain|snow/.test(d) && !cur.match(/rain|snow/))) {
      const inHours = i - nowIdx;
      return { desc: h.description, label: humanLabel(h.description), inHours };
    }
  }
  return null;
}
function humanLabel(desc) {
  const s = desc.toLowerCase();
  if (s.includes('heavy rain')) return 'Heavy rain incoming';
  if (s.includes('thunder') || s.includes('storm')) return 'Storms incoming';
  if (s.includes('rain')) return 'Rain incoming';
  if (s.includes('snow')) return 'Snow incoming';
  if (s.includes('fog')) return 'Fog rolling in';
  return desc;
}

// ── sun arc ────────────────────────────────────────────────────────
const SunArc = ({ location, now }) => {
  const sr = location.sunrise, ss = location.sunset;
  if (!sr || !ss) return null;
  const total = ss - sr;
  const elapsed = Math.max(0, Math.min(total, now - sr));
  const pct = elapsed / total;
  const isDay = now >= sr && now <= ss;
  // Arc geometry — semicircle from (10,60) to (190,60), peaking at (100,8).
  const W = 200, H = 64;
  const ang = Math.PI * pct; // 0 = left, π = right (sun travels left→right)
  const x = 10 + (180) * pct;
  // Quadratic: y traces a parabola peaking at center.
  const y = 60 - Math.sin(ang) * 52;

  // Daylight duration
  const mins = Math.round(total / 60000);
  const dh = Math.floor(mins / 60), dm = mins % 60;
  const fmt = (d) => `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  const remainMins = Math.max(0, Math.round((ss - now) / 60000));
  const rh = Math.floor(remainMins / 60), rm = remainMins % 60;

  return (
    <div style={tvStyles.sunWrap}>
      <div style={tvStyles.sunLabel}>
        <span>DAYLIGHT</span>
        <span style={tvStyles.sunDur}>{dh}h {String(dm).padStart(2,'0')}m</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="60" style={{display:'block', overflow:'visible'}}>
        <defs>
          <linearGradient id="sunArcGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"  stopColor="#3a3a3a"/>
            <stop offset="50%" stopColor="#e6c25b"/>
            <stop offset="100%" stopColor="#3a3a3a"/>
          </linearGradient>
        </defs>
        {/* horizon */}
        <line x1="0" y1="60" x2={W} y2="60" stroke="#232323" strokeWidth="1"/>
        {/* full arc dashed */}
        <path d={`M 10 60 Q 100 -44 190 60`} fill="none"
          stroke="#262626" strokeWidth="1" strokeDasharray="2 4"/>
        {/* completed portion */}
        <path d={`M 10 60 Q 100 -44 190 60`} fill="none"
          stroke="url(#sunArcGrad)" strokeWidth="1.5"
          strokeDasharray={`${pct * 240} 1000`}
          opacity={isDay ? 1 : 0.4}/>
        {/* sun marker */}
        {isDay && (
          <>
            <circle cx={x} cy={y} r="9" fill="rgba(230,194,91,.18)"/>
            <circle cx={x} cy={y} r="5" fill="#e6c25b"/>
          </>
        )}
        {/* end caps */}
        <circle cx="10"  cy="60" r="2.5" fill="#5a5a5a"/>
        <circle cx="190" cy="60" r="2.5" fill="#5a5a5a"/>
      </svg>
      <div style={tvStyles.sunTimes}>
        <div style={tvStyles.sunCol}>
          <div style={tvStyles.sunKey}>Sunrise</div>
          <div style={tvStyles.sunVal}>{fmt(sr)}</div>
        </div>
        <div style={{...tvStyles.sunCol, alignItems:'center'}}>
          <div style={tvStyles.sunKey}>{isDay ? 'Sets in' : 'Set'}</div>
          <div style={tvStyles.sunVal}>{isDay ? `${rh}h ${String(rm).padStart(2,'0')}m` : '—'}</div>
        </div>
        <div style={{...tvStyles.sunCol, alignItems:'flex-end'}}>
          <div style={tvStyles.sunKey}>Sunset</div>
          <div style={tvStyles.sunVal}>{fmt(ss)}</div>
        </div>
      </div>
    </div>
  );
};

// ── tiny metric component ──────────────────────────────────────────
const Metric = ({ icon, label, value, unit }) => (
  <div style={tvStyles.metric}>
    <div style={tvStyles.metricIcon}>{icon}</div>
    <div style={tvStyles.metricLabel}>{label}</div>
    <div style={tvStyles.metricValRow}>
      <span style={tvStyles.metricValue}>{value}</span>
      <span style={tvStyles.metricUnit}>{unit}</span>
    </div>
  </div>
);

const WindGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <path d="M2 7h9a2.5 2.5 0 100-5"/><path d="M2 11h12a2.5 2.5 0 110 5"/><path d="M2 15h6"/>
  </svg>
);
// Compass rosette — N/E/S/W ticks + needle pointing where the wind is going
// (degrees + 180°, mirroring how WindArrowV reads in the vertical view).
const CompassRosette = ({ deg = 0, size = 28 }) => {
  const dir = (deg + 180) % 360;
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" style={{display:'block'}}>
      {/* outer ring */}
      <circle cx="14" cy="14" r="11" fill="none" stroke="#2a2a2a" strokeWidth="1"/>
      <circle cx="14" cy="14" r="11" fill="none" stroke="rgba(255,255,255,.04)" strokeWidth="1" strokeDasharray="1 2"/>
      {/* cardinal ticks */}
      <line x1="14" y1="2"  x2="14" y2="4.5"  stroke="#5a5a5a" strokeWidth="1" strokeLinecap="round"/>
      <line x1="14" y1="23.5" x2="14" y2="26" stroke="#3a3a3a" strokeWidth="1" strokeLinecap="round"/>
      <line x1="2"  y1="14" x2="4.5" y2="14"  stroke="#3a3a3a" strokeWidth="1" strokeLinecap="round"/>
      <line x1="23.5" y1="14" x2="26" y2="14" stroke="#3a3a3a" strokeWidth="1" strokeLinecap="round"/>
      {/* N label */}
      <text x="14" y="1.8" textAnchor="middle" fontSize="3.4" fontWeight="700"
        fill="#8a8a8a" fontFamily='"JetBrains Mono", ui-monospace, monospace'
        style={{letterSpacing:'.2px'}}>N</text>
      {/* needle */}
      <g transform={`rotate(${dir} 14 14)`}>
        <path d="M14 5.5 L17 14 L14 12.5 L11 14 Z" fill="#fafafa"/>
        <path d="M14 22.5 L16 14 L14 15.5 L12 14 Z" fill="#5a5a5a"/>
        <circle cx="14" cy="14" r="1.4" fill="#0f0f0f" stroke="#fafafa" strokeWidth="1"/>
      </g>
    </svg>
  );
};
const DropGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 2c2 3 5 5.5 5 9a5 5 0 11-10 0c0-3.5 3-6 5-9z"/>
  </svg>
);
const UvGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <circle cx="9" cy="9" r="3"/>
    <path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.5 3.5l1.4 1.4M13.1 13.1l1.4 1.4M3.5 14.5l1.4-1.4M13.1 4.9l1.4-1.4"/>
  </svg>
);

// ── styles ─────────────────────────────────────────────────────────
const tvStyles = {
  root: {
    width: '100%', height: '100%',
    background: '#0a0a0a', color: '#e5e5e5',
    fontFamily: '"Inter", -apple-system, system-ui, sans-serif',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  hero: {
    position: 'relative', flex: '0 0 auto', height: 360,
    overflow: 'hidden',
  },
  heroFg: {
    position: 'relative', zIndex: 1, height: '100%',
    display: 'flex', flexDirection: 'column',
    padding: '8px 16px 12px',
    color: '#fafafa',
  },
  topBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  locBtn: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)',
    color: '#fafafa', padding: '6px 12px 6px 10px', borderRadius: 999,
    fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
    backdropFilter: 'blur(8px)',
  },
  iconBtn: {
    width: 34, height: 34, borderRadius: 17,
    background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)',
    color: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', backdropFilter: 'blur(8px)',
  },
  heroStack: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: 0,
  },
  nowTag: {
    fontSize: 9, fontWeight: 700, letterSpacing: 1.4,
    color: 'rgba(255,255,255,.85)',
    background: 'rgba(0,0,0,.25)', padding: '3px 7px', borderRadius: 3,
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    marginBottom: 6,
  },
  iconWrap: {
    width: 84, height: 84,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    filter: 'drop-shadow(0 4px 24px rgba(0,0,0,.4))',
  },
  tempWrap: {
    display: 'flex', alignItems: 'flex-start',
    fontFeatureSettings: '"tnum"',
    marginTop: -2,
  },
  temp: {
    fontSize: 96, fontWeight: 100, lineHeight: 0.9, letterSpacing: -5,
    color: '#fafafa',
  },
  tempDeg: {
    fontSize: 48, fontWeight: 100, lineHeight: 1, marginTop: 6,
    color: 'rgba(255,255,255,.55)',
  },
  cond: {
    fontSize: 15, fontWeight: 500, marginTop: 2, color: '#fafafa',
  },
  feels: {
    fontSize: 11, color: 'rgba(255,255,255,.65)',
    fontVariantNumeric: 'tabular-nums', marginTop: 2,
  },
  upNext: {
    alignSelf: 'center',
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'rgba(0,0,0,.35)', backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,.1)',
    padding: '7px 12px', borderRadius: 999,
    fontSize: 12, fontWeight: 500,
    fontFamily: 'inherit',
  },
  upNextHour: {
    color: 'rgba(255,255,255,.55)',
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    fontSize: 11,
  },

  lower: {
    flex: 1, display: 'flex', flexDirection: 'column',
    background: '#0a0a0a', overflow: 'hidden',
    paddingTop: 4,
  },
  stripWrap: { padding: '4px 0 0' },
  stripLabel: {
    fontSize: 10, fontWeight: 600, letterSpacing: 1,
    color: '#5a5a5a', padding: '0 16px 8px',
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
  },
  strip: {
    display: 'flex', gap: 6, overflowX: 'auto', overflowY: 'hidden',
    padding: '0 12px 4px', scrollbarWidth: 'none',
  },
  stripCell: {
    flex: '0 0 auto', width: 52,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    padding: '10px 0',
    borderRadius: 12,
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
  },
  stripCellNow: {
    background: 'rgba(255,255,255,.06)',
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.08)',
  },
  stripTime: {
    fontSize: 11, fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    fontVariantNumeric: 'tabular-nums',
  },
  stripRain: {
    fontSize: 10, color: '#7aa9d9',
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    height: 11, lineHeight: '11px',
  },
  stripTemp: {
    fontSize: 14, fontWeight: 500,
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    marginTop: 2,
  },

  sunWrap: {
    margin: '8px 16px 4px',
    padding: '10px 12px 8px',
    background: '#0f0f0f', border: '1px solid #1a1a1a',
    borderRadius: 14,
  },
  sunLabel: {
    display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
    fontSize: 10, fontWeight: 600, letterSpacing: 1, color: '#7a7a7a',
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
  },
  sunDur: {
    color: '#fafafa', fontSize: 11, fontWeight: 500,
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: 0,
  },
  sunTimes: {
    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
    marginTop: -4,
  },
  sunCol: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 },
  sunKey: {
    fontSize: 9, fontWeight: 600, color: '#7a7a7a', letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sunVal: {
    fontSize: 13, color: '#fafafa', fontWeight: 500,
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    fontVariantNumeric: 'tabular-nums',
  },

  metrics: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
    padding: '8px 16px 14px',
  },
  metric: {
    background: '#141414', border: '1px solid #1d1d1d',
    borderRadius: 14, padding: '10px 12px',
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  metricIcon: { color: '#8a8a8a' },
  metricLabel: {
    fontSize: 10, fontWeight: 600, letterSpacing: 1,
    color: '#7a7a7a',
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
  },
  metricValRow: { display: 'flex', alignItems: 'baseline', gap: 4 },
  metricValue: {
    fontSize: 18, color: '#fafafa', fontWeight: 500,
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    fontVariantNumeric: 'tabular-nums',
  },
  metricUnit: { fontSize: 10, color: '#7a7a7a' },
};

window.TodayVisual = TodayVisual;
