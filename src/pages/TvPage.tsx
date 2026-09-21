/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Public TV wall display: same ConsoleBoard as /app, full-bleed for
 * projectors and big screens. Root font-size scales with the viewport so
 * the rem-based board fills any display proportionally (?kiosk=1 hides all
 * chrome and the cursor for unattended projection).
 */
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Wifi } from 'lucide-react';
import ConsoleBoard from '../components/ConsoleBoard.js';
import BottomBar from '../components/BottomBar.js';
import { useWeatherStore } from '../store.js';
import { fetchPublicTv } from '../services/api.js';

export default function TvPage() {
  const { slug } = useParams();
  const setAll = useWeatherStore((s) => s.setAll);
  const weather = useWeatherStore((s) => s.weather);
  const kiosk = new URLSearchParams(window.location.search).get('kiosk') === '1';

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

  if (query.isError) {
    const rawMessage = (query.error as Error)?.message || 'Unable to load this display.';
    const friendlyMessage = /not found|no such|invalid slug/i.test(rawMessage)
      ? 'This TV link looks invalid or expired. Check the URL or create a new share link from the console.'
      : 'We could not reach the station for this display. Check your connection and try again.';
    return (
      <div className="h-screen bg-[#0a0d14] flex items-center justify-center text-center p-6">
        <div className="max-w-sm w-full">
          <Wifi className="w-8 h-8 text-rose-400 mx-auto mb-3" />
          <h1 className="text-white font-bold">Display unavailable</h1>
          <p className="text-gray-400 text-sm mt-2">{friendlyMessage}</p>
          <details className="mt-3 text-left">
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300">Technical details</summary>
            <p className="text-xs text-gray-500 mt-1 break-words">{rawMessage.slice(0, 300)}</p>
          </details>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              onClick={() => query.refetch()}
              className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold transition-colors"
            >
              Retry
            </button>
            <a
              href="/"
              className="px-5 py-2.5 rounded-xl border border-white/20 bg-white/5 text-white text-sm font-bold hover:bg-white/10 transition-colors"
            >
              Back home
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`tv-scaled h-[100dvh] bg-[#070b14] flex flex-col overflow-hidden ${kiosk ? 'kiosk' : ''}`}>
      <div className={`flex-1 flex flex-col min-h-0 px-[1vw] pt-[1vh] ${kiosk ? 'kiosk-drift' : ''}`}>
        <ConsoleBoard />
        {weather.ts === 0 && !query.isError && (
          <div className="absolute inset-0 bg-black/75 backdrop-blur-md z-30 flex items-center justify-center p-6">
            <div className="max-w-md bg-[#0e111a] border border-[#2d343f] rounded-2xl p-6 text-center">
              <Wifi className="w-6 h-6 text-amber-500 animate-pulse mx-auto mb-3" />
              <h3 className="text-white font-bold">Waiting for weather data</h3>
              <p className="text-gray-400 text-xs mt-2">
                This TV display will update when the station comes online.
                {query.isFetching ? ' Checking now…' : ' Check the DID in /app → Configure, then retry.'}
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
                  <a
                    href="/app?setup=1"
                    className="px-5 py-2.5 rounded-xl border border-white/20 bg-white/5 text-white text-sm font-bold hover:bg-white/10 transition-colors min-h-[44px] inline-flex items-center"
                  >
                    Open setup
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {!kiosk && <BottomBar onOpenSettings={() => undefined} />}
      {!kiosk && (
        <p className="text-center text-[10px] text-gray-600 py-1 select-none">
          Press F for fullscreen · wwebconsole.com/tv/{slug}
        </p>
      )}
    </div>
  );
}
