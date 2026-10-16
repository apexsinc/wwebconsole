/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Tile Registry: Metric definitions, presets, and formatters for customizable console tiles.
 * Supports all WeatherLink API telemetry: Solar Radiation, UV Index, Air Quality,
 * Inside/Outside Temperature, Humidity, Barometer, Wind Speeds, and Rain.
 */
import type { LucideIcon } from 'lucide-react';
import {
  Thermometer,
  Droplet,
  Cloud,
  Wind,
  CloudRain,
  Sun,
  SunMedium,
  Home,
  ShieldCheck,
  Activity,
  Flame,
  Gauge,
} from 'lucide-react';
import type { WeatherData, WLLConfig, TileConfig } from '../types.js';
import {
  convertTemp, getTempUnit,
  convertWind, getWindUnit,
  convertBaro, getBaroUnit, baroDecimals,
  convertRain, getRainUnit, rainDecimals,
} from './units.js';

export type MetricCategory =
  | 'Solar & UV'
  | 'Temperature'
  | 'Humidity & Moisture'
  | 'Wind'
  | 'Barometer'
  | 'Rain'
  | 'Indoor'
  | 'Air Quality';

export interface MetricDefinition {
  id: string;
  label: string;
  shortLabel: string;
  category: MetricCategory;
  icon: LucideIcon;
  format: (weather: WeatherData, config: WLLConfig) => { value: string; unit: string };
}

export interface TilePreset {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  config: TileConfig;
}

