/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Settings, Volume2, VolumeX, AlertCircle } from 'lucide-react';
import { useWeatherStore } from '../store.js';

interface BottomBarProps {
  onOpenSettings: () => void;
}

export default function BottomBar({ onOpenSettings }: BottomBarProps) {
  const { high_rain_rate_today, high_rain_rate_time } = useWeatherStore((state) => state.weather);
  const [soundEnabled, setSoundEnabled] = useState(true);

  return (
    <div className="w-full bg-[#030712]/90 border-t border-[#01497c]/30 px-4 py-3 flex items-center justify-between text-gray-400 text-xs md:text-sm font-sans select-none relative z-20">
      
      {/* Navigation Arrows */}
      <div className="flex items-center gap-1.5">
        <button 
          className="w-8 h-8 rounded-lg bg-gray-950/80 border border-gray-800 hover:border-gray-700 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
          title="Previous Page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button 
          className="w-8 h-8 rounded-lg bg-gray-950/80 border border-gray-800 hover:border-gray-700 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
          title="Next Page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Ticker / Banner message marquee */}
      <div className="flex-1 mx-4 max-w-xl h-8 rounded-lg bg-[#010f1c]/80 border border-[#01497c]/20 flex items-center overflow-hidden relative">
        <div className="absolute left-2 flex items-center gap-1 text-sky-400 font-mono text-[9px] uppercase font-bold tracking-wider z-10 bg-[#010f1c] pr-2 shadow-[4px_0_8px_rgba(1,15,28,1)]">
          <AlertCircle className="w-3.5 h-3.5 animate-pulse" />
          ALERT:
        </div>
        
        {/* Scrolling LED status bar */}
        <div className="flex-1 overflow-hidden whitespace-nowrap pl-16">
          <div className="inline-block animate-marquee text-[11px] md:text-xs font-mono text-gray-300">
            Jim's Home &middot; High Rain Rate: <span className="text-sky-400 font-bold">{high_rain_rate_today.toFixed(2)} in/hr</span> @ {high_rain_rate_time} &middot; Station Status: <span className="text-sky-400">Nominal</span> &middot; RSSI: <span className="text-gray-400">-48dBm</span> &middot; Battery: <span className="text-sky-400">Ok</span>
          </div>
        </div>
      </div>

      {/* Control Utility Buttons */}
      <div className="flex items-center gap-2">
        {/* Sound Toggle (faithfully replicates the physical console sound beep switch!) */}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
            soundEnabled 
              ? 'bg-sky-950/20 border-sky-500/20 text-sky-400 hover:border-sky-500/40' 
              : 'bg-gray-950/80 border-gray-800 text-gray-600 hover:border-gray-700'
          }`}
          title={soundEnabled ? 'Mute Console Beeps' : 'Enable Console Beeps'}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {/* Console System/Config settings */}
        <button
          onClick={onOpenSettings}
          className="w-8 h-8 rounded-lg bg-gray-950/80 border border-gray-800 hover:border-gray-700 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
          title="Console System Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Custom Keyframe Styles injected for Marquee */}
      <style>{`
        @keyframes marquee {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
        .animate-marquee {
          display: inline-block;
          animation: marquee 25s linear infinite;
        }
      `}</style>

    </div>
  );
}
