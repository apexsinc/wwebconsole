/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { 
  Thermometer, 
  Droplet, 
  Cloud, 
  Wind, 
  CloudRain, 
  Sunrise, 
  Sunset, 
  Moon,
  Wifi 
} from 'lucide-react';

import TabletFrame from './components/TabletFrame.js';
import Header from './components/Header.js';
import CompassRose from './components/CompassRose.js';
import BottomBar from './components/BottomBar.js';
import SettingsModal from './components/SettingsModal.js';
import ConfigNavbar from './components/ConfigNavbar.js';
import { GlassPanel, WeatherMetric, HumidityRing } from './components/WeatherPanel.js';

import { useWeatherStore } from './store.js';
import { useLiveStream, useWeatherQuery } from './services/api.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

function MainDashboard() {
  const weather = useWeatherStore((state) => state.weather);
  const config = useWeatherStore((state) => state.config);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Initialize both real-time streams: SSE (Live sub-second pushes) + TanStack Query (Polling Backup)
  useLiveStream();
  useWeatherQuery();

  // Unit conversion helpers
  const convertTemp = (tempF: number, unit?: 'F' | 'C') => {
    if (unit === 'C') {
      return (tempF - 32) * 5 / 9;
    }
    return tempF;
  };
  const getTempUnit = (unit?: 'F' | 'C') => {
    return unit === 'C' ? '°C' : '°F';
  };

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

  const convertRain = (rainInches: number, unit?: 'in' | 'mm') => {
    if (unit === 'mm') return rainInches * 25.4;
    return rainInches;
  };
  const getRainUnit = (unit?: 'in' | 'mm') => {
    return unit === 'mm' ? 'mm' : 'in';
  };

  return (
    <div className="flex-1 flex flex-col justify-between h-full relative">
      
      {/* Awaiting Connection / Unconfigured Overlay */}
      {weather.ts === 0 && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-md z-30 flex items-center justify-center p-6 select-none">
          <div className="max-w-md bg-[#0e111a] border border-[#2d343f] rounded-2xl p-6 shadow-2xl text-center flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Wifi className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-white font-sans font-bold text-base">Awaiting Station Connection</h3>
              <p className="text-gray-400 text-xs mt-1.5 leading-relaxed">
                No weather data has been received yet. Please configure your WeatherLink Live IP Address or WeatherLink Cloud API credentials in the top configuration bar to start receiving live weather telemetry.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* 3-Column Bento Grid Panel Layout */}
      <div className="p-2 md:p-3 grid grid-cols-1 md:grid-cols-12 gap-2.5 md:gap-3 items-stretch flex-1 overflow-hidden min-h-0">
        
        {/* COLUMN 1: left (purple-tinted glass) */}
        <div className="md:col-span-4 flex flex-col gap-3 md:gap-4 justify-between min-h-0">
          
          {/* Top Panel: Outside Temperature & Feels Like */}
          <GlassPanel variant="dark" className="flex-1 min-h-[90px] md:min-h-0">
            <WeatherMetric
              title="Outside Temperature"
              value={convertTemp(weather.temp, config.unitTemp).toFixed(1)}
              unit={getTempUnit(config.unitTemp)}
              icon={Thermometer}
              iconColorClass="text-slate-400"
              subValue={`${convertTemp(weather.feels_like, config.unitTemp).toFixed(1)} ${getTempUnit(config.unitTemp)}`}
              subLabel="Feels Like"
              subIcon={Thermometer}
            />
          </GlassPanel>

          {/* Middle Panel: Outside Humidity & Dew Point */}
          <GlassPanel variant="dark" className="flex-1 min-h-[90px] md:min-h-0">
            <WeatherMetric
              title="Outside Humidity"
              value={weather.hum.toFixed(1)}
              unit="%"
              icon={Droplet}
              iconColorClass="text-slate-400"
              subValue={`${convertTemp(weather.dew_point, config.unitTemp).toFixed(1)} ${getTempUnit(config.unitTemp)}`}
              subLabel="Dew Point"
              subIcon={Droplet}
            />
          </GlassPanel>

          {/* Bottom Panel: Inside Temperature & Inside Humidity (Green circle progress) */}
          <GlassPanel variant="dark" className="flex-1 min-h-[90px] md:min-h-0">
            <div className="flex flex-col h-full justify-between gap-3">
              
              {/* Header inside temperature */}
              <div className="flex items-center justify-between w-full">
                <span className="text-[10px] md:text-xs font-sans font-semibold text-slate-400 uppercase tracking-wider select-none">
                  Inside Conditions
                </span>
                <Thermometer className="w-4 h-4 md:w-[18px] md:h-[18px] text-slate-400" />
              </div>

              {/* Grid content to place Inside humidity ring inline */}
              <div className="flex items-center justify-between gap-4 mt-1">
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-500 font-sans font-medium uppercase tracking-wider select-none">
                    Inside Temp
                  </span>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-3xl md:text-4xl font-display font-bold text-white tracking-tight">
                      {convertTemp(weather.temp_in, config.unitTemp).toFixed(1)}
                    </span>
                    <span className="text-sm font-semibold text-gray-400 font-sans select-none">
                      {getTempUnit(config.unitTemp)}
                    </span>
                  </div>
                </div>

                {/* Humidity green progress ring container */}
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-gray-500 font-sans font-medium uppercase tracking-wider mb-1.5 select-none">
                    Inside Hum
                  </span>
                  <HumidityRing value={weather.hum_in} />
                </div>
              </div>

              {/* Status footer inside card */}
              <div className="flex items-center gap-1.5 pt-2 border-t border-white/5 text-[11px] md:text-xs text-gray-400 select-none">
                <span className="font-medium text-gray-500">Zone 1 Status:</span>
                <span className="text-sky-400 font-semibold">Healthy</span>
              </div>

            </div>
          </GlassPanel>

        </div>

        {/* CENTER COLUMN (dark console panel) */}
        <div className="md:col-span-4 flex flex-col justify-between gap-3 md:gap-4 bg-[#0e1930]/75 border border-[#01497c]/30 rounded-2xl p-2.5 md:p-3.5 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.8)] relative overflow-hidden backdrop-blur-md min-h-0">
          
          {/* Header section */}
          <Header />

          {/* Large High-fidelity Circular Compass Rose */}
          <div className="flex-1 flex items-center justify-center my-0">
            <CompassRose />
          </div>

          {/* Bottom panel: Sunrise, Sunset, Moon Phase */}
          <div className="grid grid-cols-3 gap-1 border-t border-gray-800/80 pt-1.5 select-none">
            
            {/* Sunrise Section */}
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-8 h-8 rounded-full bg-amber-950/20 border border-amber-500/15 flex items-center justify-center text-amber-500/80 filter drop-shadow-[0_0_6px_rgba(245,158,11,0.25)]">
                <Sunrise className="w-4 h-4" />
              </div>
              <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mt-0.5">
                Sunrise
              </span>
              <span className="text-xs text-white font-mono font-bold mt-0">
                {weather.sunrise}
              </span>
            </div>

            {/* Sunset Section */}
            <div className="flex flex-col items-center justify-center text-center border-x border-gray-800/60">
              <div className="w-8 h-8 rounded-full bg-rose-950/20 border border-rose-500/15 flex items-center justify-center text-rose-500/80 filter drop-shadow-[0_0_6px_rgba(244,63,94,0.25)]">
                <Sunset className="w-4 h-4" />
              </div>
              <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mt-0.5">
                Sunset
              </span>
              <span className="text-xs text-white font-mono font-bold mt-0">
                {weather.sunset}
              </span>
            </div>

            {/* Moon Phase Section */}
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-8 h-8 rounded-full bg-slate-900/40 border border-slate-700/30 flex items-center justify-center text-sky-200 filter drop-shadow-[0_0_6px_rgba(186,230,253,0.15)]">
                <Moon className="w-4 h-4" />
              </div>
              <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mt-0.5">
                Moon Phase
              </span>
              <span className="text-[10px] text-gray-300 font-sans font-bold mt-0.5 uppercase leading-none text-center px-1">
                {weather.moon_phase}
              </span>
            </div>

          </div>

        </div>

        {/* COLUMN 3: right (matte dark glass) */}
        <div className="md:col-span-4 flex flex-col gap-3 md:gap-4 justify-between min-h-0">
          
          {/* Top Panel: Current Barometer & Trend */}
          <GlassPanel variant="dark" className="flex-1 min-h-[90px] md:min-h-0">
            <WeatherMetric
              title="Current Barometer"
              value={convertBaro(weather.bar_sea_level, config.unitBaro).toFixed(config.unitBaro === 'inHg' || config.unitBaro === 'mmHg' ? 3 : 1)}
              unit={getBaroUnit(config.unitBaro)}
              icon={Cloud}
              iconColorClass="text-slate-400"
              subValue={`${weather.bar_trend >= 0 ? '+' : ''}${convertBaro(weather.bar_trend, config.unitBaro).toFixed(config.unitBaro === 'inHg' || config.unitBaro === 'mmHg' ? 3 : 1)} ${getBaroUnit(config.unitBaro)}`}
              subLabel="Trend"
              subIcon={Cloud}
            />
          </GlassPanel>

          {/* Middle Panel: Wind Speed averages */}
          <GlassPanel variant="dark" className="flex-1 min-h-[90px] md:min-h-0">
            <WeatherMetric
              title="2-Min Avg Wind"
              value={convertWind(weather.wind_speed_avg_2_min, config.unitWind).toFixed(1)}
              unit={getWindUnit(config.unitWind)}
              icon={Wind}
              iconColorClass="text-slate-400"
              subValue={`${convertWind(weather.wind_speed_avg_10_min, config.unitWind).toFixed(1)} ${getWindUnit(config.unitWind)}`}
              subLabel="10-Min Avg"
              subIcon={Wind}
            />
          </GlassPanel>

          {/* Bottom Panel: Rain rate & Daily rain */}
          <GlassPanel variant="dark" className="flex-1 min-h-[90px] md:min-h-0">
            <WeatherMetric
              title="Current Rain Rate"
              value={convertRain(weather.rain_rate_last, config.unitRain).toFixed(config.unitRain === 'mm' ? 1 : 2)}
              unit={`${getRainUnit(config.unitRain)}/hr`}
              icon={CloudRain}
              iconColorClass="text-slate-400"
              subValue={`${convertRain(weather.rainfall_daily, config.unitRain).toFixed(config.unitRain === 'mm' ? 1 : 2)} ${getRainUnit(config.unitRain)}`}
              subLabel="Daily Rain"
              subIcon={CloudRain}
            />
          </GlassPanel>

        </div>

      </div>

      {/* Console Bottom status utility bar */}
      <BottomBar onOpenSettings={() => setIsSettingsOpen(true)} />

      {/* Settings configuration modal */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="h-screen bg-[#e1e5eb] flex flex-col overflow-hidden">
        {/* Web Application Config Navbar */}
        <ConfigNavbar />

        {/* Console Tablet Interface */}
        <div className="flex-1 flex flex-col justify-center">
          <TabletFrame>
            <MainDashboard />
          </TabletFrame>
        </div>
      </div>
    </QueryClientProvider>
  );
}
