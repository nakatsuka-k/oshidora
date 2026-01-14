-- Track which CMS admin created/updated a notice

ALTER TABLE notices ADD COLUMN created_by_admin_id TEXT NOT NULL DEFAULT '';
ALTER TABLE notices ADD COLUMN updated_by_admin_id TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_notices_created_by
  ON notices (created_by_admin_id);

CREATE INDEX IF NOT EXISTS idx_notices_updated_by
  ON notices (updated_by_admin_id);
