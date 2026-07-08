/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import dgram from 'dgram';
import axios from 'axios';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { WeatherData, WLLConfig } from './src/types.js';

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(express.json());

const CONFIG_FILE = path.join(process.cwd(), 'config.json');

// Load configuration from config.json if it exists, otherwise use defaults
function loadConfig(): WLLConfig {
  const defaults: WLLConfig = {
    wllIpAddress: '',
    useCloudApi: false,
    cloudDid: '',
    cloudPassword: '',
    cloudApiToken: 'C65771F93D9342898619AA95AF37B89B',
    unitTemp: 'C',
    unitWind: 'kmh',
    unitBaro: 'hPa',
    unitRain: 'mm',
  };

  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const fileData = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(fileData);
      console.log('Configuration loaded from config.json');
      return { ...defaults, ...parsed };
    }
  } catch (err: any) {
    console.error('Error loading config.json, using defaults:', err.message);
  }
  return defaults;
}

function saveConfig(cfg: WLLConfig) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
    console.log('Configuration saved to config.json');
  } catch (err: any) {
    console.error('Error writing config.json:', err.message);
  }
}

let config: WLLConfig = loadConfig();

// Initial state matching the user's requested values exactly
let weatherState: WeatherData = {
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
  rain_rate_last: 0,
  rainfall_daily: 0,
  high_rain_rate_today: 0,
  high_rain_rate_time: '--',
  sunrise: '--',
  sunset: '--',
  moon_phase: '--',
  ts: 0,
  stationName: "Offline Console",
  stationDid: "Unconfigured"
};

// Connection status tracked on server
let lastUdpReceived: number | null = null;
let lastHttpReceived: number | null = null;
let serverError: string | null = null;

// List of connected SSE clients
let sseClients: express.Response[] = [];

function isSystemOnline() {
  if (weatherState.ts === 0) return 'offline';
  const threshold = config.useCloudApi ? 180000 : 30000;
  return (Date.now() - (lastHttpReceived || 0) < threshold) ? 'online' : 'offline';
}

// Helper to broadcast update to all connected clients
function broadcastState() {
  const payload = {
    weather: weatherState,
    connection: {
      status: isSystemOnline(),
      lastUdpReceived,
      lastHttpReceived,
      errorMessage: serverError
    },
    config
  };

  const dataString = `data: ${JSON.stringify(payload)}\n\n`;
  sseClients.forEach(client => {
    client.write(dataString);
  });
}

// 1. Listen for UDP broadcasts on port 22222
const udpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

udpSocket.on('error', (err) => {
  console.error(`UDP socket error:\n${err.stack}`);
  serverError = `UDP Socket Error: ${err.message}`;
  udpSocket.close();
});

udpSocket.on('message', (msg, rinfo) => {
  try {
    const packet = JSON.parse(msg.toString());
    console.log(`UDP packet from ${rinfo.address}:${rinfo.port}`);

    // If cloud API mode is enabled, ignore real packets to avoid pollution
    if (config.useCloudApi) return;

    lastUdpReceived = Date.now();
    serverError = null;

    if (packet.conditions && Array.isArray(packet.conditions)) {
      packet.conditions.forEach((cond: any) => {
        // Parse conditions based on structure type
        if (cond.data_structure_type === 1) {
          // Inside or outside integrated suite
          if (cond.temp !== undefined) weatherState.temp = cond.temp;
          if (cond.hum !== undefined) weatherState.hum = cond.hum;
          if (cond.dew_point !== undefined) weatherState.dew_point = cond.dew_point;
          if (cond.heat_index !== undefined) weatherState.feels_like = cond.heat_index;
          if (cond.wind_speed_last !== undefined) weatherState.wind_speed_last = cond.wind_speed_last;
          if (cond.wind_dir_last !== undefined) weatherState.wind_dir_last = cond.wind_dir_last;
          if (cond.wind_speed_avg_last_2_min !== undefined) weatherState.wind_speed_avg_2_min = cond.wind_speed_avg_last_2_min;
          if (cond.wind_speed_avg_last_10_min !== undefined) weatherState.wind_speed_avg_10_min = cond.wind_speed_avg_last_10_min;
          if (cond.rain_rate_last !== undefined) weatherState.rain_rate_last = cond.rain_rate_last;
          if (cond.rainfall_daily !== undefined) weatherState.rainfall_daily = cond.rainfall_daily;
        } else if (cond.data_structure_type === 3) {
          // Inside Temp & Hum
          if (cond.temp_in !== undefined) weatherState.temp_in = cond.temp_in;
          if (cond.hum_in !== undefined) weatherState.hum_in = cond.hum_in;
        } else if (cond.data_structure_type === 4) {
          // Barometer
          if (cond.bar_sea_level !== undefined) weatherState.bar_sea_level = cond.bar_sea_level;
          if (cond.bar_trend !== undefined) weatherState.bar_trend = cond.bar_trend;
        }
      });
      weatherState.ts = packet.ts || Math.floor(Date.now() / 1000);
      broadcastState();
    }
  } catch (error: any) {
    console.error('Error parsing UDP message', error);
  }
});

