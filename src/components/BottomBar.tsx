/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Settings, Volume2, VolumeX, AlertCircle, Maximize, Minimize } from 'lucide-react';
import { useWeatherStore } from '../store.js';

interface BottomBarProps {
  onOpenSettings: () => void;
}

export default function BottomBar({ onOpenSettings }: BottomBarProps) {
  const weather = useWeatherStore((state) => state.weather);
  const config = useWeatherStore((state) => state.config);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tickerIndex, setTickerIndex] = useState(0);

  // Authentic Davis consoles rotate through various interesting data points!
  const tickerMessages = [
    `High Rain Rate: ${weather.high_rain_rate_today.toFixed(2)}${config.unitRain === 'mm' ? 'mm/hr' : 'in/hr'} @ ${weather.high_rain_rate_time || '--'}`,
    `Outside Temperature: ${weather.temp.toFixed(1)}°${config.unitTemp}`,
    `Wind Speed: ${weather.wind_speed_last.toFixed(1)} ${config.unitWind}`,
    `Current Barometer: ${weather.bar_sea_level.toFixed(2)} ${config.unitBaro}`,
    `Dew Point: ${weather.dew_point.toFixed(1)}°${config.unitTemp}`
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % tickerMessages.length);
    }, 8000); // Rotate every 8 seconds exactly like the hardware
    return () => clearInterval(interval);
  }, [tickerMessages.length]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  return (
    <div className="w-full bg-[#030712]/90 border-t border-[#01497c]/30 px-4 py-1 flex items-center justify-between text-gray-400 text-xs md:text-sm font-sans select-none relative z-20">
      
      {/* Navigation Arrows */}
      <div className="flex items-center gap-1.5">
        <button 
          className="w-7 h-7 rounded-lg bg-gray-950/80 border border-gray-800 hover:border-gray-700 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
          title="Previous Page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button 
          className="w-7 h-7 rounded-lg bg-gray-950/80 border border-gray-800 hover:border-gray-700 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
          title="Next Page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Ticker / Banner message (Authentic Davis style rotating ticker) */}
      <div className="flex-1 mx-4 overflow-hidden flex items-center justify-center">
        <div className="whitespace-nowrap text-xs md:text-[13px] font-sans italic text-gray-300 tracking-wide font-medium transition-opacity duration-500">
          {config.stationName} - {tickerMessages[tickerIndex]}
        </div>
      </div>

      {/* Control Utility Buttons */}
      <div className="flex items-center gap-2">
        {/* Sound Toggle (faithfully replicates the physical console sound beep switch!) */}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
            soundEnabled 
              ? 'bg-sky-950/20 border-sky-500/20 text-sky-400 hover:border-sky-500/40' 
              : 'bg-gray-950/80 border-gray-800 text-gray-600 hover:border-gray-700'
          }`}
          title={soundEnabled ? 'Mute Console Beeps' : 'Enable Console Beeps'}
        >
          {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={toggleFullscreen}
          className="w-7 h-7 rounded-lg bg-gray-950/80 border border-gray-800 hover:border-gray-700 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
          title="Toggle Fullscreen Console"
        >
          {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
        </button>

        {/* Console System/Config settings */}
        <button
          onClick={onOpenSettings}
          className="w-7 h-7 rounded-lg bg-gray-950/80 border border-gray-800 hover:border-gray-700 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
          title="Console System Settings"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>



    </div>
  );
}
