import * as SunCalc from 'suncalc';
import { normalizeWlPlan, syncPollInterval } from './billing';
import { decryptJson, encryptJson, hmacSha256Hex } from './crypto';
import type { Env, PublicConfig, StationCredentials, StationRow, WeatherData } from './types';

export function emptyWeather(): WeatherData {
  return {
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
  };
}

export function toPublicConfig(row: StationRow, creds: StationCredentials): PublicConfig {
  return {
    cloudApiVersion: (row.cloud_api_version === 'v1' ? 'v1' : 'v2') as 'v1' | 'v2',
    cloudDid: row.cloud_did,
    cloudStationId: row.cloud_station_id,
    cloudStationName: row.cloud_station_name,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    timezone: row.timezone || undefined,
    unitTemp: (row.unit_temp as PublicConfig['unitTemp']) || 'C',
    unitWind: (row.unit_wind as PublicConfig['unitWind']) || 'kmh',
    unitBaro: (row.unit_baro as PublicConfig['unitBaro']) || 'hPa',
    unitRain: (row.unit_rain as PublicConfig['unitRain']) || 'mm',
    hasPassword: Boolean(creds.password),
    hasApiToken: Boolean(creds.apiToken),
    hasApiSecret: Boolean(creds.apiSecret),
    stationName: row.name,
    wlPlan: row.wl_plan || 'unknown',
    subscriptionStatus: row.subscription_status || 'trial',
    subscriptionExpiresAt: row.subscription_expires_at ?? null,
    pollIntervalSec: row.poll_interval_sec ?? 900,
  };
}

export function parseStoredWeather(row: StationRow): WeatherData {
  if (!row.weather_json) return emptyWeather();
  try {
    return { ...emptyWeather(), ...JSON.parse(row.weather_json) };
  } catch {
    return emptyWeather();
  }
}

/** Format a Date in the station's IANA timezone (Workers run in UTC). */
function formatStationTime(date: Date, timeZone?: string | null, tzOffsetSeconds?: number | null): string {
  if (timeZone) {
    try {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone,
      });
    } catch {
      /* fall through */
    }
  }
  if (tzOffsetSeconds != null && Number.isFinite(tzOffsetSeconds)) {
    const shifted = new Date(date.getTime() + tzOffsetSeconds * 1000);
    let h = shifted.getUTCHours();
    const m = shifted.getUTCMinutes();
    const ampm = h >= 12 ? 'pm' : 'am';
    h = h % 12 || 12;
    return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
  }
  // Last resort: UTC (will look wrong for non-UTC stations)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
}

function applySunMoon(
  weather: WeatherData,
  lat?: number | null,
  lon?: number | null,
  timeZone?: string | null,
  tzOffsetSeconds?: number | null
) {
  const dateObj = weather.ts > 0 ? new Date(weather.ts * 1000) : new Date();
  const moonIllum = SunCalc.getMoonIllumination(dateObj);
  const phase = moonIllum.phase;
  if (phase < 0.05 || phase > 0.95) weather.moon_phase = 'new moon';
  else if (phase < 0.2) weather.moon_phase = 'waxing crescent';
  else if (phase < 0.3) weather.moon_phase = 'first quarter';
  else if (phase < 0.45) weather.moon_phase = 'waxing gibbous';
  else if (phase < 0.55) weather.moon_phase = 'full moon';
  else if (phase < 0.7) weather.moon_phase = 'waning gibbous';
  else if (phase < 0.8) weather.moon_phase = 'last quarter';
  else weather.moon_phase = 'waning crescent';

  if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) return;
  try {
    const times = SunCalc.getTimes(dateObj, lat, lon);
    if (times.sunrise) weather.sunrise = formatStationTime(times.sunrise, timeZone, tzOffsetSeconds);
    if (times.sunset) weather.sunset = formatStationTime(times.sunset, timeZone, tzOffsetSeconds);
  } catch {
    /* ignore */
  }
}

