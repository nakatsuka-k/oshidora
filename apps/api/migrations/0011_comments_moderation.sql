-- Comment moderation fields for CMS

ALTER TABLE comments ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE comments ADD COLUMN moderation_note TEXT NOT NULL DEFAULT '';
ALTER TABLE comments ADD COLUMN moderated_at TEXT;
ALTER TABLE comments ADD COLUMN moderated_by_admin_id TEXT;

CREATE INDEX IF NOT EXISTS idx_comments_status_created
  ON comments (status, created_at);

CREATE INDEX IF NOT EXISTS idx_comments_deleted_status_created
  ON comments (deleted, status, created_at);
