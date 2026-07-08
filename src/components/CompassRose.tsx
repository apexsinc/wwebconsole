import { useState, useEffect } from 'react';
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
  const config = useWeatherStore((state) => state.config);
  const [displaySpeed, setDisplaySpeed] = useState(wind_speed_last);
  const [displayDir, setDisplayDir] = useState(wind_dir_last);

  const convertWind = (speedMph: number, unit?: 'mph' | 'kmh' | 'kts' | 'ms') => {
    if (unit === 'kmh') return speedMph * 1.60934;
    if (unit === 'kts') return speedMph * 0.868976;
    if (unit === 'ms') return speedMph * 0.44704;
    return speedMph;
  };
  const getWindUnit = (unit?: 'mph' | 'kmh' | 'kts' | 'ms') => {
    if (unit === 'kmh') return 'KM/H';
    if (unit === 'kts') return 'KTS';
    if (unit === 'ms') return 'M/S';
    return 'MPH';
  };

  const convertedSpeed = convertWind(displaySpeed, config.unitWind);
  const windUnitLabel = getWindUnit(config.unitWind);

  useEffect(() => {
    setDisplaySpeed(wind_speed_last);
    setDisplayDir(wind_dir_last);
  }, [wind_speed_last, wind_dir_last]);

  useEffect(() => {
    // Dynamic real-time micro-drift every 1.2 seconds to make the compass feel alive
    const interval = setInterval(() => {
      setDisplaySpeed((prev) => {
        const diff = wind_speed_last - prev;
        const drift = (Math.random() * 0.4 - 0.2) + diff * 0.15;
        const newSpeed = prev + drift;
        return Number(Math.max(0, newSpeed).toFixed(1));
      });

      setDisplayDir((prev) => {
        let diff = wind_dir_last - prev;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        const drift = (Math.random() * 6 - 3) + diff * 0.15;
        return Math.round((prev + drift + 360) % 360);
      });
    }, 1200);

    return () => clearInterval(interval);
  }, [wind_speed_last, wind_dir_last]);

  const directionText = getWindDirectionText(displayDir);

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
      <div className="relative w-44 h-44 md:w-52 md:h-52 flex items-center justify-center">
        {/* Slate-Blue Translucent Outer Bezel Ring */}
        <div className="absolute inset-0 rounded-full border border-[#01497c]/35 bg-[#013a63]/70 shadow-[inset_0_4px_12px_rgba(0,0,0,0.6)]" />
        
        {/* Ticks SVG Overlay */}
        <svg className="absolute w-full h-full transform -rotate-90 pointer-events-none" viewBox="0 0 100 100">
          {Array.from({ length: 72 }).map((_, i) => {
            const angle = i * 5;
            const isMajor = angle % 90 === 0;
            const isMedium = angle % 45 === 0 && !isMajor;
            
            // Outer tick radius (45%) to inner tick radius
            const r1 = 45;
            const r2 = isMajor ? 39 : isMedium ? 41 : 43;
            
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
                stroke={isMajor ? 'rgba(255,255,255,0.45)' : isMedium ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)'}
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
                  ? '#ffffff' 
                  : isMain 
                  ? 'rgba(255, 255, 255, 0.85)' 
                  : 'rgba(255, 255, 255, 0.45)',
                textShadow: isCurrentDir ? '0 0 6px rgba(255, 255, 255, 0.6)' : '0 10px 3px rgba(0,0,0,0.3)'
              }}
            >
              {pt.label}
            </div>
          );
        })}

        {/* Animated Direction Needle Pointer */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          animate={{ rotate: displayDir }}
          transition={{ type: 'spring', stiffness: 35, damping: 14 }}
        >
          {/* Neutral Matte White Pointer Arrow pointing outward */}
          <div className="relative w-full h-full flex flex-col items-center">
            {/* North pointing arrow */}
            <div className="absolute top-6 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[15px] border-b-white filter drop-shadow-[0_0_4px_rgba(255,255,255,0.5)]" />
            
            {/* Soft path line connecting center to arrow */}
            <div className="absolute top-10 bottom-1/2 w-[1px] bg-gradient-to-t from-transparent to-white/20" />

            {/* South tiny indicator tail */}
            <div className="absolute bottom-6 w-1.5 h-1.5 rounded-full bg-slate-700/50" />
          </div>
        </motion.div>

        {/* Central Wind Speed Readout Core */}
        <div className="absolute w-24 h-24 md:w-28 md:h-28 rounded-full bg-[#012a4a]/90 border border-[#0353a4]/35 shadow-[0_4px_16px_rgba(0,0,0,0.6)] flex flex-col items-center justify-center select-none">
          <span className="text-[10px] text-gray-500 font-sans tracking-widest font-semibold uppercase -mt-1.5">
            WIND
          </span>
          
          <motion.span 
            className="text-3xl md:text-4xl font-display font-bold text-white tracking-tight leading-none mt-0.5"
            key={convertedSpeed}
            initial={{ opacity: 0.8 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {convertedSpeed.toFixed(1)}
          </motion.span>
          
          <span className="text-[9px] text-gray-400 font-mono font-medium tracking-wider mt-0.5">
            {windUnitLabel}
          </span>

          <span className="text-[10px] text-gray-300 font-semibold tracking-wider uppercase mt-1">
            {directionText} &middot; {displayDir}&deg;
          </span>
        </div>
      </div>
    </div>
  );
}
