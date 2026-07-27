/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface WeatherData {
  temp: number;
  feels_like: number;
  hum: number;
  dew_point: number;
  temp_in: number;
  hum_in: number;
  bar_sea_level: number;
  bar_trend: number;
  wind_speed_last: number;
  wind_dir_last: number;
  wind_speed_avg_2_min: number;
  wind_speed_avg_10_min: number;
  wind_dir_10_min: number;
  rain_rate_last: number;
  rainfall_daily: number;
  high_rain_rate_today: number;
  high_rain_rate_time: string;
  sunrise: string;
  sunset: string;
  moon_phase: string;
  ts: number;
  stationName?: string;
  stationDid?: string;
  weatherList?: WeatherData[];
}

/** Public station config returned by API (secrets never included) */
export interface WLLConfig {
  cloudApiVersion?: 'v1' | 'v2';
  cloudDid?: string;
  cloudStationId?: string;
  cloudStationName?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  unitTemp?: 'F' | 'C';
  unitWind?: 'mph' | 'kmh' | 'kts' | 'ms';
  unitBaro?: 'inHg' | 'hPa' | 'mmHg' | 'mb';
  unitRain?: 'in' | 'mm';
  hasPassword?: boolean;
  hasApiToken?: boolean;
  hasApiSecret?: boolean;
  stationName?: string;
  wlPlan?: string;
  subscriptionStatus?: string;
  subscriptionExpiresAt?: number | null;
  pollIntervalSec?: number;
  /** @deprecated LAN mode is not available on Cloudflare Workers */
  wllIpAddress?: string;
  useCloudApi?: boolean;
}

export interface ConnectionState {
  status: 'online' | 'offline' | 'searching' | 'connecting';
  lastUdpReceived: number | null;
  lastHttpReceived: number | null;
  errorMessage: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role?: string;
  emailVerified?: boolean;
  suspended?: boolean;
  freeUntil?: number | null;
  deleteRequestedAt?: number | null;
  deleteEffectiveAt?: number | null;
  pendingEmail?: string | null;
}

export interface BillingInfo {
  role: string;
  suspended: boolean;
  emailVerified: boolean;
  freeUntil: number | null;
  accessOk: boolean;
  accessReason: string | null;
  subscriptionStatus: string;
  wlPlan: string;
  subscriptionExpiresAt: number | null;
  pollIntervalSec: number;
  deviceLabel: string;
}

export interface ShareLink {
  id: string;
  slug: string;
  label: string;
  enabled: boolean;
  url: string;
  created_at?: number;
}

export class ApiError extends Error {
  code?: string;
  status: number;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
