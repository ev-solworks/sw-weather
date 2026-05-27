/**
 * WindHistoryChart — measured wind + gust over time from a live station.
 * Gust as a soft filled area behind, wind as a brighter line on top. Compact
 * `sparkline` variant (no axes) for Today/Visual; full variant with y-grid + time
 * ticks for Today/Graph. All times rendered in the location's timezone.
 */

import type { WindHistoryPoint } from '@/types/weather';
import { fmtTime } from '@/utils/format';

interface Props {
  points: WindHistoryPoint[];
  tz: string;
  height?: number;
  sparkline?: boolean;
}

export function WindHistoryChart({ points, tz, height = 120, sparkline = false }: Props) {
  if (points.length < 2) {
    return <div className="flex h-16 items-center justify-center text-[11px] text-neutral-600">No live history</div>;
  }

  const W = 320;
  const H = height;
  const padL = sparkline ? 2 : 24;
  const padR = sparkline ? 2 : 8;
  const padT = 6;
  const padB = sparkline ? 2 : 16;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const t0 = points[0].time.getTime();
  const t1 = points[points.length - 1].time.getTime();
  const span = t1 - t0 || 1;
  const maxVal = Math.max(10, ...points.map((p) => Math.max(p.windSpeed, p.windGust ?? 0))) * 1.1;

  const x = (t: number) => padL + ((t - t0) / span) * innerW;
  const y = (v: number) => padT + innerH - (v / maxVal) * innerH;

  const windLine = points.map((p) => `${x(p.time.getTime()).toFixed(1)},${y(p.windSpeed).toFixed(1)}`).join(' ');
  const gustPts = points.filter((p) => p.windGust != null);
  const gustLine = gustPts.map((p) => `${x(p.time.getTime()).toFixed(1)},${y(p.windGust as number).toFixed(1)}`).join(' ');
  const gustArea =
    gustPts.length > 1
      ? `M ${x(gustPts[0].time.getTime()).toFixed(1)},${padT + innerH} ` +
        gustPts.map((p) => `L ${x(p.time.getTime()).toFixed(1)},${y(p.windGust as number).toFixed(1)}`).join(' ') +
        ` L ${x(gustPts[gustPts.length - 1].time.getTime()).toFixed(1)},${padT + innerH} Z`
      : '';

  // y-grid lines at sensible knots-ish km/h steps
  const step = maxVal > 60 ? 20 : maxVal > 30 ? 10 : 5;
  const gridVals: number[] = [];
  for (let v = step; v < maxVal; v += step) gridVals.push(v);

  // time ticks (full variant): first, middle, last
  const tickIdx = sparkline ? [] : [0, Math.floor(points.length / 2), points.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className="block">
      <defs>
        <linearGradient id="gustGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7fd02a" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#7fd02a" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {!sparkline &&
        gridVals.map((v) => (
          <g key={v}>
            <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} stroke="#15202e" strokeWidth="1" />
            <text x={padL - 4} y={y(v) + 3} textAnchor="end" fontSize="8" fill="#5a6577" fontFamily="ui-monospace, monospace">{v}</text>
          </g>
        ))}

      {gustArea && <path d={gustArea} fill="url(#gustGrad)" />}
      {gustLine && <polyline points={gustLine} fill="none" stroke="#7fd02a" strokeWidth="1" strokeOpacity="0.7" strokeDasharray="3 2" />}
      <polyline points={windLine} fill="none" stroke="#34d399" strokeWidth={sparkline ? 1.5 : 1.8} />

      {/* latest point dot */}
      {(() => {
        const last = points[points.length - 1];
        return <circle cx={x(last.time.getTime())} cy={y(last.windSpeed)} r={sparkline ? 2 : 2.6} fill="#34d399" />;
      })()}

      {!sparkline &&
        tickIdx.map((i) => (
          <text key={i} x={x(points[i].time.getTime())} y={H - 4} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'} fontSize="8" fill="#5a6577" fontFamily="ui-monospace, monospace">
            {fmtTime(points[i].time, tz)}
          </text>
        ))}
    </svg>
  );
}
