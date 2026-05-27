// today-graph.jsx — Windguru "graph" mode.
// Stacked SVG panels sharing a horizontal hour axis. Each panel renders the
// same 48h forecast as its own visual idiom: filled area, bars, line+area,
// arrows. All scroll in sync.

const TodayGraph = ({ hours, location, now }) => {
  const HOUR_W = 28;
  const totalW = hours.length * HOUR_W;
  const nowIdx = hours.findIndex((h) => h.time.getTime() === now.getTime());

  // Sync horizontal scrolling across the time-axis header + every panel.
  const scrollRef = React.useRef(null);
  const onScroll = (e) => {
    const x = e.currentTarget.scrollLeft;
    scrollRef.current.querySelectorAll('[data-g-sync]').forEach((el) => {
      if (el !== e.currentTarget) el.scrollLeft = x;
    });
  };
  React.useEffect(() => {
    const els = scrollRef.current?.querySelectorAll('[data-g-sync]');
    if (!els) return;
    const x = Math.max(0, nowIdx * HOUR_W - 60);
    els.forEach((el) => { el.scrollLeft = x; });
  }, [nowIdx]);

  return (
    <div style={gStyles.root}>
      {/* App header */}
      <div style={gStyles.appBar}>
        <div style={gStyles.appTitle}>
          <span style={gStyles.logoBadge}>SW</span>
          <span style={{fontWeight:600}}>Graph</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={gStyles.updated}>Updated 14:00 CET</span>
          <button style={gStyles.iconBtn} aria-label="Search">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="7" cy="7" r="5"/><path d="M11 11l3 3" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      <div style={gStyles.locStrip}>
        <span style={gStyles.locName}>{location.name}</span>
        <span style={gStyles.locRegion}>{location.region}</span>
      </div>

      <div ref={scrollRef} style={gStyles.scrollHost}>
        {/* Time axis */}
        <TimeAxis hours={hours} nowIdx={nowIdx} hourW={HOUR_W} onScroll={onScroll}/>

        {/* Temperature */}
        <Panel title="Temperature" unit="°C" totalW={totalW} hourW={HOUR_W} hours={hours} nowIdx={nowIdx} onScroll={onScroll} height={90}>
          {(c, scale) => <TempPanel c={c} scale={scale} hours={hours} hourW={HOUR_W}/>}
        </Panel>

        {/* Wind */}
        <Panel title="Wind / Gusts" unit="km/h" totalW={totalW} hourW={HOUR_W} hours={hours} nowIdx={nowIdx} onScroll={onScroll} height={100}>
          {(c, scale) => <WindPanel c={c} scale={scale} hours={hours} hourW={HOUR_W}/>}
        </Panel>

        {/* Rain */}
        <Panel title="Rain · prob & precip" unit="% / mm" totalW={totalW} hourW={HOUR_W} hours={hours} nowIdx={nowIdx} onScroll={onScroll} height={80}>
          {(c, scale) => <RainPanel c={c} scale={scale} hours={hours} hourW={HOUR_W}/>}
        </Panel>

        {/* Waves */}
        <Panel title="Waves · height & period" unit="m · s" totalW={totalW} hourW={HOUR_W} hours={hours} nowIdx={nowIdx} onScroll={onScroll} height={80}>
          {(c, scale) => <WavePanel c={c} scale={scale} hours={hours} hourW={HOUR_W}/>}
        </Panel>

        {/* Cloud + UV combined strip */}
        <Panel title="Cloud cover" unit="%" totalW={totalW} hourW={HOUR_W} hours={hours} nowIdx={nowIdx} onScroll={onScroll} height={50}>
          {(c, scale) => <CloudPanel c={c} scale={scale} hours={hours} hourW={HOUR_W}/>}
        </Panel>
      </div>

      <TabBar active="today" theme={window.SW_THEMES.black}/>
    </div>
  );
};

