-- CMS pickup items (video or external link)

CREATE TABLE IF NOT EXISTS cms_pickup_items (
  id TEXT NOT NULL PRIMARY KEY,
  kind TEXT NOT NULL, -- 'video' | 'link'
  video_id TEXT,
  url TEXT,
  title TEXT NOT NULL DEFAULT '',
  thumbnail_url TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cms_pickup_items_sort
  ON cms_pickup_items (sort_order, created_at);

CREATE INDEX IF NOT EXISTS idx_cms_pickup_items_video
  ON cms_pickup_items (video_id, created_at);
