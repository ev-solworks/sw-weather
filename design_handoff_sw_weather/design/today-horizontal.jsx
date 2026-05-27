// today-horizontal.jsx — horizontal hour-table variant
// Layout: vertical "spec sheet" of rows, each row is a horizontally-scrolling
// strip of hours. Reads like Windguru — every metric stacks into its own row,
// so you can scan one dimension across time without losing your place.

const TodayHorizontal = ({ hours, location, now, theme, bands }) => {
  const T = theme || window.SW_THEMES.black;
  const scrollRef = React.useRef(null);
  const HOUR_W = 56; // px per column

  // Group hours by local-day for the day-boundary separators.
  const days = React.useMemo(() => {
    const groups = [];
    hours.forEach((h, i) => {
      const key = h.time.toDateString();
      if (!groups.length || groups[groups.length - 1].key !== key) {
        groups.push({ key, date: h.time, start: i, hours: [h] });
      } else {
        groups[groups.length - 1].hours.push(h);
      }
    });
    return groups;
  }, [hours]);

  // Find "now" — the first hour whose time matches the anchored "now".
  const nowIdx = hours.findIndex((h) => h.time.getTime() === now.getTime());

  // Synchronized horizontal scroll across all rows.
  const onScroll = (e) => {
    const x = e.currentTarget.scrollLeft;
    scrollRef.current.querySelectorAll('[data-sync]').forEach((el) => {
      if (el !== e.currentTarget) el.scrollLeft = x;
    });
  };

  // Auto-scroll so "now" is the first visible column on mount.
  React.useEffect(() => {
    const els = scrollRef.current?.querySelectorAll('[data-sync]');
    if (!els) return;
    const x = Math.max(0, nowIdx * HOUR_W - 8);
    els.forEach((el) => { el.scrollLeft = x; });
  }, [nowIdx]);

  return (
    <div style={{...hStyles.root, background: T.bg, color: T.text}}>
      {/* ── Header ───────────────────────────────────────────────── */}
      <div style={hStyles.header}>
        <button style={hStyles.locBtn}>
          <span style={hStyles.locName}>{location.name}</span>
          <svg width="10" height="6" viewBox="0 0 10 6" style={{opacity:.5}}>
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
          </svg>
        </button>
        <button style={hStyles.iconBtn} aria-label="Search">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="7" cy="7" r="5"/><path d="M11 11l3 3" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* ── Summary ──────────────────────────────────────────────── */}
      <div style={hStyles.summary}>
        <div style={hStyles.dateLine}>
          {now.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}
          <span style={{color:'#3d3d3d',margin:'0 8px'}}>·</span>
          <span style={{color:'#6b6b6b'}}>14:00 local</span>
        </div>
        <div style={hStyles.summaryText}>{location.summary}</div>
      </div>

      {/* ── Big "now" readout ────────────────────────────────────── */}
      <div style={hStyles.nowBlock}>
        <div style={hStyles.nowTempCol}>
          <div style={hStyles.nowTemp}>
            {hours[nowIdx].temperature}<span style={hStyles.deg}>°</span>
          </div>
          <div style={hStyles.nowFeel}>
            Feels {hours[nowIdx].feelsLike}°
          </div>
        </div>
        <div style={hStyles.nowRight}>
          <div style={hStyles.nowDesc}>{hours[nowIdx].description}</div>
          <div style={hStyles.nowMetaRow}>
            <span>{hours[nowIdx].windSpeed} km/h {compass(hours[nowIdx].windDirection)}</span>
            <span style={hStyles.dot}/>
            <span>Gust {hours[nowIdx].windGust}</span>
          </div>
          <div style={hStyles.nowMetaRow}>
            <span style={{color: WX_SCALES.precip(hours[nowIdx].precipProbability).fg}}>
              {hours[nowIdx].precipProbability}% rain
            </span>
            <span style={hStyles.dot}/>
            <span>UV {hours[nowIdx].uvIndex}</span>
            <span style={hStyles.dot}/>
            <span>{hours[nowIdx].cloudCover}% cloud</span>
          </div>
        </div>
      </div>

      {/* ── Section label + hint ─────────────────────────────────── */}
      <div style={hStyles.sectionLabel}>
        <span>Next 48 hours</span>
        <span style={hStyles.scrollHint}>scroll →</span>
      </div>

      {/* ── The table ────────────────────────────────────────────── */}
      <div ref={scrollRef} style={hStyles.tableWrap}>
        <Row theme={T} bands={bands} label="Time" sync onScroll={onScroll} hours={hours} days={days} nowIdx={nowIdx} hourW={HOUR_W}
             render={(h, i) => (
               <div style={{...hStyles.cell, ...hStyles.timeCell}}>
                 {h.time.getHours() === 0 ? (
                   <span style={hStyles.midnightTime}>00</span>
                 ) : fmtHour(h.time).slice(0,2)}
               </div>
             )} />

        <PrecipRow theme={T} bands={bands} hours={hours} days={days} nowIdx={nowIdx} hourW={HOUR_W} onScroll={onScroll} />

        <Row theme={T} bands={bands} label="Temp" sync onScroll={onScroll} hours={hours} days={days} nowIdx={nowIdx} hourW={HOUR_W}
             render={(h) => (
               <div style={{...hStyles.cell, ...hStyles.tempCell}}>
                 <div style={hStyles.tempBig}>{h.temperature}°</div>
                 <div style={hStyles.tempFeel}>{h.feelsLike}°</div>
               </div>
             )} />

        <Row theme={T} bands={bands} label="Cond." sync onScroll={onScroll} hours={hours} days={days} nowIdx={nowIdx} hourW={HOUR_W}
             render={(h) => (
               <div style={{...hStyles.cell, ...hStyles.condCell}} title={h.description}>
                 <WxIcon desc={h.description} size={18} color={T.textHi}/>
               </div>
             )} />

        <Row theme={T} bands={bands} label="Wind" sync onScroll={onScroll} hours={hours} days={days} nowIdx={nowIdx} hourW={HOUR_W}
             render={(h) => {
               const gusty = h.windGust - h.windSpeed >= 12;
               return (
                 <div style={{...hStyles.cell, ...hStyles.windCell}}>
                   <WindArrow deg={h.windDirection} strength={h.windSpeed}/>
                   <div style={hStyles.windNum}>{h.windSpeed}</div>
                   {gusty && <div style={hStyles.windGust}>g{h.windGust}</div>}
                 </div>
               );
             }} />

        <Row theme={T} bands={bands} label="UV" sync onScroll={onScroll} hours={hours} days={days} nowIdx={nowIdx} hourW={HOUR_W}
             render={(h) => {
               const s = WX_SCALES.uv(h.uvIndex);
               if (h.uvIndex === 0) return <div style={{...hStyles.cell, ...hStyles.uvZero}}>—</div>;
               return (
                 <div style={hStyles.cell}>
                   <div style={{...hStyles.uvPill, background: s.bg, color: s.fg}}>{h.uvIndex}</div>
                 </div>
               );
             }} />

        <Row theme={T} bands={bands} label="Cloud" sync onScroll={onScroll} hours={hours} days={days} nowIdx={nowIdx} hourW={HOUR_W}
             render={(h) => (
               <div style={{...hStyles.cell, ...hStyles.cloudCell}}>
                 <div style={hStyles.cloudNum}>{h.cloudCover}</div>
                 <div style={hStyles.cloudBar}>
                   <div style={{...hStyles.cloudFill, height: `${h.cloudCover}%`}}/>
                 </div>
               </div>
             )} />
      </div>

      {/* ── Tab bar ──────────────────────────────────────────────── */}
      <TabBar active="today" theme={T}/>
    </div>
  );
};

