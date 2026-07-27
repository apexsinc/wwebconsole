/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { Home, CloudRain, ShieldCheck, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { useWeatherStore } from '../store.js';

export default function Header() {
  const { ts, stationName, stationDid } = useWeatherStore((state) => state.weather);
  const config = useWeatherStore((state) => state.config);
  const connection = useWeatherStore((state) => state.connection);
  
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
  const formattedDate = format(displayDate, 'MM/dd/yy EEEE');

  return (
    <div className="flex flex-col items-center justify-center text-center gap-2 w-full border-b border-gray-850 pb-2 select-none">
      {/* Centered Home Icon */}
      <div className="w-8 h-8 rounded-lg bg-sky-950/30 border border-sky-500/20 flex items-center justify-center text-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.1)]">
        <Home className="w-4.5 h-4.5" />
      </div>

      {/* Station Name */}
      <h1 className="text-white font-sans font-bold text-base md:text-lg tracking-tight leading-none mt-0.5">
        {stationName || "Jim's Home"}
      </h1>

      {/* Time & Date Display */}
      <div className="flex flex-col items-center mt-1 text-center">
        <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-0.5">
          Last Updated
        </span>
        <div className="text-xs md:text-sm font-sans font-semibold text-gray-300 tracking-tight leading-none">
          {formattedTime} <span className="text-gray-500 font-normal mx-1">|</span> {formattedDate}
        </div>
      </div>
    </div>
  );
}
