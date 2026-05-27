// today-vertical.jsx — vertical timeline variant
// Layout: each hour is a full-width row. Optimized for one-handed thumb scroll.
// The rain block (bg-tinted rows) reads as a continuous "weather event" stripe.

const TodayVertical = ({ hours, location, now, theme, bands }) => {
  const T = theme || window.SW_THEMES.black;
  const nowIdx = hours.findIndex((h) => h.time.getTime() === now.getTime());
  const listRef = React.useRef(null);

  // Auto-scroll the now row near the top.
  React.useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${nowIdx}"]`);
    if (el && listRef.current) {
      listRef.current.scrollTop = el.offsetTop - 8;
    }
  }, [nowIdx]);

  return (
    <div style={{...vStyles.root, background: T.bg, color: T.text}}>
      {/* Header */}
      <div style={vStyles.header}>
        <button style={vStyles.locBtn}>
          <span>{location.name}</span>
          <svg width="10" height="6" viewBox="0 0 10 6" style={{opacity:.5}}>
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
          </svg>
        </button>
        <button style={vStyles.iconBtn}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="7" cy="7" r="5"/><path d="M11 11l3 3" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <div style={vStyles.summary}>
        <div style={vStyles.dateLine}>
          {now.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}
          <span style={{color:'#3d3d3d',margin:'0 8px'}}>·</span>
          <span style={{color:'#6b6b6b'}}>14:00 local</span>
        </div>
        <div style={vStyles.summaryText}>{location.summary}</div>
      </div>

      {/* "Now" hero — current hour pulled out of the list */}
      <div style={{...vStyles.hero, borderBottom: `1px solid ${T.border}`}}>
        <div style={vStyles.heroLeft}>
          <div style={vStyles.heroNowTag}>NOW · {fmtHour(hours[nowIdx].time)}</div>
          <div style={vStyles.heroTemp}>
            {hours[nowIdx].temperature}<span style={{color:'#6b6b6b',fontWeight:200}}>°</span>
          </div>
          <div style={vStyles.heroFeel}>Feels {hours[nowIdx].feelsLike}°</div>
        </div>
        <div style={vStyles.heroRight}>
          <div style={vStyles.heroDesc}>{hours[nowIdx].description}</div>
          <div style={vStyles.heroGrid}>
            <div><span style={vStyles.heroLbl}>Wind</span><span style={vStyles.heroVal}>{hours[nowIdx].windSpeed} <span style={vStyles.heroUnit}>km/h</span> {compass(hours[nowIdx].windDirection)}</span></div>
            <div><span style={vStyles.heroLbl}>Gust</span><span style={vStyles.heroVal}>{hours[nowIdx].windGust} <span style={vStyles.heroUnit}>km/h</span></span></div>
            <div><span style={vStyles.heroLbl}>UV</span><span style={vStyles.heroVal}>{hours[nowIdx].uvIndex} <span style={vStyles.heroUnit}>{WX_SCALES.uv(hours[nowIdx].uvIndex).label}</span></span></div>
            <div><span style={vStyles.heroLbl}>Cloud</span><span style={vStyles.heroVal}>{hours[nowIdx].cloudCover}<span style={vStyles.heroUnit}>%</span></span></div>
          </div>
        </div>
      </div>

      {/* Section heading + column hint */}
      <div style={vStyles.colHead}>
        <div style={{...vStyles.colHeadCell, flex: '0 0 44px'}}>Time</div>
        <div style={{...vStyles.colHeadCell, flex: '0 0 56px'}}>Cond.</div>
        <div style={{...vStyles.colHeadCell, flex: '0 0 44px', textAlign:'right'}}>Temp</div>
        <div style={{...vStyles.colHeadCell, flex: 1, textAlign:'right'}}>Wind</div>
        <div style={{...vStyles.colHeadCell, flex: '0 0 56px', textAlign:'right'}}>Rain</div>
        <div style={{...vStyles.colHeadCell, flex: '0 0 30px', textAlign:'right'}}>UV</div>
      </div>

      {/* Hour list */}
      <div ref={listRef} style={vStyles.list}>
        {hours.map((h, i) => {
          const showDayDivider = i > 0 && h.time.getHours() === 0;
          const ps = WX_SCALES.precip(h.precipProbability);
          const us = WX_SCALES.uv(h.uvIndex);
          const isNow = i === nowIdx;
          const gusty = h.windGust - h.windSpeed >= 12;
          return (
            <React.Fragment key={i}>
              {showDayDivider && (
                <div style={vStyles.dayDivider}>
                  <span style={vStyles.dayDividerLabel}>
                    {h.time.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'short'})}
                  </span>
                </div>
              )}
              <div data-idx={i} style={{
                ...vStyles.row,
                borderBottom: `1px solid ${T.border}`,
                background: ps.bg !== 'transparent'
                  ? ps.bg
                  : (bands ? window.bandForHour(h.time.getHours(), 1) : (isNow ? T.surface : 'transparent')),
                ...(isNow ? vStyles.rowNow : null),
              }}>
                {isNow && <div style={vStyles.nowEdge}/>}
                <div style={{...vStyles.cell, flex: '0 0 44px'}}>
                  <span style={{
                    ...vStyles.timeText,
                    color: isNow ? T.textHi : T.text,
                    fontWeight: isNow ? 600 : 500,
                  }}>{fmtHour(h.time)}</span>
                </div>
                <div style={{...vStyles.cell, flex: '0 0 56px'}}>
                  <WxIcon desc={h.description} size={18} color={T.textHi}/>
                </div>
                <div style={{...vStyles.cell, flex: '0 0 44px', justifyContent:'flex-end'}}>
                  <span style={vStyles.tempText}>{h.temperature}°</span>
                  <span style={vStyles.feelText}>{h.feelsLike}°</span>
                </div>
                <div style={{...vStyles.cell, flex: 1, justifyContent:'flex-end', gap: 4}}>
                  <WindArrowV deg={h.windDirection}/>
                  <span style={vStyles.windText}>{h.windSpeed}</span>
                  <span style={vStyles.dirText}>{compass(h.windDirection)}</span>
                  {gusty && <span style={vStyles.gustText}>g{h.windGust}</span>}
                </div>
                <div style={{...vStyles.cell, flex: '0 0 56px', justifyContent:'flex-end'}}>
                  {h.precipProbability >= 20 ? (
                    <>
                      <span style={{...vStyles.precipText, color: ps.fg}}>
                        {h.precipProbability}<span style={vStyles.precipUnit}>%</span>
                      </span>
                      {h.precipAmount > 0 && (
                        <span style={vStyles.precipMm}>{h.precipAmount.toFixed(1)}<span style={vStyles.precipUnit}>mm</span></span>
                      )}
                      {h.precipProbability >= 80 && <span style={vStyles.drop}>●</span>}
                    </>
                  ) : (
                    <span style={vStyles.precipMuted}>{h.precipProbability}<span style={vStyles.precipUnit}>%</span></span>
                  )}
                </div>
                <div style={{...vStyles.cell, flex: '0 0 30px', justifyContent:'flex-end'}}>
                  {h.uvIndex === 0 ? (
                    <span style={vStyles.uvZero}>—</span>
                  ) : (
                    <span style={{...vStyles.uvPill, background: us.bg, color: us.fg}}>{h.uvIndex}</span>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <TabBar active="today" theme={T}/>
    </div>
  );
};

const WindArrowV = ({ deg }) => (
  <svg width="10" height="10" viewBox="0 0 10 10"
       style={{transform: `rotate(${deg + 180}deg)`, opacity: 0.6, flexShrink: 0}}>
    <path d="M5 1L7.5 7 5 5.6 2.5 7z" fill="#a3a3a3"/>
  </svg>
);

const vStyles = {
  root: {
    width: '100%', height: '100%',
    background: '#0a0a0a', color: '#e5e5e5',
    fontFamily: '"Inter", -apple-system, system-ui, sans-serif',
    fontSize: 14, lineHeight: 1.4,
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
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
  iconBtn: {
    width: 32, height: 32, borderRadius: 16,
    background: '#1a1a1a', border: '1px solid #232323', color: '#a3a3a3',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  },
  summary: { padding: '4px 16px 12px' },
  dateLine: { fontSize: 12, color: '#9a9a9a', fontVariantNumeric: 'tabular-nums' },
  summaryText: { fontSize: 13, color: '#cfcfcf', marginTop: 4, lineHeight: 1.35, textWrap: 'pretty' },

  hero: {
    display: 'flex', gap: 16, padding: '0 16px 16px',
    borderBottom: '1px solid #1a1a1a',
  },
  heroLeft: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start' },
  heroNowTag: {
    fontSize: 9, fontWeight: 700, color: '#fafafa', letterSpacing: 1.2,
    background: '#1a1a1a', padding: '3px 6px', borderRadius: 3,
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
  },
  heroTemp: {
    fontSize: 76, fontWeight: 200, lineHeight: 0.95, letterSpacing: -2,
    color: '#fafafa', fontFeatureSettings: '"tnum"', marginTop: 4,
  },
  heroFeel: { fontSize: 12, color: '#8a8a8a' },
  heroRight: { flex: 1, display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 24 },
  heroDesc: { fontSize: 16, color: '#fafafa', fontWeight: 500 },
  heroGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px',
    fontSize: 12, fontVariantNumeric: 'tabular-nums',
  },
  heroLbl: { display: 'block', color: '#6b6b6b', fontSize: 10,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 1 },
  heroVal: { color: '#e5e5e5', fontWeight: 500 },
  heroUnit: { color: '#6b6b6b', fontWeight: 400 },

  colHead: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 16px 6px',
    fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8,
    color: '#5a5a5a', fontWeight: 500,
    borderBottom: '1px solid #141414',
    flexShrink: 0,
  },
  colHeadCell: {},

  list: { flex: 1, overflowY: 'auto', overflowX: 'hidden' },

  row: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 16px', position: 'relative',
    borderBottom: '1px solid #131313',
    minHeight: 44, transition: 'background 0.15s',
  },
  rowNow: {
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
  },
  nowEdge: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 2,
    background: '#fafafa', boxShadow: '0 0 12px rgba(255,255,255,0.4)',
  },
  cell: {
    display: 'flex', alignItems: 'baseline', gap: 4,
    fontVariantNumeric: 'tabular-nums',
  },
  timeText: { fontSize: 13, fontFamily: '"JetBrains Mono", ui-monospace, monospace' },
  condText: { fontSize: 12, color: '#a3a3a3' },
  tempText: { fontSize: 16, color: '#fafafa', fontWeight: 500, letterSpacing: -0.3 },
  feelText: { fontSize: 11, color: '#6b6b6b' },
  windText: { fontSize: 13, color: '#cfcfcf', fontFamily: '"JetBrains Mono", ui-monospace, monospace' },
  dirText: { fontSize: 10, color: '#7a7a7a', fontFamily: '"JetBrains Mono", ui-monospace, monospace', minWidth: 16, textAlign: 'left' },
  gustText: { fontSize: 10, color: '#e69a4f', fontWeight: 500, marginLeft: 2 },
  precipText: { fontSize: 13, fontWeight: 600, fontFamily: '"JetBrains Mono", ui-monospace, monospace' },
  precipMuted: { fontSize: 13, color: '#5a5a5a', fontFamily: '"JetBrains Mono", ui-monospace, monospace' },
  precipUnit: { fontSize: 9, opacity: 0.6, marginLeft: 1 },
  precipMm: { fontSize: 10, color: '#7aa9d9', fontFamily: '"JetBrains Mono", ui-monospace, monospace' },
  drop: { fontSize: 6, color: '#bae6fd', marginLeft: 2 },

  uvPill: {
    fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 3,
    minWidth: 16, textAlign: 'center',
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
  },
  uvZero: { color: '#3a3a3a', fontSize: 13 },

  dayDivider: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '14px 16px 6px',
    borderTop: '1px solid #1a1a1a',
    background: '#0a0a0a',
  },
  dayDividerLabel: {
    fontSize: 11, fontWeight: 600, color: '#fafafa',
    textTransform: 'uppercase', letterSpacing: 1,
  },
};

window.TodayVertical = TodayVertical;