udpSocket.bind(22222, '0.0.0.0', () => {
  console.log('UDP Broadcast Listener listening on port 22222');
});

// 2. HTTP Proxy endpoint for WeatherLink current conditions (polled by React Query)
app.get('/api/weatherlink-current', async (req, res) => {
  if (!config.useCloudApi && !config.wllIpAddress) {
    return res.status(503).json({
      weather: weatherState,
      connection: {
        status: 'offline',
        lastUdpReceived,
        lastHttpReceived,
        errorMessage: 'Connection unconfigured: IP Address or Cloud credentials not set.'
      },
      config
    });
  }

  if (config.useCloudApi) {
    try {
      if (!config.cloudDid || !config.cloudPassword || !config.cloudApiToken) {
        throw new Error('Cloud API configuration is missing (DID, Password, or API Token)');
      }
      
      console.log(`Polling WeatherLink Cloud API for DID ${config.cloudDid}...`);
      const response = await axios.get(`https://api.weatherlink.com/v1/NoaaExt.json`, {
        params: {
          user: config.cloudDid,
          pass: config.cloudPassword,
          apiToken: config.cloudApiToken
        },
        timeout: 8000
      });
      
      const data = response.data;
      if (!data) {
        throw new Error('WeatherLink Cloud API returned empty response');
      }
      if (data.error) {
        throw new Error(`WeatherLink Cloud API error: ${data.error}`);
      }

      // Parse current observations from Cloud API
      const davis = data.davis_current_observation || {};

      weatherState.temp = data.temp_f !== undefined ? Number(data.temp_f) : weatherState.temp;
      weatherState.hum = data.relative_humidity !== undefined ? Number(data.relative_humidity) : weatherState.hum;
      weatherState.dew_point = data.dewpoint_f !== undefined ? Number(data.dewpoint_f) : weatherState.dew_point;

      // Feels like mapping (windchill or heat index)
      if (data.windchill_f !== undefined && Number(data.windchill_f) < weatherState.temp) {
        weatherState.feels_like = Number(data.windchill_f);
      } else if (data.heat_index_f !== undefined && Number(data.heat_index_f) > weatherState.temp) {
        weatherState.feels_like = Number(data.heat_index_f);
      } else {
        weatherState.feels_like = weatherState.temp;
      }

      weatherState.temp_in = davis.temp_in_f !== undefined ? Number(davis.temp_in_f) : weatherState.temp_in;
      weatherState.hum_in = davis.relative_humidity_in !== undefined ? Number(davis.relative_humidity_in) : weatherState.hum_in;

      weatherState.bar_sea_level = data.pressure_in !== undefined ? Number(data.pressure_in) : weatherState.bar_sea_level;
      
      // Parse pressure trend
      if (data.pressure_trend !== undefined) {
        const trend = String(data.pressure_trend).toLowerCase();
        if (trend.includes('fall') || trend.includes('down') || trend.includes('-')) {
          weatherState.bar_trend = -0.02;
        } else if (trend.includes('rise') || trend.includes('up') || trend.includes('+')) {
          weatherState.bar_trend = 0.02;
        } else {
          weatherState.bar_trend = 0;
        }
      }

      weatherState.wind_speed_last = data.wind_mph !== undefined ? Number(data.wind_mph) : weatherState.wind_speed_last;
      weatherState.wind_dir_last = data.wind_degrees !== undefined ? Number(data.wind_degrees) : weatherState.wind_dir_last;

      weatherState.wind_speed_avg_10_min = davis.wind_ten_min_ave_mph !== undefined 
        ? Number(davis.wind_ten_min_ave_mph) 
        : (davis.wind_ten_min_avg_mph !== undefined ? Number(davis.wind_ten_min_avg_mph) : weatherState.wind_speed_avg_10_min);
      
      // Set 2 min avg to last speed if avg not in json
      weatherState.wind_speed_avg_2_min = weatherState.wind_speed_last;

      weatherState.rain_rate_last = davis.rain_rate_in_per_hr !== undefined 
        ? Number(davis.rain_rate_in_per_hr) 
        : (davis.rain_rate_in !== undefined ? Number(davis.rain_rate_in) : weatherState.rain_rate_last);

      weatherState.rainfall_daily = davis.rain_day_in !== undefined 
        ? Number(davis.rain_day_in) 
        : (data.rain_day_in !== undefined ? Number(data.rain_day_in) : weatherState.rainfall_daily);

      weatherState.high_rain_rate_today = davis.rain_rate_day_high_in_per_hr !== undefined 
        ? Number(davis.rain_rate_day_high_in_per_hr) 
        : (davis.rain_rate_max_in_per_hr !== undefined ? Number(davis.rain_rate_max_in_per_hr) : weatherState.high_rain_rate_today);

      weatherState.sunrise = davis.sunrise || weatherState.sunrise;
      weatherState.sunset = davis.sunset || weatherState.sunset;

      const ts = data.observation_time_rfc822 ? Math.floor(new Date(data.observation_time_rfc822).getTime() / 1000) : Math.floor(Date.now() / 1000);
      weatherState.ts = ts;
      
      // Simple synodic month calculation. Cycle length: ~29.53059 days
      // Known new moon: Jan 6, 2000 18:14 UTC (approx 947182440 seconds)
      const knownNewMoon = 947182440;
      const secondsInCycle = 29.53059 * 24 * 60 * 60;
      let delta = ts - knownNewMoon;
      if (delta < 0) delta = 0;
      const phase = (delta % secondsInCycle) / secondsInCycle;

      if (phase < 0.03 || phase > 0.97) weatherState.moon_phase = 'new moon';
      else if (phase < 0.22) weatherState.moon_phase = 'waxing crescent';
      else if (phase < 0.28) weatherState.moon_phase = 'first quarter';
      else if (phase < 0.47) weatherState.moon_phase = 'waxing gibbous';
      else if (phase < 0.53) weatherState.moon_phase = 'full moon';
      else if (phase < 0.72) weatherState.moon_phase = 'waning gibbous';
      else if (phase < 0.78) weatherState.moon_phase = 'last quarter';
      else weatherState.moon_phase = 'waning crescent';

      weatherState.stationName = davis.station_name || data.station_name || "WeatherLink Cloud";
      weatherState.stationDid = data.DID || davis.DID || config.cloudDid || "Davis Station";

      lastHttpReceived = Date.now();
      serverError = null;
      
      broadcastState();

      return res.json({
        weather: weatherState,
        connection: {
          status: 'online',
          lastUdpReceived,
          lastHttpReceived,
          errorMessage: null
        },
        config
      });
    } catch (error: any) {
      console.error(`HTTP Polling Error from WeatherLink Cloud API:`, error.message);
      serverError = `Cloud API Polling Error: ${error.message}`;
      broadcastState();

      return res.status(503).json({
        weather: weatherState,
        connection: {
          status: 'offline',
          lastUdpReceived,
          lastHttpReceived,
          errorMessage: serverError
        },
        config
      });
    }
  }

  try {
    const response = await axios.get(`http://${config.wllIpAddress}/v1/current_conditions`, {
      timeout: 5000,
    });

    lastHttpReceived = Date.now();
    serverError = null;

    const data = response.data;
    if (data.data && data.data.conditions) {
      data.data.conditions.forEach((cond: any) => {
        if (cond.data_structure_type === 1) {
          if (cond.temp !== undefined) weatherState.temp = cond.temp;
          if (cond.hum !== undefined) weatherState.hum = cond.hum;
          if (cond.dew_point !== undefined) weatherState.dew_point = cond.dew_point;
          if (cond.heat_index !== undefined) weatherState.feels_like = cond.heat_index;
          if (cond.wind_speed_last !== undefined) weatherState.wind_speed_last = cond.wind_speed_last;
          if (cond.wind_dir_last !== undefined) weatherState.wind_dir_last = cond.wind_dir_last;
          if (cond.wind_speed_avg_last_2_min !== undefined) weatherState.wind_speed_avg_2_min = cond.wind_speed_avg_last_2_min;
          if (cond.wind_speed_avg_last_10_min !== undefined) weatherState.wind_speed_avg_10_min = cond.wind_speed_avg_last_10_min;
          if (cond.rain_rate_last !== undefined) weatherState.rain_rate_last = cond.rain_rate_last;
          if (cond.rainfall_daily !== undefined) weatherState.rainfall_daily = cond.rainfall_daily;
        } else if (cond.data_structure_type === 3) {
          if (cond.temp_in !== undefined) weatherState.temp_in = cond.temp_in;
          if (cond.hum_in !== undefined) weatherState.hum_in = cond.hum_in;
        } else if (cond.data_structure_type === 4) {
          if (cond.bar_sea_level !== undefined) weatherState.bar_sea_level = cond.bar_sea_level;
          if (cond.bar_trend !== undefined) weatherState.bar_trend = cond.bar_trend;
        }
      });
      weatherState.ts = data.data.ts || Math.floor(Date.now() / 1000);
      weatherState.stationName = "Local WeatherLink Live";
      weatherState.stationDid = config.wllIpAddress;
      broadcastState();
    }

    res.json({
      weather: weatherState,
      connection: {
        status: 'online',
        lastUdpReceived,
        lastHttpReceived,
        errorMessage: null
      },
      config
    });
  } catch (error: any) {
    console.error(`HTTP Polling Error from WLL IP ${config.wllIpAddress}:`, error.message);
    serverError = `HTTP Polling Error: ${error.message}`;
    
    // Broadcast state even on error to let clients know of offline state
    broadcastState();

    res.status(503).json({
      weather: weatherState,
      connection: {
        status: 'offline',
        lastUdpReceived,
        lastHttpReceived,
        errorMessage: serverError
      },
      config
    });
  }
});

