/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import dgram from 'dgram';
import axios from 'axios';
import { createServer as createViteServer } from 'vite';
import { WeatherData, WLLConfig } from './src/types.js';

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory config
let config: WLLConfig = {
  wllIpAddress: '192.168.1.100', // Default placeholder IP
  isSimulationMode: true, // Default to true so it works out-of-the-box in the sandbox
};

// Initial state matching the user's requested values exactly
let weatherState: WeatherData = {
  temp: 72.4,
  feels_like: 70.1,
  hum: 96.2,
  dew_point: 71.3,
  temp_in: 75.2,
  hum_in: 64.1,
  bar_sea_level: 29.875,
  bar_trend: -0.046,
  wind_speed_last: 2.4,
  wind_dir_last: 225, // SW
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
};

// Connection status tracked on server
let lastUdpReceived: number | null = null;
let lastHttpReceived: number | null = null;
let serverError: string | null = null;

// List of connected SSE clients
let sseClients: express.Response[] = [];

// Helper to broadcast update to all connected clients
function broadcastState() {
  const payload = {
    weather: weatherState,
    connection: {
      status: config.isSimulationMode 
        ? 'online' 
        : (Date.now() - (lastHttpReceived || 0) < 30000 ? 'online' : 'offline'),
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

    // If simulation is enabled, ignore real packets to avoid pollution
    if (config.isSimulationMode) return;

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
  if (config.isSimulationMode) {
    return res.json({
      weather: weatherState,
      connection: {
        status: 'online',
        lastUdpReceived,
        lastHttpReceived: Date.now(),
        errorMessage: null
      },
      config
    });
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
  const { wllIpAddress, isSimulationMode } = req.body;
  if (wllIpAddress !== undefined) config.wllIpAddress = wllIpAddress;
  if (isSimulationMode !== undefined) config.isSimulationMode = isSimulationMode;
  
  if (config.isSimulationMode) {
    serverError = null;
  }
  
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
      status: config.isSimulationMode ? 'online' : (Date.now() - (lastHttpReceived || 0) < 30000 ? 'online' : 'offline'),
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

// 3. Mock Data Simulation Engine (Random walk variations for realistic dashboard updates)
let lastWindSpeedTarget = 2.4;
let lastWindDirTarget = 225; // SW

setInterval(() => {
  if (!config.isSimulationMode) return;

  // Slowly drift values
  // Temp: -0.05 to +0.05
  weatherState.temp = parseFloat((weatherState.temp + (Math.random() * 0.1 - 0.05)).toFixed(1));
  
  // Keep feels like slightly lower than temp or aligned with humidity
  weatherState.feels_like = parseFloat((weatherState.temp - 2.3 + (Math.random() * 0.06 - 0.03)).toFixed(1));

  // Humidity: -0.1 to +0.1
  weatherState.hum = parseFloat(Math.min(100, Math.max(0, weatherState.hum + (Math.random() * 0.2 - 0.1))).toFixed(1));

  // Dew point tracks temp and humidity
  weatherState.dew_point = parseFloat((weatherState.temp - (100 - weatherState.hum) / 5).toFixed(1));

  // Inside Temp: slowly fluctuate
  weatherState.temp_in = parseFloat((weatherState.temp_in + (Math.random() * 0.04 - 0.02)).toFixed(1));
  weatherState.hum_in = parseFloat(Math.min(100, Math.max(0, weatherState.hum_in + (Math.random() * 0.1 - 0.05))).toFixed(1));

  // Barometer: drift slowly
  weatherState.bar_sea_level = parseFloat((weatherState.bar_sea_level + (Math.random() * 0.004 - 0.002)).toFixed(3));

  // Wind speed & direction: quick wind gusts and angle variations
  if (Math.random() > 0.8) {
    lastWindSpeedTarget = parseFloat((Math.random() * 8 + 0.5).toFixed(1)); // New wind speed target
  }
  if (Math.random() > 0.7) {
    lastWindDirTarget = (lastWindDirTarget + (Math.random() * 60 - 30) + 360) % 360; // Wind shift
  }

  // Smooth wind updates
  weatherState.wind_speed_last = parseFloat((weatherState.wind_speed_last + (lastWindSpeedTarget - weatherState.wind_speed_last) * 0.25).toFixed(1));
  
  // Shortest path angle interpolation
  let diff = lastWindDirTarget - weatherState.wind_dir_last;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  weatherState.wind_dir_last = Math.round((weatherState.wind_dir_last + diff * 0.2 + 360) % 360);

  // Averages are rolling slow tracking
  weatherState.wind_speed_avg_2_min = parseFloat((weatherState.wind_speed_avg_2_min + (weatherState.wind_speed_last - weatherState.wind_speed_avg_2_min) * 0.05).toFixed(1));
  weatherState.wind_speed_avg_10_min = parseFloat((weatherState.wind_speed_avg_10_min + (weatherState.wind_speed_last - weatherState.wind_speed_avg_10_min) * 0.01).toFixed(1));

  // Rain: occasionally change rain rate if it's high humidity
  if (weatherState.hum > 95) {
    if (Math.random() > 0.95) {
      weatherState.rain_rate_last = parseFloat((Math.random() * 4).toFixed(2));
    }
  } else {
    weatherState.rain_rate_last = parseFloat(Math.max(0, weatherState.rain_rate_last - 0.05).toFixed(2));
  }

  // Accumulate daily rain if raining
  if (weatherState.rain_rate_last > 0) {
    weatherState.rainfall_daily = parseFloat((weatherState.rainfall_daily + (weatherState.rain_rate_last / 1800)).toFixed(2)); // rate per hour added every 2 seconds
  }

  // Update high rain rate today
  if (weatherState.rain_rate_last > weatherState.high_rain_rate_today) {
    weatherState.high_rain_rate_today = weatherState.rain_rate_last;
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 is 12
    weatherState.high_rain_rate_time = `${hours}:${minutes} ${ampm}`;
  }

  weatherState.ts = Math.floor(Date.now() / 1000);
  broadcastState();
}, 2000);

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
