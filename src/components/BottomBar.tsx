import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Settings, Volume2, VolumeX, Maximize, Minimize, Play, Pause, Wifi, Bell } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useWeatherStore } from '../store.js';
import { toast } from './Toaster.js';

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
  const connection = useWeatherStore((state) => state.connection);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tickerIndex, setTickerIndex] = useState(0);
  const reduceMotion = useReducedMotion();

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
      document.documentElement.requestFullscreen().catch(() => {
        toast('Fullscreen was blocked by the browser. Use the F key or your browser menu instead.', 'error');
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const hasMultipleDevices = weatherList.length > 1;

  return (
    <footer className="w-full bg-[#030712]/90 border-t border-[#01497c]/30 px-3 md:px-4 py-2 flex items-center justify-between gap-2 text-gray-400 text-xs md:text-sm font-sans select-none relative z-20">
      {/* Left cluster: station nav + link status icons (mirrors the 6313 taskbar) */}
      <div className="flex items-center gap-1.5 z-20 shrink-0">
        <button 
          onClick={prevStation}
          disabled={!hasMultipleDevices}
          aria-label={hasMultipleDevices ? "Previous weather station" : "Previous station (single station)"}
          className="w-11 h-11 rounded-xl bg-gray-950/80 border border-gray-800 hover:border-gray-700 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          title={hasMultipleDevices ? "Previous Weather Station" : "Single station"}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button 
          onClick={nextStation}
          disabled={!hasMultipleDevices}
          aria-label={hasMultipleDevices ? "Next weather station" : "Next station (single station)"}
          className="w-11 h-11 rounded-xl bg-gray-950/80 border border-gray-800 hover:border-gray-700 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          title={hasMultipleDevices ? "Next Weather Station" : "Single station"}
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
        <span className="hidden sm:flex items-center gap-1 ml-1 text-slate-500" title={connection.status === 'online' ? 'Station link: online' : `Station link: ${connection.status}`}>
          <Wifi className={`w-3.5 h-3.5 ${connection.status === 'online' ? 'text-emerald-400' : 'text-amber-400 animate-pulse'}`} aria-hidden="true" />
          <Bell className="w-3.5 h-3.5" aria-hidden="true" />
        </span>
      </div>

      {/* Ticker / Banner message with Smooth Motion Animations */}
      <div className="flex-1 flex items-center justify-center pointer-events-none z-10 min-w-0 overflow-hidden h-6 px-2" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${currentStationIndex}-${tickerIndex}`}
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: reduceMotion ? 0 : 0.35, ease: 'easeInOut' }}
            className="whitespace-nowrap text-xs md:text-[13px] font-sans italic text-gray-300 tracking-wide font-medium truncate text-center max-w-full"
          >
            {weather.stationName || config.stationName || 'Connecting…'} - {tickerMessages[tickerIndex]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Right cluster: station tag + control utility buttons */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="hidden md:block text-[11px] font-mono uppercase tracking-widest text-slate-500 truncate max-w-[180px]" title={weather.stationName || config.stationName || 'Console'}>
          {weather.stationName || config.stationName || 'Console'}
        </span>
        {/* Sound Toggle (faithfully replicates the physical console sound beep switch!) */}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          aria-label={soundEnabled ? 'Mute console beeps' : 'Enable console beeps'}
          aria-pressed={soundEnabled}
          className={`w-11 h-11 rounded-xl border flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
            soundEnabled 
              ? 'bg-sky-950/20 border-sky-500/20 text-sky-400 hover:border-sky-500/40' 
              : 'bg-gray-950/80 border-gray-800 text-gray-600 hover:border-gray-700'
          }`}
          title={soundEnabled ? 'Mute Console Beeps' : 'Enable Console Beeps'}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          className="w-11 h-11 rounded-xl bg-gray-950/80 border border-gray-800 hover:border-gray-700 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
          title="Toggle Fullscreen Console"
        >
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>

        {/* Console System/Config settings */}
        <button
          onClick={onOpenSettings}
          aria-label="Open console settings"
          className="w-11 h-11 rounded-xl bg-gray-950/80 border border-gray-800 hover:border-gray-700 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
          title="Console System Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

    </footer>
  );
}