// ── Row primitive ────────────────────────────────────────────────────
const Row = ({ label, hours, render, days, nowIdx, hourW, onScroll, sync, theme, bands }) => {
  const T = theme || window.SW_THEMES.black;
  return (
  <div style={{...hStyles.row, borderBottom: `1px solid ${T.border}`}}>
    <div style={{...hStyles.rowLabel, background: T.bg, borderRight: `1px solid ${T.border}`, color: T.textXLo}}>{label}</div>
    <div data-sync={sync ? '1' : undefined} onScroll={onScroll} style={hStyles.rowScroll}>
      <div style={{...hStyles.rowInner, width: hours.length * hourW}}>
        {hours.map((h, i) => {
          const bandBg = bands ? window.bandForHour(h.time.getHours(), 1) : null;
          return (
          <React.Fragment key={i}>
            {/* day boundary line, drawn before the new day's first hour */}
            {i > 0 && h.time.getHours() === 0 && (
              <div style={hStyles.dayDivider}>
                <span style={{...hStyles.dayDividerLabel, background: T.bg, color: T.textHi}}>{fmtDayShort(h.time)}</span>
              </div>
            )}
            <div style={{
              ...hStyles.cellWrap,
              width: hourW,
              borderRight: `1px solid ${T.border}`,
              background: bandBg || 'transparent',
              ...(i === nowIdx ? hStyles.cellNow : null),
            }}>
              {render(h, i)}
              {i === nowIdx && <div style={hStyles.nowMarker}/>}
            </div>
          </React.Fragment>
          );
        })}
      </div>
    </div>
  </div>
  );
};

