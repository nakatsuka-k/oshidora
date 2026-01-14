-- Per-video recommendations (related videos)

CREATE TABLE IF NOT EXISTS video_recommendations (
  video_id TEXT NOT NULL,
  recommended_video_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY (video_id, recommended_video_id),
  FOREIGN KEY (video_id) REFERENCES videos(id),
  FOREIGN KEY (recommended_video_id) REFERENCES videos(id)
);

CREATE INDEX IF NOT EXISTS idx_video_recommendations_video
  ON video_recommendations (video_id, sort_order, created_at);
