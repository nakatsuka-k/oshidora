-- Minimal event tables for KPI & rankings

-- Video play events (used for playsToday + rankings)
CREATE TABLE IF NOT EXISTS video_play_events (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL,
  user_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_video_play_events_created_at
  ON video_play_events (created_at);

CREATE INDEX IF NOT EXISTS idx_video_play_events_video_created
  ON video_play_events (video_id, created_at);

-- Coin spend events (used for coinsSpentToday + rankings)
-- NOTE: The coin economy/purchase flow is not implemented yet; this table is a generic ledger for future use.
CREATE TABLE IF NOT EXISTS coin_spend_events (
  id TEXT PRIMARY KEY,
  video_id TEXT,
  user_id TEXT,
  amount INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_coin_spend_events_created_at
  ON coin_spend_events (created_at);

CREATE INDEX IF NOT EXISTS idx_coin_spend_events_video_created
  ON coin_spend_events (video_id, created_at);