function pickStationFromList(stations: any[], cloudDid: string) {
  if (!stations.length) return null;
  if (!cloudDid) return stations[0];
  const cleanDid = cloudDid.replace(/:/g, '').toUpperCase();
  return (
    stations.find(
      (s) =>
        (s.did && String(s.did).replace(/:/g, '').toUpperCase() === cleanDid) ||
        (s.did_gateway && String(s.did_gateway).replace(/:/g, '').toUpperCase() === cleanDid) ||
        (s.device_id && String(s.device_id).replace(/:/g, '').toUpperCase() === cleanDid) ||
        (s.gateway_id_hex && String(s.gateway_id_hex).replace(/:/g, '').toUpperCase() === cleanDid)
    ) || stations[0]
  );
}

function applyStationMeta(row: StationRow, station: any) {
  if (!station) return;
  if (station.station_id != null) row.cloud_station_id = String(station.station_id);
  row.cloud_station_name = station.station_name || station.name || row.cloud_station_name || 'WeatherLink Cloud (V2)';
  if (station.latitude !== undefined && station.latitude !== null) row.latitude = Number(station.latitude);
  if (station.longitude !== undefined && station.longitude !== null) row.longitude = Number(station.longitude);
  if (station.time_zone) row.timezone = String(station.time_zone);

  // Infer WeatherLink subscription tier from station metadata when present
  const planHint =
    station.subscription_type ||
    station.subscription ||
    station.plan ||
    station.product_number ||
    '';
  const inferred = normalizeWlPlan(String(planHint));
  if (inferred !== 'unknown') row.wl_plan = inferred;
  // Product numbers: many Pro/WLL cloud products; treat explicit "basic" strings only as basic
  if (inferred === 'unknown' && station.subscription_end_date) {
    // Active paid WeatherLink cloud subscription often implies Pro-capable data; keep unknown until admin/user sets it
  }
}

/** Always refresh lat/lon/timezone from WeatherLink /stations (source of truth). */
async function syncV2StationMeta(row: StationRow, creds: StationCredentials): Promise<any[]> {
  if (!creds.apiToken || !creds.apiSecret) return [];
  const ts = Math.floor(Date.now() / 1000);
  const sigStr = `api-key${creds.apiToken}t${ts}`;
  const sig = await hmacSha256Hex(creds.apiSecret, sigStr);
  const stRes = await fetch(
    `https://api.weatherlink.com/v2/stations?api-key=${encodeURIComponent(creds.apiToken)}&t=${ts}&api-signature=${sig}`,
    { signal: AbortSignal.timeout(8000) }
  );
  if (!stRes.ok) throw new Error(`Station lookup failed (${stRes.status})`);
  const stData = (await stRes.json()) as { stations?: any[] };
  if (!stData.stations?.length) throw new Error('No stations found for this API Key');

  let target: any = null;
  if (row.cloud_station_id) {
    target = stData.stations.find((s) => String(s.station_id) === String(row.cloud_station_id));
  }
  if (!target) target = pickStationFromList(stData.stations, row.cloud_did);
  applyStationMeta(row, target);
  return stData.stations;
}

async function getCredentials(env: Env, row: StationRow): Promise<StationCredentials> {
  return decryptJson<StationCredentials>(env.CREDENTIALS_KEY, row.credentials_enc, row.credentials_iv);
}

async function persistStation(
  env: Env,
  row: StationRow,
  weather: WeatherData,
  error: string | null,
  online: boolean
) {
  const now = Date.now();
  await env.DB.prepare(
    `UPDATE stations SET
      cloud_station_id = ?, cloud_station_name = ?, latitude = ?, longitude = ?, timezone = ?,
      wl_plan = COALESCE(?, wl_plan), poll_interval_sec = COALESCE(?, poll_interval_sec),
      weather_json = ?, last_http_at = ?, last_error = ?, updated_at = ?
     WHERE id = ?`
  )
    .bind(
      row.cloud_station_id,
      row.cloud_station_name,
      row.latitude,
      row.longitude,
      row.timezone || '',
      row.wl_plan || null,
      row.poll_interval_sec ?? null,
      JSON.stringify(weather),
      online ? now : row.last_http_at,
      error,
      now,
      row.id
    )
    .run();
}

