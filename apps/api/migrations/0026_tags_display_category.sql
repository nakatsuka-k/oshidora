-- Tags: display category (CMS_00035)

ALTER TABLE tags ADD COLUMN category_id TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_tags_category_id
  ON tags (category_id);
