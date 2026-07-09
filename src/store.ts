/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { WeatherData, WLLConfig, ConnectionState, AuthUser, BillingInfo } from './types.js';

interface WeatherStore {
  weather: WeatherData;
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
  setAll: (payload) =>
    set(() => ({
      weather: payload.weather,
      connection: payload.connection,
      config: payload.config,
      stationId: payload.stationId ?? null,
    })),
}));
