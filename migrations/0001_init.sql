-- Users
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_users_email ON users(email);

-- Cookie sessions
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- WeatherLink station config (one primary station per user for v1)
CREATE TABLE stations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My Station',
  cloud_api_version TEXT NOT NULL DEFAULT 'v2',
  cloud_did TEXT NOT NULL DEFAULT '',
  cloud_station_id TEXT NOT NULL DEFAULT '',
  cloud_station_name TEXT NOT NULL DEFAULT '',
  latitude REAL,
  longitude REAL,
  -- AES-GCM encrypted JSON blob: { password?, apiToken?, apiSecret? }
  credentials_enc TEXT NOT NULL DEFAULT '',
  credentials_iv TEXT NOT NULL DEFAULT '',
  unit_temp TEXT NOT NULL DEFAULT 'C',
  unit_wind TEXT NOT NULL DEFAULT 'kmh',
  unit_baro TEXT NOT NULL DEFAULT 'hPa',
  unit_rain TEXT NOT NULL DEFAULT 'mm',
  last_http_at INTEGER,
  last_error TEXT,
  weather_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_stations_user ON stations(user_id);

-- Public TV / broadcast share links
CREATE TABLE share_links (
  id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
  label TEXT NOT NULL DEFAULT 'TV Display',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_share_slug ON share_links(slug);
CREATE INDEX idx_share_station ON share_links(station_id);