// ── Time axis ─────────────────────────────────────────────────────
const TimeAxis = ({ hours, nowIdx, hourW, onScroll }) => {
  const totalW = hours.length * hourW;
  return (
    <div style={{...gStyles.row, ...gStyles.timeAxisRow}}>
      <div style={gStyles.gutter}>
        <div style={gStyles.gutterTitle}>Time</div>
        <div style={gStyles.gutterSub}>26 May · CET</div>
      </div>
      <div data-g-sync="1" onScroll={onScroll} style={gStyles.scroll}>
        <svg width={totalW} height={42} style={{display:'block'}}>
          {hours.map((h, i) => {
            const x = i * hourW;
            const prev = hours[i-1];
            const newDay = !prev || prev.time.toDateString() !== h.time.toDateString();
            const isNow = i === nowIdx;
            const isMajor = h.time.getHours() % 6 === 0;
            const night = h.time.getHours() < 6 || h.time.getHours() >= 20;
            return (
              <g key={i}>
                {night && (
                  <rect x={x} y={0} width={hourW} height={42} fill="#0a1024"/>
                )}
                {isNow && (
                  <rect x={x} y={0} width={hourW} height={42} fill="#3a2f0f"/>
                )}
                {newDay && i > 0 && (
                  <line x1={x} y1={0} x2={x} y2={42} stroke="#2a3550" strokeWidth="1.5"/>
                )}
                {newDay && (
                  <text x={x + 4} y={14} fontSize="9" fill="#9a9a93" fontWeight="700"
                    fontFamily='"JetBrains Mono", ui-monospace, monospace'
                    style={{letterSpacing: '.3px'}}>
                    {dayShort(h.time)}
                  </text>
                )}
                {isMajor && (
                  <text x={x + hourW/2} y={32} fontSize="10" fill={isNow ? '#fafafa' : '#cfcfcf'} textAnchor="middle"
                    fontFamily='"JetBrains Mono", ui-monospace, monospace'
                    fontWeight={isNow ? 700 : 500}>
                    {String(h.time.getHours()).padStart(2,'0')}
                  </text>
                )}
                {!isMajor && h.time.getHours() % 3 === 0 && (
                  <line x1={x + hourW/2} y1={36} x2={x + hourW/2} y2={40} stroke="#4a5070" strokeWidth="1"/>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

// ── Panel wrapper ─────────────────────────────────────────────────
const Panel = ({ title, unit, totalW, hourW, hours, nowIdx, onScroll, height, children }) => {
  const padTop = 6;
  const padBot = 6;
  const innerH = height;
  const fullH = innerH + padTop + padBot;
  return (
    <div style={gStyles.row}>
      <div style={gStyles.gutter}>
        <div style={gStyles.gutterTitle}>{title}</div>
        <div style={gStyles.gutterSub}>{unit}</div>
      </div>
      <div data-g-sync="1" onScroll={onScroll} style={gStyles.scroll}>
        <svg width={totalW} height={fullH} style={{display:'block'}}>
          {/* Day / night / now backgrounds */}
          {hours.map((h, i) => {
            const x = i * hourW;
            const night = h.time.getHours() < 6 || h.time.getHours() >= 20;
            const isNow = i === nowIdx;
            const prev = hours[i-1];
            const newDay = !prev || prev.time.toDateString() !== h.time.toDateString();
            return (
              <g key={i}>
                {night && <rect x={x} y={0} width={hourW} height={fullH} fill="#0a1024"/>}
                {isNow && <rect x={x} y={0} width={hourW} height={fullH} fill="#3a2f0f" opacity="0.55"/>}
                {newDay && i > 0 && (
                  <line x1={x} y1={0} x2={x} y2={fullH} stroke="#2a3550" strokeWidth="1.5"/>
                )}
                {/* 6h tick gridline */}
                {h.time.getHours() % 6 === 0 && !newDay && (
                  <line x1={x} y1={0} x2={x} y2={fullH} stroke="#131a2e" strokeWidth="1"/>
                )}
              </g>
            );
          })}
          {/* Now vertical guide */}
          {nowIdx >= 0 && (
            <line x1={nowIdx * hourW + 0.5} y1={0}
              x2={nowIdx * hourW + 0.5} y2={fullH}
              stroke="#fafafa" strokeWidth="1" opacity="0.4" strokeDasharray="2 3"/>
          )}
          <g transform={`translate(0,${padTop})`}>
            {children({width: totalW, height: innerH, hourW}, innerH)}
          </g>
        </svg>
      </div>
    </div>
  );
};

// ── Temperature: filled area + feels-like dashed line ─────────────
const TempPanel = ({ c, scale, hours, hourW }) => {
  const temps = hours.map(h => h.temperature);
  const feels = hours.map(h => h.feelsLike);
  const tMin = Math.min(...temps, ...feels) - 1;
  const tMax = Math.max(...temps, ...feels) + 1;
  const y = (v) => scale - ((v - tMin) / (tMax - tMin)) * scale;
  const pts = (arr) => arr.map((v, i) => `${i * hourW + hourW/2},${y(v).toFixed(1)}`).join(' ');

  // Build a smooth-ish path (use line for simplicity, with gradient fill)
  const linePts = pts(temps);
  const feelPts = pts(feels);
  // Closed area for fill
  const areaPath = `M ${0},${scale} L ${linePts.split(' ').join(' L ')} L ${(hours.length-1)*hourW + hourW/2},${scale} Z`;

  // Temperature gradient stops along the y axis based on value range.
  return (
    <>
      <defs>
        <linearGradient id="tempGrad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%"   stopColor="#bfd4ef" stopOpacity="0.0"/>
          <stop offset="20%"  stopColor="#bfd4ef" stopOpacity="0.15"/>
          <stop offset="55%"  stopColor="#fff09a" stopOpacity="0.35"/>
          <stop offset="85%"  stopColor="#ffb04a" stopOpacity="0.55"/>
          <stop offset="100%" stopColor="#f4612a" stopOpacity="0.7"/>
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#tempGrad)"/>
      {/* Feels-like dashed */}
      <polyline points={feelPts} fill="none" stroke="#9a9a93" strokeWidth="1" strokeDasharray="3 3" opacity="0.7"/>
      {/* Main temp line */}
      <polyline points={linePts} fill="none" stroke="#fafafa" strokeWidth="1.6"/>
      {/* Value labels every 6h */}
      {hours.map((h, i) => {
        if (h.time.getHours() % 6 !== 0) return null;
        return (
          <g key={i}>
            <circle cx={i*hourW + hourW/2} cy={y(h.temperature)} r="2.4" fill="#fafafa"/>
            <text x={i*hourW + hourW/2} y={y(h.temperature) - 6} fontSize="10" fill="#fafafa"
              textAnchor="middle" fontFamily='"JetBrains Mono", ui-monospace, monospace'
              style={{fontVariantNumeric:"tabular-nums"}}>{h.temperature}°</text>
          </g>
        );
      })}
    </>
  );
};

// ── Wind: bars by speed + gust outline + direction arrows ─────────
const WindPanel = ({ c, scale, hours, hourW }) => {
  const arrowZ = 12; // bottom band for arrows
  const barH = scale - arrowZ - 2;
  const maxV = Math.max(45, ...hours.map(h => h.windGust));
  const y = (v) => barH - (v / maxV) * barH;

  return (
    <>
      {hours.map((h, i) => {
        const x = i * hourW + 2;
        const w = hourW - 4;
        const c1 = wgScales.wind(h.windSpeed);
        return (
          <g key={i}>
            {/* Gust outline */}
            <rect x={x} y={y(h.windGust)} width={w} height={barH - y(h.windGust)}
              fill="none" stroke="#fafafa" strokeWidth="0.8" opacity="0.4"/>
            {/* Speed bar */}
            <rect x={x} y={y(h.windSpeed)} width={w} height={barH - y(h.windSpeed)}
              fill={c1.bg} stroke={c1.bg}/>
            {/* Value, every 3h */}
            {h.time.getHours() % 3 === 0 && (
              <text x={x + w/2} y={y(h.windSpeed) - 2} fontSize="8.5" fill={c1.fg === '#fff' ? '#fafafa' : c1.fg}
                textAnchor="middle" fontFamily='"JetBrains Mono", ui-monospace, monospace'
                fontWeight={h.windSpeed >= 25 ? 700 : 500}
                style={{fontVariantNumeric:"tabular-nums"}}>{h.windSpeed}</text>
            )}
            {/* Arrow band */}
            <g transform={`translate(${i*hourW + hourW/2},${scale - arrowZ/2 + 1}) rotate(${h.windDirection + 180})`}>
              <path d="M0 -4 L3 4 L0 2.5 L-3 4 Z" fill="#cfcfcf"/>
            </g>
          </g>
        );
      })}
      {/* Baseline */}
      <line x1="0" y1={barH} x2={hours.length * hourW} y2={barH}
        stroke="#1f2a48" strokeWidth="1"/>
    </>
  );
};

// ── Rain: % area + precip mm bars ─────────────────────────────────
const RainPanel = ({ c, scale, hours, hourW }) => {
  const maxMm = Math.max(4, ...hours.map(h => h.precipAmount || 0));
  // Probability area
  const probY = (p) => scale - (p / 100) * scale;
  const pts = hours.map((h, i) => `${i * hourW + hourW/2},${probY(h.precipProbability).toFixed(1)}`).join(' ');
  const areaPath = `M 0,${scale} L ${pts.split(' ').join(' L ')} L ${(hours.length-1)*hourW + hourW/2},${scale} Z`;

  return (
    <>
      <defs>
        <linearGradient id="rainGrad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%"   stopColor="#3a9cef" stopOpacity="0"/>
          <stop offset="40%"  stopColor="#3a9cef" stopOpacity="0.35"/>
          <stop offset="100%" stopColor="#7fc8ff" stopOpacity="0.7"/>
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#rainGrad)"/>
      <polyline points={pts} fill="none" stroke="#7fc8ff" strokeWidth="1.3"/>
      {/* Precip bars in mm — overlaid */}
      {hours.map((h, i) => {
        if (!h.precipAmount || h.precipAmount < 0.05) return null;
        const x = i * hourW + hourW/2 - 3;
        const v = h.precipAmount;
        const barH = (v / maxMm) * scale;
        return (
          <rect key={i} x={x} y={scale - barH} width={6} height={barH}
            fill="#bfe4ff" opacity="0.9"/>
        );
      })}
      {/* Tick labels at right axis */}
      <text x="2" y="9" fontSize="8" fill="#5a6485" fontFamily='"JetBrains Mono", ui-monospace, monospace'>100%</text>
    </>
  );
};

// ── Waves: height area + period labels + direction arrows ─────────
const WavePanel = ({ c, scale, hours, hourW }) => {
  const arrowZ = 10;
  const innerH = scale - arrowZ - 2;
  const maxM = Math.max(3, ...hours.map(h => h.waveHeight || 0));
  const y = (m) => innerH - (m / maxM) * innerH;
  const pts = hours.map((h, i) => `${i * hourW + hourW/2},${y(h.waveHeight || 0).toFixed(1)}`).join(' ');
  const areaPath = `M 0,${innerH} L ${pts.split(' ').join(' L ')} L ${(hours.length-1)*hourW + hourW/2},${innerH} Z`;

  return (
    <>
      <defs>
        <linearGradient id="waveGrad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%"   stopColor="#4a4f9c" stopOpacity="0.1"/>
          <stop offset="60%"  stopColor="#6f5fc8" stopOpacity="0.5"/>
          <stop offset="100%" stopColor="#9a4fd4" stopOpacity="0.85"/>
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#waveGrad)"/>
      <polyline points={pts} fill="none" stroke="#cfb8ff" strokeWidth="1.3"/>
      {/* Period labels every 6h */}
      {hours.map((h, i) => {
        if (h.time.getHours() % 6 !== 0 || !h.wavePeriod) return null;
        const fg = h.wavePeriod >= 10 ? '#f5b8c8' : '#cfb8ff';
        return (
          <text key={i} x={i*hourW + hourW/2} y={y(h.waveHeight || 0) - 4}
            fontSize="9" fill={fg} textAnchor="middle"
            fontFamily='"JetBrains Mono", ui-monospace, monospace'
            style={{fontVariantNumeric:"tabular-nums"}} fontWeight="600">
            {h.wavePeriod}s
          </text>
        );
      })}
      {/* Direction arrows */}
      {hours.map((h, i) => (
        <g key={`a${i}`} transform={`translate(${i*hourW + hourW/2},${scale - arrowZ/2 + 1}) rotate(${(h.waveDirection || 0) + 180})`}>
          <path d="M0 -3 L2.4 3 L0 1.8 L-2.4 3 Z" fill="#a8b3e0" opacity="0.85"/>
        </g>
      ))}
      <line x1="0" y1={innerH} x2={hours.length * hourW} y2={innerH}
        stroke="#1f2a48" strokeWidth="1"/>
    </>
  );
};

// ── Cloud cover: simple % filled bar across each hour ─────────────
const CloudPanel = ({ c, scale, hours, hourW }) => (
  <>
    {hours.map((h, i) => {
      const x = i * hourW;
      const v = h.cloudCover;
      const h2 = (v / 100) * scale;
      const cc = wgScales.cloud(v);
      return (
        <rect key={i} x={x} y={scale - h2} width={hourW} height={h2}
          fill={cc.bg} opacity={v < 5 ? 0.15 : 1}/>
      );
    })}
  </>
);

// ── helpers ───────────────────────────────────────────────────────
function dayShort(d) {
  const wd = ['Su','Mo','Tu','We','Th','Fr','Sa'][d.getDay()];
  return `${wd} ${d.getDate()}.`;
}

// ── styles ────────────────────────────────────────────────────────
const gStyles = {
  root: {
    width: '100%', height: '100%',
    background: '#070b1a', color: '#e5e5e5',
    fontFamily: '"Inter", -apple-system, system-ui, sans-serif',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  appBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 14px 8px',
    borderBottom: '1px solid #131a2e', flexShrink: 0,
  },
  appTitle: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#fafafa' },
  logoBadge: {
    fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
    background: '#fafafa', color: '#070b1a',
    padding: '3px 6px', borderRadius: 3,
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
  },
  updated: {
    fontSize: 10, color: '#7a7a7a',
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    fontVariantNumeric: 'tabular-nums',
  },
  iconBtn: {
    width: 28, height: 28, borderRadius: 14,
    background: '#0f1628', border: '1px solid #1b2440', color: '#a3a3a3',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  },
  locStrip: {
    display: 'flex', alignItems: 'baseline', gap: 8,
    padding: '8px 14px 10px', borderBottom: '1px solid #131a2e',
    flexShrink: 0,
  },
  locName: { fontSize: 18, fontWeight: 600, letterSpacing: -0.3, color: '#fafafa' },
  locRegion: { fontSize: 11, color: '#7a7a7a', fontWeight: 500 },

  scrollHost: { flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 4 },
  row: {
    display: 'flex', alignItems: 'stretch',
    borderBottom: '1px solid #101627',
    minHeight: 32,
  },
  timeAxisRow: {
    minHeight: 46, position: 'sticky', top: 0, zIndex: 2,
    background: '#070b1a',
    borderBottom: '1px solid #1f2a48',
  },
  gutter: {
    flexShrink: 0, width: 88,
    padding: '6px 8px 6px 14px',
    display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 1,
    background: '#070b1a', borderRight: '1px solid #131a2e',
    position: 'sticky', left: 0, zIndex: 1,
  },
  gutterTitle: {
    fontSize: 11, color: '#fafafa', fontWeight: 700, letterSpacing: 0.2,
  },
  gutterSub: {
    fontSize: 10, color: '#7a7a7a',
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
  },
  scroll: { flex: 1, overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none' },
};

window.TodayGraph = TodayGraph;
