-- Cast/staff account profiles for CMS-managed registration
-- Links a public cast entry (casts) with a login account (users).

CREATE TABLE IF NOT EXISTS cast_staff_profiles (
  cast_id TEXT PRIMARY KEY,
  user_id TEXT,
  appearances TEXT NOT NULL DEFAULT '',
  video_url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (cast_id) REFERENCES casts(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cast_staff_profiles_user_id
  ON cast_staff_profiles (user_id);

CREATE INDEX IF NOT EXISTS idx_cast_staff_profiles_cast_id
  ON cast_staff_profiles (cast_id);
