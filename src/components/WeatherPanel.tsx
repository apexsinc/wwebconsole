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
    // Dark console panel
    variantStyle = "bg-gray-950/65 border-gray-800 text-gray-100 glass-glow-dark";
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
    <div className={`flex flex-col w-full h-full justify-between gap-2 md:gap-3 ${className}`}>
      {/* Panel Top Header */}
      <div className="flex items-center justify-between w-full">
        <span className="text-[10px] md:text-xs font-sans font-semibold text-gray-400 uppercase tracking-wider select-none">
          {title}
        </span>
        {Icon && <Icon className={`w-4 h-4 md:w-[18px] md:h-[18px] ${iconColorClass}`} />}
      </div>

      {/* Main Big Readout value */}
      <div className="flex items-baseline gap-1 mt-1 group">
        <motion.span
          className="text-3xl md:text-4xl font-display font-bold text-white tracking-tight"
          key={value}
          initial={{ opacity: 0.7, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {value}
        </motion.span>
        {unit && (
          <span className="text-sm md:text-base font-semibold text-gray-400 font-sans ml-0.5 select-none">
            {unit}
          </span>
        )}

        {/* Refresh button that spins */}
        <button
          onClick={handleRefreshClick}
          className="ml-2 text-gray-600 hover:text-sky-400 cursor-pointer p-0.5 rounded-full transition-all focus:outline-none"
          title="Force refresh metric"
        >
          <motion.div animate={controls} className="origin-center">
            <RefreshCw className="w-3 h-3 md:w-3.5 md:h-3.5" />
          </motion.div>
        </button>
      </div>

      {/* Secondary Bottom Metric info */}
      {subValue !== undefined && (
        <div className="flex items-center gap-1.5 pt-2 border-t border-white/5 text-[11px] md:text-xs text-gray-400 select-none">
          {SubIcon && <SubIcon className="w-3 h-3 text-gray-500" />}
          {subLabel && <span className="font-medium text-gray-500">{subLabel}:</span>}
          <span className="text-white font-semibold">{subValue}</span>
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
