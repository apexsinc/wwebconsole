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
import { motion, useReducedMotion } from 'motion/react';
import { useWeatherStore } from '../store.js';
import { convertWind, getWindUnit } from './units.js';
import { getWindDirectionText } from './windDirection.js';

export default function CompassRose() {
  const weather = useWeatherStore((state) => state.weather);
  const config = useWeatherStore((state) => state.config);
  const reduceMotion = useReducedMotion();

  const { wind_speed_last: speedMph, wind_dir_last: dirDeg } = weather;

  const convertedSpeed = convertWind(speedMph, config.unitWind);
  const windUnitLabel = getWindUnit(config.unitWind).toUpperCase();
  const directionText = getWindDirectionText(dirDeg);
  const hasFix = weather.ts > 0;
  const trail = useWeatherStore((s) => s.windDirHistory);

  // No-data state (before the first poll): hold still, no fabricated bearing.
  const shownDir = hasFix ? dirDeg : 0;

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
            ? `Wind ${directionText} at ${convertedSpeed.toFixed(1)} ${windUnitLabel}`
            : 'Wind direction unknown — waiting for station data'
        }
      >
        <span className="sr-only">
          {hasFix
            ? `Wind ${directionText} at ${convertedSpeed.toFixed(1)} ${windUnitLabel}`
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
            initial={{ rotate: shownDir }}
            animate={{ rotate: shownDir }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { type: 'tween', duration: 0.35, ease: 'easeOut' }
            }
          >
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
          <span className="compass-rose-abbrev text-[var(--con-disc-sub)] font-bold tracking-widest uppercase">
            {hasFix ? directionText : '--'}
          </span>

          <span className="compass-rose-speed font-bold text-[var(--con-disc-num)] tracking-tighter leading-none">
            {convertedSpeed.toFixed(1)}
          </span>

          <span className="compass-rose-unit text-[var(--con-disc-sub)] font-bold tracking-widest">
            {windUnitLabel}
          </span>
        </div>
        </div>
      </div>
    </div>
  );
}
