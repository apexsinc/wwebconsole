import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Settings, Volume2, VolumeX, Maximize, Minimize, Play, Pause } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useWeatherStore } from '../store.js';

interface BottomBarProps {
  onOpenSettings: () => void;
}

export default function BottomBar({ onOpenSettings }: BottomBarProps) {
  const weather = useWeatherStore((state) => state.weather);
  const weatherList = useWeatherStore((state) => state.weatherList);
  const currentStationIndex = useWeatherStore((state) => state.currentStationIndex);
  const autoSlideEnabled = useWeatherStore((state) => state.autoSlideEnabled);
  const nextStation = useWeatherStore((state) => state.nextStation);
  const prevStation = useWeatherStore((state) => state.prevStation);
  const toggleAutoSlide = useWeatherStore((state) => state.toggleAutoSlide);
  const config = useWeatherStore((state) => state.config);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tickerIndex, setTickerIndex] = useState(0);

  const convertTemp = (tempF: number, unit?: 'F' | 'C') => (unit === 'C' ? ((tempF - 32) * 5) / 9 : tempF);
  const getTempUnit = (unit?: 'F' | 'C') => (unit === 'C' ? '°C' : '°F');

  const convertWind = (speedMph: number, unit?: 'mph' | 'kmh' | 'kts' | 'ms') => {
    if (unit === 'kmh') return speedMph * 1.60934;
    if (unit === 'kts') return speedMph * 0.868976;
    if (unit === 'ms') return speedMph * 0.44704;
    return speedMph;
  };
  const getWindUnit = (unit?: 'mph' | 'kmh' | 'kts' | 'ms') => {
    if (unit === 'kmh') return 'km/h';
    if (unit === 'kts') return 'kts';
    if (unit === 'ms') return 'm/s';
    return 'mph';
  };

  const convertBaro = (baroInHg: number, unit?: 'inHg' | 'hPa' | 'mmHg' | 'mb') => {
    if (unit === 'hPa' || unit === 'mb') return baroInHg * 33.8639;
    if (unit === 'mmHg') return baroInHg * 25.4;
    return baroInHg;
  };
  const getBaroUnit = (unit?: 'inHg' | 'hPa' | 'mmHg' | 'mb') => {
    if (unit === 'hPa') return 'hPa';
    if (unit === 'mb') return 'mb';
    if (unit === 'mmHg') return 'mm Hg';
    return 'in Hg';
  };

  const convertRain = (rainInches: number, unit?: 'in' | 'mm') => (unit === 'mm' ? rainInches * 25.4 : rainInches);
  const getRainUnit = (unit?: 'in' | 'mm') => (unit === 'mm' ? 'mm' : 'in');

  // Authentic Davis consoles rotate through various interesting data points!
  const tickerMessages = [
    `High Rain Rate: ${convertRain(weather.high_rain_rate_today, config.unitRain).toFixed(config.unitRain === 'mm' ? 1 : 2)} ${getRainUnit(config.unitRain)}/hr @ ${weather.high_rain_rate_time || '--'}`,
    `Outside Temperature: ${convertTemp(weather.temp, config.unitTemp).toFixed(1)}${getTempUnit(config.unitTemp)}`,
    `Wind Speed: ${convertWind(weather.wind_speed_last, config.unitWind).toFixed(1)} ${getWindUnit(config.unitWind)}`,
    `Current Barometer: ${convertBaro(weather.bar_sea_level, config.unitBaro).toFixed(config.unitBaro === 'inHg' || config.unitBaro === 'mmHg' ? 2 : 1)} ${getBaroUnit(config.unitBaro)}`,
    `Dew Point: ${convertTemp(weather.dew_point, config.unitTemp).toFixed(1)}${getTempUnit(config.unitTemp)}`
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % tickerMessages.length);
    }, 8000); // Rotate every 8 seconds exactly like the hardware
    return () => clearInterval(interval);
  }, [tickerMessages.length]);

  // Auto-slide between multi-DID stations if 2 or more devices exist
  useEffect(() => {
    if (!autoSlideEnabled || weatherList.length <= 1) return;
    const slideInterval = setInterval(() => {
      nextStation();
    }, 5 * 60 * 1000); // Auto-slide every 5 minutes
    return () => clearInterval(slideInterval);
  }, [autoSlideEnabled, weatherList.length, nextStation]);

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

  const hasMultipleDevices = weatherList.length > 1;

  return (
    <div className="w-full bg-[#030712]/90 border-t border-[#01497c]/30 px-4 py-1 flex items-center justify-between text-gray-400 text-xs md:text-sm font-sans select-none relative z-20">
      
      {/* Navigation Arrows & Device Slide Controls */}
      <div className="flex items-center gap-1.5 z-20">
        <button 
          onClick={prevStation}
          disabled={!hasMultipleDevices}
          className="w-7 h-7 rounded-lg bg-gray-950/80 border border-gray-800 hover:border-gray-700 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          title={hasMultipleDevices ? "Previous Weather Station" : "Previous Page"}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button 
          onClick={nextStation}
          disabled={!hasMultipleDevices}
          className="w-7 h-7 rounded-lg bg-gray-950/80 border border-gray-800 hover:border-gray-700 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          title={hasMultipleDevices ? "Next Weather Station" : "Next Page"}
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {hasMultipleDevices && (
          <div className="flex items-center gap-1 ml-1 bg-sky-950/40 border border-sky-500/30 rounded-lg px-2 py-0.5 text-[11px] font-mono text-sky-300 font-bold">
            <span>Device {currentStationIndex + 1}/{weatherList.length}</span>
            <button
              onClick={toggleAutoSlide}
              className="p-0.5 hover:text-white transition-colors"
              title={autoSlideEnabled ? "Pause Auto-Slide" : "Play Auto-Slide"}
            >
              {autoSlideEnabled ? <Pause className="w-3 h-3 text-emerald-400" /> : <Play className="w-3 h-3 text-slate-400" />}
            </button>
          </div>
        )}
      </div>

      {/* Ticker / Banner message with Smooth Motion Animations */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none z-10 max-w-[55%] overflow-hidden h-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentStationIndex}-${tickerIndex}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
            className="whitespace-nowrap text-xs md:text-[13px] font-sans italic text-gray-300 tracking-wide font-medium truncate text-center"
          >
            {weather.stationName || config.stationName} - {tickerMessages[tickerIndex]}
          </motion.div>
        </AnimatePresence>
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
