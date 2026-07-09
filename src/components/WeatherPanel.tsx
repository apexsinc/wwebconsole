/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, useAnimation } from 'motion/react';
import { RefreshCw, LucideIcon } from 'lucide-react';

interface GlassPanelProps {
  children: React.ReactNode;
  variant: 'purple' | 'blue' | 'dark';
  className?: string;
}

export function GlassPanel({ children, variant, className = '' }: GlassPanelProps) {
  const baseStyle = "backdrop-blur-xl border rounded-2xl p-4 md:p-5 flex flex-col justify-between transition-all duration-300 hover:scale-[1.015]";

  let variantStyle = "";
  if (variant === 'purple') {
    // Purple tinted glass
    variantStyle = "bg-purple-950/15 border-purple-500/10 text-purple-100 hover:border-purple-500/25 glass-glow-purple";
  } else if (variant === 'blue') {
    // Blue tinted glass
    variantStyle = "bg-sky-950/15 border-sky-500/10 text-sky-100 hover:border-sky-500/25 glass-glow-blue";
  } else {
    // Semi-light version of the center column's #0e1930 color
    variantStyle = "bg-[#162a4f]/80 border-[#01497c]/60 text-gray-100 shadow-xl hover:border-[#01497c]/90";
  }

  return (
    <div className={`${baseStyle} ${variantStyle} ${className}`}>
      {children}
    </div>
  );
}

interface WeatherMetricProps {
  title: string;
  value: string | number;
  unit?: string;
  icon?: LucideIcon;
  subValue?: string | number;
  subUnit?: string;
  subLabel?: string;
  subIcon?: LucideIcon;
  onRefresh?: () => void;
  className?: string;
  iconColorClass?: string;
}

export function WeatherMetric({
  title,
  value,
  unit = '',
  icon: Icon,
  subValue,
  subUnit = '',
  subLabel,
  subIcon: SubIcon,
  onRefresh,
  className = '',
  iconColorClass = 'text-sky-400'
}: WeatherMetricProps) {
  const [isRotating, setIsRotating] = useState(false);
  const controls = useAnimation();

  const handleRefreshClick = async () => {
    if (isRotating) return;
    setIsRotating(true);
    if (onRefresh) {
      onRefresh();
    }
    await controls.start({
      rotate: 360,
      transition: { duration: 0.8, ease: 'easeInOut' }
    });
    controls.set({ rotate: 0 });
    setIsRotating(false);
  };

  return (
    <div className={`grid grid-cols-2 w-full h-full gap-2 md:gap-4 relative ${className}`}>

      {/* Centered Divider Icon (User Request) */}
      {Icon && (
        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-0.5 z-10 flex items-center justify-center bg-[#061122] rounded-full p-1 border border-white/10 shadow-sm">
          <Icon className={`w-3.5 h-3.5 md:w-4 md:h-4 lg:w-5 lg:h-5 xl:w-6 xl:h-6 ${iconColorClass}`} />
        </div>
      )}

      {/* Primary Metric (Left) */}
      <div className="flex flex-col justify-between h-full pr-2">
        <div className="flex items-center w-full">
          <span className="text-[10px] sm:text-[11px] md:text-xs lg:text-sm xl:text-base 2xl:text-lg font-sans font-bold text-gray-400 uppercase tracking-wide select-none leading-tight">
            {title}
          </span>
        </div>

        <div className="flex items-baseline gap-1 mt-1">
          <motion.span
            className="text-3xl sm:text-4xl md:text-[2.75rem] lg:text-[2.75rem] xl:text-5xl 2xl:text-[3rem] font-display font-bold text-white tracking-tight leading-none"
            key={value}
            initial={{ opacity: 0.7, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {value}
          </motion.span>
          {unit && (
            <span className="text-sm md:text-base lg:text-base xl:text-lg 2xl:text-xl font-semibold text-gray-400 font-sans ml-0.5 lg:ml-1 select-none">
              {unit}
            </span>
          )}
        </div>
      </div>

      {/* Secondary Metric (Right) */}
      {subValue !== undefined && (
        <div className="flex flex-col justify-between h-full pl-2 md:pl-4 border-l border-white/5">
          <div className="flex items-center w-full">
            <span className="text-[10px] sm:text-[11px] md:text-xs lg:text-sm xl:text-base 2xl:text-lg font-sans font-bold text-gray-400 uppercase tracking-wide select-none leading-tight pl-2 lg:pl-3">
              {subLabel}
            </span>
          </div>

          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-3xl sm:text-4xl md:text-[2.75rem] lg:text-[2.75rem] xl:text-5xl 2xl:text-[3rem] font-display font-bold text-white tracking-tight leading-none">
              {subValue}
            </span>
            {subUnit && (
              <span className="text-sm md:text-base lg:text-base xl:text-lg 2xl:text-xl font-semibold text-gray-400 font-sans ml-0.5 lg:ml-1 select-none">
                {subUnit}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface HumidityRingProps {
  value: number; // Humidity (e.g. 64.1)
  size?: number;
}

export function HumidityRing({ value, size = 52 }: HumidityRingProps) {
  const radius = size / 2 - 4;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Background Track Circle */}
      <svg className="absolute w-full h-full transform -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="stroke-gray-800"
          strokeWidth="3.5"
          fill="transparent"
        />
        {/* Glow-tinted Green Percentage indicator */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="stroke-[#00b4d8] filter drop-shadow-[0_0_4px_rgba(0,180,216,0.5)]"
          strokeWidth="3.5"
          fill="transparent"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          strokeLinecap="round"
        />
      </svg>
      {/* Percent Inner Text Readout */}
      <span className="text-[10px] md:text-[11px] font-mono font-bold text-emerald-400 select-none">
        {Math.round(value)}%
      </span>
    </div>
  );
}
