-- Subscription (video access)

-- Add a simple subscription flag to users.
-- NOTE: D1 supports ALTER TABLE ADD COLUMN.

ALTER TABLE users ADD COLUMN is_subscribed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN subscription_started_at TEXT;
ALTER TABLE users ADD COLUMN subscription_ended_at TEXT;
