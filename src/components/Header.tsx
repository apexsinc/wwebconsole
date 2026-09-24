/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 6313-style station cell: compact centered block (home icon, station name,
 * time | date) that sits at the top of the center column, mirroring the
 * hardware's top-middle cell overlapped by the wind rose.
 */

import { useEffect, useState } from 'react';
import { Home } from 'lucide-react';
import { format } from 'date-fns';
import { useWeatherStore } from '../store.js';

export default function Header() {
  const { stationName } = useWeatherStore((state) => state.weather);
  const config = useWeatherStore((state) => state.config);
  const connection = useWeatherStore((state) => state.connection);
  const resolvedName = stationName || config.stationName || 'Connecting…';

  // Real-time ticking system clock synced with the WLL system
  const [systemTime, setSystemTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setSystemTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Use the exact time we polled the API (or received UDP), falling back to the ticking system clock if offline
  const lastUpdateMs = connection.lastHttpReceived || connection.lastUdpReceived || 0;

  const displayDate = lastUpdateMs === 0
    ? systemTime
    : new Date(lastUpdateMs);

  const formattedTime = format(displayDate, 'h:mm a');
  const formattedDate = format(displayDate, 'M/d/yy');
  const weekday = format(displayDate, 'EEEE');
  // Wall displays run unattended: flag data older than 30 min right on the clock.
  const stale = lastUpdateMs > 0 && Date.now() - lastUpdateMs > 30 * 60 * 1000;

  return (
    <section aria-label="Station information" className="console-station flex flex-col items-center justify-center text-center w-full">
      <div className="console-station-icon" aria-hidden="true">
        <Home />
      </div>
      <p className="console-station-name" data-page-title>{resolvedName}</p>
      <div
        className={`console-station-time${stale ? ' console-station-stale' : ''}`}
        title={stale ? 'Station data is stale — check the station link' : undefined}
      >
        {formattedTime} <span className="console-station-sep" aria-hidden="true">|</span> {formattedDate}
        {stale && (
          <span className="console-station-stale-tag" role="status">
            <span aria-hidden="true"> · stale</span>
            <span className="sr-only">Station data is stale</span>
          </span>
        )}
      </div>
      <div className="console-station-weekday">{weekday}</div>
    </section>
  );
}
