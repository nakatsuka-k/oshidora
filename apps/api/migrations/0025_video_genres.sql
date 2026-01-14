-- Video genres (CMS)

CREATE TABLE IF NOT EXISTS genres (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS video_genres (
  video_id TEXT NOT NULL,
  genre_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (video_id, genre_id),
  FOREIGN KEY (video_id) REFERENCES videos(id),
  FOREIGN KEY (genre_id) REFERENCES genres(id)
);

CREATE INDEX IF NOT EXISTS idx_video_genres_genre
  ON video_genres (genre_id);
