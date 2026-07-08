/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface WeatherData {
  // Outside Air (typically conditions type 1)
  temp: number; // °F
  feels_like: number; // °F
  hum: number; // %
  dew_point: number; // °F

  // Inside Air (typically conditions type 3)
  temp_in: number; // °F
  hum_in: number; // %

  // Barometer (typically conditions type 4)
  bar_sea_level: number; // in Hg
  bar_trend: number; // in Hg

  // Wind (typically conditions type 1)
  wind_speed_last: number; // mph
  wind_dir_last: number; // degrees
  wind_speed_avg_2_min: number; // mph
  wind_speed_avg_10_min: number; // mph

  // Rain (typically conditions type 1)
  rain_rate_last: number; // in/hr
  rainfall_daily: number; // in
  high_rain_rate_today: number; // in/hr
  high_rain_rate_time: string; // e.g. "8:32 am"

  // Sun & Moon (calculated / static for station location)
  sunrise: string; // "7:15 am"
  sunset: string; // "4:50 pm"
  moon_phase: string; // "waning crescent"
  
  // Status
  ts: number; // Unix timestamp
}

export interface WLLConfig {
  wllIpAddress: string;
  isSimulationMode: boolean;
}

export interface ConnectionState {
  status: 'online' | 'offline' | 'searching' | 'connecting';
  lastUdpReceived: number | null;
  lastHttpReceived: number | null;
  errorMessage: string | null;
}
