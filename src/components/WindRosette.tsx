/**
 * WindRosette — the "Sweep" wind rosette. Thick track ring, a colored arc centred
 * on the wind's FROM-bearing, N/E/S/W letters, and a bold pointer at the bearing.
 * Wind speed sits centered inside; colour ramps with strength (knots). Offline
 * renders muted with no arc/arrow.
 */

const C = 66; // center (viewBox 132)
const R = 56;

/** Wind colour ramp by knots: calm slate → green → yellow → orange → magenta. */
export function windColor(kt: number): string {
  if (kt < 5) return '#6b7596';
  if (kt < 10) return '#2fd49a';
  if (kt < 15) return '#7fd02a';
  if (kt < 20) return '#f0c020';
  if (kt < 27) return '#ee5b2a';
  return '#cf3290';
}

/** SVG arc path from a0→a1 degrees (0 = N, clockwise) at radius r. */
function arcPath(r: number, a0: number, a1: number): string {
  const p = (a: number) => {
    const ra = ((a - 90) * Math.PI) / 180;
    return [C + r * Math.cos(ra), C + r * Math.sin(ra)];
  };
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  const large = (a1 - a0 + 360) % 360 > 180 ? 1 : 0;
  return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}

function letters() {
  const lr = R - 10;
  const L = (t: string, a: number) => {
    const ra = (a * Math.PI) / 180;
    return (
      <text
        key={t}
        x={(C + Math.sin(ra) * lr).toFixed(1)}
        y={(C - Math.cos(ra) * lr + 3).toFixed(1)}
        textAnchor="middle"
        fontSize="8"
        fontWeight="700"
        fill="#5e6a8c"
        fontFamily="ui-monospace, monospace"
      >
        {t}
      </text>
    );
  };
  return [L('N', 0), L('E', 90), L('S', 180), L('W', 270)];
}

interface Props {
  dir: number; // FROM bearing, degrees
  windKt: number; // for colour
  online: boolean;
  size?: number;
}

export function WindRosette({ dir, windKt, online, size = 132 }: Props) {
  const col = online ? windColor(windKt) : '#2a3550';
  return (
    <svg viewBox="0 0 132 132" width={size} height={size} aria-hidden style={{ position: 'absolute', inset: 0 }}>
      <circle cx={C} cy={C} r={R} fill="none" stroke="#222d44" strokeWidth="6" />
      {online && <path d={arcPath(R, dir - 44, dir + 44)} fill="none" stroke={col} strokeWidth="6" strokeLinecap="round" />}
      {letters()}
      {online && (
        <g transform={`rotate(${dir} ${C} ${C})`}>
          <path d={`M${C} ${C - 48} L${C - 10} ${C - 67} L${C + 10} ${C - 67} Z`} fill={col} />
        </g>
      )}
    </svg>
  );
}
