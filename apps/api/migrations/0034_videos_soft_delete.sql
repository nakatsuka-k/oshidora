-- Add soft-delete flag to videos
-- Some API queries filter on `videos.deleted = 0`.

ALTER TABLE videos ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_videos_deleted_created
  ON videos (deleted, created_at);
