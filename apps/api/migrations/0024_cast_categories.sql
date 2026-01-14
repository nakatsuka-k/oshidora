-- Cast categories (CMS)

CREATE TABLE IF NOT EXISTS cast_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

ALTER TABLE casts ADD COLUMN category_id TEXT;

CREATE INDEX IF NOT EXISTS idx_casts_category
  ON casts (category_id);