export const METRIC_REGISTRY: Record<string, MetricDefinition> = {
  // Solar & UV
  solar_rad: {
    id: 'solar_rad',
    label: 'Solar Radiation',
    shortLabel: 'Solar',
    category: 'Solar & UV',
    icon: Sun,
    format: (w) => ({
      value: (w.solar_rad ?? 0).toFixed(0),
      unit: 'W/m²',
    }),
  },
  uv_index: {
    id: 'uv_index',
    label: 'UV Index',
    shortLabel: 'UV',
    category: 'Solar & UV',
    icon: SunMedium,
    format: (w) => ({
      value: (w.uv_index ?? 0).toFixed(1),
      unit: 'INDEX',
    }),
  },
  thsw_index: {
    id: 'thsw_index',
    label: 'THSW Index (Sun/Wind)',
    shortLabel: 'THSW',
    category: 'Solar & UV',
    icon: Flame,
    format: (w, c) => ({
      value: convertTemp(w.thsw_index ?? w.feels_like, c.unitTemp).toFixed(1),
      unit: getTempUnit(c.unitTemp),
    }),
  },

  // Temperature
  temp: {
    id: 'temp',
    label: 'Outside Temperature',
    shortLabel: 'Outside Temp',
    category: 'Temperature',
    icon: Thermometer,
    format: (w, c) => ({
      value: convertTemp(w.temp, c.unitTemp).toFixed(1),
      unit: getTempUnit(c.unitTemp),
    }),
  },
  feels_like: {
    id: 'feels_like',
    label: 'Feels Like',
    shortLabel: 'Feels Like',
    category: 'Temperature',
    icon: Thermometer,
    format: (w, c) => ({
      value: convertTemp(w.feels_like, c.unitTemp).toFixed(1),
      unit: getTempUnit(c.unitTemp),
    }),
  },
  dew_point: {
    id: 'dew_point',
    label: 'Dew Point',
    shortLabel: 'Dew Point',
    category: 'Temperature',
    icon: Droplet,
    format: (w, c) => ({
      value: convertTemp(w.dew_point, c.unitTemp).toFixed(1),
      unit: getTempUnit(c.unitTemp),
    }),
  },
  wet_bulb: {
    id: 'wet_bulb',
    label: 'Wet Bulb Temperature',
    shortLabel: 'Wet Bulb',
    category: 'Temperature',
    icon: Thermometer,
    format: (w, c) => ({
      value: convertTemp(w.wet_bulb ?? w.temp, c.unitTemp).toFixed(1),
      unit: getTempUnit(c.unitTemp),
    }),
  },
  temp_hi: {
    id: 'temp_hi',
    label: 'High Temp Today',
    shortLabel: 'High Temp',
    category: 'Temperature',
    icon: Thermometer,
    format: (w, c) => ({
      value: convertTemp(w.temp_hi ?? w.temp, c.unitTemp).toFixed(1),
      unit: getTempUnit(c.unitTemp),
    }),
  },
  temp_low: {
    id: 'temp_low',
    label: 'Low Temp Today',
    shortLabel: 'Low Temp',
    category: 'Temperature',
    icon: Thermometer,
    format: (w, c) => ({
      value: convertTemp(w.temp_low ?? w.temp, c.unitTemp).toFixed(1),
      unit: getTempUnit(c.unitTemp),
    }),
  },

  // Humidity
  hum: {
    id: 'hum',
    label: 'Outside Humidity',
    shortLabel: 'Humidity',
    category: 'Humidity & Moisture',
    icon: Droplet,
    format: (w) => ({
      value: w.hum.toFixed(0),
      unit: '%',
    }),
  },

  // Inside
  temp_in: {
    id: 'temp_in',
    label: 'Inside Temperature',
    shortLabel: 'Inside Temp',
    category: 'Indoor',
    icon: Home,
    format: (w, c) => ({
      value: convertTemp(w.temp_in, c.unitTemp).toFixed(1),
      unit: getTempUnit(c.unitTemp),
    }),
  },
  hum_in: {
    id: 'hum_in',
    label: 'Inside Humidity',
    shortLabel: 'Inside Hum',
    category: 'Indoor',
    icon: Droplet,
    format: (w) => ({
      value: w.hum_in.toFixed(0),
      unit: '%',
    }),
  },
  dew_point_in: {
    id: 'dew_point_in',
    label: 'Inside Dew Point',
    shortLabel: 'In Dew Pt',
    category: 'Indoor',
    icon: Droplet,
    format: (w, c) => ({
      value: convertTemp(w.dew_point_in ?? w.temp_in, c.unitTemp).toFixed(1),
      unit: getTempUnit(c.unitTemp),
    }),
  },

  // Barometer
  bar_sea_level: {
    id: 'bar_sea_level',
    label: 'Current Barometer',
    shortLabel: 'Barometer',
    category: 'Barometer',
    icon: Cloud,
    format: (w, c) => ({
      value: convertBaro(w.bar_sea_level, c.unitBaro).toFixed(baroDecimals(c.unitBaro)),
      unit: getBaroUnit(c.unitBaro),
    }),
  },
  bar_trend: {
    id: 'bar_trend',
    label: 'Barometer Trend',
    shortLabel: 'Trend',
    category: 'Barometer',
    icon: Gauge,
    format: (w, c) => ({
      value: convertBaro(w.bar_trend, c.unitBaro).toFixed(baroDecimals(c.unitBaro)),
      unit: getBaroUnit(c.unitBaro),
    }),
  },

  // Wind
  wind_speed_last: {
    id: 'wind_speed_last',
    label: 'Current Wind Speed',
    shortLabel: 'Wind Speed',
    category: 'Wind',
    icon: Wind,
    format: (w, c) => ({
      value: convertWind(w.wind_speed_last, c.unitWind).toFixed(1),
      unit: getWindUnit(c.unitWind),
    }),
  },
  wind_speed_avg_2_min: {
    id: 'wind_speed_avg_2_min',
    label: '2-Minute Average Wind Speed',
    shortLabel: '2-Min Wind',
    category: 'Wind',
    icon: Wind,
    format: (w, c) => ({
      value: convertWind(w.wind_speed_avg_2_min, c.unitWind).toFixed(1),
      unit: getWindUnit(c.unitWind),
    }),
  },
  wind_speed_avg_10_min: {
    id: 'wind_speed_avg_10_min',
    label: '10-Minute Average Wind Speed',
    shortLabel: '10-Min Wind',
    category: 'Wind',
    icon: Wind,
    format: (w, c) => ({
      value: convertWind(w.wind_speed_avg_10_min, c.unitWind).toFixed(1),
      unit: getWindUnit(c.unitWind),
    }),
  },
  wind_gust_10_min: {
    id: 'wind_gust_10_min',
    label: '10-Minute Wind Gust',
    shortLabel: 'Wind Gust',
    category: 'Wind',
    icon: Wind,
    format: (w, c) => {
      const gust = w.wind_gust_10_min > 0 ? w.wind_gust_10_min : w.wind_speed_last;
      return {
        value: convertWind(gust, c.unitWind).toFixed(1),
        unit: getWindUnit(c.unitWind),
      };
    },
  },
  wind_speed_hi_day: {
    id: 'wind_speed_hi_day',
    label: 'Daily Peak Gust',
    shortLabel: 'Peak Gust',
    category: 'Wind',
    icon: Wind,
    format: (w, c) => ({
      value: convertWind(w.wind_speed_hi_day ?? w.wind_gust_10_min ?? w.wind_speed_last, c.unitWind).toFixed(1),
      unit: getWindUnit(c.unitWind),
    }),
  },

  // Rain
  rain_rate_last: {
    id: 'rain_rate_last',
    label: 'Current Rain Rate',
    shortLabel: 'Rain Rate',
    category: 'Rain',
    icon: CloudRain,
    format: (w, c) => ({
      value: convertRain(w.rain_rate_last, c.unitRain).toFixed(rainDecimals(c.unitRain)),
      unit: `${getRainUnit(c.unitRain)}/hr`,
    }),
  },
  rainfall_daily: {
    id: 'rainfall_daily',
    label: 'Daily Rain',
    shortLabel: 'Daily Rain',
    category: 'Rain',
    icon: CloudRain,
    format: (w, c) => ({
      value: convertRain(w.rainfall_daily, c.unitRain).toFixed(rainDecimals(c.unitRain)),
      unit: getRainUnit(c.unitRain),
    }),
  },
  high_rain_rate_today: {
    id: 'high_rain_rate_today',
    label: 'High Rain Rate Today',
    shortLabel: 'High Rate',
    category: 'Rain',
    icon: CloudRain,
    format: (w, c) => ({
      value: convertRain(w.high_rain_rate_today, c.unitRain).toFixed(rainDecimals(c.unitRain)),
      unit: `${getRainUnit(c.unitRain)}/hr`,
    }),
  },
  rainfall_monthly: {
    id: 'rainfall_monthly',
    label: 'Monthly Rain',
    shortLabel: 'Month Rain',
    category: 'Rain',
    icon: CloudRain,
    format: (w, c) => ({
      value: convertRain(w.rainfall_monthly ?? 0, c.unitRain).toFixed(rainDecimals(c.unitRain)),
      unit: getRainUnit(c.unitRain),
    }),
  },
  rainfall_year: {
    id: 'rainfall_year',
    label: 'Yearly Rain',
    shortLabel: 'Year Rain',
    category: 'Rain',
    icon: CloudRain,
    format: (w, c) => ({
      value: convertRain(w.rainfall_year ?? 0, c.unitRain).toFixed(rainDecimals(c.unitRain)),
      unit: getRainUnit(c.unitRain),
    }),
  },
  rain_storm: {
    id: 'rain_storm',
    label: 'Rain Storm',
    shortLabel: 'Storm Rain',
    category: 'Rain',
    icon: CloudRain,
    format: (w, c) => ({
      value: convertRain(w.rain_storm ?? 0, c.unitRain).toFixed(rainDecimals(c.unitRain)),
      unit: getRainUnit(c.unitRain),
    }),
  },

  // Air Quality
  aqi: {
    id: 'aqi',
    label: 'Air Quality Index (AQI)',
    shortLabel: 'AQI',
    category: 'Air Quality',
    icon: ShieldCheck,
    format: (w) => ({
      value: (w.aqi ?? 0).toFixed(0),
      unit: 'AQI',
    }),
  },
  pm_2p5: {
    id: 'pm_2p5',
    label: 'PM 2.5 Air Quality',
    shortLabel: 'PM 2.5',
    category: 'Air Quality',
    icon: Activity,
    format: (w) => ({
      value: (w.pm_2p5 ?? 0).toFixed(1),
      unit: 'µg/m³',
    }),
  },
  pm_10: {
    id: 'pm_10',
    label: 'PM 10 Air Quality',
    shortLabel: 'PM 10',
    category: 'Air Quality',
    icon: Activity,
    format: (w) => ({
      value: (w.pm_10 ?? 0).toFixed(1),
      unit: 'µg/m³',
    }),
  },
};

