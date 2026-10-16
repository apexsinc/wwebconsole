/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { WeatherData, WLLConfig, ConnectionState, AuthUser, BillingInfo, TileConfig } from './types.js';

function loadLocalCustomTiles(): Record<string, TileConfig> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem('wwc_custom_tiles');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalCustomTiles(tiles: Record<string, TileConfig>) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem('wwc_custom_tiles', JSON.stringify(tiles));
  } catch {
    /* ignore */
  }
}

interface WeatherStore {
  weather: WeatherData;
  weatherList: WeatherData[];
  currentStationIndex: number;
  autoSlideEnabled: boolean;
  connection: ConnectionState;
  config: WLLConfig;
  user: AuthUser | null;
  billing: BillingInfo | null;
  stationId: string | null;
  authChecked: boolean;
  trialDays: number | null;
  /** 6313-style display prefs (persisted to localStorage). */
  tileLayout: 'dense' | 'room';
  highContrast: boolean;
  /** Custom tile metric selection per position slot (persisted to localStorage & synced with station config). */
  customTiles: Record<string, TileConfig>;
  /** Timestamp (ms) when weather telemetry was last fetched from the API */
  lastFetchedAt: number;
  /** Whether a background/manual refresh is currently in progress */
  isRefreshing: boolean;
  /** Trailing wind-direction readings (oldest first, max 5) for the rose trail. */
  windDirHistory: number[];

  updateWeather: (data: WeatherData) => void;
  updateConnection: (conn: Partial<ConnectionState>) => void;
  updateConfig: (cfg: Partial<WLLConfig>) => void;
  setUser: (user: AuthUser | null) => void;
  setBilling: (billing: BillingInfo | null) => void;
  setTrialDays: (v: number | null) => void;
  setTileLayout: (v: 'dense' | 'room') => void;
  setHighContrast: (v: boolean) => void;
  setTileConfig: (tileKey: string, config: TileConfig) => void;
  setAllTileConfigs: (configs: Record<string, TileConfig>) => void;
  resetTileConfigs: () => void;
  setLastFetchedAt: (ts: number) => void;
  setIsRefreshing: (v: boolean) => void;
  setAuthChecked: (v: boolean) => void;
  setStationIndex: (index: number) => void;
  nextStation: () => void;
  prevStation: () => void;
  toggleAutoSlide: () => void;
  setAll: (payload: {
    weather: WeatherData;
    connection: ConnectionState;
    config: WLLConfig;
    stationId?: string;
  }) => void;
}

