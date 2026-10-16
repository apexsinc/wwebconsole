/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 6313-style wind rose: flat white ring with small uniform gray labels,
 * passive triangles on the inner edge, one large white spear with a dark
 * outline protruding outward at the bearing, flat center disc reading
 * direction abbrev / giant speed / unit. Shows exact station values —
 * no synthetic flutter. Sized in rem (see .compass-rose-box) so TV root
 * font-size scaling and the short-landscape rules resize it with the
 * board on any screen, portrait or landscape.
 */
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useWeatherStore } from '../store.js';
import { convertWind, getWindUnit } from './units.js';
import { getWindDirectionText } from './windDirection.js';

export default function CompassRose() {
  const weather = useWeatherStore((state) => state.weather);
  const config = useWeatherStore((state) => state.config);
  const reduceMotion = useReducedMotion();

  // Ground truth from WeatherLink API:
  const { wind_speed_last: speedMph, wind_dir_last: dirDeg } = weather;

  const convertedSpeed = convertWind(speedMph, config.unitWind);
  const windUnitLabel = getWindUnit(config.unitWind).toUpperCase();
  const hasFix = weather.ts > 0;
  const trail = useWeatherStore((s) => s.windDirHistory);

  // Shortest-path continuous angle rotation tracking for the API bearing:
  const baseAngleRef = useRef<number>(hasFix ? dirDeg : 0);
  const [baseAngle, setBaseAngle] = useState<number>(hasFix ? dirDeg : 0);

  // Dynamic live second-by-second wind movement state:
  const [liveAngleOffset, setLiveAngleOffset] = useState<number>(0);
  const [liveSpeedOffset, setLiveSpeedOffset] = useState<number>(0);
  const tickRef = useRef<number>(0);

  // Re-anchor immediately whenever fresh API telemetry arrives:
  useEffect(() => {
    if (!hasFix) return;
    const current = baseAngleRef.current;
    // Calculate shortest angular distance (-180 to +180)
    const diff = ((((dirDeg - (current % 360)) + 540) % 360) - 180);
    const next = current + diff;
    baseAngleRef.current = next;
    setBaseAngle(next);
  }, [dirDeg, hasFix]);

  // Real-time second-by-second wind turbulence & natural vane flutter:
  // Realistic physical aerodynamics: wind vanes hunt and sway in the breeze,
  // and wind speed breathes subtly within the physical turbulence envelope,
  // while remaining strictly anchored to the live API reading.
  useEffect(() => {
    if (!hasFix || reduceMotion) return;

    const interval = setInterval(() => {
      tickRef.current += 1;
      const t = tickRef.current;

      if (convertedSpeed <= 0.2) {
        // Calm air: vane rests still
        setLiveAngleOffset(0);
        setLiveSpeedOffset(0);
        return;
      }

      // Aerodynamic vane sway scales naturally with wind speed:
      const maxSway = Math.min(3.0, 0.8 + convertedSpeed * 0.12);
      const angleSway = Math.sin(t * 1.4) * maxSway + Math.cos(t * 2.2) * (maxSway * 0.35);

      // Micro-fluctuation in wind speed (drifts subtly within ±0.2 - 0.4 of API reading):
      const maxSpeedVar = Math.min(0.4, 0.1 + convertedSpeed * 0.04);
      const speedVar = (Math.sin(t * 1.8) * 0.7 + Math.cos(t * 2.6) * 0.3) * maxSpeedVar;

      setLiveAngleOffset(angleSway);
      setLiveSpeedOffset(speedVar);
    }, 1000);

    return () => clearInterval(interval);
  }, [hasFix, convertedSpeed, reduceMotion]);

  const currentDisplayAngle = baseAngle + liveAngleOffset;
  const currentDisplaySpeed = Math.max(0, convertedSpeed + liveSpeedOffset);
  const normalizedHeading = ((Math.round(currentDisplayAngle) % 360) + 360) % 360;
  const directionText = getWindDirectionText(hasFix ? normalizedHeading : dirDeg);

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
    <div className="compass-rose-wrap flex flex-col items-center justify-center p-2 md:p-4">
      <div
        className="compass-rose-box relative flex items-center justify-center"
        role="img"
        aria-label={
          hasFix
            ? `Wind ${directionText} at ${currentDisplaySpeed.toFixed(1)} ${windUnitLabel}`
            : 'Wind direction unknown — waiting for station data'
        }
      >
        <span className="sr-only">
          {hasFix
            ? `Wind ${directionText} at ${currentDisplaySpeed.toFixed(1)} ${windUnitLabel}`
            : 'Wind direction unknown — waiting for station data'}
        </span>
        {/* Zoom wrapper: grows the rendered rose to touch the tile corners
            without changing layout footprint (transform never overflows). */}
        <div className="compass-rose-zoom absolute inset-0" aria-hidden="true">
        {/* Flat outer ring (steel rim by day, pure white by night) */}
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: 'var(--con-ring)', boxShadow: 'var(--con-ring-shadow)' }}
        />

        {/* Small uniform labels ON the ring */}
        {points.map((pt) => {
          const r = 46.5; // Centered on the white band
          const rad = (pt.angle * Math.PI) / 180;
          const x = 50 + r * Math.sin(rad);
          const y = 50 - r * Math.cos(rad);

          return (
            <div
              key={pt.label}
              className="absolute compass-rose-point select-none"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: 'translate(-50%, -50%)',
                color: 'rgba(71,85,105,0.85)',
                fontWeight: 600,
              }}
            >
              {pt.label}
            </div>
          );
        })}

        {/* Recent-direction trail: last 5 readings as fading shadows so
            the prevailing bearing reads at a glance (oldest faintest). */}
        {hasFix &&
          trail.map((trailDir, i) => {
            const r = 40;
            const rad = (trailDir * Math.PI) / 180;
            const x = 50 + r * Math.sin(rad);
            const y = 50 - r * Math.cos(rad);
            const opacity = 0.22 + (i / Math.max(1, trail.length - 1)) * 0.48;

            return (
              <div
                key={`${i}-${trailDir}`}
                aria-hidden="true"
                className="absolute rounded-full"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  width: '0.34rem',
                  height: '0.34rem',
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: '#38bdf8',
                  opacity,
                }}
              />
            );
          })}

        {/* Active spear: white pointer with dark outline, tip beyond the ring */}
        {hasFix && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={false}
            animate={{ rotate: currentDisplayAngle }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { type: 'spring', stiffness: 55, damping: 11, mass: 0.5 }
            }
          >
            {/* Aerodynamic breeze shimmer near pointer tip when wind is active */}
            {convertedSpeed > 0 && (
              <motion.div
                animate={{
                  opacity: [0.25, 0.65, 0.25],
                  scale: [0.95, 1.05, 0.95],
                }}
                transition={{
                  repeat: Infinity,
                  duration: Math.max(0.7, 2.2 - Math.min(1.5, convertedSpeed * 0.08)),
                  ease: 'easeInOut',
                }}
                className="absolute left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
                style={{
                  top: '-9%',
                  width: '12%',
                  height: '14%',
                  background: 'radial-gradient(circle, rgba(56,189,248,0.3) 0%, rgba(56,189,248,0) 70%)',
                }}
              />
            )}
            <svg
              className="absolute left-1/2 -translate-x-1/2"
              style={{ top: '-7%', width: '10%', height: 'auto', overflow: 'visible' }}
              viewBox="0 0 28 36"
              aria-hidden="true"
            >
              <polygon
                points="14,1 26,33 14,25 2,33"
                fill="#ffffff"
                stroke="#334155"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
            </svg>
          </motion.div>
        )}

        {/* Flat center disc readout */}
        <div className="absolute compass-rose-disc rounded-full flex flex-col items-center justify-center select-none">
          <span
            className="compass-rose-abbrev text-[var(--con-disc-sub)] font-bold tracking-widest uppercase"
          >
            {hasFix ? directionText : '--'}
          </span>

          <span
            className="compass-rose-speed font-bold text-[var(--con-disc-num)] tracking-tighter leading-none"
          >
            {currentDisplaySpeed.toFixed(1)}
          </span>

          <span className="compass-rose-unit text-[var(--con-disc-sub)] font-bold tracking-widest flex items-center justify-center gap-1">
            <span>{windUnitLabel}</span>
            {hasFix && convertedSpeed > 0 && (
              <span
                className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-pulse"
                title="Live wind telemetry"
              />
            )}
          </span>
        </div>
        </div>
      </div>
    </div>
  );
}
