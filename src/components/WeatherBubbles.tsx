/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 6313-style supplementary row: circular badges (gust, daily rain, moon)
 * plus the sun arc — a thin arc with the sun at its apex and sunrise /
 * sunset times beneath, like the original hardware. On wide screens the
 * badges live as corner medallions on the tiles, so the in-flow copies
 * hide and only the sun arc row remains.
 */
import { Sunrise, Sunset, Moon, Wind, CloudRain, Sun } from 'lucide-react';

/** Minutes since midnight for "6:42 AM" style times, or null when unknown. */
function parseDayTime(t: string): number | null {
  const m = /^\s*(\d{1,2}):(\d{2})\s*([AP]M)\s*$/i.exec(t || '');
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (/pm/i.test(m[3])) h += 12;
  return h * 60 + Number(m[2]);
}

export default function WeatherBubbles({
  gust,
  gustUnit,
  dailyRain,
  rainUnit,
  sunrise,
  sunset,
  moonPhase,
}: {
  gust: string;
  gustUnit: string;
  dailyRain: string;
  rainUnit: string;
  sunrise: string;
  sunset: string;
  moonPhase: string;
}) {
  // Status medallions: icon only (like the 6313) — readings live in
  // title/aria-label plus the taskbar ticker, never as badge text.
  const badges = [
    { icon: Wind, label: 'Gust', value: `${gust} ${gustUnit}`, tone: 'teal', iconOnly: true, cls: '' },
    { icon: CloudRain, label: 'Daily rain', value: `${dailyRain} ${rainUnit}`, tone: 'sky', iconOnly: true, cls: '' },
    { icon: Moon, label: 'Moon', value: moonPhase, tone: 'indigo', iconOnly: true, cls: ' bubble-moon' },
  ];
  // Sun dot rides the arc between sunrise and sunset; hidden at night
  // when the sun is below the horizon.
  const riseMin = parseDayTime(sunrise);
  const setMin = parseDayTime(sunset);
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const dayT =
    riseMin !== null && setMin !== null && setMin > riseMin
      ? (nowMin - riseMin) / (setMin - riseMin)
      : 0.5;
  const sunUp = dayT >= 0 && dayT <= 1;
  const sunAngle = Math.PI + Math.PI * Math.min(1, Math.max(0, dayT));
  // Arc path M10,46 A50,50 in a 120x62 box (y offset +10): position the
  // rayed sun glyph exactly on the stroke.
  const sunLeft = ((60 + 50 * Math.cos(sunAngle)) / 120) * 100;
  const sunTop = ((46 + 50 * Math.sin(sunAngle) + 10) / 62) * 100;
  return (
    <div className="console-bubbles" role="list" aria-label="Supplementary readings">
      {badges.map((b) => (
        <div
          key={b.label}
          role="listitem"
          className={`console-bubble console-bubble-tone-${b.tone} desktop-hidden${b.cls}${b.iconOnly ? ' console-bubble-icon-only' : ''}`}
          title={`${b.label}: ${b.value}`}
        >
          <span aria-hidden="true" className="console-bubble-visual">
            <b.icon aria-hidden="true" />
            {!b.iconOnly && (
              <>
                <span className="console-bubble-label">{b.label}</span>
                <span className="console-bubble-value">{b.value}</span>
              </>
            )}
          </span>
          <span className="sr-only">{`${b.label}: ${b.value}`}</span>
        </div>
      ))}
      <div className="console-sunarc" role="listitem">
        <span className="sr-only">{`Sunrise ${sunrise}, sunset ${sunset}`}</span>
        <div className="console-sunarc-track" aria-hidden="true">
          <svg viewBox="0 -10 120 62" className="console-sunarc-arc" aria-hidden="true">
            <path d="M10,46 A50,50 0 0 1 110,46" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          {sunUp && (
            <Sun
              className="console-sunarc-sun"
              aria-hidden="true"
              style={{ left: `${sunLeft.toFixed(1)}%`, top: `${sunTop.toFixed(1)}%` }}
            />
          )}
        </div>
        <div className="console-sunarc-times" aria-hidden="true">
          <span className="console-sunarc-time">
            <Sunrise aria-hidden="true" />
            {sunrise}
          </span>
          <span className="console-sunarc-time">
            {sunset}
            <Sunset aria-hidden="true" />
          </span>
        </div>
      </div>
    </div>
  );
}
