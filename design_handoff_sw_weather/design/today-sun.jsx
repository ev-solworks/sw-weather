// today-sun.jsx — sun & moon data view.
// Hero arc with all named phases, twilight gradient strip, daylight stats,
// scrollable phase list, and moon panel. Same dark navy shell as the rest.

const TodaySun = ({ location, now }) => {
  const sun = location.sun;
  const moon = location.moon;

  const dayLen = sun.sunset - sun.sunrise;
  const deltaYday = dayLen - sun.yesterdayLengthMs;
  const deltaTmw = sun.tomorrowLengthMs - dayLen;

  const fmt = (d) => `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  const fmtDur = (ms) => {
    const total = Math.round(ms / 60000);
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${h}h ${String(m).padStart(2,'0')}m`;
  };
  const fmtDelta = (ms) => {
    const total = Math.round(ms / 60000);
    const sign = total >= 0 ? '+' : '−';
    const abs = Math.abs(total);
    const m = abs % 60;
    const h = Math.floor(abs / 60);
    return h > 0 ? `${sign}${h}h ${m}m` : `${sign}${m}m`;
  };

  return (
    <div style={sStyles.root}>
      {/* App bar */}
      <div style={sStyles.appBar}>
        <div style={sStyles.appTitle}>
          <span style={sStyles.logoBadge}>SW</span>
          <span style={{fontWeight:600}}>Sun &amp; Moon</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={sStyles.dateTag}>Mon 9 Feb</span>
        </div>
      </div>

      {/* Location strip */}
      <div style={sStyles.locStrip}>
        <span style={sStyles.locName}>{location.name}</span>
        <span style={sStyles.locRegion}>{location.region}</span>
      </div>

      {/* Scroll body */}
      <div style={sStyles.body}>

        {/* Hero arc */}
        <SunArcHero sun={sun} now={now}/>

        {/* Daylight stats */}
        <div style={sStyles.stats}>
          <div style={sStyles.statCol}>
            <div style={sStyles.statKey}>Daylight</div>
            <div style={sStyles.statVal}>{fmtDur(dayLen)}</div>
            <div style={{...sStyles.statSub, color: deltaYday > 0 ? '#7fd02a' : '#f49224'}}>
              {fmtDelta(deltaYday)} vs yesterday
            </div>
          </div>
          <div style={sStyles.statDiv}/>
          <div style={sStyles.statCol}>
            <div style={sStyles.statKey}>Solar noon</div>
            <div style={sStyles.statVal}>{fmt(sun.solarNoon)}</div>
            <div style={sStyles.statSub}>Sun at peak</div>
          </div>
          <div style={sStyles.statDiv}/>
          <div style={sStyles.statCol}>
            <div style={sStyles.statKey}>Tomorrow</div>
            <div style={sStyles.statVal}>{fmtDur(sun.tomorrowLengthMs)}</div>
            <div style={{...sStyles.statSub, color: deltaTmw > 0 ? '#7fd02a' : '#f49224'}}>
              {fmtDelta(deltaTmw)} longer
            </div>
          </div>
        </div>

        {/* Twilight gradient strip */}
        <TwilightStrip sun={sun} now={now}/>

        {/* Phase list */}
        <div style={sStyles.phaseSection}>
          <div style={sStyles.sectionLabel}>PHASES</div>
          <PhaseList sun={sun} now={now}/>
        </div>

        {/* Moon */}
        <MoonPanel moon={moon} fmt={fmt}/>
      </div>

      <TabBar active="today" theme={window.SW_THEMES.black}/>
    </div>
  );
};