export const useWeatherStore = create<WeatherStore>((set) => ({
  weather: {
    temp: 0,
    feels_like: 0,
    hum: 0,
    dew_point: 0,
    temp_in: 0,
    hum_in: 0,
    bar_sea_level: 0,
    bar_trend: 0,
    wind_speed_last: 0,
    wind_dir_last: 0,
    wind_speed_avg_2_min: 0,
    wind_speed_avg_10_min: 0,
    wind_dir_10_min: 0,
    wind_gust_10_min: 0,
    rain_rate_last: 0,
    rainfall_daily: 0,
    high_rain_rate_today: 0,
    high_rain_rate_time: '--',
    sunrise: '--',
    sunset: '--',
    moon_phase: '--',
    ts: 0,
    stationName: '',
    stationDid: '',
  },
  weatherList: [],
  currentStationIndex: 0,
  autoSlideEnabled: true,
  connection: {
    status: 'connecting',
    lastUdpReceived: null,
    lastHttpReceived: null,
    errorMessage: null,
  },
  config: {
    useCloudApi: true,
    cloudApiVersion: 'v2',
    cloudDid: '',
    cloudStationId: '',
    unitTemp: 'C',
    unitWind: 'kmh',
    unitBaro: 'hPa',
    unitRain: 'mm',
  },
  user: null,
  billing: null,
  stationId: null,
  authChecked: false,
  trialDays: null,
  tileLayout: (typeof localStorage !== 'undefined' && localStorage.getItem('wwc_layout') === 'room' ? 'room' : 'dense') as 'dense' | 'room',
  highContrast: typeof localStorage !== 'undefined' && localStorage.getItem('wwc_contrast') === 'high',
  customTiles: loadLocalCustomTiles(),
  lastFetchedAt: Date.now(),
  isRefreshing: false,
  windDirHistory: [],

  updateWeather: (data) => set((state) => ({ weather: { ...state.weather, ...data } })),
  updateConnection: (conn) => set((state) => ({ connection: { ...state.connection, ...conn } })),
  updateConfig: (cfg) => set((state) => ({ config: { ...state.config, ...cfg } })),
  setUser: (user) => set({ user }),
  setBilling: (billing) => set({ billing }),
  setTrialDays: (trialDays) => set({ trialDays }),
  setLastFetchedAt: (lastFetchedAt) => set({ lastFetchedAt }),
  setIsRefreshing: (isRefreshing) => set({ isRefreshing }),
  setTileLayout: (tileLayout) => {
    try {
      localStorage.setItem('wwc_layout', tileLayout);
    } catch { /* ignore */ }
    set({ tileLayout });
  },
  setHighContrast: (highContrast) => {
    try {
      localStorage.setItem('wwc_contrast', highContrast ? 'high' : 'standard');
      document.documentElement.dataset.contrast = highContrast ? 'high' : 'standard';
    } catch { /* ignore */ }
    set({ highContrast });
  },
  setTileConfig: (tileKey, tileConfig) =>
    set((state) => {
      const next = { ...state.customTiles, [tileKey]: tileConfig };
      saveLocalCustomTiles(next);
      return { customTiles: next };
    }),
  setAllTileConfigs: (configs) => {
    saveLocalCustomTiles(configs);
    set({ customTiles: configs });
  },
  resetTileConfigs: () => {
    saveLocalCustomTiles({});
    set({ customTiles: {} });
  },
  setAuthChecked: (authChecked) => set({ authChecked }),
  setStationIndex: (index) =>
    set((state) => {
      const maxIndex = state.weatherList.length > 0 ? state.weatherList.length - 1 : 0;
      const validIndex = Math.max(0, Math.min(index, maxIndex));
      return {
        currentStationIndex: validIndex,
        weather: state.weatherList[validIndex] || state.weather,
      };
    }),
  nextStation: () =>
    set((state) => {
      if (state.weatherList.length <= 1) return state;
      const nextIdx = (state.currentStationIndex + 1) % state.weatherList.length;
      return {
        currentStationIndex: nextIdx,
        weather: state.weatherList[nextIdx] || state.weather,
      };
    }),
  prevStation: () =>
    set((state) => {
      if (state.weatherList.length <= 1) return state;
      const prevIdx = (state.currentStationIndex - 1 + state.weatherList.length) % state.weatherList.length;
      return {
        currentStationIndex: prevIdx,
        weather: state.weatherList[prevIdx] || state.weather,
      };
    }),
  toggleAutoSlide: () => set((state) => ({ autoSlideEnabled: !state.autoSlideEnabled })),
  setAll: (payload) =>
    set((state) => {
      const list = payload.weather?.weatherList && payload.weather.weatherList.length > 0
        ? payload.weather.weatherList
        : [payload.weather];
      const validIdx = state.currentStationIndex < list.length ? state.currentStationIndex : 0;
      const activeWeather = list[validIdx] || payload.weather;
      // Roll the wind-direction trail on fresh data (max 5, oldest first).
      const incomingTs = activeWeather.ts || 0;
      const isFresh = incomingTs > 0 && (
        incomingTs !== state.weather.ts ||
        activeWeather.wind_dir_last !== state.weather.wind_dir_last ||
        activeWeather.wind_speed_last !== state.weather.wind_speed_last
      );
      const windDirHistory =
        isFresh && typeof activeWeather.wind_dir_last === 'number'
          ? [...state.windDirHistory, activeWeather.wind_dir_last].slice(-5)
          : state.windDirHistory;
      let customTiles = state.customTiles;
      if (
        Object.keys(customTiles).length === 0 &&
        payload.config?.customTiles &&
        Object.keys(payload.config.customTiles).length > 0
      ) {
        customTiles = payload.config.customTiles;
        saveLocalCustomTiles(customTiles);
      }

      return {
        weather: activeWeather,
        weatherList: list,
        currentStationIndex: validIdx,
        connection: payload.connection,
        config: payload.config,
        stationId: payload.stationId ?? null,
        windDirHistory,
        customTiles,
        lastFetchedAt: Date.now(),
        isRefreshing: false,
      };
    }),
}));
