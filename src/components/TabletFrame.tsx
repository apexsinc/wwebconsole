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
    <div className="w-full max-w-7xl mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-screen">
      {/* Outer Tablet Frame Bezel */}
      <div className="relative w-full bg-[#0a0a0a] rounded-[2rem] md:rounded-[3rem] p-4 md:p-8 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] border-4 border-[#1a1a1a] transition-all duration-300">
        
        {/* Reflection Glare */}
        <div className="absolute inset-0 rounded-[2rem] md:rounded-[3rem] bg-gradient-to-tr from-transparent via-white/2 to-transparent pointer-events-none" />

        {/* Top Camera Notch & Light Sensor */}
        <div className="absolute top-2 md:top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-none">
          <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[#0d0f14] shadow-inner border border-white/5" />
          <div className="w-1 h-1 rounded-full bg-[#1c4587]/30 animate-pulse-soft" />
        </div>

        {/* Inner Screen Shell */}
        <div className="relative w-full screen-bg rounded-[1.2rem] md:rounded-[2rem] overflow-hidden border border-white/10 flex flex-col justify-between min-h-[640px] md:min-h-[720px]">
          
          {/* Main Weather Console Content */}
          <div className="flex-1 flex flex-col relative z-10">
            {children}
          </div>

          {/* Ambient Grid Overlays */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/10 via-transparent to-transparent pointer-events-none" />
        </div>

        {/* Bottom Bezel "DAVIS" Logo and Status light */}
        <div className="relative mt-2 md:mt-5 flex items-center justify-between px-6 pointer-events-none">
          {/* Status Indicator */}
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${
              status === 'online' 
                ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' 
                : status === 'connecting'
                ? 'bg-amber-500 animate-pulse'
                : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]'
            }`} />
            <span className="text-[10px] text-gray-500 font-mono tracking-wider uppercase hidden md:inline">
              CONSOLE LINK: {status}
            </span>
          </div>

          {/* DAVIS Brand Logo */}
          <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
            <span className="text-white font-sans font-black tracking-[0.25em] text-sm md:text-lg select-none">
              DAVIS
            </span>
            <span className="text-[8px] text-gray-500 font-sans tracking-widest font-semibold uppercase -mt-0.5 select-none">
              WEATHERLINK
            </span>
          </div>

          {/* Sensor Info */}
          <div className="text-[9px] text-gray-500 font-mono text-right hidden md:block">
            VANTAGE PRO2 &middot; 868 MHZ
          </div>
        </div>
      </div>
    </div>
  );
}
