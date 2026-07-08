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
  Moon 
} from 'lucide-react';

import TabletFrame from './components/TabletFrame.js';
import Header from './components/Header.js';
import CompassRose from './components/CompassRose.js';
import BottomBar from './components/BottomBar.js';
import SettingsModal from './components/SettingsModal.js';
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Initialize both real-time streams: SSE (Live sub-second pushes) + TanStack Query (Polling Backup)
  useLiveStream();
  useWeatherQuery();

  return (
    <div className="flex-1 flex flex-col justify-between h-full relative">
      
      {/* 3-Column Bento Grid Panel Layout */}
      <div className="p-4 md:p-6 lg:p-8 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-5 lg:gap-6 items-stretch flex-1">
        
        {/* COLUMN 1: left (purple-tinted glass) */}
        <div className="md:col-span-4 flex flex-col gap-4 md:gap-5 justify-between">
          
          {/* Top Panel: Outside Temperature & Feels Like */}
          <GlassPanel variant="purple" className="flex-1 min-h-[140px] md:min-h-0">
            <WeatherMetric
              title="Outside Temperature"
              value={weather.temp.toFixed(1)}
              unit="&deg;F"
              icon={Thermometer}
              iconColorClass="text-purple-400 filter drop-shadow-[0_0_6px_rgba(168,85,247,0.4)]"
              subValue={`${weather.feels_like.toFixed(1)} \u00B0F`}
              subLabel="Feels Like"
              subIcon={Thermometer}
            />
          </GlassPanel>

          {/* Middle Panel: Outside Humidity & Dew Point */}
          <GlassPanel variant="purple" className="flex-1 min-h-[140px] md:min-h-0">
            <WeatherMetric
              title="Outside Humidity"
              value={weather.hum.toFixed(1)}
              unit="%"
              icon={Droplet}
              iconColorClass="text-purple-400 filter drop-shadow-[0_0_6px_rgba(168,85,247,0.4)]"
              subValue={`${weather.dew_point.toFixed(1)} \u00B0F`}
              subLabel="Dew Point"
              subIcon={Droplet}
            />
          </GlassPanel>

          {/* Bottom Panel: Inside Temperature & Inside Humidity (Green circle progress) */}
          <GlassPanel variant="purple" className="flex-1 min-h-[140px] md:min-h-0">
            <div className="flex flex-col h-full justify-between gap-3">
              
              {/* Header inside temperature */}
              <div className="flex items-center justify-between w-full">
                <span className="text-[10px] md:text-xs font-sans font-semibold text-gray-400 uppercase tracking-wider select-none">
                  Inside Conditions
                </span>
                <Thermometer className="w-4 h-4 md:w-[18px] md:h-[18px] text-purple-400" />
              </div>

              {/* Grid content to place Inside humidity ring inline */}
              <div className="flex items-center justify-between gap-4 mt-1">
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 font-sans font-medium uppercase tracking-wider select-none">
                    Inside Temp
                  </span>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-3xl md:text-4xl font-display font-bold text-white tracking-tight">
                      {weather.temp_in.toFixed(1)}
                    </span>
                    <span className="text-sm font-semibold text-gray-400 font-sans select-none">
                      &deg;F
                    </span>
                  </div>
                </div>

                {/* Humidity green progress ring container */}
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-gray-400 font-sans font-medium uppercase tracking-wider mb-1.5 select-none">
                    Inside Hum
                  </span>
                  <HumidityRing value={weather.hum_in} />
                </div>
              </div>

              {/* Status footer inside card */}
              <div className="flex items-center gap-1.5 pt-2 border-t border-white/5 text-[11px] md:text-xs text-gray-400 select-none">
                <span className="font-medium text-gray-500">Zone 1 Status:</span>
                <span className="text-emerald-400 font-semibold">Healthy</span>
              </div>

            </div>
          </GlassPanel>

        </div>

        {/* CENTER COLUMN (dark console panel) */}
        <div className="md:col-span-4 flex flex-col justify-between gap-4 md:gap-5 bg-gradient-to-b from-[#090b12] to-[#040508] border border-gray-900 rounded-2xl p-4 md:p-6 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.7)]">
          
          {/* Header section */}
          <Header />

          {/* Large High-fidelity Circular Compass Rose */}
          <div className="flex-1 flex items-center justify-center my-2">
            <CompassRose />
          </div>

          {/* Bottom panel: Sunrise, Sunset, Moon Phase */}
          <div className="grid grid-cols-3 gap-1 border-t border-gray-800/80 pt-4 select-none">
            
            {/* Sunrise Section */}
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-8 h-8 rounded-full bg-amber-950/20 border border-amber-500/15 flex items-center justify-center text-amber-500/80 filter drop-shadow-[0_0_6px_rgba(245,158,11,0.25)]">
                <Sunrise className="w-4 h-4" />
              </div>
              <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mt-1.5">
                Sunrise
              </span>
              <span className="text-xs text-white font-mono font-bold mt-0.5">
                {weather.sunrise}
              </span>
            </div>

            {/* Sunset Section */}
            <div className="flex flex-col items-center justify-center text-center border-x border-gray-800/60">
              <div className="w-8 h-8 rounded-full bg-rose-950/20 border border-rose-500/15 flex items-center justify-center text-rose-500/80 filter drop-shadow-[0_0_6px_rgba(244,63,94,0.25)]">
                <Sunset className="w-4 h-4" />
              </div>
              <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mt-1.5">
                Sunset
              </span>
              <span className="text-xs text-white font-mono font-bold mt-0.5">
                {weather.sunset}
              </span>
            </div>

            {/* Moon Phase Section */}
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-8 h-8 rounded-full bg-slate-900/40 border border-slate-700/30 flex items-center justify-center text-sky-200 filter drop-shadow-[0_0_6px_rgba(186,230,253,0.15)]">
                <Moon className="w-4 h-4" />
              </div>
              <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mt-1.5">
                Moon Phase
              </span>
              <span className="text-[10px] text-gray-300 font-sans font-bold mt-1 uppercase leading-none text-center px-1">
                {weather.moon_phase}
              </span>
            </div>

          </div>

        </div>

        {/* COLUMN 2: right (blue-tinted glass) */}
        <div className="md:col-span-4 flex flex-col gap-4 md:gap-5 justify-between">
          
          {/* Top Panel: Current Barometer & Trend */}
          <GlassPanel variant="blue" className="flex-1 min-h-[140px] md:min-h-0">
            <WeatherMetric
              title="Current Barometer"
              value={weather.bar_sea_level.toFixed(3)}
              unit="in Hg"
              icon={Cloud}
              iconColorClass="text-sky-400 filter drop-shadow-[0_0_6px_rgba(56,189,248,0.4)]"
              subValue={`${weather.bar_trend >= 0 ? '+' : ''}${weather.bar_trend.toFixed(3)} in Hg`}
              subLabel="Trend"
              subIcon={Cloud}
            />
          </GlassPanel>

          {/* Middle Panel: Wind Speed averages */}
          <GlassPanel variant="blue" className="flex-1 min-h-[140px] md:min-h-0">
            <WeatherMetric
              title="2-Min Avg Wind"
              value={weather.wind_speed_avg_2_min.toFixed(1)}
              unit="mi/hr"
              icon={Wind}
              iconColorClass="text-sky-400 filter drop-shadow-[0_0_6px_rgba(56,189,248,0.4)]"
              subValue={`${weather.wind_speed_avg_10_min.toFixed(1)} mi/hr`}
              subLabel="10-Min Avg"
              subIcon={Wind}
            />
          </GlassPanel>

          {/* Bottom Panel: Rain rate & Daily rain */}
          <GlassPanel variant="blue" className="flex-1 min-h-[140px] md:min-h-0">
            <WeatherMetric
              title="Current Rain Rate"
              value={weather.rain_rate_last.toFixed(2)}
              unit="in/hr"
              icon={CloudRain}
              iconColorClass="text-sky-400 filter drop-shadow-[0_0_6px_rgba(56,189,248,0.4)]"
              subValue={`${weather.rainfall_daily.toFixed(2)} in`}
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
      <TabletFrame>
        <MainDashboard />
      </TabletFrame>
    </QueryClientProvider>
  );
}
