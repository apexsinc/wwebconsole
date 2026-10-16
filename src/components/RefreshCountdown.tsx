/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { useWeatherStore } from '../store';
import { triggerWeatherRefresh } from '../services/api';

interface RefreshCountdownProps {
  variant?: 'bezel' | 'taskbar';
  className?: string;
}

export function RefreshCountdown({ variant = 'bezel', className = '' }: RefreshCountdownProps) {
  const lastFetchedAt = useWeatherStore((state) => state.lastFetchedAt);
  const isRefreshing = useWeatherStore((state) => state.isRefreshing);
  const config = useWeatherStore((state) => state.config);
  const connection = useWeatherStore((state) => state.connection);

  // Davis WeatherLink Cloud API permissions:
  // Pro: publishes every 5 min (300s)
  // Basic: publishes every 15 min (900s)
  // V1: 60s
  const isV2 = config.cloudApiVersion !== 'v1';
  const defaultPollSec = isV2 ? (config.wlPlan === 'basic' ? 900 : 300) : 60;
  const pollIntervalSec = config.pollIntervalSec || defaultPollSec;

  const [secondsRemaining, setSecondsRemaining] = useState<number>(pollIntervalSec);

  const calculateRemaining = useCallback(() => {
    const now = Date.now();
    const anchor = lastFetchedAt || now;
    const elapsedSec = Math.floor((now - anchor) / 1000);
    const left = pollIntervalSec - elapsedSec;
    return Math.max(0, left);
  }, [lastFetchedAt, pollIntervalSec]);

  // Tick countdown every second
  useEffect(() => {
    setSecondsRemaining(calculateRemaining());
    const interval = setInterval(() => {
      setSecondsRemaining(calculateRemaining());
    }, 1000);
    return () => clearInterval(interval);
  }, [calculateRemaining]);

  const handleManualRefresh = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isRefreshing) return;
    try {
      await triggerWeatherRefresh(true);
    } catch (err) {
      console.error('Manual refresh failed:', err);
    }
  };

  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const formattedTime = `${mins}:${String(secs).padStart(2, '0')}`;
  const planLabel = config.wlPlan ? (config.wlPlan.toUpperCase() === 'PRO' ? 'PRO (5m)' : config.wlPlan.toUpperCase()) : 'PRO (5m)';

  if (variant === 'taskbar') {
    return (
      <button
        type="button"
        onClick={handleManualRefresh}
        disabled={isRefreshing}
        aria-label={`Refresh weather data. Next cloud sync in ${formattedTime}`}
        title={
          isRefreshing
            ? 'Fetching latest telemetry from WeatherLink Cloud...'
            : `Click to refresh weather data now (WeatherLink ${planLabel} sync in ${formattedTime})`
        }
        className={`h-[36px] px-2.5 rounded-xl bg-gray-950/80 border border-gray-800 hover:border-gray-700 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 text-slate-300 select-none ${
          isRefreshing ? 'opacity-70 cursor-wait' : ''
        } ${className}`}
      >
        <RefreshCw
          className={`w-3.5 h-3.5 ${
            isRefreshing ? 'animate-spin text-sky-400' : 'text-slate-400 hover:text-slate-200'
          }`}
          aria-hidden="true"
        />
        <span className="text-[11px] font-mono font-semibold tracking-wider text-slate-300">
          {isRefreshing ? 'SYNCING...' : formattedTime}
        </span>
      </button>
    );
  }

  // Hardware console bezel variant (located in bottom bezel next to CONSOLE LINK status)
  return (
    <button
      type="button"
      onClick={handleManualRefresh}
      disabled={isRefreshing}
      aria-label={`Refresh weather data. Next cloud sync in ${formattedTime}`}
      title={
        isRefreshing
          ? 'Fetching latest telemetry from WeatherLink Cloud...'
          : `Click to refresh weather data now (WeatherLink ${planLabel} sync in ${formattedTime})`
      }
      className={`group pointer-events-auto inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900/90 border border-slate-700/70 hover:border-sky-500/60 hover:bg-slate-800/90 text-slate-300 hover:text-white transition-all cursor-pointer select-none active:scale-95 shadow-[0_1px_4px_rgba(0,0,0,0.6)] focus:outline-none focus:ring-1 focus:ring-sky-500/50 ${
        isRefreshing ? 'opacity-80 cursor-wait' : ''
      } ${className}`}
    >
      <RefreshCw
        className={`w-2.5 h-2.5 transition-colors ${
          isRefreshing
            ? 'animate-spin text-sky-400'
            : 'text-slate-400 group-hover:text-sky-300'
        }`}
        aria-hidden="true"
      />
      <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-slate-400 group-hover:text-slate-200 transition-colors">
        {isRefreshing ? (
          <span className="text-sky-300 animate-pulse">SYNCING...</span>
        ) : (
          <>
            <span className="text-slate-500 mr-1 hidden sm:inline">REFRESH:</span>
            <span className="text-slate-300">{formattedTime}</span>
          </>
        )}
      </span>
    </button>
  );
}
