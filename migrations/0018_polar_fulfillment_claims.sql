-- Durable Polar fulfillment claims: one paid checkout may activate Pro once.
-- Event and order IDs provide replay protection for webhook-only deliveries.
CREATE TABLE IF NOT EXISTS polar_fulfillment_claims (
  id TEXT PRIMARY KEY,
  checkout_id TEXT UNIQUE,
  event_id TEXT UNIQUE,
  order_id TEXT UNIQUE,
  station_id TEXT REFERENCES stations(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'claimed' CHECK (status IN ('claimed', 'fulfilled')),
  created_at INTEGER NOT NULL,
  fulfilled_at INTEGER,
  CHECK (checkout_id IS NOT NULL OR event_id IS NOT NULL OR order_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_polar_fulfillment_station
  ON polar_fulfillment_claims(station_id);