export const TILE_PRESETS: TilePreset[] = [
  {
    id: 'solar_uv',
    name: 'Solar & UV',
    description: 'Solar Radiation (W/m²) and UV Index from station sensor',
    icon: Sun,
    config: {
      primaryMetric: 'solar_rad',
      secondaryMetric: 'uv_index',
    },
  },
  {
    id: 'temp_feels',
    name: 'Outside Temp & Feels Like',
    description: 'Current temperature with feels like index',
    icon: Thermometer,
    config: {
      primaryMetric: 'temp',
      secondaryMetric: 'feels_like',
    },
  },
  {
    id: 'hum_dew',
    name: 'Outside Humidity & Dew Point',
    description: 'Outdoor relative humidity and calculated dew point',
    icon: Droplet,
    config: {
      primaryMetric: 'hum',
      secondaryMetric: 'dew_point',
    },
  },
  {
    id: 'temp_in_hum',
    name: 'Inside Temp & Humidity',
    description: 'Indoor temperature and indoor relative humidity',
    icon: Home,
    config: {
      primaryMetric: 'temp_in',
      secondaryMetric: 'hum_in',
    },
  },
  {
    id: 'baro_trend',
    name: 'Current Barometer & Trend',
    description: 'Sea-level atmospheric pressure and 3-hour trend',
    icon: Cloud,
    config: {
      primaryMetric: 'bar_sea_level',
      secondaryMetric: 'bar_trend',
    },
  },
  {
    id: 'wind_2_10',
    name: '2-Min & 10-Min Wind',
    description: '2-minute and 10-minute average wind speeds',
    icon: Wind,
    config: {
      primaryMetric: 'wind_speed_avg_2_min',
      secondaryMetric: 'wind_speed_avg_10_min',
    },
  },
  {
    id: 'wind_speed_gust',
    name: 'Wind Speed & Gust',
    description: 'Current wind speed and trailing 10-min peak gust',
    icon: Wind,
    config: {
      primaryMetric: 'wind_speed_last',
      secondaryMetric: 'wind_gust_10_min',
    },
  },
  {
    id: 'rain_rate_day',
    name: 'Current Rain Rate & Daily Rain',
    description: 'Active rain rate and cumulative daily precipitation',
    icon: CloudRain,
    config: {
      primaryMetric: 'rain_rate_last',
      secondaryMetric: 'rainfall_daily',
    },
  },
  {
    id: 'rain_month_year',
    name: 'Monthly & Yearly Rain',
    description: 'Month-to-date and year-to-date total precipitation',
    icon: CloudRain,
    config: {
      primaryMetric: 'rainfall_monthly',
      secondaryMetric: 'rainfall_year',
    },
  },
  {
    id: 'temp_hi_lo',
    name: 'Daily High & Low Temp',
    description: 'Today’s maximum and minimum recorded temperatures',
    icon: Thermometer,
    config: {
      primaryMetric: 'temp_hi',
      secondaryMetric: 'temp_low',
    },
  },
  {
    id: 'solar_single',
    name: 'Solar Radiation (Single Large)',
    description: 'Prominent full-tile solar radiation measurement',
    icon: Sun,
    config: {
      single: true,
      primaryMetric: 'solar_rad',
    },
  },
  {
    id: 'uv_single',
    name: 'UV Index (Single Large)',
    description: 'Prominent full-tile UV Index measurement',
    icon: SunMedium,
    config: {
      single: true,
      primaryMetric: 'uv_index',
    },
  },
  {
    id: 'air_quality',
    name: 'Air Quality (AQI & PM2.5)',
    description: 'AirLink air quality index and fine particulate matter',
    icon: ShieldCheck,
    config: {
      primaryMetric: 'aqi',
      secondaryMetric: 'pm_2p5',
    },
  },
];

