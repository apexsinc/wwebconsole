/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Onboarding helpers: setup-open event, demo weather payload, step model.
 */

export const OPEN_SETUP_EVENT = 'wwc:open-setup';

export function openStationSetup(tab: 'link' | 'tv' = 'link') {
  window.dispatchEvent(new CustomEvent(OPEN_SETUP_EVENT, { detail: { tab } }));
}

export const ONBOARDING_STEPS = [
  { id: 'connect', label: 'Connect station', hint: 'DID + API key' },
  { id: 'units', label: 'Units', hint: '°C/°F, km/h' },
  { id: 'share', label: 'Share TV', hint: '/tv link' },
] as const;

/** Canned payload so new users can preview the console before connecting. */
export function demoWeatherPayload(now = Date.now()) {
  return {
    weather: {
      temp: 72.4,
      feels_like: 73.1,
      hum: 58,
      dew_point: 56.2,
      temp_in: 74.8,
      hum_in: 44,
      bar_sea_level: 29.98,
      bar_trend: 0.01,
      wind_speed_last: 6.2,
      wind_dir_last: 225,
      wind_speed_avg_2_min: 5.4,
      wind_speed_avg_10_min: 4.8,
      wind_dir_10_min: 220,
      wind_gust_10_min: 7.8,
      rain_rate_last: 0,
      rainfall_daily: 0.02,
      high_rain_rate_today: 0.12,
      high_rain_rate_time: '2:40 PM',
      sunrise: '6:42 AM',
      sunset: '7:15 PM',
      moon_phase: 'Waxing Gibbous',
      ts: Math.floor(now / 1000),
      stationName: 'Demo Station',
      stationDid: 'DEMO',
    },
    connection: {
      status: 'online' as const,
      lastUdpReceived: null,
      lastHttpReceived: now,
      errorMessage: null,
    },
    config: {
      useCloudApi: true,
      cloudApiVersion: 'v2' as const,
      cloudDid: 'DEMO',
      cloudStationId: '',
      unitTemp: 'F' as const,
      unitWind: 'mph' as const,
      unitBaro: 'inHg' as const,
      unitRain: 'in' as const,
      stationName: 'Demo Station',
    },
  };
}
