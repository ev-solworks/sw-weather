// weather-backdrop.jsx — motion backgrounds keyed off the condition string.
// Each backdrop fills its container (absolute, inset: 0). Uses CSS keyframes
// injected once into the document; cheap enough to render multiple on screen.

(() => {
  if (document.getElementById('wx-bg-styles')) return;
  const tag = document.createElement('style');
  tag.id = 'wx-bg-styles';
  tag.textContent = `
@keyframes wxRain { 0%{transform:translate3d(0,-30%,0)} 100%{transform:translate3d(-14px,130%,0)} }
@keyframes wxSnow { 0%{transform:translate3d(0,-20%,0)} 100%{transform:translate3d(18px,130%,0)} }
@keyframes wxCloudA { 0%{transform:translate3d(-25%,0,0)} 100%{transform:translate3d(125%,0,0)} }
@keyframes wxCloudB { 0%{transform:translate3d(-40%,0,0)} 100%{transform:translate3d(140%,0,0)} }
@keyframes wxSunSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
@keyframes wxSunPulse { 0%,100%{opacity:.78;transform:scale(1)} 50%{opacity:1;transform:scale(1.06)} }
@keyframes wxFogDrift { 0%{transform:translateX(-12%)} 50%{transform:translateX(12%)} 100%{transform:translateX(-12%)} }
@keyframes wxStarTwinkle { 0%,100%{opacity:.25} 50%{opacity:.9} }
@keyframes wxBoltFlash { 0%,92%,100%{opacity:0} 94%{opacity:1} 96%{opacity:.2} 98%{opacity:.8} }
.wx-rain-line { position:absolute; top:0; width:1px; background:linear-gradient(to bottom, transparent, currentColor 35%, currentColor 70%, transparent); will-change:transform; }
.wx-snow-dot { position:absolute; top:0; border-radius:50%; background:currentColor; will-change:transform; }
.wx-cloud-blob { position:absolute; border-radius:50%; filter:blur(28px); will-change:transform; }
.wx-fog-band { position:absolute; left:-20%; right:-20%; height:32%; filter:blur(28px); will-change:transform; }
  `;
  document.head.appendChild(tag);
})();

// ─────────────────────────────────────────────────────────────────────
// Master switch
const WeatherBackdrop = ({ desc, intensity = 1, palette, night = false, compact = false }) => {
  const s = String(desc || '').toLowerCase();
  const P = palette || WX_PALETTES.clear;
  const wrap = {
    position: 'absolute', inset: 0, overflow: 'hidden',
    background: `radial-gradient(120% 80% at 50% 0%, ${P.skyHi} 0%, ${P.skyLo} 70%, ${P.bg} 100%)`,
  };
  let layer;
  if (s.includes('thunder') || s.includes('storm')) layer = <RainLayer heavy color={P.rain} intensity={intensity}/>;
  else if (s.includes('heavy rain')) layer = <RainLayer heavy color={P.rain} intensity={intensity}/>;
  else if (s.includes('rain') || s.includes('drizzle') || s.includes('shower')) layer = <RainLayer color={P.rain} intensity={intensity}/>;
  else if (s.includes('snow') || s.includes('flurr')) layer = <SnowLayer color={P.rain} intensity={intensity}/>;
  else if (s.includes('fog') || s.includes('mist') || s.includes('haze')) layer = <FogLayer color={P.fog}/>;
  else if (s.includes('partly')) layer = <PartlyLayer P={P} night={night}/>;
  else if (s.includes('cloud') || s.includes('overcast')) layer = <CloudLayer P={P} dense/>;
  else if (s.includes('mostly clear') || s.includes('mostly sunny')) layer = <ClearLayer P={P} night={night} mostly/>;
  else layer = <ClearLayer P={P} night={night}/>;
  return (
    <div style={wrap}>
      {layer}
      {/* Soft vignette so foreground text stays legible */}
      <div style={{position:'absolute',inset:0,
        background: compact
          ? 'radial-gradient(120% 80% at 50% 100%, rgba(0,0,0,.35), transparent 60%)'
          : 'radial-gradient(140% 100% at 50% 110%, rgba(0,0,0,.55), transparent 60%)',
        pointerEvents:'none'}}/>
    </div>
  );
};

