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
}

export interface PublicConfig {
  cloudApiVersion: 'v1' | 'v2';
  cloudDid: string;
  cloudStationId: string;
  cloudStationName: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  unitTemp: 'F' | 'C';
  unitWind: 'mph' | 'kmh' | 'kts' | 'ms';
  unitBaro: 'inHg' | 'hPa' | 'mmHg' | 'mb';
  unitRain: 'in' | 'mm';
  hasPassword: boolean;
  hasApiToken: boolean;
  hasApiSecret: boolean;
  stationName: string;
  wlPlan?: string;
  subscriptionStatus?: string;
  subscriptionExpiresAt?: number | null;
  pollIntervalSec?: number;
}

export interface StationCredentials {
  password?: string;
  apiToken?: string;
  apiSecret?: string;
}

export interface ConnectionState {
  status: 'online' | 'offline' | 'searching' | 'connecting';
  lastUdpReceived: number | null;
  lastHttpReceived: number | null;
  errorMessage: string | null;
}

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  SESSION_SECRET: string;
  CREDENTIALS_KEY: string;
  APP_NAME: string;
  APP_URL: string;
  /** Comma-separated admin emails (preferred). Falls back to ADMIN_EMAIL. */
  ADMIN_EMAILS?: string;
  ADMIN_EMAIL?: string;
  /** Optional Workers secrets that override D1 settings */
  TURNSTILE_SECRET_KEY?: string;
  RESEND_API_KEY?: string;
}

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: string;
  suspended: number;
  email_verified: number;
  free_until: number | null;
  notes: string;
  delete_requested_at: number | null;
  pending_email: string | null;
  pending_email_code_hash: string | null;
  pending_email_expires_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface StationRow {
  id: string;
  user_id: string;
  name: string;
  cloud_api_version: string;
  cloud_did: string;
  cloud_station_id: string;
  cloud_station_name: string;
  latitude: number | null;
  longitude: number | null;
  timezone?: string;
  credentials_enc: string;
  credentials_iv: string;
  unit_temp: string;
  unit_wind: string;
  unit_baro: string;
  unit_rain: string;
  last_http_at: number | null;
  last_error: string | null;
  weather_json: string | null;
  wl_plan?: string;
  device_label?: string;
  subscription_status?: string;
  subscription_expires_at?: number | null;
  poll_interval_sec?: number;
  created_at: number;
  updated_at: number;
}

export interface ShareLinkRow {
  id: string;
  station_id: string;
  user_id: string;
  slug: string;
  label: string;
  enabled: number;
  created_at: number;
  updated_at: number;
}

export interface DeviceRow {
  id: string;
  user_id: string;
  station_id: string | null;
  label: string;
  wl_plan: string;
  subscription_status: string;
  subscription_expires_at: number | null;
  poll_interval_sec: number;
  created_at: number;
  updated_at: number;
}

export type WlPlan = 'basic' | 'pro' | 'unknown';
export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'none';
