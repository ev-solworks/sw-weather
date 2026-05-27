/**
 * WindRosette — the "Sweep" rosette. Track ring + a colored arc centred on the
 * wind's FROM-bearing, N/E/S/W letters, and a smooth arrowhead at the bearing.
 * Colour ramps with wind strength (knots). Offline = muted, no arc/arrow.
 * The numeric readout (speed/gust/direction) is overlaid by the caller.
 */

const VB = 140; // viewBox
const C = VB / 2;
const R = 60;

/** Wind colour ramp by knots: calm slate → green → yellow → orange → magenta. */
export function windColor(kt: number): string {
  if (kt < 5) return '#6b7596';
  if (kt < 10) return '#2fd49a';
  if (kt < 15) return '#7fd02a';
  if (kt < 20) return '#f0c020';
  if (kt < 27) return '#ee5b2a';
  return '#cf3290';
}

/** SVG arc path a0→a1 degrees (0 = N, clockwise) at radius r. */
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
  const lr = R - 11;
  const L = (t: string, a: number) => {
    const ra = (a * Math.PI) / 180;
    return (
      <text
        key={t}
        x={(C + Math.sin(ra) * lr).toFixed(1)}
        y={(C - Math.cos(ra) * lr + 3.2).toFixed(1)}
        textAnchor="middle"
        fontSize="8.5"
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

/**
 * A smooth, kite-shaped arrowhead pointing inward (toward centre) at 12 o'clock,
 * to be rotated to the bearing. Concave tail edges + a rounded join read as a
 * proper arrow rather than a flat triangle. Tip near the ring, sitting on it.
 */
function arrowHead(col: string) {
  const tipY = C - R + 16; // inner tip
  const baseY = C - R - 4; // outer base (just outside ring)
  const w = 11; // half-width at base
  // tip → right base → concave curve back to a short neck → left base → close
  const d =
    `M ${C} ${tipY} ` +
    `L ${C + w} ${baseY} ` +
    `Q ${C} ${baseY - 5} ${C - w} ${baseY} ` +
    `Z`;
  return <path d={d} fill={col} strokeLinejoin="round" />;
}

interface Props {
  dir: number; // FROM bearing, degrees
  windKt: number; // for colour
  online: boolean;
  size?: number;
}

export function WindRosette({ dir, windKt, online, size = 150 }: Props) {
  const col = online ? windColor(windKt) : '#2a3550';
  return (
    <svg viewBox={`0 0 ${VB} ${VB}`} width={size} height={size} aria-hidden style={{ position: 'absolute', inset: 0 }}>
      <circle cx={C} cy={C} r={R} fill="none" stroke="#212c48" strokeWidth="6" />
      {online && <path d={arcPath(R, dir - 46, dir + 46)} fill="none" stroke={col} strokeWidth="6" strokeLinecap="round" />}
      {letters()}
      {online && <g transform={`rotate(${dir} ${C} ${C})`}>{arrowHead(col)}</g>}
    </svg>
  );
}
