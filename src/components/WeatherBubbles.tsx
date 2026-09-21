/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 6313-style "weather bubbles": small inset circles flanking the wind rose
 * with supplementary readings (gust, daily rain, sunrise, moon).
 */
import { Sunrise, Sunset, Moon, Wind, CloudRain } from 'lucide-react';

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
  const bubbles = [
    { icon: Wind, label: 'Gust', value: `${gust} ${gustUnit}` },
    { icon: CloudRain, label: 'Daily rain', value: `${dailyRain} ${rainUnit}` },
    { icon: Sunrise, label: 'Sunrise', value: sunrise },
    { icon: Sunset, label: 'Sunset', value: sunset },
    { icon: Moon, label: 'Moon', value: moonPhase },
  ];
  return (
    <div className="console-bubbles" role="list" aria-label="Supplementary readings">
      {bubbles.map((b) => (
        <div key={b.label} role="listitem" className="console-bubble" title={`${b.label}: ${b.value}`}>
          <b.icon aria-hidden="true" />
          <span className="console-bubble-label">{b.label}</span>
          <span className="console-bubble-value">{b.value}</span>
        </div>
      ))}
    </div>
  );
}
