// today-windguru.jsx — dense Windguru-style data table.
// Light surface, stacked day/hour header, color-coded cells per metric with
// metric-specific ramps (wind cyan→green, temp yellow→red, cloud grayscale,
// rain blues, UV green→purple). Rows sync-scroll horizontally.

const TodayWindguru = ({ hours, location, now }) => {
  const scrollRef = React.useRef(null);
  const HOUR_W = 44;
  const LABEL_W = 92;

  const nowIdx = hours.findIndex((h) => h.time.getTime() === now.getTime());

  const onScroll = (e) => {
    const x = e.currentTarget.scrollLeft;
    scrollRef.current.querySelectorAll('[data-wg-sync]').forEach((el) => {
      if (el !== e.currentTarget) el.scrollLeft = x;
    });
  };

  React.useEffect(() => {
    const els = scrollRef.current?.querySelectorAll('[data-wg-sync]');
    if (!els) return;
    const x = Math.max(0, nowIdx * HOUR_W - 8);
    els.forEach((el) => { el.scrollLeft = x; });
  }, [nowIdx]);

  // Build the day groups for the header — show a wider "day cell" spanning the
  // hours that belong to that day, then per-hour "hh" cells beneath.
  const dayLabel = (d) => {
    const wd = ['Su','Mo','Tu','We','Th','Fr','Sa'][d.getDay()];
    return `${wd} ${d.getDate()}.`;
  };

  return (
    <div style={wg.root}>
      {/* ── App header ──────────────────────────────────────── */}
      <div style={wg.appBar}>
        <div style={wg.appTitle}>
          <span style={wg.logoBadge}>SW</span>
          <span style={{fontWeight:600}}>Forecast</span>
        </div>
        <div style={wg.appBarRight}>
          <span style={wg.updated}>Updated 14:00 CET</span>
          <button style={wg.iconBtn} aria-label="Search">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="7" cy="7" r="5"/><path d="M11 11l3 3" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Location strip */}
      <div style={wg.locStrip}>
        <span style={wg.locName}>{location.name}</span>
        <span style={wg.locRegion}>{location.region}</span>
      </div>

      {/* ── Sync-scrolling table ─────────────────────────────── */}
      <div ref={scrollRef} style={wg.tableWrap}>
        {/* Time header row — sticky at top inside tableWrap */}
        <div style={{...wg.row, ...wg.headerRow}}>
          <div style={{...wg.label, ...wg.headerLabel, width: LABEL_W}}>
            <div style={wg.labelMain}>Forecast</div>
            <div style={wg.labelSub}>26 May · CET</div>
          </div>
          <div data-wg-sync="1" onScroll={onScroll} style={wg.scroll}>
            <div style={{...wg.rowInner, width: hours.length * HOUR_W}}>
              {hours.map((h, i) => {
                const isNow = i === nowIdx;
                const prev = hours[i-1];
                const newDay = !prev || prev.time.toDateString() !== h.time.toDateString();
                return (
                  <div key={i} style={{
                    ...wg.headCell,
                    width: HOUR_W,
                    borderLeft: newDay && i > 0 ? '2px solid #2a3550' : '1px solid #131a2e',
                    background: isNow ? '#3a2f0f' : (i % 24 < 6 || i % 24 >= 20) ? '#0a1024' : '#0c1428',
                  }}>
                    <div style={wg.headDay}>{newDay ? dayLabel(h.time) : '\u00A0'}</div>
                    <div style={wg.headHour}>
                      {String(h.time.getHours()).padStart(2,'0')}<span style={wg.headH}>h</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Wind */}
        <DataRow label="Wind speed" unit="km/h" labelW={LABEL_W} hourW={HOUR_W} hours={hours} onScroll={onScroll} nowIdx={nowIdx}
          render={(h) => {
            const c = wgScales.wind(h.windSpeed);
            return <Cell bg={c.bg} fg={c.fg} bold={h.windSpeed >= 25}>{h.windSpeed}</Cell>;
          }}/>

        <DataRow label="Wind gusts" unit="km/h" labelW={LABEL_W} hourW={HOUR_W} hours={hours} onScroll={onScroll} nowIdx={nowIdx}
          render={(h) => {
            const c = wgScales.wind(h.windGust);
            return <Cell bg={c.bg} fg={c.fg} bold={h.windGust >= 30}>{h.windGust}</Cell>;
          }}/>

        <DataRow label="Wind direction" labelW={LABEL_W} hourW={HOUR_W} hours={hours} onScroll={onScroll} nowIdx={nowIdx}
          render={(h) => (
            <Cell bg="#0a0f1c" fg="#fafafa">
              <WgArrow deg={h.windDirection}/>
            </Cell>
          )}/>

        {/* Wave */}
        <DataRow label="Wave" unit="m" labelW={LABEL_W} hourW={HOUR_W} hours={hours} onScroll={onScroll} nowIdx={nowIdx}
          render={(h) => {
            if (!h.waveHeight || h.waveHeight < 0.05) return <Cell bg="#0a0f1c" fg="#3a3a35">·</Cell>;
            const c = wgScales.wave(h.waveHeight);
            return <Cell bg={c.bg} fg={c.fg} bold={h.waveHeight >= 1.5}>{h.waveHeight.toFixed(1)}</Cell>;
          }}/>

        <DataRow label="Wave period" unit="s" labelW={LABEL_W} hourW={HOUR_W} hours={hours} onScroll={onScroll} nowIdx={nowIdx}
          render={(h) => {
            if (!h.wavePeriod) return <Cell bg="#0a0f1c" fg="#3a3a35">·</Cell>;
            const c = wgScales.period(h.wavePeriod);
            return <Cell bg={c.bg} fg={c.fg} bold={h.wavePeriod >= 10}>{h.wavePeriod}</Cell>;
          }}/>

        <DataRow label="Wave direction" labelW={LABEL_W} hourW={HOUR_W} hours={hours} onScroll={onScroll} nowIdx={nowIdx}
          render={(h) => (
            <Cell bg="#0a0f1c" fg="#fafafa">
              <WgArrow deg={h.waveDirection} small/>
            </Cell>
          )}/>

        {/* Temperature */}
        <DataRow label="Temperature" unit="°C" labelW={LABEL_W} hourW={HOUR_W} hours={hours} onScroll={onScroll} nowIdx={nowIdx}
          render={(h) => {
            const c = wgScales.temp(h.temperature);
            return <Cell bg={c.bg} fg={c.fg} bold={h.temperature >= 25 || h.temperature <= 0}>{h.temperature}</Cell>;
          }}/>

        <DataRow label="Feels like" unit="°C" labelW={LABEL_W} hourW={HOUR_W} hours={hours} onScroll={onScroll} nowIdx={nowIdx}
          render={(h) => {
            const c = wgScales.temp(h.feelsLike);
            return <Cell bg={c.bg} fg={c.fg} muted>{h.feelsLike}</Cell>;
          }}/>

        {/* Conditions */}
        <DataRow label="Conditions" labelW={LABEL_W} hourW={HOUR_W} hours={hours} onScroll={onScroll} nowIdx={nowIdx}
          render={(h) => (
            <Cell bg="#0a0f1c" fg="#fafafa">
              <WxIcon desc={h.description} size={18} color="#cfcfcf" strokeWidth={1.5}/>
            </Cell>
          )}/>

        {/* Rain */}
        <DataRow label="Rain prob." unit="%" labelW={LABEL_W} hourW={HOUR_W} hours={hours} onScroll={onScroll} nowIdx={nowIdx}
          render={(h) => {
            if (h.precipProbability < 5) return <Cell bg="#0a0f1c" fg="#3a3a45">·</Cell>;
            const c = wgScales.rain(h.precipProbability);
            return <Cell bg={c.bg} fg={c.fg} bold={h.precipProbability >= 70}>{h.precipProbability}</Cell>;
          }}/>

        <DataRow label="Precip." unit="mm/1h" labelW={LABEL_W} hourW={HOUR_W} hours={hours} onScroll={onScroll} nowIdx={nowIdx}
          render={(h) => {
            if (!h.precipAmount || h.precipAmount < 0.05) return <Cell bg="#0a0f1c" fg="#3a3a45">·</Cell>;
            const c = wgScales.rainMm(h.precipAmount);
            return <Cell bg={c.bg} fg={c.fg} bold={h.precipAmount >= 2}>{h.precipAmount.toFixed(1)}</Cell>;
          }}/>

        {/* Cloud cover */}
        <DataRow label="Cloud cover" unit="%" labelW={LABEL_W} hourW={HOUR_W} hours={hours} onScroll={onScroll} nowIdx={nowIdx}
          render={(h) => {
            if (h.cloudCover < 5) return <Cell bg="#0a0f1c" fg="#3a3a45">·</Cell>;
            const c = wgScales.cloud(h.cloudCover);
            return <Cell bg={c.bg} fg={c.fg}>{h.cloudCover}</Cell>;
          }}/>

        {/* UV */}
        <DataRow label="UV index" labelW={LABEL_W} hourW={HOUR_W} hours={hours} onScroll={onScroll} nowIdx={nowIdx}
          render={(h) => {
            if (h.uvIndex === 0) return <Cell bg="#0a0f1c" fg="#3a3a45">·</Cell>;
            const c = wgScales.uv(h.uvIndex);
            return <Cell bg={c.bg} fg={c.fg} bold={h.uvIndex >= 8}>{h.uvIndex}</Cell>;
          }}/>

        {/* Humidity */}
        <DataRow label="Humidity" unit="%" labelW={LABEL_W} hourW={HOUR_W} hours={hours} onScroll={onScroll} nowIdx={nowIdx}
          render={(h) => (
            <Cell bg="#0a0f1c" fg="#9a9a93">{h.humidity}</Cell>
          )}/>

        {/* SW rating */}
        <DataRow label="SW rating" labelW={LABEL_W} hourW={HOUR_W} hours={hours} onScroll={onScroll} nowIdx={nowIdx} last
          render={(h) => {
            const r = ratingFor(h);
            return (
              <Cell bg="#0a0f1c" fg="#e9b440">
                {r > 0 ? '★'.repeat(r) : <span style={{color:'#22273a'}}>·</span>}
              </Cell>
            );
          }}/>
      </div>

      {/* Legend strip */}
      <div style={wg.legend}>
        <LegendChip label="Wind (km/h)" stops={[
          [0,'#141414'], [7,'#bff0ee'], [10,'#2fd49a'], [16,'#7fd02a'],
          [22,'#f0c020'], [28,'#ee5b2a'], [35,'#cf3290'], [40,'#8a3fcc']
        ]}/>
        <LegendChip label="Wave (m)" stops={[
          [0,'#1c2240'], [1,'#2b3268'], [1.5,'#4a4f9c'], [2,'#6f5fc8'], [3,'#9a4fd4']
        ]}/>
        <LegendChip label="Temp (°C)" stops={[
          [-5,'#bfd4ef'], [5,'#e8f5c8'], [14,'#fff09a'], [22,'#ffb04a'],
          [30,'#f4612a'], [38,'#cf3290']
        ]}/>
        <LegendChip label="Rain (%)" stops={[
          [10,'#1a2c4a'], [50,'#2a4f8a'], [70,'#4a7ed1'], [85,'#3a9cef'], [100,'#7fc8ff']
        ]}/>
      </div>

      <TabBar active="today" theme={window.SW_THEMES.black}/>
    </div>
  );
};

// ── Cell + Row primitives ────────────────────────────────────────
const Cell = ({ bg, fg, bold, muted, children }) => (
  <div style={{
    width:'100%', height:'100%', background: bg, color: fg,
    display:'flex', alignItems:'center', justifyContent:'center',
    fontFamily:'"JetBrains Mono", ui-monospace, monospace',
    fontWeight: bold ? 700 : (muted ? 400 : 500),
    fontSize: 12, fontVariantNumeric: 'tabular-nums',
    letterSpacing: -0.2,
    fontStyle: muted ? 'normal' : undefined,
    opacity: muted ? 0.75 : 1,
  }}>{children}</div>
);

const DataRow = ({ label, unit, labelW, hourW, hours, render, onScroll, nowIdx, last }) => (
  <div style={{...wg.row, borderBottom: last ? '1px solid #1f2a48' : '1px solid #101627'}}>
    <div style={{...wg.label, width: labelW}}>
      <span style={wg.labelText}>{label}</span>
      {unit && <span style={wg.labelUnit}> ({unit})</span>}
    </div>
    <div data-wg-sync="1" onScroll={onScroll} style={wg.scroll}>
      <div style={{...wg.rowInner, width: hours.length * hourW}}>
        {hours.map((h, i) => {
          const prev = hours[i-1];
          const newDay = !prev || prev.time.toDateString() !== h.time.toDateString();
          const isNow = i === nowIdx;
          return (
            <div key={i} style={{
              ...wg.cellWrap, width: hourW,
              borderLeft: newDay && i > 0 ? '2px solid #2a3550' : '1px solid #101627',
              boxShadow: isNow ? 'inset 2px 0 0 #fafafa' : 'none',
            }}>
              {render(h, i)}
            </div>
          );
        })}
      </div>
    </div>
  </div>
);

const WgArrow = ({ deg, small }) => (
  <svg width={small ? 12 : 14} height={small ? 12 : 14} viewBox="0 0 14 14"
    style={{ transform: `rotate(${deg + 180}deg)` }}>
    <path d="M7 1.4 L11 11 L7 9.2 L3 11 Z" fill={small ? '#cfcfcf' : '#fafafa'}/>
  </svg>
);

const LegendChip = ({ label, stops }) => (
  <div style={wg.legendChip}>
    <span style={wg.legendLabel}>{label}</span>
    <div style={wg.legendBar}>
      {stops.map(([v, c], i) => (
        <div key={i} style={{flex:1, background: c, height:'100%'}}/>
      ))}
    </div>
    <div style={wg.legendNums}>
      <span>{stops[0][0]}</span>
      <span>{stops[stops.length-1][0]}</span>
    </div>
  </div>
);

// ── Color scales ─────────────────────────────────────────────────
// Windguru-style rainbow ramps. Cell fills stay vivid; we just pick a
// readable text color (dark on bright fills, light on deep ones).
// Dark theme = the SHELL is dark; the cells are still saturated.
const wgScales = {
  wind: (v) => {
    // Extended ramp 0 → 40+ km/h to match Windguru's full palette.
    if (v < 4)  return { bg: '#141414', fg: '#5a5a55' };
    if (v < 7)  return { bg: '#bff0ee', fg: '#0a3a3a' };
    if (v < 10) return { bg: '#7fe2d6', fg: '#0a2a2a' };
    if (v < 13) return { bg: '#2fd49a', fg: '#0a2614' };
    if (v < 16) return { bg: '#26c25c', fg: '#0a2614' };
    if (v < 19) return { bg: '#7fd02a', fg: '#1a2606' };
    if (v < 22) return { bg: '#cad42a', fg: '#26260a' };
    if (v < 25) return { bg: '#f0c020', fg: '#2a1a04' };
    if (v < 28) return { bg: '#f49224', fg: '#2a0e02' };
    if (v < 31) return { bg: '#ee5b2a', fg: '#fff' };
    if (v < 35) return { bg: '#e8332f', fg: '#fff' };
    if (v < 40) return { bg: '#cf3290', fg: '#fff' };
    return { bg: '#8a3fcc', fg: '#fff' };
  },
  temp: (v) => {
    // Sub-zero → blue; 0–15 → yellow/green; 15–25 → orange; >25 → red/magenta.
    if (v < -5) return { bg: '#7fa8d9', fg: '#0a1a3a' };
    if (v < 0)  return { bg: '#bfd4ef', fg: '#0a1a3a' };
    if (v < 5)  return { bg: '#e8f5c8', fg: '#2a3a14' };
    if (v < 10) return { bg: '#f2f6a2', fg: '#3a3a14' };
    if (v < 14) return { bg: '#fff09a', fg: '#3a2a08' };
    if (v < 18) return { bg: '#ffd478', fg: '#3a2a08' };
    if (v < 22) return { bg: '#ffb04a', fg: '#3a2208' };
    if (v < 26) return { bg: '#ff8a2a', fg: '#3a1a04' };
    if (v < 30) return { bg: '#f4612a', fg: '#fff' };
    if (v < 34) return { bg: '#e23a2a', fg: '#fff' };
    if (v < 38) return { bg: '#cf3290', fg: '#fff' };
    return { bg: '#8a3fcc', fg: '#fff' };
  },
  cloud: (v) => {
    // Grayscale that reads on the dark shell — start at a charcoal,
    // climb to near-white at 100%. (Inverted from light-theme version.)
    if (v < 25) return { bg: '#222220', fg: '#9a9a93' };
    if (v < 50) return { bg: '#4a4a45', fg: '#e0e0d8' };
    if (v < 75) return { bg: '#8a8a83', fg: '#0f0f0f' };
    if (v < 90) return { bg: '#c8c8c2', fg: '#0f0f0f' };
    return { bg: '#ececec', fg: '#0f0f0f' };
  },
  rain: (v) => {
    if (v < 30) return { bg: '#1a2c4a', fg: '#9bbeef' };
    if (v < 50) return { bg: '#2a4f8a', fg: '#dce6f6' };
    if (v < 70) return { bg: '#4a7ed1', fg: '#fff' };
    if (v < 85) return { bg: '#3a9cef', fg: '#0a1a3a' };
    return { bg: '#7fc8ff', fg: '#0a1a3a' };
  },
  rainMm: (v) => {
    if (v < 0.5) return { bg: '#1a2c4a', fg: '#9bbeef' };
    if (v < 1.5) return { bg: '#2a4f8a', fg: '#dce6f6' };
    if (v < 3)   return { bg: '#3a9cef', fg: '#0a1a3a' };
    if (v < 6)   return { bg: '#7fc8ff', fg: '#0a1a3a' };
    return { bg: '#bfe4ff', fg: '#0a1a3a' };
  },
  // Waves run cooler than rain: lilac → violet → indigo, so the row reads
  // as its own band even when sitting next to rain rows.
  wave: (m) => {
    if (m < 0.5) return { bg: '#1c2240', fg: '#a8b3e0' };
    if (m < 1.0) return { bg: '#2b3268', fg: '#cfd8f5' };
    if (m < 1.5) return { bg: '#4a4f9c', fg: '#fff' };
    if (m < 2.0) return { bg: '#6f5fc8', fg: '#fff' };
    if (m < 3.0) return { bg: '#9a4fd4', fg: '#fff' };
    return { bg: '#cf3290', fg: '#fff' };
  },
  // Period encodes swell quality — short = wind-chop, long = clean swell.
  // Pinkish accent when 10s+, matching the Windguru highlight.
  period: (s) => {
    if (s < 5)  return { bg: '#0a0f1c', fg: '#7a7a93' };
    if (s < 8)  return { bg: '#0a0f1c', fg: '#c8c8e0' };
    if (s < 11) return { bg: '#3a1f2a', fg: '#f5b8c8' };
    if (s < 14) return { bg: '#5a2a3a', fg: '#ffd0dc' };
    return { bg: '#7a3550', fg: '#fff' };
  },
  uv: (v) => {
    if (v <= 2) return { bg: '#2db765', fg: '#0a2614' };
    if (v <= 5) return { bg: '#f0c020', fg: '#2a1a04' };
    if (v <= 7) return { bg: '#f49224', fg: '#2a0e02' };
    if (v <= 10) return { bg: '#e8332f', fg: '#fff' };
    return { bg: '#8a3fcc', fg: '#fff' };
  },
};

function ratingFor(h) {
  // Toy "comfort" rating — for the demo. 0-5 stars based on wind, rain, temp.
  let r = 5;
  if (h.precipProbability > 50) r -= 2;
  else if (h.precipProbability > 25) r -= 1;
  if (h.windSpeed > 35) r -= 2;
  else if (h.windSpeed > 22) r -= 1;
  if (h.temperature < 4 || h.temperature > 32) r -= 1;
  if (h.cloudCover > 80) r -= 1;
  return Math.max(0, Math.min(5, r));
}

const wg = {
  root: {
    width: '100%', height: '100%',
    background: '#070b1a', color: '#e5e5e5',
    fontFamily: '"Inter", -apple-system, system-ui, sans-serif',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  appBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 14px 8px',
    borderBottom: '1px solid #131a2e',
    flexShrink: 0,
  },
  appTitle: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#fafafa' },
  logoBadge: {
    fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
    background: '#fafafa', color: '#070b1a',
    padding: '3px 6px', borderRadius: 3,
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
  },
  appBarRight: { display: 'flex', alignItems: 'center', gap: 8 },
  updated: {
    fontSize: 10, color: '#7a7a7a',
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    fontVariantNumeric: 'tabular-nums',
  },
  iconBtn: {
    width: 28, height: 28, borderRadius: 14,
    background: '#0f1628', border: '1px solid #1b2440',
    color: '#a3a3a3', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
  },
  locStrip: {
    display: 'flex', alignItems: 'baseline', gap: 8,
    padding: '8px 14px 10px',
    borderBottom: '1px solid #131a2e',
    flexShrink: 0,
  },
  locName: { fontSize: 18, fontWeight: 600, letterSpacing: -0.3, color: '#fafafa' },
  locRegion: { fontSize: 11, color: '#7a7a7a', fontWeight: 500 },

  tableWrap: {
    flex: 1, overflowY: 'auto', overflowX: 'hidden',
    paddingBottom: 4,
    background: '#070b1a',
  },
  row: {
    display: 'flex', alignItems: 'stretch',
    borderBottom: '1px solid #101627',
    minHeight: 32,
  },
  headerRow: {
    minHeight: 46,
    position: 'sticky', top: 0, zIndex: 3,
    background: '#070b1a',
    borderBottom: '1px solid #1f2a48',
  },
  label: {
    flexShrink: 0, display: 'flex', alignItems: 'center',
    padding: '0 10px 0 14px',
    fontSize: 11, color: '#9a9a93', fontWeight: 500,
    background: '#070b1a',
    borderRight: '1px solid #131a2e',
    position: 'sticky', left: 0, zIndex: 2,
  },
  headerLabel: { flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 1, fontWeight: 600 },
  labelMain: { fontSize: 11, color: '#fafafa', fontWeight: 700, letterSpacing: 0.2 },
  labelSub: {
    fontSize: 10, color: '#6a6a6a',
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    fontVariantNumeric: 'tabular-nums',
  },
  labelText: { color: '#e5e5e5' },
  labelUnit: { color: '#6a6a6a', marginLeft: 2 },

  scroll: { flex: 1, overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none' },
  rowInner: { display: 'flex', height: '100%', position: 'relative' },
  cellWrap: {
    flexShrink: 0, height: '100%', position: 'relative',
    display: 'flex', alignItems: 'stretch',
  },

  headCell: {
    flexShrink: 0,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 1,
    padding: '4px 0',
  },
  headDay: {
    fontSize: 9, fontWeight: 700, color: '#9a9a93',
    letterSpacing: 0.3,
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
  },
  headHour: {
    fontSize: 12, fontWeight: 600, color: '#fafafa',
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: -0.3,
  },
  headH: { fontSize: 9, color: '#6a6a6a', fontWeight: 500 },

  legend: {
    display: 'flex', gap: 10, padding: '8px 14px 10px',
    borderTop: '1px solid #131a2e',
    flexShrink: 0,
    overflowX: 'auto',
    scrollbarWidth: 'none',
    background: '#070b1a',
  },
  legendChip: {
    display: 'flex', flexDirection: 'column', gap: 3,
    minWidth: 124, flexShrink: 0,
  },
  legendLabel: {
    fontSize: 9, color: '#7a7a7a', fontWeight: 600,
    letterSpacing: 0.3, textTransform: 'uppercase',
  },
  legendBar: {
    display: 'flex', height: 6, borderRadius: 2, overflow: 'hidden',
    border: '1px solid #1b2440',
  },
  legendNums: {
    display: 'flex', justifyContent: 'space-between',
    fontSize: 9, color: '#7a7a7a',
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    fontVariantNumeric: 'tabular-nums',
  },
};

window.TodayWindguru = TodayWindguru;
