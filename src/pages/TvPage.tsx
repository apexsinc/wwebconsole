/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Public TV wall display: same ConsoleBoard as /app, full-bleed for
 * projectors and big screens. Root font-size scales with the viewport so
 * the rem-based board fills any display proportionally (?kiosk=1 hides all
 * chrome and the cursor for unattended projection).
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Wifi } from 'lucide-react';
import ConsoleBoard from '../components/ConsoleBoard.js';
import BottomBar from '../components/BottomBar.js';
import { useWeatherStore } from '../store.js';
import { fetchPublicTv } from '../services/api.js';
import { toast } from '../components/Toaster.js';
import { useTheme } from '../hooks/useTheme.js';
import { applyDocumentSeo } from '../components/MarketingLayout.js';

export default function TvPage() {
  const { slug } = useParams();
  const setAll = useWeatherStore((s) => s.setAll);
  const existingConfig = useWeatherStore((s) => s.config);
  const weather = useWeatherStore((s) => s.weather);
  const kiosk = new URLSearchParams(window.location.search).get('kiosk') === '1';
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Wall display follows station daylight unless the viewer pinned a theme.
  useTheme({ sunrise: weather.sunrise, sunset: weather.sunset, timeZone: existingConfig.timezone });

  const query = useQuery({
    queryKey: ['tv', slug],
    queryFn: () => fetchPublicTv(slug!),
    enabled: Boolean(slug),
    // Server caches this endpoint for 30s — polling faster only re-reads cache.
    refetchInterval: 30000,
    retry: 2,
  });

  useEffect(() => {
    if (query.data?.weather && query.data?.config) {
      const stationName =
        query.data.weather.stationName || query.data.config.stationName || '';
      setAll({
        // Merge units/name over the existing config instead of replacing it,
        // so unrelated keys (poll interval, coords, etc.) survive.
        weather: { ...query.data.weather, stationName },
        connection: query.data.connection,
        config: {
          ...existingConfig,
          unitTemp: query.data.config.unitTemp || existingConfig.unitTemp,
          unitWind: query.data.config.unitWind || existingConfig.unitWind,
          unitBaro: query.data.config.unitBaro || existingConfig.unitBaro,
          unitRain: query.data.config.unitRain || existingConfig.unitRain,
          stationName: stationName || existingConfig.stationName,
          cloudStationName:
            query.data.config.cloudStationName || existingConfig.cloudStationName,
        },
      });
      // Owner's display prefs win over this browser's last choice; explicit
      // ?layout= / ?contrast= URL params win over both (per-link override).
      const params = new URLSearchParams(window.location.search);
      const st = useWeatherStore.getState();
      const paramLayout = params.get('layout');
      const serverLayout = query.data.config.tileLayout;
      const layout =
        paramLayout === 'dense' || paramLayout === 'room'
          ? paramLayout
          : serverLayout === 'dense' || serverLayout === 'room'
            ? serverLayout
            : null;
      if (layout && st.tileLayout !== layout) st.setTileLayout(layout);
      const paramContrast = params.get('contrast');
      const serverContrast = query.data.config.highContrast;
      const contrast =
        paramContrast === 'high' ? true
        : paramContrast === 'standard' ? false
        : typeof serverContrast === 'boolean' ? serverContrast
        : null;
      if (contrast !== null && st.highContrast !== contrast) st.setHighContrast(contrast);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, setAll]);

  // Fullscreen chrome: the hint bar auto-hides while fullscreen so the
  // wall display is pure console (Esc/F or the taskbar button exits).
  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);
  // rem-based board scales with the ROOT font-size (container font-size does
  // not affect rem). Drive it from the viewport while a TV display is mounted.
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.fontSize;
    const apply = () => {
      const vw = window.innerWidth || 1280;
      const vh = window.innerHeight || 720;
      const next = Math.min(34, Math.max(15, vw * 0.01 + vh * 0.01));
      root.style.fontSize = `${next.toFixed(2)}px`;
    };
    apply();
    window.addEventListener('resize', apply);
    return () => {
      window.removeEventListener('resize', apply);
      root.style.fontSize = prev;
    };
  }, []);

  // Kiosk remote control: TV remotes/keyboards have no pointer — F fills
  // the screen, arrows flip multi-station displays, R retries the fetch.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (k === 'f') {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => undefined);
        }
      } else if (k === 'arrowleft') {
        useWeatherStore.getState().prevStation();
      } else if (k === 'arrowright') {
        useWeatherStore.getState().nextStation();
      } else if (k === 'r') {
        query.refetch();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wall displays are unlisted: noindex + self canonical (robots.txt
  // also disallows /tv/ as defense in depth).
  useEffect(() => {
    applyDocumentSeo({
      title: `TV display${weather.stationName ? ` — ${weather.stationName}` : ''} — Weatherlink Web Console`,
      description: 'Live WeatherLink station display for wall monitors and lobbies.',
      path: `/tv/${slug || ''}`,
      indexable: false,
    });
  }, [slug, weather.stationName]);

  // Kiosk hint: no chrome is visible, so announce the keys once on mount.
  useEffect(() => {
    if (!kiosk) return;
    const t = window.setTimeout(() => {
      toast('TV keys: F fullscreen · ←/→ switch station · R retry', 'info');
    }, 1200);
    return () => window.clearTimeout(t);
  }, [kiosk]);

  if (query.isError) {
    const rawMessage = (query.error as Error)?.message || 'Unable to load this display.';
    const status = (query.error as { status?: number })?.status;
    const code = (query.error as { code?: string })?.code;
    // Map backend states to viewer-safe copy (anonymous viewers can't fix
    // billing/suspension — only the station owner can).
    let friendlyMessage =
      'We could not reach the station for this display. Check your connection and try again.';
    if (status === 404 || /not found|no such|invalid slug/i.test(rawMessage)) {
      friendlyMessage =
        'This TV link looks invalid or has been removed. Ask the station owner for a fresh share link.';
    } else if (status === 402 || code === 'ACCESS_DENIED') {
      friendlyMessage =
        'This display is paused — the station subscription needs attention. Ask the station owner to check billing.';
    } else if (status === 403) {
      friendlyMessage =
        'This display is unavailable. Ask the station owner to check the account status.';
    } else if (status === 429) {
      friendlyMessage =
        'Too many displays are refreshing this link right now. Waiting a minute, then retrying.';
    }
    return (
      <div className="h-screen bg-[#0a0d14] flex items-center justify-center text-center p-6">
        <div className="max-w-sm w-full">
          <Wifi className="w-8 h-8 text-rose-400 mx-auto mb-3" />
          <h1 className="text-white font-bold">Display unavailable</h1>
          <p className="text-gray-400 text-sm mt-2">{friendlyMessage}</p>
          <details className="mt-3 text-left">
            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300">Technical details</summary>
            <p className="text-xs text-gray-400 mt-1 break-words">{rawMessage.slice(0, 300)}</p>
          </details>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              onClick={() => query.refetch()}
              className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold transition-colors min-h-[44px]"
            >
              Retry
            </button>
            <a
              href="/"
              className="px-5 py-2.5 rounded-xl border border-white/20 bg-white/5 text-white text-sm font-bold hover:bg-white/10 transition-colors min-h-[44px] inline-flex items-center"
            >
              Back home
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main id="main-content" aria-label={`TV weather display${weather.stationName ? ` — ${weather.stationName}` : ''}`} className={`tv-scaled screen-bg relative h-[100dvh] flex flex-col overflow-hidden ${kiosk ? 'kiosk' : ''}`}>
      <h1 className="sr-only">TV weather display{weather.stationName ? ` — ${weather.stationName}` : ''}</h1>
      <div className={`relative flex-1 flex flex-col min-h-0 px-[1vw] pt-[1vh] ${kiosk ? 'kiosk-drift' : ''}`}>
        <ConsoleBoard />
        {weather.ts === 0 && !query.isError && (
          <div role="status" aria-live="polite" className="absolute inset-0 bg-black/75 backdrop-blur-md z-30 flex items-center justify-center p-6">
            <div className="max-w-md bg-[#0e111a] border border-[#2d343f] rounded-2xl p-6 text-center">
              <Wifi className="w-6 h-6 text-amber-500 animate-pulse mx-auto mb-3" aria-hidden="true" />
              <h3 className="text-white font-bold">Waiting for weather data</h3>
              <p className="text-gray-400 text-xs mt-2">
                This TV display will update when the station comes online.
                {query.isFetching ? ' Checking now…' : ' Ask the station owner to check the console setup, then retry.'}
              </p>
              {!kiosk && (
                <div className="mt-4 flex items-center justify-center gap-2.5">
                  <button
                    onClick={() => query.refetch()}
                    disabled={query.isFetching}
                    className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold transition-colors min-h-[44px] disabled:opacity-50"
                  >
                    {query.isFetching ? 'Checking…' : 'Retry'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {!kiosk && <BottomBar onOpenSettings={() => undefined} hideSettings bare />}
      {!kiosk && !isFullscreen && (
        <p className="text-center text-[11px] text-gray-400 py-1 select-none" title={`wwebconsole.com/tv/${slug}`}>
          F fullscreen · ←/→ stations · R retry · wwebconsole.com/tv/{slug}
        </p>
      )}
    </main>
  );
}
