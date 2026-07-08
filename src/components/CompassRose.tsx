/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import { useWeatherStore } from '../store.js';

// Helper to convert degrees to cardinal/intercardinal direction names
export function getWindDirectionText(deg: number): string {
  const directions = [
    { label: 'N', min: 337.5, max: 360 },
    { label: 'N', min: 0, max: 22.5 },
    { label: 'NE', min: 22.5, max: 67.5 },
    { label: 'E', min: 67.5, max: 112.5 },
    { label: 'SE', min: 112.5, max: 157.5 },
    { label: 'S', min: 157.5, max: 202.5 },
    { label: 'SW', min: 202.5, max: 247.5 },
    { label: 'W', min: 247.5, max: 292.5 },
    { label: 'NW', min: 292.5, max: 337.5 },
  ];

  const found = directions.find((d) => {
    if (d.min > d.max) {
      // Handles northern crossing (337.5 to 22.5)
      return deg >= d.min || deg < d.max;
    }
    return deg >= d.min && deg < d.max;
  });

  return found ? found.label : 'N';
}

export default function CompassRose() {
  const { wind_speed_last, wind_dir_last } = useWeatherStore((state) => state.weather);

  const directionText = getWindDirectionText(wind_dir_last);

  // Compass layout configurations
  const points = [
    { label: 'N', angle: 0 },
    { label: 'NE', angle: 45 },
    { label: 'E', angle: 90 },
    { label: 'SE', angle: 135 },
    { label: 'S', angle: 180 },
    { label: 'SW', angle: 225 },
    { label: 'W', angle: 270 },
    { label: 'NW', angle: 315 },
  ];

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="relative w-64 h-64 md:w-72 md:h-72 flex items-center justify-center">
        {/* Subtle Outer Ring Gradient & Ticks */}
        <div className="absolute inset-0 rounded-full border border-gray-800 bg-radial from-[#121622] via-[#090b11] to-[#040508] shadow-[inset_0_4px_12px_rgba(0,0,0,0.8)]" />
        
        {/* Animated Gradient Outer Active Ring */}
        <div className="absolute inset-2 rounded-full border border-sky-500/20" />

        {/* Ticks around the circle */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100">
          <defs>
            <radialGradient id="grad1" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1e293b" stopOpacity="0" />
              <stop offset="90%" stopColor="#38bdf8" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.2" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="45" fill="url(#grad1)" stroke="#1e293b" strokeWidth="0.5" />
          
          {/* Compass Graduation Ticks (every 15 degrees) */}
          {Array.from({ length: 24 }).map((_, i) => {
            const angle = i * 15;
            const isMajor = angle % 90 === 0;
            const isMedium = angle % 45 === 0 && !isMajor;
            const r1 = isMajor ? 41 : isMedium ? 42.5 : 43.5;
            const r2 = 45;
            const x1 = 50 + r1 * Math.sin((angle * Math.PI) / 180);
            const y1 = 50 - r1 * Math.cos((angle * Math.PI) / 180);
            const x2 = 50 + r2 * Math.sin((angle * Math.PI) / 180);
            const y2 = 50 - r2 * Math.cos((angle * Math.PI) / 180);

            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={isMajor ? '#38bdf8' : isMedium ? '#64748b' : '#334155'}
                strokeWidth={isMajor ? 0.75 : 0.5}
              />
            );
          })}
        </svg>

        {/* Compass Cardinal and Intercardinal Labels */}
        {points.map((pt) => {
          const r = 35; // Radius to place labels
          const rad = (pt.angle * Math.PI) / 180;
          const x = 50 + r * Math.sin(rad);
          const y = 50 - r * Math.cos(rad);
          const isMain = ['N', 'S', 'E', 'W'].includes(pt.label);
          const isCurrentDir = pt.label === directionText;

          return (
            <div
              key={pt.label}
              className="absolute text-[10px] md:text-xs font-bold tracking-tight select-none transition-all duration-300"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: 'translate(-50%, -50%)',
                color: isCurrentDir 
                  ? '#38bdf8' 
                  : isMain 
                  ? '#cbd5e1' 
                  : '#475569',
                textShadow: isCurrentDir ? '0 0 8px rgba(56, 189, 248, 0.4)' : 'none'
              }}
            >
              {pt.label}
            </div>
          );
        })}

        {/* Animated Direction Needle Pointer */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          animate={{ rotate: wind_dir_last }}
          transition={{ type: 'spring', stiffness: 45, damping: 12 }}
        >
          {/* Neon Pointer Arrow pointing outward */}
          <div className="relative w-full h-full flex flex-col items-center">
            {/* North pointing arrow */}
            <div className="absolute top-10 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[18px] border-b-sky-500 filter drop-shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
            
            {/* Soft path line connecting center to arrow */}
            <div className="absolute top-14 bottom-1/2 w-[1px] bg-gradient-to-t from-transparent to-sky-500/40" />

            {/* South tiny indicator tail */}
            <div className="absolute bottom-10 w-1.5 h-1.5 rounded-full bg-slate-600/50" />
          </div>
        </motion.div>

        {/* Central Wind Speed Readout Core */}
        <div className="absolute w-28 h-28 md:w-32 md:h-32 rounded-full bg-[#050608] border border-gray-800 shadow-[0_4px_16px_rgba(0,0,0,0.6)] flex flex-col items-center justify-center select-none">
          <span className="text-[10px] text-gray-500 font-sans tracking-widest font-semibold uppercase -mt-2">
            WIND
          </span>
          
          <motion.span 
            className="text-3xl md:text-4xl font-display font-bold text-white tracking-tight leading-none mt-1"
            key={wind_speed_last}
            initial={{ opacity: 0.6, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            {wind_speed_last.toFixed(1)}
          </motion.span>
          
          <span className="text-[10px] text-sky-400 font-mono font-medium tracking-wider mt-0.5">
            MPH
          </span>

          <span className="text-xs text-gray-300 font-semibold tracking-wider uppercase mt-1">
            {directionText} &middot; {wind_dir_last}&deg;
          </span>
        </div>
      </div>
    </div>
  );
}
