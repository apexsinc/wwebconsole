import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Settings, Volume2, VolumeX, Maximize, Minimize, Play, Pause, Wifi, Bell } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useWeatherStore } from '../store.js';
import { toast } from './Toaster.js';
import {
  convertTemp, getTempUnit,
  convertWind, getWindUnit,
  convertBaro, getBaroUnit,
  convertRain, getRainUnit,
} from './units.js';
import { getWindDirectionText } from './windDirection.js';

interface BottomBarProps {
  onOpenSettings: () => void;
  /** TV wall displays have no settings UI — hide the dead gear button. */
  hideSettings?: boolean;
  /** Bulletin-exact taskbar: alarm+count left, sliding ticker center, wifi right. */
  bare?: boolean;
}

export default function BottomBar({ onOpenSettings, hideSettings, bare }: BottomBarProps) {
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
  const [tickerPaused, setTickerPaused] = useState(false);
  const [tickerAnnounce, setTickerAnnounce] = useState('');
  const reduceMotion = useReducedMotion();

  // Unit math lives in components/units.ts (single source for /app + /tv).

  // Authentic Davis consoles rotate through various interesting data points!
  const rainRateTime = weather.high_rain_rate_time && weather.high_rain_rate_time !== '--'
    ? ` @ ${weather.high_rain_rate_time}`
    : '';
  const gustRaw = weather.wind_gust_10_min > 0 ? weather.wind_gust_10_min : weather.wind_speed_last;
  const tickerMessages = [
    `High Rain Rate: ${convertRain(weather.high_rain_rate_today, config.unitRain).toFixed(config.unitRain === 'mm' ? 1 : 2)} ${getRainUnit(config.unitRain)}/hr${rainRateTime}`,
    `Outside Temperature: ${convertTemp(weather.temp, config.unitTemp).toFixed(1)}${getTempUnit(config.unitTemp)}`,
    `Wind Speed: ${convertWind(weather.wind_speed_last, config.unitWind).toFixed(1)} ${getWindUnit(config.unitWind)} ${getWindDirectionText(weather.wind_dir_last)}`,
    `Wind Gust: ${convertWind(gustRaw, config.unitWind).toFixed(1)} ${getWindUnit(config.unitWind)}`,
    `Current Barometer: ${convertBaro(weather.bar_sea_level, config.unitBaro).toFixed(config.unitBaro === 'inHg' || config.unitBaro === 'mmHg' ? 2 : 1)} ${getBaroUnit(config.unitBaro)}`,
    `Dew Point: ${convertTemp(weather.dew_point, config.unitTemp).toFixed(1)}${getTempUnit(config.unitTemp)}`
  ];

  useEffect(() => {
    // Paused (or reduced-motion): advance manually only — WCAG 2.2.2.
    if (tickerPaused || reduceMotion) return;
    const interval = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % tickerMessages.length);
    }, 8000); // Rotate every 8 seconds exactly like the hardware
    return () => clearInterval(interval);
  }, [tickerMessages.length, tickerPaused, reduceMotion]);

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

  // Bulletin alarm count: stations whose data is missing or older than 15 min.
  const nowSec = Date.now() / 1000;
  const alertCount = weatherList.length > 0
    ? weatherList.filter((w) => !w.ts || nowSec - w.ts > 900).length
    : (!weather.ts || nowSec - weather.ts > 900 ? 1 : 0);

  const stepTicker = (dir: 1 | -1) =>
    setTickerIndex((i) => {
      const next = (i + dir + tickerMessages.length) % tickerMessages.length;
      // Announce manual steps (auto-rotation stays silent for screen readers).
      setTickerAnnounce(tickerMessages[next] ?? '');
      return next;
    });

  const alarmCluster = (
    <div className="flex items-center gap-[6px] z-20 shrink-0">
      <button
        onClick={() => setSoundEnabled(!soundEnabled)}
        aria-label={`${alertCount} active alert${alertCount === 1 ? '' : 's'}. ${soundEnabled ? 'Mute console beeps' : 'Unmute console beeps'}`}
        aria-pressed={soundEnabled}
        className="relative w-[36px] h-[36px] rounded-xl bg-gray-950/80 border border-gray-800 hover:border-gray-700 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95 text-gray-300"
        title={soundEnabled ? 'Mute Console Beeps' : 'Enable Console Beeps'}
      >
        <Bell className="w-[16px] h-[16px]" aria-hidden="true" />
        <span
          aria-hidden="true"
          className="absolute -top-[6px] -right-[6px] min-w-[18px] h-[18px] px-[3px] rounded-full bg-sky-600 text-white text-[11px] font-bold font-mono flex items-center justify-center"
        >
          {alertCount}
        </span>
      </button>
      {hasMultipleDevices && (
        <>
          <button
            onClick={prevStation}
            aria-label="Previous weather station"
            className="w-[36px] h-[36px] rounded-xl bg-gray-950/80 border border-gray-800 hover:border-gray-700 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
            title="Previous Weather Station"
          >
            <ChevronLeft className="w-[16px] h-[16px]" aria-hidden="true" />
          </button>
          <button
            onClick={nextStation}
            aria-label="Next weather station"
            className="w-[36px] h-[36px] rounded-xl bg-gray-950/80 border border-gray-800 hover:border-gray-700 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
            title="Next Weather Station"
          >
            <ChevronRight className="w-[16px] h-[16px]" aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );

  const tickerCluster = (withSlide: boolean) => (
    <div className="flex-1 flex items-center justify-center gap-[4px] min-w-0">
      {withSlide && (
        <button
          onClick={() => stepTicker(-1)}
          aria-label="Previous ticker message"
          className="shrink-0 w-[28px] h-[28px] rounded-lg text-gray-400 hover:text-white hover:bg-white/5 flex items-center justify-center transition-all cursor-pointer active:scale-95"
          title="Previous message"
        >
          <ChevronLeft className="w-[14px] h-[14px]" aria-hidden="true" />
        </button>
      )}
      <button
        onClick={() => setTickerPaused((p) => !p)}
        aria-label={tickerPaused ? 'Resume ticker messages' : 'Pause ticker messages'}
        aria-pressed={tickerPaused}
        className="shrink-0 w-[28px] h-[28px] rounded-lg text-gray-400 hover:text-white hover:bg-white/5 flex items-center justify-center transition-all cursor-pointer active:scale-95"
        title={tickerPaused ? 'Resume ticker' : 'Pause ticker'}
      >
        {tickerPaused
          ? <Play className="w-[14px] h-[14px]" aria-hidden="true" />
          : <Pause className="w-[14px] h-[14px]" aria-hidden="true" />}
      </button>
      <div className="flex-1 flex items-center justify-center pointer-events-none z-10 min-w-0 overflow-hidden h-[24px] px-[8px]" aria-live="off">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${currentStationIndex}-${tickerIndex}`}
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: reduceMotion ? 0 : 0.35, ease: 'easeInOut' }}
            className="whitespace-nowrap text-[0.8rem] font-sans italic font-bold text-gray-300 tracking-wide truncate text-center max-w-full"
          >
            {weather.stationName || config.stationName || 'Connecting…'} - {tickerMessages[tickerIndex]}
          </motion.div>
        </AnimatePresence>
      </div>
      {withSlide && (
        <button
          onClick={() => stepTicker(1)}
          aria-label="Next ticker message"
          className="shrink-0 w-[28px] h-[28px] rounded-lg text-gray-400 hover:text-white hover:bg-white/5 flex items-center justify-center transition-all cursor-pointer active:scale-95"
          title="Next message"
        >
          <ChevronRight className="w-[14px] h-[14px]" aria-hidden="true" />
        </button>
      )}
      <span className="sr-only" role="status">
        {tickerAnnounce}
      </span>
    </div>
  );

  const wifiCluster = (
    <div className="flex items-center gap-[8px] shrink-0">
      <span
        role="img"
        aria-label={connection.status === 'online' ? 'Station link online' : `Station link ${connection.status}`}
        className="flex items-center text-slate-500"
        title={connection.status === 'online' ? 'Station link: online' : `Station link: ${connection.status}`}
      >
        <Wifi className={`w-[16px] h-[16px] ${connection.status === 'online' ? 'text-emerald-400' : 'text-amber-400 animate-pulse'}`} aria-hidden="true" />
      </span>
      <span className="sr-only" role="status">
        {`Station link ${connection.status}`}
      </span>
    </div>
  );

  if (bare) {
    return (
      <footer className="w-full bg-[#030712]/90 border-t border-[#01497c]/30 px-[12px] md:px-[16px] py-[4px] flex items-center justify-between gap-[8px] text-gray-400 text-[12px] md:text-[13px] font-sans select-none relative z-20">
        {alarmCluster}
        {tickerCluster(true)}
        {wifiCluster}
      </footer>
    );
  }

  return (
    <footer className="w-full bg-[#030712]/90 border-t border-[#01497c]/30 px-[12px] md:px-[16px] py-[4px] flex items-center justify-between gap-[8px] text-gray-400 text-[12px] md:text-[13px] font-sans select-none relative z-20">
      {/* Left cluster: alerts + station nav (mirrors the 6313 taskbar) */}
      <div className="flex items-center gap-[6px] z-20 shrink-0">
        {alarmCluster}
        {hasMultipleDevices && (
          <div className="flex items-center gap-[4px] ml-[4px] bg-sky-950/40 border border-sky-500/30 rounded-lg px-[8px] py-[2px] text-[11px] font-mono text-sky-300 font-bold">
            <span>Device {currentStationIndex + 1}/{weatherList.length}</span>
            <button
              onClick={toggleAutoSlide}
              aria-label={autoSlideEnabled ? 'Pause auto-slide' : 'Play auto-slide'}
              aria-pressed={autoSlideEnabled}
              className="min-w-[24px] min-h-[24px] p-[4px] hover:text-white transition-colors flex items-center justify-center"
              title={autoSlideEnabled ? 'Pause Auto-Slide' : 'Play Auto-Slide'}
            >
              {autoSlideEnabled ? <Pause className="w-[12px] h-[12px] text-emerald-400" aria-hidden="true" /> : <Play className="w-[12px] h-[12px] text-slate-400" aria-hidden="true" />}
            </button>
          </div>
        )}
      </div>

      {tickerCluster(false)}

      {/* Right cluster: station tag + control utility buttons + link status */}
      <div className="flex items-center gap-[8px] shrink-0">
        <span className="hidden md:block text-[11px] font-mono uppercase tracking-widest text-slate-400 truncate max-w-[180px]" title={weather.stationName || config.stationName || 'Console'}>
          {weather.stationName || config.stationName || 'Console'}
        </span>
        {/* Sound Toggle (faithfully replicates the physical console sound beep switch!) */}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          aria-label={soundEnabled ? 'Mute console beeps' : 'Enable console beeps'}
          aria-pressed={soundEnabled}
          className={`w-[36px] h-[36px] rounded-xl border flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
            soundEnabled 
              ? 'bg-sky-950/20 border-sky-500/20 text-sky-400 hover:border-sky-500/40' 
              : 'bg-gray-950/80 border-gray-800 text-gray-600 hover:border-gray-700'
          }`}
          title={soundEnabled ? 'Mute Console Beeps' : 'Enable Console Beeps'}
        >
          {soundEnabled ? <Volume2 className="w-[16px] h-[16px]" aria-hidden="true" /> : <VolumeX className="w-[16px] h-[16px]" aria-hidden="true" />}
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          aria-keyshortcuts="f"
          className="w-[36px] h-[36px] rounded-xl bg-gray-950/80 border border-gray-800 hover:border-gray-700 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
          title="Toggle Fullscreen Console"
        >
          {isFullscreen ? <Minimize className="w-[16px] h-[16px]" aria-hidden="true" /> : <Maximize className="w-[16px] h-[16px]" aria-hidden="true" />}
        </button>

        {/* Console System/Config settings (hidden on TV wall displays) */}
        {!hideSettings && (
        <button
          onClick={onOpenSettings}
          aria-label="Open console settings"
          className="w-[36px] h-[36px] rounded-xl bg-gray-950/80 border border-gray-800 hover:border-gray-700 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
          title="Console System Settings"
        >
          <Settings className="w-[16px] h-[16px]" aria-hidden="true" />
        </button>
        )}
        {wifiCluster}
      </div>

    </footer>
  );
}
