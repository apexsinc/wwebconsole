/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { WeatherData, WLLConfig, ConnectionState, AuthUser, BillingInfo } from './types.js';

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

  updateWeather: (data: WeatherData) => void;
  updateConnection: (conn: Partial<ConnectionState>) => void;
  updateConfig: (cfg: Partial<WLLConfig>) => void;
  setUser: (user: AuthUser | null) => void;
  setBilling: (billing: BillingInfo | null) => void;
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
    rain_rate_last: 0,
    rainfall_daily: 0,
    high_rain_rate_today: 0,
    high_rain_rate_time: '--',
    sunrise: '--',
    sunset: '--',
    moon_phase: '--',
    ts: 0,
    stationName: 'Offline Console',
    stationDid: 'Unconfigured',
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

  updateWeather: (data) => set((state) => ({ weather: { ...state.weather, ...data } })),
  updateConnection: (conn) => set((state) => ({ connection: { ...state.connection, ...conn } })),
  updateConfig: (cfg) => set((state) => ({ config: { ...state.config, ...cfg } })),
  setUser: (user) => set({ user }),
  setBilling: (billing) => set({ billing }),
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
      return {
        weather: activeWeather,
        weatherList: list,
        currentStationIndex: validIdx,
        connection: payload.connection,
        config: payload.config,
        stationId: payload.stationId ?? null,
      };
    }),
}));
