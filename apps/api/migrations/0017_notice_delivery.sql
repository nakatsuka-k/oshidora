-- Notice delivery enhancements (tags, email txt/html, push metadata, send logs)

-- Extend notices table
ALTER TABLE notices ADD COLUMN tags TEXT NOT NULL DEFAULT '';
ALTER TABLE notices ADD COLUMN mail_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE notices ADD COLUMN mail_format TEXT NOT NULL DEFAULT 'text';
ALTER TABLE notices ADD COLUMN mail_text TEXT NOT NULL DEFAULT '';
ALTER TABLE notices ADD COLUMN mail_html TEXT NOT NULL DEFAULT '';
ALTER TABLE notices ADD COLUMN mail_sent_at TEXT NOT NULL DEFAULT '';
ALTER TABLE notices ADD COLUMN push_title TEXT NOT NULL DEFAULT '';
ALTER TABLE notices ADD COLUMN push_body TEXT NOT NULL DEFAULT '';
ALTER TABLE notices ADD COLUMN push_sent_at TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS notice_deliveries (
  id TEXT PRIMARY KEY,
  notice_id TEXT NOT NULL,
  channel TEXT NOT NULL, -- 'email' | 'push'
  status TEXT NOT NULL,  -- 'sent' | 'failed'
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notice_deliveries_notice_created
  ON notice_deliveries (notice_id, created_at);
