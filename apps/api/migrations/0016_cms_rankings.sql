-- Minimal rankings storage for CMS_00011-00020

CREATE TABLE IF NOT EXISTS cms_rankings (
  type TEXT NOT NULL,
  as_of TEXT NOT NULL,
  rank INTEGER NOT NULL,
  entity_id TEXT NOT NULL DEFAULT '',
  label TEXT NOT NULL DEFAULT '',
  value INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (type, as_of, rank)
);

CREATE INDEX IF NOT EXISTS idx_cms_rankings_type_asof
  ON cms_rankings (type, as_of);
