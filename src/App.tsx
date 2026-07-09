/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
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
  Wifi,
} from 'lucide-react';

import TabletFrame from './components/TabletFrame.js';
import Header from './components/Header.js';
import CompassRose from './components/CompassRose.js';
import BottomBar from './components/BottomBar.js';
import SettingsModal from './components/SettingsModal.js';
import ConfigNavbar from './components/ConfigNavbar.js';
import { GlassPanel, WeatherMetric } from './components/WeatherPanel.js';
import { useWeatherStore } from './store.js';
import { fetchMe, useWeatherQuery } from './services/api.js';
import { LoginPage, RegisterPage, VerifyEmailPage, ForgotPasswordPage, ResetPasswordPage } from './pages/AuthPages.js';
import AccountPage from './pages/AccountPage.js';
import AdminPage from './pages/AdminPage.js';
import TvPage from './pages/TvPage.js';
import { MarketingLayout } from './components/MarketingLayout.js';
import {
  AboutPage,
  ChangelogPage,
  ContactPage,
  FeaturesPage,
  HomePage,
  PricingPage,
  PrivacyPage,
  TermsPage,
} from './pages/MarketingPages.js';
import { applyTheme, getStoredTheme } from './hooks/useTheme.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

if (typeof document !== 'undefined') {
  applyTheme(getStoredTheme());
}

function MainDashboard() {
  const weather = useWeatherStore((state) => state.weather);
  const config = useWeatherStore((state) => state.config);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useWeatherQuery(true);

  const convertTemp = (tempF: number, unit?: 'F' | 'C') => {
    if (unit === 'C') return ((tempF - 32) * 5) / 9;
    return tempF;
  };
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

  return (
    <div className="flex-1 flex flex-col justify-between h-full relative">
      {weather.ts === 0 && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-md z-30 flex items-center justify-center p-6 select-none">
          <div className="max-w-md bg-[#0e111a] border border-[#2d343f] rounded-2xl p-6 shadow-2xl text-center flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Wifi className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-white font-sans font-bold text-base">Awaiting Station Connection</h3>
              <p className="text-gray-400 text-xs mt-1.5 leading-relaxed">
                Configure your WeatherLink Cloud credentials in the top bar, then create a TV Share URL for big-screen monitors.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="pt-2 px-2 pb-0 md:pt-3 md:px-3 md:pb-0 grid grid-cols-1 md:grid-cols-[1fr_240px_1fr] lg:grid-cols-[1fr_280px_1fr] gap-2.5 md:gap-4 items-stretch flex-1 overflow-hidden min-h-0">
        <div className="flex flex-col min-h-0 relative z-10 h-full gap-2.5 md:gap-4">
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

        <div className="flex flex-col justify-between bg-[#0e1930]/75 border border-[#01497c]/30 rounded-2xl pt-2.5 px-2.5 pb-0 md:pt-3.5 md:px-3.5 md:pb-0 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.8)] relative overflow-visible backdrop-blur-md min-h-0 z-50">
          <div className="relative z-20">
            <Header />
          </div>
          <div className="absolute top-[55%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0">
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
              <span className="text-xs text-white font-mono font-bold mt-0">{weather.sunrise}</span>
            </div>
            <div className="flex flex-col items-center justify-center text-center border-x border-gray-800/60">
              <div className="w-8 h-8 rounded-full bg-rose-950/20 border border-rose-500/15 flex items-center justify-center text-rose-500/80">
                <Sunset className="w-4 h-4" />
              </div>
              <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mt-0.5">Sunset</span>
              <span className="text-xs text-white font-mono font-bold mt-0">{weather.sunset}</span>
            </div>
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-8 h-8 rounded-full bg-slate-900/40 border border-slate-700/30 flex items-center justify-center text-sky-200">
                <Moon className="w-4 h-4" />
              </div>
              <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mt-0.5">Moon Phase</span>
              <span className="text-[10px] text-gray-300 font-sans font-bold mt-0.5 uppercase leading-none text-center px-1">
                {weather.moon_phase}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col min-h-0 relative z-10 h-full gap-2.5 md:gap-4">
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

      <BottomBar onOpenSettings={() => setIsSettingsOpen(true)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}

function ProtectedConsole() {
  const user = useWeatherStore((s) => s.user);
  const billing = useWeatherStore((s) => s.billing);
  const authChecked = useWeatherStore((s) => s.authChecked);
  const setUser = useWeatherStore((s) => s.setUser);
  const setBilling = useWeatherStore((s) => s.setBilling);
  const setAuthChecked = useWeatherStore((s) => s.setAuthChecked);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await fetchMe();
        if (!cancelled) {
          setUser(me.user);
          setBilling(me.billing);
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setUser, setBilling, setAuthChecked]);

  if (!authChecked) {
    return (
      <div className="h-screen bg-[#e8edf3] dark:bg-[#0a0d14] flex items-center justify-center text-slate-500 dark:text-gray-400 text-sm">
        Loading…
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const accessBlocked = billing && !billing.accessOk;

  return (
    <div className="h-screen bg-[#e8edf3] dark:bg-[#0a0d14] flex flex-col overflow-hidden">
      <ConfigNavbar />
      {accessBlocked && (
        <div className="bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-100 text-xs px-4 py-2 border-b border-amber-200 dark:border-amber-800 text-center">
          {billing.accessReason || 'Subscription required'} · Free trial / yearly Pro device plans apply
        </div>
      )}
      {user.deleteRequestedAt && (
        <div className="bg-rose-100 dark:bg-rose-950 text-rose-900 dark:text-rose-100 text-xs px-4 py-2 border-b border-rose-200 dark:border-rose-800 text-center">
          Account deletion scheduled
          {user.deleteEffectiveAt ? ` for ${new Date(user.deleteEffectiveAt).toLocaleString()}` : ''}.{' '}
          <a href="/account" className="underline font-semibold">
            Manage in Account
          </a>
        </div>
      )}
      <div className="flex-1 flex flex-col justify-center">
        <TabletFrame>
          <MainDashboard />
        </TabletFrame>
      </div>
    </div>
  );
}

function HostAwareRoutes() {
  const host = typeof window !== 'undefined' ? window.location.hostname : '';

  // Dedicated admin host: login only (no public registration). Cloudflare Access OTP sits in front.
  if (host === 'admin.wwebconsole.com' || host.startsWith('admin.') || host === 'admin.localhost') {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/register" element={<Navigate to="/login" replace />} />
        <Route path="/verify" element={<Navigate to="/login" replace />} />
        <Route path="/*" element={<AdminPage />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/account" element={<AccountPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/admin/*" element={<AdminPage />} />
      <Route path="/tv/:slug" element={<TvPage />} />
      <Route path="/app" element={<ProtectedConsole />} />
      <Route path="/app/*" element={<ProtectedConsole />} />
      <Route element={<MarketingLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/changelog" element={<ChangelogPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <HostAwareRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
