-- Category hierarchy support (parent/child)

ALTER TABLE categories ADD COLUMN parent_id TEXT;

CREATE INDEX IF NOT EXISTS idx_categories_parent
  ON categories (parent_id);
