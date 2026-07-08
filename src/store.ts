/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { WeatherData, WLLConfig, ConnectionState } from './types.js';

interface WeatherStore {
  weather: WeatherData;
  connection: ConnectionState;
  config: WLLConfig;
  
  // Actions
  updateWeather: (data: WeatherData) => void;
  updateConnection: (conn: Partial<ConnectionState>) => void;
  updateConfig: (cfg: Partial<WLLConfig>) => void;
  setAll: (payload: { weather: WeatherData; connection: ConnectionState; config: WLLConfig }) => void;
}

export const useWeatherStore = create<WeatherStore>((set) => ({
  weather: {
    temp: 72.4,
    feels_like: 70.1,
    hum: 96.2,
    dew_point: 71.3,
    temp_in: 75.2,
    hum_in: 64.1,
    bar_sea_level: 29.875,
    bar_trend: -0.046,
    wind_speed_last: 2.4,
    wind_dir_last: 225,
    wind_speed_avg_2_min: 3.1,
    wind_speed_avg_10_min: 3.4,
    rain_rate_last: 3.01,
    rainfall_daily: 5.07,
    high_rain_rate_today: 2.42,
    high_rain_rate_time: '8:32 am',
    sunrise: '7:15 am',
    sunset: '4:50 pm',
    moon_phase: 'waning crescent',
    ts: Math.floor(Date.now() / 1000)
  },
  connection: {
    status: 'connecting',
    lastUdpReceived: null,
    lastHttpReceived: null,
    errorMessage: null,
  },
  config: {
    wllIpAddress: '192.168.1.100',
    isSimulationMode: true,
  },

  updateWeather: (data) => set((state) => ({ weather: { ...state.weather, ...data } })),
  updateConnection: (conn) => set((state) => ({ connection: { ...state.connection, ...conn } })),
  updateConfig: (cfg) => set((state) => ({ config: { ...state.config, ...cfg } })),
  setAll: (payload) => set(() => ({
    weather: payload.weather,
    connection: payload.connection,
    config: payload.config
  }))
}));
