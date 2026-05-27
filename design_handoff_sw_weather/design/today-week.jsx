// today-week.jsx — 7-day forecast view.
// Hero: week temperature-range chart (per-day bar across week's absolute scale).
// Body: detailed 7-day list with condition, wind/wave/rain chips, lo/hi temps.

const TodayWeek = ({ days, location, now }) => {
  // Absolute temperature scale for the week.
  const allTemps = days.flatMap(d => [d.tempHi, d.tempLo]);
  const weekHi = Math.max(...allTemps);
  const weekLo = Math.min(...allTemps);
  // Pad scale slightly so bars don't kiss the edges.
  const scaleMin = weekLo - 1;
  const scaleMax = weekHi + 1;
  const scaleRange = scaleMax - scaleMin;

  // Highest hi and lowest lo across the week, for the summary chips.
  const totalRain = days.reduce((s, d) => s + d.rainAmount, 0);
  const maxWave = Math.max(...days.map(d => d.waveHeight));

  return (
    <div style={wkStyles.root}>
      {/* App bar */}
      <div style={wkStyles.appBar}>
        <div style={wkStyles.appTitle}>
          <span style={wkStyles.logoBadge}>SW</span>
          <span style={{fontWeight:600}}>Week</span>
        </div>
        <div style={wkStyles.dateTag}>9–15 Feb</div>
      </div>

      {/* Location */}
      <div style={wkStyles.locStrip}>
        <span style={wkStyles.locName}>{location.name}</span>
        <span style={wkStyles.locRegion}>{location.region}</span>
      </div>

      <div style={wkStyles.body}>
        {/* Week summary tiles */}
        <div style={wkStyles.summary}>
          <Tile label="Week high" value={`${weekHi}°`} accent="#f4612a"/>
          <Tile label="Week low"  value={`${weekLo}°`} accent="#6a8aff"/>
          <Tile label="Total rain" value={`${totalRain.toFixed(1)}`} unit="mm" accent="#3a9cef"/>
          <Tile label="Peak wave" value={`${maxWave.toFixed(1)}`} unit="m" accent="#9a4fd4"/>
        </div>

        {/* Scale axis above the day rows */}
        <div style={wkStyles.scaleAxis}>
          <span style={wkStyles.scaleNum}>{scaleMin}°</span>
          <div style={wkStyles.scaleFill}>
            <div style={wkStyles.scaleGrad}/>
          </div>
          <span style={wkStyles.scaleNum}>{scaleMax}°</span>
        </div>

        {/* 7 day rows */}
        <div style={wkStyles.list}>
          {days.map((d, i) => (
            <DayRow key={i}
              day={d}
              isToday={i === 0}
              now={now}
              scaleMin={scaleMin}
              scaleRange={scaleRange}
            />
          ))}
        </div>

        <div style={wkStyles.footnote}>
          Tap a day for hourly · long-press to pin
        </div>
      </div>

      <TabBar active="week" theme={window.SW_THEMES.black}/>
    </div>
  );
};

// ── Day row ──────────────────────────────────────────────────────
const DayRow = ({ day, isToday, now, scaleMin, scaleRange }) => {
  // Position of the temp-range bar inside the row's track.
  const loPct  = ((day.tempLo - scaleMin) / scaleRange) * 100;
  const hiPct  = ((day.tempHi - scaleMin) / scaleRange) * 100;
  const curPct = day.tempCurrent != null
    ? ((day.tempCurrent - scaleMin) / scaleRange) * 100
    : null;

  // Gradient slice spanning the bar: pick stops from the Windguru temp ramp
  // for this day's range, so each bar gets a colour mood.
  const grad = tempGradient(day.tempLo, day.tempHi);

  const dateStr = `${day.date.getDate()} ${day.date.toLocaleString('en-GB',{month:'short'})}`;

  return (
    <div style={{
      ...wkStyles.row,
      ...(isToday ? wkStyles.rowToday : null),
    }}>
      <div style={wkStyles.rowMain}>
        {/* Left: day name + date */}
        <div style={wkStyles.rowDay}>
          <div style={{
            ...wkStyles.rowDayName,
            color: isToday ? '#ffd06a' : '#fafafa',
          }}>
            {day.dayName}
          </div>
          <div style={wkStyles.rowDate}>{dateStr}</div>
        </div>

        {/* Icon */}
        <div style={wkStyles.rowIcon}>
          <WxIcon desc={day.description} size={28} color="#fafafa" strokeWidth={1.4}/>
        </div>

        {/* Right: range bar + temps */}
        <div style={wkStyles.rangeWrap}>
          <span style={wkStyles.tempLo}>{day.tempLo}°</span>
          <div style={wkStyles.track}>
            <div style={{
              ...wkStyles.bar,
              left: `${loPct}%`,
              width: `${hiPct - loPct}%`,
              background: grad,
            }}/>
            {curPct != null && (
              <div style={{...wkStyles.curMarker, left: `${curPct}%`}}/>
            )}
          </div>
          <span style={wkStyles.tempHi}>{day.tempHi}°</span>
        </div>
      </div>

      {/* Inline chips: rain + wind + wave + condition */}
      <div style={wkStyles.chips}>
        <span style={wkStyles.condLabel}>{day.description}</span>
        <Chip color="#3a9cef" muted={day.rainProbability < 30}>
          <RainGlyph/>
          <span>{day.rainProbability}<span style={wkStyles.chipUnit}>%</span></span>
        </Chip>
        <Chip color="#7fd02a" muted={day.windAvg < 12}>
          <Arrow deg={day.windDirection}/>
          <span>{day.windAvg}<span style={wkStyles.chipUnit}>km/h</span></span>
        </Chip>
        <Chip color="#9a4fd4" muted={day.waveHeight < 0.7}>
          <WaveGlyph/>
          <span>{day.waveHeight.toFixed(1)}<span style={wkStyles.chipUnit}>m</span></span>
        </Chip>
      </div>
    </div>
  );
};

