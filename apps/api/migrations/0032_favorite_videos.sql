-- Favorite videos/works (user-specific)
-- Stores which works a user has favorited from the work detail page.

CREATE TABLE IF NOT EXISTS favorite_videos (
  user_id TEXT NOT NULL,
  work_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, work_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (work_id) REFERENCES works(id)
);

CREATE INDEX IF NOT EXISTS idx_favorite_videos_user_created
  ON favorite_videos (user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_favorite_videos_work_created
  ON favorite_videos (work_id, created_at);