async function fetchV2(row: StationRow, creds: StationCredentials, weather: WeatherData): Promise<number | null> {
  if (!creds.apiToken || !creds.apiSecret) {
    throw new Error('Cloud API V2 requires API Key and API Secret');
  }

  // Always sync lat/lon/time_zone from /stations so sunrise/sunset stay accurate
  const stationsList = await syncV2StationMeta(row, creds);

  if (!stationsList || !stationsList.length) {
    throw new Error('Missing Station ID and auto-lookup failed');
  }

  // Parse multi-DID if user provided comma-separated DIDs
  const dids = (row.cloud_did || '')
    .split(',')
    .map((s) => s.trim().replace(/:/g, '').toUpperCase())
    .filter(Boolean);

  // Always poll ALL stations on the API key so every device appears in weatherList.
  // If cloud_did is set, put matching stations first (they become the primary/default view),
  // but append the remaining stations so users can navigate to them via the < > arrows.
  let targetStations: any[];
  if (dids.length > 0) {
    const matching = stationsList.filter((s) => {
      const sDid = String(s.did || s.did_gateway || s.device_id || s.gateway_id_hex || s.station_id || '').replace(/:/g, '').toUpperCase();
      return dids.some((d) => sDid.includes(d) || d.includes(sDid));
    });
    const rest = stationsList.filter((s) => {
      const sDid = String(s.did || s.did_gateway || s.device_id || s.gateway_id_hex || s.station_id || '').replace(/:/g, '').toUpperCase();
      return !dids.some((d) => sDid.includes(d) || d.includes(sDid));
    });
    targetStations = [...matching, ...rest];
  } else {
    targetStations = stationsList;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const weatherList: WeatherData[] = [];
  let primaryTzOffset: number | null = null;

  for (const stMeta of targetStations) {
    const stId = String(stMeta.station_id);
    const stringToHash = `api-key${creds.apiToken}station-id${stId}t${timestamp}`;
    const signature = await hmacSha256Hex(creds.apiSecret, stringToHash);
    const response = await fetch(
      `https://api.weatherlink.com/v2/current/${stId}?api-key=${encodeURIComponent(creds.apiToken)}&t=${timestamp}&api-signature=${signature}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!response.ok) continue;
    const data = (await response.json()) as { sensors?: any[]; generated_at?: number };
    if (!data.sensors) continue;

    const itemWeather: WeatherData = emptyWeather();
    let tzOffsetSeconds: number | null = null;

    for (const sensor of data.sensors) {
      if (!sensor.data?.length) continue;
      const cond = sensor.data[0];
      const dst = sensor.data_structure_type;

      if (cond.tz_offset !== undefined && cond.tz_offset !== null) {
        tzOffsetSeconds = Number(cond.tz_offset);
      }

      if (dst === 21 || dst === 22) {
        if (cond.temp_in !== undefined) itemWeather.temp_in = Number(cond.temp_in);
        if (cond.hum_in !== undefined) itemWeather.hum_in = Number(cond.hum_in);
      }
      if (dst === 19 || dst === 20) {
        if (cond.bar_sea_level !== undefined) itemWeather.bar_sea_level = Number(cond.bar_sea_level);
        if (cond.bar_trend !== undefined) itemWeather.bar_trend = Number(cond.bar_trend);
      }
      if (dst !== 21 && dst !== 22 && dst !== 19 && dst !== 20 && dst !== 27) {
        if (cond.temp !== undefined) itemWeather.temp = Number(cond.temp);
        if (cond.hum !== undefined) itemWeather.hum = Number(cond.hum);
        if (cond.dew_point !== undefined) itemWeather.dew_point = Number(cond.dew_point);
        if (cond.thw_index !== undefined) itemWeather.feels_like = Number(cond.thw_index);
        else if (cond.wind_chill !== undefined && cond.temp !== undefined && Number(cond.wind_chill) < Number(cond.temp)) {
          itemWeather.feels_like = Number(cond.wind_chill);
        } else if (cond.heat_index !== undefined && cond.temp !== undefined && Number(cond.heat_index) > Number(cond.temp)) {
          itemWeather.feels_like = Number(cond.heat_index);
        } else if (cond.temp !== undefined) {
          itemWeather.feels_like = Number(cond.temp);
        }
        if (cond.wind_speed_last !== undefined) itemWeather.wind_speed_last = Number(cond.wind_speed_last);
        if (cond.wind_dir_last !== undefined) itemWeather.wind_dir_last = Number(cond.wind_dir_last);
        if (cond.wind_speed_avg_last_2_min !== undefined) itemWeather.wind_speed_avg_2_min = Number(cond.wind_speed_avg_last_2_min);
        if (cond.wind_speed_avg_last_10_min !== undefined) itemWeather.wind_speed_avg_10_min = Number(cond.wind_speed_avg_last_10_min);
        if (cond.wind_dir_scalar_avg_last_10_min !== undefined) itemWeather.wind_dir_10_min = Number(cond.wind_dir_scalar_avg_last_10_min);
        if (cond.rain_rate_last_in !== undefined) itemWeather.rain_rate_last = Number(cond.rain_rate_last_in);
        else if (cond.rain_rate_last !== undefined) itemWeather.rain_rate_last = Number(cond.rain_rate_last);
        if (cond.rainfall_day_in !== undefined) itemWeather.rainfall_daily = Number(cond.rainfall_day_in);
        else if (cond.rainfall_daily_in !== undefined) itemWeather.rainfall_daily = Number(cond.rainfall_daily_in);
        else if (cond.rainfall_daily !== undefined) itemWeather.rainfall_daily = Number(cond.rainfall_daily);
        if (cond.rain_rate_hi_in !== undefined) itemWeather.high_rain_rate_today = Number(cond.rain_rate_hi_in);
      }
    }

    itemWeather.ts = data.generated_at || Math.floor(Date.now() / 1000);
    itemWeather.stationName = stMeta.station_name || stMeta.name || row.cloud_station_name || row.name || 'WeatherLink Cloud (V2)';
    itemWeather.stationDid = String(stMeta.did || stMeta.station_id || stId);
    applySunMoon(itemWeather, stMeta.latitude ?? row.latitude, stMeta.longitude ?? row.longitude, stMeta.time_zone ?? row.timezone, tzOffsetSeconds);

    weatherList.push(itemWeather);
    if (primaryTzOffset === null) primaryTzOffset = tzOffsetSeconds;
  }

  if (weatherList.length > 0) {
    Object.assign(weather, weatherList[0]);
    weather.weatherList = weatherList;
  } else {
    weather.ts = timestamp;
    weather.stationName = row.cloud_station_name || row.name || 'WeatherLink Cloud (V2)';
    weather.stationDid = row.cloud_station_id;
  }

  return primaryTzOffset;
}

async function fetchV1(row: StationRow, creds: StationCredentials, weather: WeatherData) {
  if (!row.cloud_did || !creds.password || !creds.apiToken) {
    throw new Error('Cloud API V1 requires DID, Password, and API Token');
  }
  const dids = row.cloud_did.split(',').map((s) => s.trim()).filter(Boolean);
  const weatherList: WeatherData[] = [];
  let lastError = 'No weather data returned from WeatherLink V1 API';

  for (const rawDid of dids) {
    const cleanDid = rawDid.replace(/:/g, '').trim().toUpperCase();
    if (!cleanDid) continue;

    const url = new URL('https://api.weatherlink.com/v1/NoaaExt.json');
    url.searchParams.set('user', cleanDid);
    url.searchParams.set('pass', creds.password);
    url.searchParams.set('apiToken', creds.apiToken);

    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    } catch (err: any) {
      lastError = `Network timeout or connection error for DID ${cleanDid}: ${err.message}`;
      continue;
    }

    if (!response.ok) {
      lastError = `WeatherLink V1 API returned HTTP ${response.status} for DID ${cleanDid}. Check credentials.`;
      continue;
    }

    const data = (await response.json().catch(() => null)) as any;
    if (!data) {
      lastError = `WeatherLink V1 API returned an empty response for DID ${cleanDid}`;
      continue;
    }

    if (data.error || data.reason || data.ResultCode) {
      const msg =
        data.error?.message ||
        data.error ||
        data.reason ||
        (data.ResultCode ? `Error code ${data.ResultCode}` : 'Invalid credentials or DID');
      lastError = `WeatherLink V1 error for DID ${cleanDid}: ${msg}`;
      continue;
    }

    const itemWeather: WeatherData = emptyWeather();
    const davis = data.davis_current_observation || {};

    itemWeather.temp =
      data.temp_f !== undefined
        ? Number(data.temp_f)
        : davis.temp_f !== undefined
        ? Number(davis.temp_f)
        : itemWeather.temp;
    itemWeather.hum =
      data.relative_humidity !== undefined
        ? Number(data.relative_humidity)
        : davis.relative_humidity !== undefined
        ? Number(davis.relative_humidity)
        : itemWeather.hum;
    itemWeather.dew_point =
      data.dewpoint_f !== undefined
        ? Number(data.dewpoint_f)
        : davis.dewpoint_f !== undefined
        ? Number(davis.dewpoint_f)
        : itemWeather.dew_point;

    const windChill = data.windchill_f ?? davis.windchill_f;
    const heatIndex = data.heat_index_f ?? davis.heat_index_f;
    if (windChill !== undefined && Number(windChill) < itemWeather.temp) {
      itemWeather.feels_like = Number(windChill);
    } else if (heatIndex !== undefined && Number(heatIndex) > itemWeather.temp) {
      itemWeather.feels_like = Number(heatIndex);
    } else {
      itemWeather.feels_like = itemWeather.temp;
    }

    itemWeather.temp_in =
      davis.temp_in_f !== undefined
        ? Number(davis.temp_in_f)
        : data.temp_in_f !== undefined
        ? Number(data.temp_in_f)
        : itemWeather.temp_in;
    itemWeather.hum_in =
      davis.relative_humidity_in !== undefined
        ? Number(davis.relative_humidity_in)
        : data.relative_humidity_in !== undefined
        ? Number(data.relative_humidity_in)
        : itemWeather.hum_in;

    const press = data.pressure_in ?? davis.pressure_in;
    itemWeather.bar_sea_level = press !== undefined ? Number(press) : itemWeather.bar_sea_level;

    const trend = String(data.pressure_trend || davis.pressure_trend || '').toLowerCase();
    if (trend.includes('fall') || trend.includes('down') || trend.includes('-')) itemWeather.bar_trend = -0.02;
    else if (trend.includes('rise') || trend.includes('up') || trend.includes('+')) itemWeather.bar_trend = 0.02;
    else itemWeather.bar_trend = 0;

    itemWeather.wind_speed_last =
      data.wind_mph !== undefined
        ? Number(data.wind_mph)
        : davis.wind_mph !== undefined
        ? Number(davis.wind_mph)
        : itemWeather.wind_speed_last;
    itemWeather.wind_dir_last =
      data.wind_degrees !== undefined
        ? Number(data.wind_degrees)
        : davis.wind_degrees !== undefined
        ? Number(davis.wind_degrees)
        : itemWeather.wind_dir_last;
    itemWeather.wind_speed_avg_10_min =
      davis.wind_ten_min_ave_mph !== undefined
        ? Number(davis.wind_ten_min_ave_mph)
        : data.wind_ten_min_ave_mph !== undefined
        ? Number(data.wind_ten_min_ave_mph)
        : itemWeather.wind_speed_avg_10_min;
    itemWeather.wind_speed_avg_2_min = itemWeather.wind_speed_last;

    itemWeather.rain_rate_last =
      davis.rain_rate_in_per_hr !== undefined
        ? Number(davis.rain_rate_in_per_hr)
        : data.rain_rate_in_per_hr !== undefined
        ? Number(data.rain_rate_in_per_hr)
        : itemWeather.rain_rate_last;
    itemWeather.rainfall_daily =
      davis.rain_day_in !== undefined
        ? Number(davis.rain_day_in)
        : data.rain_day_in !== undefined
        ? Number(data.rain_day_in)
        : itemWeather.rainfall_daily;
    itemWeather.high_rain_rate_today =
      davis.rain_rate_day_high_in_per_hr !== undefined
        ? Number(davis.rain_rate_day_high_in_per_hr)
        : data.rain_rate_day_high_in_per_hr !== undefined
        ? Number(data.rain_rate_day_high_in_per_hr)
        : itemWeather.high_rain_rate_today;

    itemWeather.ts = data.observation_time_rfc822
      ? Math.floor(new Date(data.observation_time_rfc822).getTime() / 1000)
      : Math.floor(Date.now() / 1000);
    itemWeather.stationName = davis.station_name || data.station_name || row.name || `WeatherLink V1 (${cleanDid})`;
    itemWeather.stationDid = data.DID || davis.DID || cleanDid;

    const lat =
      data.latitude !== undefined
        ? Number(data.latitude)
        : davis.latitude !== undefined
        ? Number(davis.latitude)
        : row.latitude;
    const lon =
      data.longitude !== undefined
        ? Number(data.longitude)
        : davis.longitude !== undefined
        ? Number(davis.longitude)
        : row.longitude;

    applySunMoon(itemWeather, lat, lon, row.timezone, null);

    weatherList.push(itemWeather);
  }

  if (weatherList.length === 0) {
    throw new Error(lastError);
  }

  Object.assign(weather, weatherList[0]);
  weather.weatherList = weatherList;
}

export async function refreshStation(env: Env, row: StationRow) {
  const weather = parseStoredWeather(row);
  const creds = await getCredentials(env, row);
  let tzOffsetSeconds: number | null = null;

  try {
    if (row.cloud_api_version === 'v1') {
      await fetchV1(row, creds, weather);
    } else {
      tzOffsetSeconds = await fetchV2(row, creds, weather);
    }
    applySunMoon(weather, row.latitude, row.longitude, row.timezone, tzOffsetSeconds);
    await syncPollInterval(env, row);
    await persistStation(env, row, weather, null, true);
    return { weather, error: null as string | null, online: true };
  } catch (err: any) {
    const message = err?.message || 'WeatherLink poll failed';
    applySunMoon(weather, row.latitude, row.longitude, row.timezone, tzOffsetSeconds);
    await persistStation(env, row, weather, message, false);
    return { weather, error: message, online: false };
  }
}

export function connectionFromRow(row: StationRow, weather: WeatherData, error: string | null) {
  const lastHttp = row.last_http_at;
  const online = weather.ts > 0 && lastHttp != null && Date.now() - lastHttp < 180_000 && !error;
  return {
    status: (online ? 'online' : 'offline') as 'online' | 'offline',
    lastUdpReceived: null as number | null,
    lastHttpReceived: lastHttp,
    errorMessage: error || row.last_error,
  };
}

export async function saveCredentials(
  env: Env,
  existing: StationCredentials,
  patch: Partial<StationCredentials> & { apiVersion?: 'v1' | 'v2' }
): Promise<{ enc: string; iv: string }> {
  const version = patch.apiVersion || 'v2';
  const merged: StationCredentials = { ...existing };

  if (version === 'v1') {
    // V1 only: DID + password + apiToken. Clear V2 secret.
    if (patch.password !== undefined && patch.password !== '') merged.password = patch.password;
    if (patch.apiToken !== undefined && patch.apiToken !== '') merged.apiToken = patch.apiToken;
    merged.apiSecret = undefined;
  } else {
    // V2 only: apiToken + apiSecret (+ optional password for hybrid sunrise). Clear nothing required for v1 password unless empty overwrite.
    if (patch.apiToken !== undefined && patch.apiToken !== '') merged.apiToken = patch.apiToken;
    if (patch.apiSecret !== undefined && patch.apiSecret !== '') merged.apiSecret = patch.apiSecret;
    if (patch.password !== undefined) {
      if (patch.password === '') merged.password = undefined;
      else merged.password = patch.password;
    }
  }

  return encryptJson(env.CREDENTIALS_KEY, merged);
}

export async function getStationForUser(env: Env, userId: string): Promise<StationRow | null> {
  return env.DB.prepare('SELECT * FROM stations WHERE user_id = ?').bind(userId).first<StationRow>();
}

export async function getStationById(env: Env, id: string): Promise<StationRow | null> {
  return env.DB.prepare('SELECT * FROM stations WHERE id = ?').bind(id).first<StationRow>();
}