// ── Hero arc ─────────────────────────────────────────────────────
const SunArcHero = ({ sun, now }) => {
  // Geometry: viewBox 360 × 200. Horizon line at y=140.
  // Daylight arc spans sunrise (x=30) → sunset (x=330), peaking at
  // (180, 30) for solar noon. Below the horizon line we render dashed
  // arcs extending the path through civil → nautical → astronomical.
  const W = 360, H = 200;
  const horizonY = 140;
  const arcLeft = 30, arcRight = 330, arcTop = 30;

  // Map a Date to (x, y) along the arc.
  // Daylight portion uses a parabola peaking at noon.
  // Twilight extensions use a virtual extension symmetric below the horizon.
  const sunriseT = sun.sunrise.getTime();
  const sunsetT  = sun.sunset.getTime();
  const dayLen   = sunsetT - sunriseT;
  const noonT    = sun.solarNoon.getTime();

  const dayPos = (t) => {
    // 0 at sunrise, 1 at sunset
    const u = (t - sunriseT) / dayLen;
    const x = arcLeft + u * (arcRight - arcLeft);
    // Parabola: y = horizonY - sin(πu) * (horizonY - arcTop)
    const y = horizonY - Math.sin(Math.PI * u) * (horizonY - arcTop);
    return { x, y };
  };

  // Twilight position: u<0 (pre-sunrise) or u>1 (post-sunset). Extend the arc
  // below the horizon mirror-style, capped at u=-0.35 / u=1.35 = astro twilight.
  const twilightPos = (t) => {
    const u = (t - sunriseT) / dayLen;
    const x = arcLeft + u * (arcRight - arcLeft);
    // For u<0, mirror angle below horizon.
    const phase = u < 0 ? -u : (u - 1); // 0 at horizon, increasing into night
    const y = horizonY + Math.sin(Math.PI * Math.min(phase / 0.35, 1)) * 35;
    return { x, y, u };
  };

  // Current sun position.
  const nowT = now.getTime();
  const isDay = nowT >= sunriseT && nowT <= sunsetT;
  const sunPos = isDay ? dayPos(nowT) : twilightPos(nowT);

  // Markers along the day arc
  const markers = [
    { t: sun.sunrise,    label: 'Sunrise',   time: sun.sunrise,    primary: true },
    { t: sun.goldenEnd,  label: 'Golden h.', time: sun.goldenEnd },
    { t: sun.solarNoon,  label: 'Noon',      time: sun.solarNoon,  primary: true },
    { t: sun.goldenStart,label: 'Golden h.', time: sun.goldenStart },
    { t: sun.sunset,     label: 'Sunset',    time: sun.sunset,     primary: true },
  ];

  const fmt = (d) => `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;

  return (
    <div style={sStyles.hero}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{display:'block'}}>
        <defs>
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#1a3a8a" stopOpacity="0.45"/>
            <stop offset="55%" stopColor="#e6c25b" stopOpacity="0.25"/>
            <stop offset="80%" stopColor="#f49224" stopOpacity="0.18"/>
            <stop offset="100%" stopColor="#070b1a" stopOpacity="0"/>
          </linearGradient>
          <radialGradient id="sunGlow">
            <stop offset="0%"   stopColor="#ffe39a" stopOpacity="0.9"/>
            <stop offset="45%"  stopColor="#f4b03a" stopOpacity="0.5"/>
            <stop offset="100%" stopColor="#f4b03a" stopOpacity="0"/>
          </radialGradient>
        </defs>

        {/* Sky under-arc fill */}
        <path d={`M ${arcLeft} ${horizonY} Q ${(arcLeft+arcRight)/2} ${2*arcTop - horizonY} ${arcRight} ${horizonY} Z`}
          fill="url(#skyGrad)"/>

        {/* Twilight band guides — concentric dashed below horizon */}
        {[0.18, 0.27, 0.35].map((depth, i) => {
          const dy = depth * 100;
          return (
            <path key={i}
              d={`M ${arcLeft - dy*0.6} ${horizonY + dy} Q ${(arcLeft+arcRight)/2} ${horizonY + dy * 1.2} ${arcRight + dy*0.6} ${horizonY + dy}`}
              fill="none" stroke={['#3a4f8a','#26305a','#161e3a'][i]} strokeWidth="1"
              strokeDasharray="1 3" opacity="0.6"/>
          );
        })}

        {/* Horizon line */}
        <line x1="0" y1={horizonY} x2={W} y2={horizonY}
          stroke="#3a4566" strokeWidth="1"/>
        <text x="6" y={horizonY - 4} fontSize="8" fill="#5a6485"
          fontFamily='"JetBrains Mono", ui-monospace, monospace'
          style={{letterSpacing:'.5px'}}>HORIZON</text>

        {/* Main daylight arc */}
        <path d={`M ${arcLeft} ${horizonY} Q ${(arcLeft+arcRight)/2} ${2*arcTop - horizonY} ${arcRight} ${horizonY}`}
          fill="none" stroke="#e6c25b" strokeWidth="1.8" opacity="0.55"/>

        {/* Phase markers */}
        {markers.map((m, i) => {
          const p = dayPos(m.t.getTime());
          return (
            <g key={i}>
              <line x1={p.x} y1={horizonY} x2={p.x} y2={p.y}
                stroke={m.primary ? '#5a6485' : '#2a3550'} strokeWidth="1"
                strokeDasharray={m.primary ? '0' : '2 2'}/>
              <circle cx={p.x} cy={p.y}
                r={m.primary ? 3 : 2}
                fill={m.primary ? '#fafafa' : '#7a8aa3'}/>
            </g>
          );
        })}

        {/* Twilight phase markers below horizon */}
        {[
          { t: sun.civilDawn, color: '#6a8aff' },
          { t: sun.nauticalDawn, color: '#4a5fcf' },
          { t: sun.astroDawn, color: '#2a3590' },
          { t: sun.civilDusk, color: '#6a8aff' },
          { t: sun.nauticalDusk, color: '#4a5fcf' },
          { t: sun.astroDusk, color: '#2a3590' },
        ].map((m, i) => {
          const p = twilightPos(m.t.getTime());
          return <circle key={i} cx={p.x} cy={p.y} r="2" fill={m.color}/>;
        })}

        {/* Current sun */}
        <circle cx={sunPos.x} cy={sunPos.y} r="14" fill="url(#sunGlow)"/>
        <circle cx={sunPos.x} cy={sunPos.y} r="5.5" fill={isDay ? '#ffd06a' : '#a8b3e0'}/>

        {/* Labels — sunrise / noon / sunset */}
        <g fontFamily='"JetBrains Mono", ui-monospace, monospace' style={{fontVariantNumeric:'tabular-nums'}}>
          <text x={dayPos(sun.sunrise.getTime()).x} y={horizonY + 14}
            textAnchor="middle" fontSize="9.5" fill="#cfcfcf" fontWeight="600">
            {fmt(sun.sunrise)}
          </text>
          <text x={dayPos(sun.solarNoon.getTime()).x} y={arcTop - 10}
            textAnchor="middle" fontSize="10" fill="#ffd06a" fontWeight="600">
            {fmt(sun.solarNoon)}
          </text>
          <text x={dayPos(sun.sunset.getTime()).x} y={horizonY + 14}
            textAnchor="middle" fontSize="9.5" fill="#cfcfcf" fontWeight="600">
            {fmt(sun.sunset)}
          </text>
        </g>

        {/* "Sunrise" / "Sunset" small labels */}
        <text x={arcLeft} y={horizonY + 26} textAnchor="middle"
          fontSize="9" fill="#7a8aa3" fontWeight="600"
          style={{letterSpacing:'.4px'}}>SUNRISE</text>
        <text x={arcRight} y={horizonY + 26} textAnchor="middle"
          fontSize="9" fill="#7a8aa3" fontWeight="600"
          style={{letterSpacing:'.4px'}}>SUNSET</text>
      </svg>
    </div>
  );
};

// ── Twilight gradient strip ──────────────────────────────────────
const TwilightStrip = ({ sun, now }) => {
  // 24h horizontal strip with vertical phase ticks.
  const startMs = new Date(sun.sunrise);
  startMs.setHours(0,0,0,0);
  const dayStart = startMs.getTime();
  const dayEnd = dayStart + 24 * 3600 * 1000;
  const pct = (t) => ((t - dayStart) / (dayEnd - dayStart)) * 100;

  const stops = [
    { p: 0,                    c: '#070b1a' }, // midnight
    { p: pct(sun.astroDawn.getTime()),    c: '#0d1230' },
    { p: pct(sun.nauticalDawn.getTime()), c: '#1a2658' },
    { p: pct(sun.civilDawn.getTime()),    c: '#3a3a88' },
    { p: pct(sun.sunrise.getTime()),      c: '#e87a3a' },
    { p: pct(sun.goldenEnd.getTime()),    c: '#ffd06a' },
    { p: pct(sun.solarNoon.getTime()),    c: '#ffe79a' },
    { p: pct(sun.goldenStart.getTime()),  c: '#ffd06a' },
    { p: pct(sun.sunset.getTime()),       c: '#e87a3a' },
    { p: pct(sun.civilDusk.getTime()),    c: '#3a3a88' },
    { p: pct(sun.nauticalDusk.getTime()), c: '#1a2658' },
    { p: pct(sun.astroDusk.getTime()),    c: '#0d1230' },
    { p: 100,                  c: '#070b1a' },
  ];

  const grad = `linear-gradient(to right, ${stops.map(s => `${s.c} ${s.p.toFixed(1)}%`).join(', ')})`;
  const nowPct = pct(now.getTime());

  return (
    <div style={sStyles.twilightWrap}>
      <div style={sStyles.sectionLabel}>SKY · 24H</div>
      <div style={sStyles.twilightBar}>
        <div style={{...sStyles.twilightFill, background: grad}}/>
        {/* Tick markers under */}
        {[0, 6, 12, 18, 24].map((h) => (
          <div key={h} style={{...sStyles.twilightTick, left: `${(h/24)*100}%`}}/>
        ))}
        {/* Now marker */}
        <div style={{...sStyles.twilightNow, left: `${nowPct}%`}}/>
      </div>
      <div style={sStyles.twilightAxis}>
        {[0, 6, 12, 18, 24].map((h) => (
          <div key={h} style={{...sStyles.twilightHr, left: `${(h/24)*100}%`}}>
            {String(h).padStart(2,'0')}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Phase list ───────────────────────────────────────────────────
const PhaseList = ({ sun, now }) => {
  const fmt = (d) => `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  const phases = [
    { t: sun.astroDawn,    name: 'Astronomical dawn', sub: 'Stars begin to fade',     color: '#2a3590', dot: 'astro' },
    { t: sun.nauticalDawn, name: 'Nautical dawn',     sub: 'Horizon visible',         color: '#4a5fcf', dot: 'naut' },
    { t: sun.civilDawn,    name: 'Civil dawn',        sub: 'First usable light',      color: '#6a8aff', dot: 'civil' },
    { t: sun.sunrise,      name: 'Sunrise',           sub: 'Sun crosses horizon',     color: '#e87a3a', dot: 'sun', big: true },
    { t: sun.goldenEnd,    name: 'Morning golden h.', sub: 'Soft warm light ends',    color: '#ffd06a', dot: 'golden' },
    { t: sun.solarNoon,    name: 'Solar noon',        sub: 'Sun at its peak',         color: '#ffe79a', dot: 'noon', big: true },
    { t: sun.goldenStart,  name: 'Evening golden h.', sub: 'Soft warm light begins',  color: '#ffd06a', dot: 'golden' },
    { t: sun.sunset,       name: 'Sunset',            sub: 'Sun crosses horizon',     color: '#e87a3a', dot: 'sun', big: true },
    { t: sun.civilDusk,    name: 'Civil dusk',        sub: 'Last usable light',       color: '#6a8aff', dot: 'civil' },
    { t: sun.nauticalDusk, name: 'Nautical dusk',     sub: 'Horizon fades',           color: '#4a5fcf', dot: 'naut' },
    { t: sun.astroDusk,    name: 'Astronomical dusk', sub: 'True night begins',       color: '#2a3590', dot: 'astro' },
  ];

  return (
    <div style={sStyles.phaseList}>
      {phases.map((p, i) => {
        const passed = now >= p.t;
        const isCurrent = i < phases.length - 1 && now >= p.t && now < phases[i+1].t;
        return (
          <div key={i} style={{
            ...sStyles.phaseRow,
            opacity: passed && !isCurrent ? 0.55 : 1,
          }}>
            <div style={sStyles.phaseTime}>{fmt(p.t)}</div>
            <PhaseDot kind={p.dot} color={p.color}/>
            <div style={sStyles.phaseText}>
              <div style={{
                ...sStyles.phaseName,
                fontWeight: p.big ? 600 : 500,
                color: p.big ? '#fafafa' : '#e5e5e5',
              }}>
                {p.name}
              </div>
              <div style={sStyles.phaseSub}>{p.sub}</div>
            </div>
            {isCurrent && <div style={sStyles.phaseNow}>NOW</div>}
          </div>
        );
      })}
    </div>
  );
};