// ── Small components ─────────────────────────────────────────────
const Tile = ({ label, value, unit, accent }) => (
  <div style={wkStyles.tile}>
    <div style={{...wkStyles.tileBar, background: accent}}/>
    <div style={wkStyles.tileLabel}>{label}</div>
    <div style={wkStyles.tileVal}>
      <span>{value}</span>
      {unit && <span style={wkStyles.tileUnit}>{unit}</span>}
    </div>
  </div>
);

const Chip = ({ color, muted, children }) => (
  <div style={{
    ...wkStyles.chip,
    color: muted ? '#7a7a7a' : color,
    background: muted ? '#0c1428' : `${color}1a`,
    borderColor: muted ? '#1b2440' : `${color}33`,
  }}>
    {children}
  </div>
);

const RainGlyph = () => (
  <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 1.5c1.5 2 3.5 4 3.5 6.5a3.5 3.5 0 11-7 0c0-2.5 2-4.5 3.5-6.5z"/>
  </svg>
);
const WaveGlyph = () => (
  <svg width="12" height="11" viewBox="0 0 14 11" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
    <path d="M1 7 C 3 4, 4 4, 6 7 S 11 10, 13 7"/>
    <path d="M1 3 C 3 1, 4 1, 6 3 S 11 5, 13 3" opacity="0.5"/>
  </svg>
);
const Arrow = ({ deg }) => (
  <svg width="11" height="11" viewBox="0 0 11 11" style={{transform:`rotate(${deg + 180}deg)`}}>
    <path d="M5.5 1 L9 9 L5.5 7.5 L2 9 Z" fill="currentColor"/>
  </svg>
);

// ── helpers ──────────────────────────────────────────────────────
// Map a temp range to a CSS linear-gradient by sampling the Windguru temp ramp.
function tempGradient(lo, hi) {
  const colorAt = (t) => {
    if (t < -5) return '#bfd4ef';
    if (t < 0)  return '#cfe2ff';
    if (t < 5)  return '#e8f5c8';
    if (t < 10) return '#f2f6a2';
    if (t < 14) return '#fff09a';
    if (t < 18) return '#ffd478';
    if (t < 22) return '#ffb04a';
    if (t < 26) return '#ff8a2a';
    if (t < 30) return '#f4612a';
    return '#cf3290';
  };
  return `linear-gradient(to right, ${colorAt(lo)}, ${colorAt(hi)})`;
}

