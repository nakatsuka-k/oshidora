-- CMS featured video slots (recommend/pickup etc)

CREATE TABLE IF NOT EXISTS cms_featured_videos (
  slot TEXT NOT NULL,
  video_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY (slot, video_id)
);

CREATE INDEX IF NOT EXISTS idx_cms_featured_videos_slot_sort
  ON cms_featured_videos (slot, sort_order, created_at);

CREATE INDEX IF NOT EXISTS idx_cms_featured_videos_video
  ON cms_featured_videos (video_id, created_at);