// Compact icon for each phase kind.
const PhaseDot = ({ kind, color }) => {
  if (kind === 'sun') return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="3.5" fill={color}/>
      <g stroke={color} strokeWidth="1.2" strokeLinecap="round">
        <line x1="10" y1="2" x2="10" y2="4"/>
        <line x1="10" y1="16" x2="10" y2="18"/>
        <line x1="2" y1="10" x2="4" y2="10"/>
        <line x1="16" y1="10" x2="18" y2="10"/>
      </g>
    </svg>
  );
  if (kind === 'noon') return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="4" fill={color}/>
      <g stroke={color} strokeWidth="1.4" strokeLinecap="round">
        {Array.from({length:8}).map((_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return <line key={i}
            x1={10 + Math.cos(a)*6} y1={10 + Math.sin(a)*6}
            x2={10 + Math.cos(a)*8} y2={10 + Math.sin(a)*8}/>;
        })}
      </g>
    </svg>
  );
  if (kind === 'golden') return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M3 14 L17 14" stroke="#4a4566" strokeWidth="1"/>
      <circle cx="10" cy="14" r="3" fill={color}/>
      <g stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.8">
        <line x1="10" y1="8" x2="10" y2="9.5"/>
        <line x1="4.5" y1="14" x2="6" y2="14"/>
        <line x1="14" y1="14" x2="15.5" y2="14"/>
      </g>
    </svg>
  );
  // Twilight phases: dot below or just above horizon
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M3 12 L17 12" stroke="#4a4566" strokeWidth="1"/>
      <circle cx="10" cy={kind === 'civil' ? 13 : kind === 'naut' ? 14.5 : 16} r="2.2" fill={color}/>
    </svg>
  );
};