export const DEFAULT_TILES_DENSE: Record<string, TileConfig> = {
  tile_0: { primaryMetric: 'temp', secondaryMetric: 'feels_like' },
  tile_1: { primaryMetric: 'hum', secondaryMetric: 'dew_point' },
  tile_2: { primaryMetric: 'temp_in', secondaryMetric: 'hum_in' },
  tile_3: { primaryMetric: 'bar_sea_level', secondaryMetric: 'bar_trend' },
  tile_4: { primaryMetric: 'wind_speed_avg_2_min', secondaryMetric: 'wind_speed_avg_10_min' },
  tile_5: { primaryMetric: 'rain_rate_last', secondaryMetric: 'rainfall_daily' },
};

export const DEFAULT_TILES_ROOM: Record<string, TileConfig> = {
  room_0: { single: true, primaryMetric: 'temp' },
  room_1: { single: true, primaryMetric: 'wind_speed_avg_2_min' },
  room_2: { single: true, primaryMetric: 'bar_sea_level' },
  room_3: { single: true, primaryMetric: 'rain_rate_last' },
};

export const TILE_POSITIONS_DENSE = [
  { key: 'tile_0', label: 'Top Left', defaultName: 'Outside Temp & Feels Like' },
  { key: 'tile_1', label: 'Middle Left', defaultName: 'Outside Humidity & Dew Point' },
  { key: 'tile_2', label: 'Bottom Left', defaultName: 'Inside Temp & Humidity' },
  { key: 'tile_3', label: 'Top Right', defaultName: 'Current Barometer & Trend' },
  { key: 'tile_4', label: 'Middle Right', defaultName: '2-Min & 10-Min Wind' },
  { key: 'tile_5', label: 'Bottom Right', defaultName: 'Current Rain Rate & Daily Rain' },
];

