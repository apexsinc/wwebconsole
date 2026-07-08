/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useWeatherStore } from '../store.js';

interface TabletFrameProps {
  children: React.ReactNode;
}

export default function TabletFrame({ children }: TabletFrameProps) {
  const status = useWeatherStore((state) => state.connection.status);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-2 flex flex-col items-center justify-center h-[calc(100vh-80px)] max-h-[calc(100vh-80px)] overflow-hidden">
      {/* Outer Tablet Bezel (Black rim, White inner bezel) */}
      <div className="relative w-full bg-white rounded-[1.5rem] md:rounded-[2.2rem] p-3 md:p-4 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.15)] border-[5px] border-black transition-all duration-300">

        {/* Reflection Glare */}
        <div className="absolute inset-0 rounded-[1.5rem] md:rounded-[2.2rem] bg-gradient-to-tr from-transparent via-black/5 to-transparent pointer-events-none" />

        {/* Top Camera Notch & Light Sensor */}
        <div className="absolute top-1.5 md:top-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 pointer-events-none">
          <div className="w-1.2 h-1.2 md:w-1.5 md:h-1.5 rounded-full bg-[#0d0f14] shadow-inner border border-black/10" />
          <div className="w-0.8 h-0.8 rounded-full bg-[#1c4587]/30 animate-pulse-soft" />
        </div>

        {/* Inner Screen Shell */}
        <div className="relative w-full screen-bg rounded-[1rem] md:rounded-[1.5rem] overflow-hidden border border-white/10 flex flex-col justify-between h-[calc(100vh-170px)] max-h-[calc(100vh-170px)]">

          {/* Main Weather Console Content */}
          <div className="flex-1 flex flex-col relative z-10 min-h-0 h-full">
            {children}
          </div>

          {/* Ambient Grid Overlays */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/10 via-transparent to-transparent pointer-events-none" />
        </div>

        {/* Bottom Bezel "DAVIS" Logo and Status light */}
        <div className="relative mt-1.5 md:mt-3 flex items-center justify-between px-6 pointer-events-none">
          {/* Status Indicator */}
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${status === 'online'
                ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                : status === 'connecting'
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]'
              }`} />
            <span className="text-[10px] text-black font-mono font-bold tracking-wider uppercase hidden md:inline">
              CONSOLE LINK: {status}
            </span>
          </div>

          {/* DAVIS Brand Logo */}
          <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
            <span className="text-black font-sans font-black tracking-[0.25em] text-sm md:text-lg select-none">
              DAVIS
            </span>
            <span className="text-[8px] text-black font-sans tracking-widest font-bold uppercase -mt-0.5 select-none">
              WEATHERLINK
            </span>
          </div>

          {/* Sensor Info */}
          <div className="text-[9px] text-black font-mono font-bold text-right hidden md:block">
            VANTAGE PRO2 &middot; 868 MHZ
          </div>
        </div>
      </div>
    </div>
  );
}
