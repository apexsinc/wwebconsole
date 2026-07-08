/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { Home, CloudRain, ShieldCheck, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { useWeatherStore } from '../store.js';

export default function Header() {
  const { ts } = useWeatherStore((state) => state.weather);
  const config = useWeatherStore((state) => state.config);
  const status = useWeatherStore((state) => state.connection.status);
  
  // Real-time ticking system clock synced with the WLL system
  const [systemTime, setSystemTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setSystemTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format the time as requested: "12:52 pm | 12/14/22 Wednesday"
  // Note: if simulation mode is active, we can show the live system clock.
  // If we are showing the Davis weather station's actual packet timestamp, we format the "ts".
  const displayDate = config.isSimulationMode 
    ? systemTime 
    : new Date(ts * 1000);

  const formattedTime = format(displayDate, 'h:mm a');
  const formattedDate = format(displayDate, 'MM/dd/yy EEEE');

  return (
    <div className="flex flex-col gap-3 w-full border-b border-gray-800 pb-4 select-none">
      {/* Device Status Ribbons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[9px] md:text-[10px] bg-sky-950/40 border border-sky-500/15 text-sky-400 px-2 py-0.5 rounded-full font-mono uppercase tracking-wider">
          <Activity className="w-3 h-3 animate-pulse" />
          {config.isSimulationMode ? 'SIMULATOR ACTIVE' : 'LIVE WLL LINK'}
        </div>
        
        <div className="flex items-center gap-1 text-[9px] md:text-[10px] text-gray-500 font-mono">
          <ShieldCheck className="w-3 h-3 text-emerald-500/70" />
          SECURE UDP CONSOLE
        </div>
      </div>

      {/* Main Location/Time Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
        
        {/* Left Side: Station Location Name */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-950/30 border border-sky-500/20 flex items-center justify-center text-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.1)]">
            <Home className="w-4.5 h-4.5" />
          </div>
          <div>
            <h1 className="text-white font-sans font-bold text-base md:text-lg tracking-tight leading-none">
              Jim's Home
            </h1>
            <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">
              Davis Station #1
            </span>
          </div>
        </div>

        {/* Right Side: Davis Meteorological Forecast Condition & Timestamp */}
        <div className="flex items-center gap-4 sm:text-right">
          <div className="flex flex-col">
            <div className="text-sm md:text-base font-display font-semibold text-white tracking-tight leading-none">
              {formattedTime} <span className="text-gray-500 font-normal">|</span> {formattedDate}
            </div>
            <span className="text-[10px] text-gray-400 font-sans font-medium uppercase tracking-wider mt-1 block sm:text-right">
              Console Local Time
            </span>
          </div>

          {/* Forecast Animated Weather Icon */}
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-950/20 border border-blue-500/10 text-blue-400 filter drop-shadow-[0_0_8px_rgba(59,130,246,0.3)] animate-bounce-slow">
            <CloudRain className="w-5.5 h-5.5" />
          </div>
        </div>

      </div>
    </div>
  );
}
