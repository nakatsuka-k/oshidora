-- Extend videos for CMS detail requirements

ALTER TABLE videos ADD COLUMN episode_no INTEGER;
ALTER TABLE videos ADD COLUMN stream_video_id_clean TEXT NOT NULL DEFAULT '';
ALTER TABLE videos ADD COLUMN stream_video_id_subtitled TEXT NOT NULL DEFAULT '';

-- Optional metrics fields (used by some client endpoints too)
ALTER TABLE videos ADD COLUMN rating_avg REAL NOT NULL DEFAULT 0;
ALTER TABLE videos ADD COLUMN review_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_videos_work_episode_no
  ON videos (work_id, episode_no);
