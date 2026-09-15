-- Perf + retention indexes for cron/admin hot paths (idempotent).
CREATE INDEX IF NOT EXISTS idx_users_free_until ON users(free_until);
CREATE INDEX IF NOT EXISTS idx_stations_sub ON stations(subscription_status, subscription_expires_at);
CREATE INDEX IF NOT EXISTS idx_stations_last_http ON stations(last_http_at);
CREATE INDEX IF NOT EXISTS idx_stations_user ON stations(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_created ON contact_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