// ── styles ───────────────────────────────────────────────────────
const wkStyles = {
  root: {
    width: '100%', height: '100%',
    background: '#070b1a', color: '#e5e5e5',
    fontFamily: '"Inter", -apple-system, system-ui, sans-serif',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  appBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 14px 8px', borderBottom: '1px solid #131a2e',
    flexShrink: 0,
  },
  appTitle: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#fafafa' },
  logoBadge: {
    fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
    background: '#fafafa', color: '#070b1a',
    padding: '3px 6px', borderRadius: 3,
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
  },
  dateTag: {
    fontSize: 11, color: '#cfcfcf',
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    background: '#0f1628', border: '1px solid #1b2440',
    padding: '4px 8px', borderRadius: 4,
  },
  locStrip: {
    display: 'flex', alignItems: 'baseline', gap: 8,
    padding: '8px 14px 8px', borderBottom: '1px solid #131a2e',
    flexShrink: 0,
  },
  locName: { fontSize: 16, fontWeight: 600, letterSpacing: -0.3, color: '#fafafa' },
  locRegion: { fontSize: 11, color: '#7a7a7a', fontWeight: 500 },

  body: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' },

  summary: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6,
    padding: '10px 12px 8px',
  },
  tile: {
    position: 'relative',
    background: '#0c1428', border: '1px solid #1b2440',
    borderRadius: 10, padding: '8px 8px 8px 10px',
    display: 'flex', flexDirection: 'column', gap: 2,
    overflow: 'hidden',
  },
  tileBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
  },
  tileLabel: {
    fontSize: 9, fontWeight: 700, letterSpacing: 0.4,
    color: '#7a8aa3', textTransform: 'uppercase',
  },
  tileVal: {
    display: 'flex', alignItems: 'baseline', gap: 2,
    fontSize: 17, color: '#fafafa', fontWeight: 500, letterSpacing: -0.5,
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    fontVariantNumeric: 'tabular-nums',
  },
  tileUnit: { fontSize: 10, color: '#7a7a7a', fontWeight: 500 },

  scaleAxis: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '6px 14px 4px',
  },
  scaleNum: {
    fontSize: 9, color: '#7a8aa3', fontWeight: 600,
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    fontVariantNumeric: 'tabular-nums',
    minWidth: 22, textAlign: 'center',
  },
  scaleFill: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden' },
  scaleGrad: {
    width: '100%', height: '100%',
    background: 'linear-gradient(to right, #cfe2ff, #f2f6a2, #ffd478, #ff8a2a, #f4612a, #cf3290)',
    opacity: 0.4,
  },

  list: {
    display: 'flex', flexDirection: 'column',
    margin: '0 12px', borderRadius: 12, overflow: 'hidden',
    background: '#0c1428', border: '1px solid #1b2440',
  },
  row: {
    display: 'flex', flexDirection: 'column', gap: 6,
    padding: '10px 12px 10px',
    borderBottom: '1px solid #131a2e',
  },
  rowMain: {
    display: 'grid',
    gridTemplateColumns: '56px 32px 1fr',
    alignItems: 'center', gap: 10,
  },
  rowToday: {
    background: 'linear-gradient(90deg, rgba(255,208,106,.08), transparent)',
    borderBottom: '1px solid #1b2440',
  },
  rowDay: { display: 'flex', flexDirection: 'column', gap: 1 },
  rowDayName: {
    fontSize: 13, fontWeight: 600, letterSpacing: -0.2, color: '#fafafa',
  },
  rowDate: {
    fontSize: 10, color: '#7a8aa3',
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    fontVariantNumeric: 'tabular-nums',
  },
  rowIcon: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
  condLabel: {
    fontSize: 11, color: '#9a9a93', fontWeight: 500,
    paddingLeft: 64,           /* align with icon column */
    paddingRight: 4,
    flexBasis: '100%',         /* push chips onto next visual line if needed */
    marginBottom: -4,
    display: 'none',           /* condition lives in icon tooltip; keep simple */
  },
  chips: {
    display: 'flex', flexWrap: 'nowrap', gap: 6,
    paddingLeft: 64,             /* indent under day-name column */
    paddingRight: 0,
    overflow: 'hidden',
  },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '3px 8px', borderRadius: 999,
    fontSize: 11, fontWeight: 500,
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    fontVariantNumeric: 'tabular-nums',
    border: '1px solid transparent',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  chipUnit: { color: 'inherit', opacity: 0.65, marginLeft: 2, fontSize: 9 },

  rangeWrap: {
    display: 'flex', alignItems: 'center', gap: 8,
  },
  tempLo: {
    width: 26, textAlign: 'right',
    fontSize: 12, color: '#9a9a93', fontWeight: 500,
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    fontVariantNumeric: 'tabular-nums',
  },
  tempHi: {
    width: 26, textAlign: 'left',
    fontSize: 13, color: '#fafafa', fontWeight: 600,
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    fontVariantNumeric: 'tabular-nums',
  },
  track: {
    position: 'relative', flex: 1, height: 6,
    background: '#1b2440', borderRadius: 3,
  },
  bar: {
    position: 'absolute', top: 0, bottom: 0, borderRadius: 3,
  },
  curMarker: {
    position: 'absolute', top: -2, bottom: -2, width: 3,
    background: '#fafafa', borderRadius: 2,
    boxShadow: '0 0 6px rgba(255,255,255,.7)',
    transform: 'translateX(-50%)',
  },

  footnote: {
    padding: '10px 14px 14px',
    fontSize: 10, color: '#5a6485', textAlign: 'center',
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
  },
};

window.TodayWeek = TodayWeek;