// Palettes per family — tuned warm/cool. Foreground stays light over all.
const WX_PALETTES = {
  clear:   { skyHi:'#1f3b6e', skyLo:'#0a1226', bg:'#070b1a', sun:'#ffd47a', rain:'rgba(190,210,255,.7)', fog:'rgba(180,200,230,.25)' },
  clearNight:{ skyHi:'#0f1a36', skyLo:'#070b1a', bg:'#04060f', sun:'#dbe6ff', rain:'rgba(190,210,255,.7)', fog:'rgba(150,170,210,.18)' },
  partly:  { skyHi:'#28406d', skyLo:'#0d152a', bg:'#070b1a', sun:'#ffcf6e', rain:'rgba(200,215,240,.7)', fog:'rgba(180,200,230,.25)' },
  cloud:   { skyHi:'#2c3344', skyLo:'#11141c', bg:'#0a0c12', sun:'#aab3c4', rain:'rgba(190,205,225,.6)', fog:'rgba(170,185,210,.25)' },
  rain:    { skyHi:'#1d2c44', skyLo:'#0a1322', bg:'#060a14', sun:'#5b78a8', rain:'rgba(140,180,235,.85)', fog:'rgba(140,170,210,.28)' },
  heavy:   { skyHi:'#142136', skyLo:'#070d18', bg:'#04070e', sun:'#3b5476', rain:'rgba(120,170,235,.95)', fog:'rgba(110,150,200,.3)' },
  snow:    { skyHi:'#384258', skyLo:'#161b27', bg:'#0c0f17', sun:'#dde6f4', rain:'rgba(230,238,250,.85)', fog:'rgba(210,220,235,.3)' },
  fog:     { skyHi:'#3a3f49', skyLo:'#1a1d24', bg:'#0e1014', sun:'#b8bcc4', rain:'rgba(200,205,215,.5)', fog:'rgba(200,210,225,.45)' },
};

// ─────────────────────────────────────────────────────────────────────
// Layers

const RainLayer = ({ heavy = false, color = 'rgba(160,200,235,.8)', intensity = 1 }) => {
  const count = Math.round((heavy ? 70 : 38) * intensity);
  const lines = React.useMemo(() => Array.from({length: count}, (_, i) => {
    const left = (i / count) * 100 + Math.random() * (100/count);
    const dur = 0.55 + Math.random() * (heavy ? 0.4 : 0.7);
    const delay = -Math.random() * 1.5;
    const len = 18 + Math.random() * (heavy ? 38 : 28);
    const op = 0.4 + Math.random() * 0.6;
    return { left, dur, delay, len, op };
  }), [count, heavy]);
  return (
    <div style={{position:'absolute',inset:0,color,transform:'rotate(8deg) scale(1.2)',transformOrigin:'center'}}>
      {lines.map((l, i) => (
        <div key={i} className="wx-rain-line" style={{
          left: `${l.left}%`,
          height: l.len,
          opacity: l.op,
          animation: `wxRain ${l.dur}s linear ${l.delay}s infinite`,
        }}/>
      ))}
      {heavy && (
        <div style={{position:'absolute',inset:0,
          background:'radial-gradient(80% 50% at 50% 0%, rgba(255,255,255,.04), transparent 60%)',
          animation:'wxBoltFlash 7s ease-in-out infinite',
        }}/>
      )}
    </div>
  );
};

const SnowLayer = ({ color = 'rgba(235,242,252,.9)', intensity = 1 }) => {
  const count = Math.round(50 * intensity);
  const flakes = React.useMemo(() => Array.from({length: count}, (_, i) => {
    const left = (i / count) * 100 + Math.random() * (100/count);
    const dur = 4 + Math.random() * 6;
    const delay = -Math.random() * 8;
    const size = 2 + Math.random() * 3;
    const op = 0.45 + Math.random() * 0.5;
    return { left, dur, delay, size, op };
  }), [count]);
  return (
    <div style={{position:'absolute',inset:0,color}}>
      {flakes.map((f, i) => (
        <div key={i} className="wx-snow-dot" style={{
          left: `${f.left}%`,
          width: f.size, height: f.size, opacity: f.op,
          animation: `wxSnow ${f.dur}s linear ${f.delay}s infinite`,
        }}/>
      ))}
    </div>
  );
};

const CloudLayer = ({ P, dense = false }) => {
  // 3 large blurred blobs drifting at different speeds.
  const blobs = [
    { top: '8%',  size: 220, color: 'rgba(180,195,225,.22)', dur: 60, delay: -10, anim: 'wxCloudA' },
    { top: '22%', size: 300, color: 'rgba(170,180,210,.18)', dur: 90, delay: -30, anim: 'wxCloudB' },
    { top: '38%', size: 260, color: dense ? 'rgba(150,165,195,.22)' : 'rgba(190,205,235,.15)', dur: 75, delay: -55, anim: 'wxCloudA' },
  ];
  if (dense) blobs.push({ top: '4%', size: 360, color: 'rgba(200,210,230,.16)', dur: 110, delay: -70, anim: 'wxCloudB' });
  return (
    <div style={{position:'absolute',inset:0}}>
      {blobs.map((b, i) => (
        <div key={i} className="wx-cloud-blob" style={{
          top: b.top, width: b.size, height: b.size * 0.55,
          background: b.color, left: 0,
          animation: `${b.anim} ${b.dur}s linear ${b.delay}s infinite`,
        }}/>
      ))}
    </div>
  );
};

