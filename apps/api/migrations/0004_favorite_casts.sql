-- Favorite casts (user-specific)
-- Stores which casts/staff a user has favorited.

CREATE TABLE IF NOT EXISTS favorite_casts (
  user_id TEXT NOT NULL,
  cast_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, cast_id)
);

CREATE INDEX IF NOT EXISTS idx_favorite_casts_user_created
  ON favorite_casts (user_id, created_at);
