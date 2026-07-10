import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useWeatherStore } from '../store.js';

export function getWindDirectionText(deg: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round((deg % 360) / 22.5) % 16;
  return directions[index];
}

export default function CompassRose() {
  const { wind_speed_last, wind_dir_last } = useWeatherStore((state) => state.weather);
  const config = useWeatherStore((state) => state.config);
  const [displaySpeed, setDisplaySpeed] = useState(wind_speed_last);
  const [displayDir, setDisplayDir] = useState(wind_dir_last);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

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

  // Disable the initial spin animation by waiting for the first real data payload
  useEffect(() => {
    if (isInitialLoad && (wind_dir_last !== 0 || wind_speed_last !== 0)) {
      // Snap to the value instantly on first load without spinning
      setDisplayDir(wind_dir_last);
      setDisplaySpeed(wind_speed_last);
      // Give a tiny delay before enabling smooth animations for subsequent updates
      setTimeout(() => setIsInitialLoad(false), 100);
    }
  }, [wind_dir_last, wind_speed_last, isInitialLoad]);

  useEffect(() => {
    // We create a subtle, smoothed aerodynamic flutter around the exact true values.
    const interval = setInterval(() => {
      // Small randomized flutter for speed (only if wind is blowing)
      setDisplaySpeed(() => {
        if (wind_speed_last === 0) return 0;
        const randomFlutter = (Math.random() * 0.2 - 0.1);
        return Number(Math.max(0, wind_speed_last + randomFlutter).toFixed(1));
      });

      // Smooth, realistic flutter for direction
      setDisplayDir(() => {
        if (wind_speed_last === 0) return wind_dir_last;

        // Aerodynamic flutter: Needle oscillates ± 2 degrees based on wind speed
        const flutterIntensity = Math.min(2, wind_speed_last * 0.1); // Max 2 degrees flutter
        const randomFlutter = (Math.random() * (flutterIntensity * 2)) - flutterIntensity;

        return Math.round((wind_dir_last + randomFlutter + 360) % 360);
      });
    }, 800); // 800ms updates for a smooth, high-framerate feel

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
      <div className="relative w-[220px] h-[220px] md:w-[300px] md:h-[300px] flex items-center justify-center">
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
          initial={{ rotate: displayDir }}
          animate={{ rotate: displayDir }}
          transition={isInitialLoad ? { duration: 0 } : { type: 'spring', stiffness: 35, damping: 14 }}
        >
          {/* Neutral Matte White Pointer Arrow pointing outward */}
          <div className="relative w-full h-full flex flex-col items-center">
            {/* Massive North pointing arrow */}
            <div className="absolute top-1 md:top-2 w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-b-[30px] border-b-white filter drop-shadow-[0_0_8px_rgba(255,255,255,0.9)]" />

            {/* Soft path line connecting center to arrow */}
            <div className="absolute top-8 md:top-10 bottom-1/2 w-[2px] bg-gradient-to-t from-transparent to-white/30" />

            {/* South tiny indicator tail */}
            <div className="absolute bottom-4 w-2 h-2 rounded-full bg-slate-700/80" />
          </div>
        </motion.div>

        {/* Central Wind Speed Readout Core */}
        <div className="absolute w-36 h-36 md:w-44 md:h-44 rounded-full bg-[#012a4a]/90 border-[3px] border-[#0353a4]/50 shadow-[0_8px_30px_rgba(0,180,216,0.3)] flex flex-col items-center justify-center select-none backdrop-blur-md">
          <span className="text-[11px] md:text-sm text-gray-400 font-sans tracking-widest font-bold uppercase -mt-2">
            WIND
          </span>

          <motion.span
            className="text-5xl md:text-7xl font-display font-bold text-white tracking-tighter leading-none mt-1"
            key={convertedSpeed}
            initial={{ opacity: 0.8 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {convertedSpeed.toFixed(1)}
          </motion.span>

          <span className="text-[11px] md:text-sm text-gray-300 font-mono font-bold tracking-widest mt-1">
            {windUnitLabel}
          </span>

          <span className="text-[11px] md:text-sm text-sky-200 font-bold tracking-widest uppercase mt-1.5 md:mt-2">
            {directionText} &middot; {displayDir}&deg;
          </span>
        </div>
      </div>
    </div>
  );
}
