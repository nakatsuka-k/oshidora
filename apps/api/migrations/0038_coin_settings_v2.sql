-- Coin settings v2 (price/coin amount + optional availability dates)

ALTER TABLE coin_settings ADD COLUMN coin_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE coin_settings ADD COLUMN starts_at TEXT NOT NULL DEFAULT '';
ALTER TABLE coin_settings ADD COLUMN ends_at TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_coin_settings_price_yen ON coin_settings (price_yen);
CREATE INDEX IF NOT EXISTS idx_coin_settings_active_dates ON coin_settings (starts_at, ends_at);