export const TILE_POSITIONS_ROOM = [
  { key: 'room_0', label: 'Top Left', defaultName: 'Outside Temp' },
  { key: 'room_1', label: 'Top Right', defaultName: 'Wind Speed' },
  { key: 'room_2', label: 'Bottom Left', defaultName: 'Barometer' },
  { key: 'room_3', label: 'Bottom Right', defaultName: 'Rain Rate' },
];

export function resolveTileProps(
  tileKey: string,
  customConfig: TileConfig | undefined,
  weather: WeatherData,
  config: WLLConfig,
  isRoomMode = false
) {
  const fallback = isRoomMode ? DEFAULT_TILES_ROOM[tileKey] : DEFAULT_TILES_DENSE[tileKey];
  const active = customConfig || fallback || { primaryMetric: 'temp' };

  const pDef = METRIC_REGISTRY[active.primaryMetric] || METRIC_REGISTRY.temp;
  const pData = pDef.format(weather, config);

  if (active.single) {
    return {
      single: true,
      label: active.customLabel || pDef.label,
      value: pData.value,
      unit: pData.unit,
      icon: pDef.icon,
    };
  }

  const sDef = active.secondaryMetric ? METRIC_REGISTRY[active.secondaryMetric] : undefined;
  const sData = sDef ? sDef.format(weather, config) : undefined;

  return {
    single: false,
    label: active.customLabel || pDef.label,
    value: pData.value,
    unit: pData.unit,
    subLabel: active.customSubLabel || (sDef ? sDef.label : undefined),
    subValue: sData ? sData.value : undefined,
    subUnit: sData ? sData.unit : undefined,
    icon: pDef.icon,
  };
}