const ClearLayer = ({ P, night = false, mostly = false }) => {
  if (night) return (
    <div style={{position:'absolute',inset:0}}>
      <StarField/>
      <div style={{position:'absolute',top:'14%',right:'16%',width:90,height:90,borderRadius:'50%',
        background:'radial-gradient(circle at 35% 35%, #f5f1e3, #c9c4b1 55%, #6e6b5c 100%)',
        boxShadow:'0 0 60px rgba(245,241,227,.25)'}}/>
    </div>
  );
  return (
    <div style={{position:'absolute',inset:0}}>
      {/* Sun glow */}
      <div style={{
        position:'absolute', top:'-10%', left:'50%', transform:'translateX(-50%)',
        width: '120%', height: '90%',
        background: `radial-gradient(closest-side, ${P.sun}55, ${P.sun}11 55%, transparent 75%)`,
        animation: 'wxSunPulse 7s ease-in-out infinite',
      }}/>
      {/* Sun rays */}
      <div style={{
        position:'absolute', top:'10%', left:'50%', width: 280, height: 280, marginLeft: -140,
        animation: 'wxSunSpin 80s linear infinite', opacity: .35,
      }}>
        <svg viewBox="0 0 200 200" width="280" height="280">
          {Array.from({length: 16}, (_, i) => {
            const a = (i / 16) * Math.PI * 2;
            const x1 = 100 + Math.cos(a) * 50, y1 = 100 + Math.sin(a) * 50;
            const x2 = 100 + Math.cos(a) * 95, y2 = 100 + Math.sin(a) * 95;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={P.sun} strokeWidth="1.2" strokeLinecap="round"/>;
          })}
        </svg>
      </div>
      {mostly && (
        <div className="wx-cloud-blob" style={{
          top:'28%', width: 240, height: 130,
          background: 'rgba(220,225,240,.15)',
          animation: 'wxCloudA 90s linear -20s infinite',
        }}/>
      )}
    </div>
  );
};

const PartlyLayer = ({ P, night }) => (
  <div style={{position:'absolute',inset:0}}>
    <ClearLayer P={P} night={night} mostly/>
    <div className="wx-cloud-blob" style={{
      top:'20%', width: 320, height: 170, background: 'rgba(180,195,225,.22)',
      animation: 'wxCloudB 70s linear -30s infinite',
    }}/>
    <div className="wx-cloud-blob" style={{
      top:'42%', width: 220, height: 120, background: 'rgba(200,210,235,.16)',
      animation: 'wxCloudA 95s linear -10s infinite',
    }}/>
  </div>
);

const FogLayer = ({ color = 'rgba(200,210,225,.45)' }) => (
  <div style={{position:'absolute',inset:0}}>
    {[18, 38, 58, 78].map((top, i) => (
      <div key={i} className="wx-fog-band" style={{
        top: `${top}%`,
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        animation: `wxFogDrift ${22 + i * 5}s ease-in-out ${-i * 3}s infinite`,
      }}/>
    ))}
  </div>
);

const StarField = () => {
  const stars = React.useMemo(() => Array.from({length: 40}, () => ({
    left: Math.random() * 100,
    top: Math.random() * 70,
    size: Math.random() < 0.85 ? 1 : 2,
    delay: -Math.random() * 4,
    dur: 2 + Math.random() * 4,
  })), []);
  return (
    <>
      {stars.map((s, i) => (
        <div key={i} style={{
          position:'absolute', left:`${s.left}%`, top:`${s.top}%`,
          width: s.size, height: s.size, borderRadius:'50%', background:'#dde6f4',
          animation:`wxStarTwinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
        }}/>
      ))}
    </>
  );
};

// Map a forecast description + hour to a backdrop palette key.
window.wxPaletteFor = (desc, hour = 12) => {
  const s = String(desc || '').toLowerCase();
  const night = hour < 6 || hour >= 20;
  if (s.includes('heavy rain') || s.includes('thunder') || s.includes('storm')) return WX_PALETTES.heavy;
  if (s.includes('rain') || s.includes('drizzle') || s.includes('shower')) return WX_PALETTES.rain;
  if (s.includes('snow') || s.includes('flurr')) return WX_PALETTES.snow;
  if (s.includes('fog') || s.includes('mist') || s.includes('haze')) return WX_PALETTES.fog;
  if (s.includes('partly')) return WX_PALETTES.partly;
  if (s.includes('cloud') || s.includes('overcast')) return WX_PALETTES.cloud;
  if (night) return WX_PALETTES.clearNight;
  return WX_PALETTES.clear;
};

window.WeatherBackdrop = WeatherBackdrop;
window.WX_PALETTES = WX_PALETTES;
