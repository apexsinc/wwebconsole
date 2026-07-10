import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Thermometer,
  Droplet,
  Cloud,
  Wind,
  CloudRain,
  Sunrise,
  Sunset,
  Moon,
  Wifi,
} from 'lucide-react';
import TabletFrame from '../components/TabletFrame.js';
import Header from '../components/Header.js';
import CompassRose from '../components/CompassRose.js';
import BottomBar from '../components/BottomBar.js';
import { GlassPanel, WeatherMetric } from '../components/WeatherPanel.js';
import { useWeatherStore } from '../store.js';
import { fetchPublicTv } from '../services/api.js';

export default function TvPage() {
  const { slug } = useParams();
  const setAll = useWeatherStore((s) => s.setAll);
  const weather = useWeatherStore((s) => s.weather);
  const config = useWeatherStore((s) => s.config);

  const query = useQuery({
    queryKey: ['tv', slug],
    queryFn: () => fetchPublicTv(slug!),
    enabled: Boolean(slug),
    refetchInterval: 15000,
    retry: 2,
  });

  useEffect(() => {
    if (query.data) {
      setAll({
        weather: query.data.weather,
        connection: query.data.connection,
        config: {
          ...query.data.config,
          unitTemp: query.data.config.unitTemp,
          unitWind: query.data.config.unitWind,
          unitBaro: query.data.config.unitBaro,
          unitRain: query.data.config.unitRain,
          stationName: query.data.config.stationName,
        },
      });
    }
  }, [query.data, setAll]);

  useEffect(() => {
    // Auto-enter fullscreen-friendly TV mode: hide cursor after idle is browser-native;
    // request fullscreen once user interacts if not already.
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'f') {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => undefined);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const convertTemp = (tempF: number, unit?: 'F' | 'C') => (unit === 'C' ? ((tempF - 32) * 5) / 9 : tempF);
  const getTempUnit = (unit?: 'F' | 'C') => (unit === 'C' ? '°C' : '°F');
  const convertWind = (speedMph: number, unit?: string) => {
    if (unit === 'kmh') return speedMph * 1.60934;
    if (unit === 'kts') return speedMph * 0.868976;
    if (unit === 'ms') return speedMph * 0.44704;
    return speedMph;
  };
  const getWindUnit = (unit?: string) =>
    unit === 'kmh' ? 'km/h' : unit === 'kts' ? 'kts' : unit === 'ms' ? 'm/s' : 'mph';
  const convertBaro = (baroInHg: number, unit?: string) => {
    if (unit === 'hPa' || unit === 'mb') return baroInHg * 33.8639;
    if (unit === 'mmHg') return baroInHg * 25.4;
    return baroInHg;
  };
  const getBaroUnit = (unit?: string) =>
    unit === 'hPa' ? 'hPa' : unit === 'mb' ? 'mb' : unit === 'mmHg' ? 'mm Hg' : 'in Hg';
  const convertRain = (rainInches: number, unit?: string) => (unit === 'mm' ? rainInches * 25.4 : rainInches);
  const getRainUnit = (unit?: string) => (unit === 'mm' ? 'mm' : 'in');

  if (query.isError) {
    return (
      <div className="h-screen bg-[#0a0d14] flex items-center justify-center text-center p-6">
        <div>
          <Wifi className="w-8 h-8 text-rose-400 mx-auto mb-3" />
          <h1 className="text-white font-bold">Display unavailable</h1>
          <p className="text-gray-400 text-sm mt-2">{(query.error as Error).message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-[#0a0d14] flex flex-col overflow-y-auto md:overflow-hidden">
      <div className="flex-1 flex flex-col justify-center">
        <TabletFrame>
          <div className="flex-1 flex flex-col justify-between h-full relative">
            {weather.ts === 0 && (
              <div className="absolute inset-0 bg-black/75 backdrop-blur-md z-30 flex items-center justify-center p-6">
                <div className="max-w-md bg-[#0e111a] border border-[#2d343f] rounded-2xl p-6 text-center">
                  <Wifi className="w-6 h-6 text-amber-500 animate-pulse mx-auto mb-3" />
                  <h3 className="text-white font-bold">Waiting for weather data</h3>
                  <p className="text-gray-400 text-xs mt-2">This TV display will update when the station comes online.</p>
                </div>
              </div>
            )}

            <div className="pt-2 px-2 pb-0 md:pt-3 md:px-3 grid grid-cols-1 md:grid-cols-[1fr_240px_1fr] lg:grid-cols-[1fr_280px_1fr] gap-4 md:gap-4 items-stretch flex-1 overflow-y-auto md:overflow-hidden min-h-0">
              <div className="flex flex-col min-h-[350px] md:min-h-0 h-full gap-2.5 md:gap-4">
                <GlassPanel variant="dark" className="flex-1 flex flex-col justify-center">
                  <WeatherMetric
                    title="Outside Temperature"
                    value={convertTemp(weather.temp, config.unitTemp).toFixed(1)}
                    unit={getTempUnit(config.unitTemp)}
                    icon={Thermometer}
                    iconColorClass="text-slate-400"
                    subValue={convertTemp(weather.feels_like, config.unitTemp).toFixed(1)}
                    subUnit={getTempUnit(config.unitTemp)}
                    subLabel="Feels Like"
                  />
                </GlassPanel>
                <GlassPanel variant="dark" className="flex-1 flex flex-col justify-center">
                  <WeatherMetric
                    title="Outside Humidity"
                    value={weather.hum.toFixed(1)}
                    unit="%"
                    icon={Droplet}
                    iconColorClass="text-slate-400"
                    subValue={convertTemp(weather.dew_point, config.unitTemp).toFixed(1)}
                    subUnit={getTempUnit(config.unitTemp)}
                    subLabel="Dew Point"
                  />
                </GlassPanel>
                <GlassPanel variant="dark" className="flex-1 flex flex-col justify-center">
                  <WeatherMetric
                    title="Inside Temperature"
                    value={convertTemp(weather.temp_in, config.unitTemp).toFixed(1)}
                    unit={getTempUnit(config.unitTemp)}
                    icon={Thermometer}
                    iconColorClass="text-slate-400"
                    subValue={weather.hum_in.toFixed(1)}
                    subUnit="%"
                    subLabel="Inside Humidity"
                  />
                </GlassPanel>
              </div>

              <div className="flex flex-col justify-between bg-[#0e1930]/75 border border-[#01497c]/30 rounded-2xl pt-2.5 px-2.5 pb-0 md:pt-3.5 md:px-3.5 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.8)] relative overflow-visible backdrop-blur-md min-h-[300px] md:min-h-0 z-50">
                <div className="relative z-20">
                  <Header />
                </div>
                <div className="relative md:absolute md:top-[55%] md:left-1/2 md:transform md:-translate-x-1/2 md:-translate-y-1/2 pointer-events-none z-0 my-4 md:my-0 flex justify-center">
                  <div className="pointer-events-auto">
                    <CompassRose />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1 border-t border-white/10 pt-1.5 select-none mt-auto z-20 relative">
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="w-8 h-8 rounded-full bg-amber-950/20 border border-amber-500/15 flex items-center justify-center text-amber-500/80">
                      <Sunrise className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mt-0.5">Sunrise</span>
                    <span className="text-xs text-white font-mono font-bold">{weather.sunrise}</span>
                  </div>
                  <div className="flex flex-col items-center justify-center text-center border-x border-gray-800/60">
                    <div className="w-8 h-8 rounded-full bg-rose-950/20 border border-rose-500/15 flex items-center justify-center text-rose-500/80">
                      <Sunset className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mt-0.5">Sunset</span>
                    <span className="text-xs text-white font-mono font-bold">{weather.sunset}</span>
                  </div>
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="w-8 h-8 rounded-full bg-slate-900/40 border border-slate-700/30 flex items-center justify-center text-sky-200">
                      <Moon className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mt-0.5">Moon Phase</span>
                    <span className="text-[10px] text-gray-300 font-sans font-bold mt-0.5 uppercase">{weather.moon_phase}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col min-h-[350px] md:min-h-0 h-full gap-2.5 md:gap-4 pb-2 md:pb-0">
                <GlassPanel variant="dark" className="flex-1 flex flex-col justify-center">
                  <WeatherMetric
                    title="Current Barometer"
                    value={convertBaro(weather.bar_sea_level, config.unitBaro).toFixed(
                      config.unitBaro === 'inHg' || config.unitBaro === 'mmHg' ? 3 : 1
                    )}
                    unit={getBaroUnit(config.unitBaro)}
                    icon={Cloud}
                    iconColorClass="text-slate-400"
                    subValue={`${weather.bar_trend >= 0 ? '+' : ''}${convertBaro(weather.bar_trend, config.unitBaro).toFixed(
                      config.unitBaro === 'inHg' || config.unitBaro === 'mmHg' ? 3 : 1
                    )}`}
                    subUnit={getBaroUnit(config.unitBaro)}
                    subLabel="Barometer Trend"
                  />
                </GlassPanel>
                <GlassPanel variant="dark" className="flex-1 flex flex-col justify-center">
                  <WeatherMetric
                    title="2-Min Avg Wind"
                    value={convertWind(weather.wind_speed_avg_2_min, config.unitWind).toFixed(1)}
                    unit={getWindUnit(config.unitWind)}
                    icon={Wind}
                    iconColorClass="text-slate-400"
                    subValue={convertWind(weather.wind_speed_avg_10_min, config.unitWind).toFixed(1)}
                    subUnit={getWindUnit(config.unitWind)}
                    subLabel="10-Min Avg"
                  />
                </GlassPanel>
                <GlassPanel variant="dark" className="flex-1 flex flex-col justify-center">
                  <WeatherMetric
                    title="Current Rain Rate"
                    value={convertRain(weather.rain_rate_last, config.unitRain).toFixed(config.unitRain === 'mm' ? 1 : 2)}
                    unit={`${getRainUnit(config.unitRain)}/hr`}
                    icon={CloudRain}
                    iconColorClass="text-slate-400"
                    subValue={convertRain(weather.rainfall_daily, config.unitRain).toFixed(config.unitRain === 'mm' ? 1 : 2)}
                    subUnit={getRainUnit(config.unitRain)}
                    subLabel="Daily Rain"
                  />
                </GlassPanel>
              </div>
            </div>

            <BottomBar onOpenSettings={() => undefined} />
          </div>
        </TabletFrame>
      </div>
      <p className="text-center text-[10px] text-gray-600 pb-2 select-none">Press F for fullscreen · wwebconsole.com/tv/{slug}</p>
    </div>
  );
}