// Precip row uses bg fill across the row to make the rain block visually obvious.
const PrecipRow = ({ hours, days, nowIdx, hourW, onScroll, theme, bands }) => {
  const T = theme || window.SW_THEMES.black;
  return (
  <div style={{...hStyles.row, ...hStyles.precipRow, borderBottom: `1px solid ${T.border}`}}>
    <div style={{...hStyles.rowLabel, background: T.bg, borderRight: `1px solid ${T.border}`, color: T.textXLo}}>Rain</div>
    <div data-sync="1" onScroll={onScroll} style={hStyles.rowScroll}>
      <div style={{...hStyles.rowInner, width: hours.length * hourW, height: 56}}>
        {hours.map((h, i) => {
          const s = WX_SCALES.precip(h.precipProbability);
          const bandBg = bands ? window.bandForHour(h.time.getHours(), 1.4) : null;
          return (
            <React.Fragment key={i}>
              {i > 0 && h.time.getHours() === 0 && (
                <div style={hStyles.dayDivider}>
                  <span style={{...hStyles.dayDividerLabel, background: T.bg, color: T.textHi}}>{fmtDayShort(h.time)}</span>
                </div>
              )}
              <div style={{
                ...hStyles.cellWrap,
                width: hourW,
                borderRight: `1px solid ${T.border}`,
                background: s.bg !== 'transparent' ? s.bg : (bandBg || 'transparent'),
                ...(i === nowIdx ? hStyles.cellNow : null),
              }}>
                <div style={{...hStyles.precipCell, color: s.fg}}>
                  <div style={hStyles.precipPct}>
                    {h.precipProbability >= 20 ? `${h.precipProbability}` : '·'}
                  </div>
                  {h.precipAmount > 0 && (
                    <div style={hStyles.precipMm}>{h.precipAmount.toFixed(1)}</div>
                  )}
                </div>
                {i === nowIdx && <div style={hStyles.nowMarker}/>}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  </div>
  );
};

// Wind direction arrow — points in the direction the wind is going TO.
// In meteorology, "wind from N" means deg=0; arrow rendered points away from origin.
const WindArrow = ({ deg, strength }) => {
  const opacity = strength < 10 ? 0.35 : strength < 20 ? 0.6 : strength < 30 ? 0.85 : 1;
  return (
    <svg width="14" height="14" viewBox="0 0 14 14"
         style={{ transform: `rotate(${deg + 180}deg)`, opacity }}>
      <path d="M7 1.5L10.5 9 7 7.2 3.5 9z" fill="#cfcfcf"/>
    </svg>
  );
};

// Map condition descriptions to a 2-letter monospace glyph until icons land.
function condGlyph(desc) {
  const m = {
    'Sunny': 'SU',
    'Mostly clear': 'MC',
    'Clear': 'CL',
    'Partly cloudy': 'PC',
    'Cloudy': 'CD',
    'Light rain': 'LR',
    'Rain': 'RA',
    'Heavy rain': 'HR',
  };
  return m[desc] || '··';
}

const TabBar = ({ active, theme }) => {
  const T = theme || window.SW_THEMES.black;
  return (
  <div style={{...hStyles.tabBar, background: T.bg, borderTop: `1px solid ${T.border}`}}>
    {[
      ['home','Home'],
      ['today','Today'],
      ['week','Week'],
    ].map(([k, label]) => (
      <button key={k} style={{
        ...hStyles.tab,
        color: active === k ? T.textHi : T.textXLo,
      }}>
        <span style={{
          ...hStyles.tabDot,
          background: active === k ? T.textHi : 'transparent',
        }}/>
        {label}
      </button>
    ))}
  </div>
  );
};

// ── Styles ───────────────────────────────────────────────────────────
const hStyles = {
  root: {
    width: '100%', height: '100%',
    background: '#0a0a0a', color: '#e5e5e5',
    fontFamily: '"Inter", -apple-system, system-ui, sans-serif',
    fontSize: 14, lineHeight: 1.4,
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 16px 4px', flexShrink: 0,
  },
  locBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'transparent', border: 0, color: '#e5e5e5', padding: '6px 0',
    fontSize: 15, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
  },
  locName: { letterSpacing: -0.1 },
  iconBtn: {
    width: 32, height: 32, borderRadius: 16,
    background: '#1a1a1a', border: '1px solid #232323',
    color: '#a3a3a3', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
  },
  summary: { padding: '4px 16px 12px' },
  dateLine: { fontSize: 12, color: '#9a9a9a', fontVariantNumeric: 'tabular-nums' },
  summaryText: { fontSize: 13, color: '#cfcfcf', marginTop: 4, lineHeight: 1.35, textWrap: 'pretty' },

  nowBlock: {
    display: 'flex', alignItems: 'flex-end', gap: 16,
    padding: '4px 16px 16px',
  },
  nowTempCol: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start' },
  nowTemp: {
    fontSize: 76, fontWeight: 200, lineHeight: 0.95, letterSpacing: -2,
    color: '#fafafa', fontFeatureSettings: '"tnum"',
  },
  deg: { fontWeight: 200, color: '#6b6b6b' },
  nowFeel: { fontSize: 12, color: '#8a8a8a', marginTop: 2, fontVariantNumeric: 'tabular-nums' },
  nowRight: { flex: 1, display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 6 },
  nowDesc: { fontSize: 15, color: '#e5e5e5', fontWeight: 500 },
  nowMetaRow: {
    fontSize: 12, color: '#9a9a9a', display: 'flex',
    alignItems: 'center', gap: 6, fontVariantNumeric: 'tabular-nums',
  },
  dot: { width: 2, height: 2, borderRadius: 1, background: '#3a3a3a' },

  sectionLabel: {
    display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
    padding: '12px 16px 8px',
    fontSize: 11, textTransform: 'uppercase', letterSpacing: 1,
    color: '#7a7a7a', fontWeight: 500,
    borderTop: '1px solid #1a1a1a',
  },
  scrollHint: { fontSize: 10, color: '#4a4a4a', letterSpacing: 0.5 },

  tableWrap: {
    flex: 1, overflowY: 'auto', overflowX: 'hidden',
    paddingBottom: 12,
  },

  row: {
    display: 'flex', alignItems: 'stretch',
    borderBottom: '1px solid #141414',
    minHeight: 44,
  },
  precipRow: {
    minHeight: 56,
    background: 'linear-gradient(to right, #0a0a0a, #0a0a0a)',
  },
  rowLabel: {
    width: 56, flexShrink: 0,
    display: 'flex', alignItems: 'center',
    padding: '0 12px 0 16px',
    fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8,
    color: '#5a5a5a', fontWeight: 500,
    borderRight: '1px solid #141414',
    background: '#0a0a0a',
    position: 'sticky', left: 0, zIndex: 2,
  },
  rowScroll: {
    flex: 1, overflowX: 'auto', overflowY: 'hidden',
    scrollbarWidth: 'none',
  },
  rowInner: {
    display: 'flex', height: '100%', position: 'relative',
  },

  cellWrap: {
    flexShrink: 0, height: '100%', position: 'relative',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRight: '1px solid #131313',
  },
  cellNow: {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
  },
  nowMarker: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 2,
    background: '#fafafa', boxShadow: '0 0 12px rgba(255,255,255,0.4)',
  },

  cell: {
    width: '100%', height: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexDirection: 'column', gap: 2,
    fontVariantNumeric: 'tabular-nums',
  },

  timeCell: {
    fontSize: 13, fontWeight: 500, color: '#a3a3a3',
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
  },
  midnightTime: { color: '#fafafa', fontWeight: 600 },

  precipCell: {
    width: '100%', height: '100%',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 1,
    fontVariantNumeric: 'tabular-nums',
  },
  precipPct: {
    fontSize: 14, fontWeight: 600,
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
  },
  precipMm: {
    fontSize: 9, opacity: 0.85, letterSpacing: 0.2,
  },

  tempCell: { gap: 0 },
  tempBig: { fontSize: 17, fontWeight: 500, color: '#fafafa', letterSpacing: -0.3 },
  tempFeel: { fontSize: 10, color: '#6b6b6b' },

  condCell: {},
  condGlyph: {
    fontSize: 11, fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    color: '#a3a3a3', letterSpacing: 0.5,
    padding: '3px 6px', borderRadius: 3,
    background: '#161616',
  },

  windCell: { gap: 1 },
  windNum: {
    fontSize: 12, color: '#cfcfcf', fontWeight: 500,
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
  },
  windGust: { fontSize: 9, color: '#e69a4f', fontWeight: 500 },

  uvPill: {
    fontSize: 12, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
    minWidth: 22, textAlign: 'center',
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
  },
  uvZero: { color: '#3a3a3a', fontSize: 14 },

  cloudCell: { flexDirection: 'row', gap: 6 },
  cloudNum: {
    fontSize: 11, color: '#8a8a8a', minWidth: 22, textAlign: 'right',
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
  },
  cloudBar: {
    width: 4, height: 24, borderRadius: 2,
    background: '#1a1a1a', overflow: 'hidden',
    display: 'flex', alignItems: 'flex-end',
  },
  cloudFill: { width: '100%', background: '#5a5a5a' },

  dayDivider: {
    width: 1, flexShrink: 0,
    background: 'repeating-linear-gradient(to bottom, #2a2a2a 0 4px, transparent 4px 8px)',
    position: 'relative',
  },
  dayDividerLabel: {
    position: 'absolute', top: -2, left: 4,
    fontSize: 9, fontWeight: 600, color: '#fafafa',
    letterSpacing: 1, textTransform: 'uppercase',
    background: '#0a0a0a', padding: '1px 4px',
    whiteSpace: 'nowrap',
  },

  tabBar: {
    flexShrink: 0,
    display: 'flex', borderTop: '1px solid #1a1a1a',
    background: '#0a0a0a', paddingBottom: 18,
  },
  tab: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 4, padding: '10px 0 4px',
    background: 'transparent', border: 0, fontSize: 11,
    fontFamily: 'inherit', cursor: 'pointer', fontWeight: 500,
  },
  tabDot: {
    width: 4, height: 4, borderRadius: 2,
  },
};

window.TodayHorizontal = TodayHorizontal;
