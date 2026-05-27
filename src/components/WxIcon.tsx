/**
 * WxIcon — line-style weather glyph for a ConditionCode. Single stroke color,
 * scalable. Night variants swap sun→moon. Matches the design handoff's WxIcon role.
 */

import type { ConditionCode } from '@/types/weather';

interface WxIconProps {
  desc: ConditionCode;
  size?: number;
  color?: string;
  strokeWidth?: number;
  night?: boolean;
  className?: string;
}

export function WxIcon({ desc, size = 24, color = 'currentColor', strokeWidth = 1.4, night = false, className }: WxIconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    role: 'img',
    'aria-label': desc,
  };

  const sunOrMoon =
    night ? (
      <path d="M20 14.5A8 8 0 119.5 4a6.5 6.5 0 1010.5 10.5z" />
    ) : (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>
    );

  const cloud = <path d="M7 18a4 4 0 010-8 5 5 0 019.6-1.3A3.5 3.5 0 0117 18H7z" />;

  switch (desc) {
    case 'Clear':
    case 'Sunny':
      return <svg {...common}>{sunOrMoon}</svg>;

    case 'Mostly clear':
    case 'Mostly sunny':
    case 'Partly cloudy':
      return (
        <svg {...common}>
          {night ? (
            <path d="M17 12.5A5.5 5.5 0 1110 6" />
          ) : (
            <>
              <circle cx="8" cy="8" r="3" />
              <path d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M3.8 3.8l1 1M11.2 11.2l1 1M3.8 12.2l1-1" />
            </>
          )}
          <path d="M9 19a3.5 3.5 0 010-7 4.5 4.5 0 018.6-1.2A3 3 0 0117 19H9z" />
        </svg>
      );

    case 'Cloudy':
      return <svg {...common}>{cloud}</svg>;

    case 'Fog':
      return (
        <svg {...common}>
          {cloud}
          <path d="M5 21h14M7 18.5h10" opacity={0.6} />
        </svg>
      );

    case 'Light rain':
      return (
        <svg {...common}>
          {cloud}
          <path d="M9 20l-1 2M13 20l-1 2" />
        </svg>
      );

    case 'Rain':
      return (
        <svg {...common}>
          {cloud}
          <path d="M8 20l-1.2 2.5M12 20l-1.2 2.5M16 20l-1.2 2.5" />
        </svg>
      );

    case 'Heavy rain':
      return (
        <svg {...common}>
          {cloud}
          <path d="M7 19.5l-1.5 3M11 19.5l-1.5 3M15 19.5l-1.5 3M9 19.5l-1.5 3M13 19.5l-1.5 3" />
        </svg>
      );

    case 'Thunder':
      return (
        <svg {...common}>
          {cloud}
          <path d="M12 19l-2 3h3l-2 3" />
        </svg>
      );

    case 'Snow':
      return (
        <svg {...common}>
          {cloud}
          <path d="M8 21h.01M12 22h.01M16 21h.01M10 20h.01M14 20h.01" />
        </svg>
      );

    default:
      return <svg {...common}>{cloud}</svg>;
  }
}
