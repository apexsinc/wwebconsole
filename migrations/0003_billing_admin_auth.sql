-- User account lifecycle / roles
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN suspended INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN free_until INTEGER;
ALTER TABLE users ADD COLUMN notes TEXT NOT NULL DEFAULT '';

-- Station / device billing + WeatherLink plan
ALTER TABLE stations ADD COLUMN wl_plan TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE stations ADD COLUMN device_label TEXT NOT NULL DEFAULT 'Device 1';
ALTER TABLE stations ADD COLUMN subscription_status TEXT NOT NULL DEFAULT 'trial';
ALTER TABLE stations ADD COLUMN subscription_expires_at INTEGER;
ALTER TABLE stations ADD COLUMN poll_interval_sec INTEGER NOT NULL DEFAULT 900;

-- Allow multiple devices per user (drop unique user_id if present via rebuild-friendly index)
-- SQLite cannot drop UNIQUE easily; keep one-row-per-user for v1 and treat station as the billable device.
-- Additional devices table for yearly per-device subscriptions beyond the primary station.
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  station_id TEXT REFERENCES stations(id) ON DELETE SET NULL,
  label TEXT NOT NULL DEFAULT 'Device',
  wl_plan TEXT NOT NULL DEFAULT 'unknown',
  subscription_status TEXT NOT NULL DEFAULT 'trial',
  subscription_expires_at INTEGER,
  poll_interval_sec INTEGER NOT NULL DEFAULT 900,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);

-- OTP codes (email verify + forgot password)
CREATE TABLE IF NOT EXISTS otp_codes (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE,
  purpose TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_otp_email_purpose ON otp_codes(email, purpose);

-- App-wide settings (admin-configurable integrations)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES
  ('turnstile_site_key', '', strftime('%s','now') * 1000),
  ('turnstile_secret_key', '', strftime('%s','now') * 1000),
  ('turnstile_enabled', '0', strftime('%s','now') * 1000),
  ('resend_api_key', '', strftime('%s','now') * 1000),
  ('resend_from_email', 'WWebConsole <noreply@wwebconsole.com>', strftime('%s','now') * 1000),
  ('resend_enabled', '0', strftime('%s','now') * 1000),
  ('yearly_price_usd', '49', strftime('%s','now') * 1000),
  ('free_trial_days', '60', strftime('%s','now') * 1000),
  ('poll_basic_sec', '900', strftime('%s','now') * 1000),
  ('poll_pro_sec', '120', strftime('%s','now') * 1000);

-- Backfill free trial for existing accounts (60 days from now)
UPDATE users SET free_until = (strftime('%s','now') * 1000) + (60 * 24 * 60 * 60 * 1000)
WHERE free_until IS NULL;

UPDATE stations SET
  subscription_status = COALESCE(NULLIF(subscription_status, ''), 'trial'),
  subscription_expires_at = COALESCE(subscription_expires_at, (strftime('%s','now') * 1000) + (60 * 24 * 60 * 60 * 1000)),
  poll_interval_sec = COALESCE(NULLIF(poll_interval_sec, 0), 900),
  wl_plan = COALESCE(NULLIF(wl_plan, ''), 'unknown');