// Configure endpoint
app.get('/api/config', (req, res) => {
  res.json(config);
});

app.post('/api/config', (req, res) => {
  const { wllIpAddress, useCloudApi, cloudDid, cloudPassword, cloudApiToken, unitTemp, unitWind, unitBaro, unitRain } = req.body;
  if (wllIpAddress !== undefined) config.wllIpAddress = wllIpAddress;
  if (useCloudApi !== undefined) config.useCloudApi = useCloudApi;
  if (cloudDid !== undefined) config.cloudDid = cloudDid;
  if (cloudPassword !== undefined) config.cloudPassword = cloudPassword;
  if (cloudApiToken !== undefined) config.cloudApiToken = cloudApiToken;
  if (unitTemp !== undefined) config.unitTemp = unitTemp;
  if (unitWind !== undefined) config.unitWind = unitWind;
  if (unitBaro !== undefined) config.unitBaro = unitBaro;
  if (unitRain !== undefined) config.unitRain = unitRain;
  
  saveConfig(config);
  broadcastState();
  res.json(config);
});

// SSE Live Stream connection
app.get('/api/live-stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Add client
  sseClients.push(res);

  // Send initial data immediately
  const initialPayload = {
    weather: weatherState,
    connection: {
      status: isSystemOnline(),
      lastUdpReceived,
      lastHttpReceived,
      errorMessage: serverError
    },
    config
  };
  res.write(`data: ${JSON.stringify(initialPayload)}\n\n`);

  req.on('close', () => {
    sseClients = sseClients.filter(client => client !== res);
  });
});

// 3. (Mock Data Simulation Engine completely removed for pure telemetry-only Console)

// Initialize Vite server for asset handling
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Express server running on http://localhost:${PORT}`);
  });
}

startServer();
