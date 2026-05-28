/**
 * AnnotationStrip — horizontal chips below the hourly strip summarizing useful
 * at-a-glance cues (next golden hour, peak gust, rain onset, temp trend).
 * Hand-authored rules in services/annotations.ts.
 *
 * Icons match the rest of the app — Meteocons (WxIcon / WxTagIcon). No emoji.
 */

import { getAnnotations, type Annotation } from '@/services/annotations';
import type { WeatherConditions, ConditionCode } from '@/types/weather';
import { WxIcon, WxTagIcon, type WxTag } from '@/components/WxIcon';

interface Props {
  weather: WeatherConditions;
  /** Cap the number of chips rendered. Defaults to 4. */
  limit?: number;
}

export function AnnotationStrip({ weather, limit = 4 }: Props) {
  const list = getAnnotations(weather).slice(0, limit);
  if (!list.length) return null;
  return (
    <div className="flex shrink-0 gap-2 overflow-x-auto px-3 pb-2 pt-1 [scrollbar-width:none]">
      {list.map((a) => (
        <Chip key={a.id} a={a} />
      ))}
    </div>
  );
}

const TAGS: ReadonlySet<WxTag> = new Set(['wind', 'sun', 'thermo', 'umbrella']);
function isTag(s: Annotation['icon']): s is WxTag {
  return typeof s === 'string' && TAGS.has(s as WxTag);
}

function Chip({ a }: { a: Annotation }) {
  const style =
    a.kind === 'urgent'
      ? 'bg-amber-900/40 text-amber-100 border border-amber-700/40'
      : a.kind === 'info'
        ? 'bg-[#121b2c] text-neutral-200 border border-[#1d2533]'
        : 'bg-transparent text-neutral-400 border border-[#1b2440]';
  return (
    <div className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full py-1 pl-1.5 pr-2.5 text-[11.5px] ${style}`}>
      {a.icon && (
        isTag(a.icon)
          ? <WxTagIcon tag={a.icon} size={18} />
          : <WxIcon desc={a.icon as ConditionCode} size={18} />
      )}
      <span className="font-medium">{a.text}</span>
    </div>
  );
}