// ── Moon panel ───────────────────────────────────────────────────
const MoonPanel = ({ moon, fmt }) => {
  return (
    <div style={sStyles.moonPanel}>
      <div style={sStyles.sectionLabel}>MOON</div>
      <div style={sStyles.moonRow}>
        <MoonDisc fraction={moon.phaseFraction} size={64}/>
        <div style={sStyles.moonInfo}>
          <div style={sStyles.moonPhase}>{moon.phase}</div>
          <div style={sStyles.moonIllum}>{moon.illumination}% illuminated</div>
          <div style={sStyles.moonTimes}>
            <div>
              <span style={sStyles.moonKey}>Rise</span>
              <span style={sStyles.moonVal}>{fmt(moon.moonrise)}</span>
            </div>
            <div>
              <span style={sStyles.moonKey}>Set</span>
              <span style={sStyles.moonVal}>{fmt(moon.moonset)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// fraction: 0=new, 0.25=first quarter, 0.5=full, 0.75=last quarter
const MoonDisc = ({ fraction, size = 56 }) => {
  // Cover the full moon with a shadow shape based on phase fraction.
  const r = size / 2;
  // Phase angle in [0, 2π); shadow side and width controlled by it.
  const phase = fraction * 2 * Math.PI;
  // Compute the position of the terminator ellipse rx for a sphere.
  // For a perfect crescent/gibbous, terminator x-scale = |cos(phase)|, sign flips for waxing/waning.
  const cosP = Math.cos(phase);
  const rx = Math.abs(cosP) * r;

  // Decide which half is shadowed. For waxing (0<fraction<0.5), shadow is on the LEFT.
  // For waning (0.5<fraction<1), shadow is on the RIGHT.
  const shadowLeft = fraction < 0.5;

  // For gibbous (>50% lit), shadow is the smaller, single side.
  // For crescent (<50% lit), shadow covers more than half: shadow = side + ellipse.
  // We build a shape: outer arc on one side + ellipse arc as terminator.
  const shadowFill = '#0d1124';
  const litFill = '#e3decc';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{filter:'drop-shadow(0 4px 14px rgba(180,170,140,.15))'}}>
      <defs>
        <radialGradient id="moonSurface" cx="0.35" cy="0.35" r="0.7">
          <stop offset="0%" stopColor="#f4ecd6"/>
          <stop offset="100%" stopColor="#bdb293"/>
        </radialGradient>
      </defs>
      {/* lit disc */}
      <circle cx={r} cy={r} r={r-1} fill="url(#moonSurface)"/>
      {/* shadow: a half-disc + an ellipse forming the terminator */}
      <g>
        {/* clip to the moon circle */}
        <clipPath id="moonClip"><circle cx={r} cy={r} r={r-1}/></clipPath>
        <g clipPath="url(#moonClip)">
          {/* draw shadow side rect */}
          {fraction < 0.5 ? (
            // waxing: shadow on left
            <rect x="0" y="0" width={r} height={size} fill={shadowFill}/>
          ) : (
            // waning: shadow on right
            <rect x={r} y="0" width={r} height={size} fill={shadowFill}/>
          )}
          {/* terminator ellipse — sweeps across center */}
          <ellipse cx={r} cy={r} rx={rx} ry={r-1}
            fill={cosP > 0 ? shadowFill : litFill}/>
        </g>
      </g>
      {/* maria spots */}
      <g opacity="0.18" fill="#3a3530">
        <circle cx={r - 6} cy={r - 4} r="3"/>
        <circle cx={r + 3} cy={r + 5} r="2"/>
        <circle cx={r - 2} cy={r + 7} r="1.5"/>
      </g>
      {/* rim */}
      <circle cx={r} cy={r} r={r-1} fill="none" stroke="#3a3a3a" strokeWidth="0.5" opacity="0.4"/>
    </svg>
  );
};

// ── styles ───────────────────────────────────────────────────────
const sStyles = {
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

  hero: { padding: '8px 8px 0' },

  sectionLabel: {
    fontSize: 9, fontWeight: 700, letterSpacing: 1,
    color: '#5a6485', padding: '0 0 6px',
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
  },

  stats: {
    display: 'flex', alignItems: 'stretch',
    margin: '4px 14px 12px', padding: '10px 4px',
    background: '#0c1428', border: '1px solid #1b2440',
    borderRadius: 12,
  },
  statCol: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 2,
  },
  statDiv: {
    width: 1, alignSelf: 'stretch', background: '#1b2440', margin: '2px 0',
  },
  statKey: {
    fontSize: 9, fontWeight: 700, color: '#7a8aa3',
    letterSpacing: 0.6, textTransform: 'uppercase',
  },
  statVal: {
    fontSize: 17, color: '#fafafa', fontWeight: 500, letterSpacing: -0.4,
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    fontVariantNumeric: 'tabular-nums',
  },
  statSub: {
    fontSize: 10, color: '#9a9a93',
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
  },

  twilightWrap: { padding: '0 14px 12px' },
  twilightBar: {
    position: 'relative', height: 22,
    borderRadius: 6, overflow: 'hidden',
    border: '1px solid #1b2440',
  },
  twilightFill: { position: 'absolute', inset: 0 },
  twilightTick: {
    position: 'absolute', top: 0, bottom: 0, width: 1,
    background: 'rgba(255,255,255,.18)',
  },
  twilightNow: {
    position: 'absolute', top: -3, bottom: -3, width: 2,
    background: '#fafafa', boxShadow: '0 0 8px rgba(255,255,255,.6)',
  },
  twilightAxis: { position: 'relative', height: 12, marginTop: 4 },
  twilightHr: {
    position: 'absolute', transform: 'translateX(-50%)',
    fontSize: 9, color: '#7a8aa3',
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
  },

  phaseSection: { padding: '4px 14px 12px' },
  phaseList: {
    display: 'flex', flexDirection: 'column',
    background: '#0c1428', border: '1px solid #1b2440',
    borderRadius: 12, overflow: 'hidden',
  },
  phaseRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 12px', borderBottom: '1px solid #131a2e',
    minHeight: 36,
  },
  phaseTime: {
    width: 44, fontSize: 12, fontWeight: 600, color: '#fafafa',
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    fontVariantNumeric: 'tabular-nums',
  },
  phaseText: { flex: 1, display: 'flex', flexDirection: 'column' },
  phaseName: { fontSize: 13, lineHeight: 1.2 },
  phaseSub: { fontSize: 10, color: '#7a8aa3', marginTop: 1 },
  phaseNow: {
    fontSize: 9, fontWeight: 700, letterSpacing: 1, color: '#0a0a0a',
    background: '#ffd06a', padding: '3px 6px', borderRadius: 3,
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
  },

  moonPanel: { padding: '4px 14px 16px' },
  moonRow: {
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '12px 14px',
    background: '#0c1428', border: '1px solid #1b2440',
    borderRadius: 12,
  },
  moonInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 },
  moonPhase: { fontSize: 14, fontWeight: 600, color: '#fafafa' },
  moonIllum: {
    fontSize: 11, color: '#9a9a93',
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    fontVariantNumeric: 'tabular-nums',
  },
  moonTimes: {
    display: 'flex', gap: 16, marginTop: 4,
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    fontVariantNumeric: 'tabular-nums',
  },
  moonKey: {
    fontSize: 9, color: '#7a8aa3', fontWeight: 700,
    letterSpacing: 0.6, textTransform: 'uppercase',
    marginRight: 6,
  },
  moonVal: { fontSize: 12, color: '#fafafa', fontWeight: 500 },
};

window.TodaySun = TodaySun;
