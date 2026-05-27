// Throwaway verification harness — proves normalize.getWeather() produces sane
// data against the LIVE APIs for one ES + one PT location. Run with vite-node so
// import.meta.env + the @/ alias resolve. Delete after Stage 1 verification.
import { getWeather } from '@/services/normalize';
import { getSeedLocation } from '@/utils/locations';

function summarize(label: string, b: Awaited<ReturnType<typeof getWeather>>) {
  console.log(`\n══════ ${label} (${b.location.name}) ══════`);
  console.log('assembledAt:', b.assembledAt);
  console.log('sources:', Object.fromEntries(Object.entries(b.sources).map(([k, v]) => [k, `${v.source}/${v.confidence}`])));
  console.log('current:', {
    temp: b.current.temperature,
    feels: b.current.feelsLike,
    wind: b.current.windSpeed,
    dir: b.current.windDirection,
    sky: b.current.description,
    night: b.current.isNight,
    at: b.current.observedAt.toISOString(),
  });
  console.log(`hours: ${b.hours.length} (first 3)`);
  for (const h of b.hours.slice(0, 3)) {
    console.log('  ', h.time.toISOString(), `${h.temperature}°`, h.description, `wind ${h.windSpeed}km/h@${h.windDirection}`, `precip ${h.precipAmount}mm`, `wave ${h.waveHeight ?? '–'}m`);
  }
  console.log(`days: ${b.days.length}`);
  const dkey = (x: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: b.location.timezone, month: '2-digit', day: '2-digit' }).format(x);
  for (const d of b.days.slice(0, 4)) {
    console.log('  ', d.dayName.padEnd(5), dkey(d.date), `${d.tempLo}–${d.tempHi}°`, d.description, `rain ${d.rainProbability}%`, `wave ${d.waveHeight ?? '–'}m sst ${d.seaTemperature ?? '–'}°`);
  }
  console.log('sun:', { sunrise: b.sun.sunrise.toLocaleTimeString('en-GB'), goldenStart: b.sun.goldenStart.toLocaleTimeString('en-GB'), sunset: b.sun.sunset.toLocaleTimeString('en-GB') });
  console.log('moon:', b.moon.phase, `${b.moon.illumination}%`);
}

async function main() {
  const palma = getSeedLocation('palma')!;
  const lisboa = getSeedLocation('lisboa')!;
  summarize('SPAIN', await getWeather(palma));
  summarize('PORTUGAL', await getWeather(lisboa));
}

main().catch((e) => {
  console.error('VERIFY FAILED:', e);
  process.exit(1);
});
