-- CMS content schema (PH1)

-- Admin accounts for CMS (separate from end-user `users`)
CREATE TABLE IF NOT EXISTS cms_admins (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Admin',
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS works (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  thumbnail_url TEXT NOT NULL DEFAULT '',
  published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  stream_video_id TEXT NOT NULL DEFAULT '',
  thumbnail_url TEXT NOT NULL DEFAULT '',
  published INTEGER NOT NULL DEFAULT 0,
  scheduled_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (work_id) REFERENCES works(id)
);

CREATE INDEX IF NOT EXISTS idx_videos_work_created
  ON videos (work_id, created_at);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS casts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  thumbnail_url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Work relations
CREATE TABLE IF NOT EXISTS work_categories (
  work_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY (work_id, category_id),
  FOREIGN KEY (work_id) REFERENCES works(id),
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS work_tags (
  work_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (work_id, tag_id),
  FOREIGN KEY (work_id) REFERENCES works(id),
  FOREIGN KEY (tag_id) REFERENCES tags(id)
);

CREATE TABLE IF NOT EXISTS work_casts (
  work_id TEXT NOT NULL,
  cast_id TEXT NOT NULL,
  role_name TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY (work_id, cast_id),
  FOREIGN KEY (work_id) REFERENCES works(id),
  FOREIGN KEY (cast_id) REFERENCES casts(id)
);

CREATE INDEX IF NOT EXISTS idx_work_categories_category
  ON work_categories (category_id);

CREATE INDEX IF NOT EXISTS idx_work_tags_tag
  ON work_tags (tag_id);

CREATE INDEX IF NOT EXISTS idx_work_casts_cast
  ON work_casts (cast_id);

-- Video relations
CREATE TABLE IF NOT EXISTS video_categories (
  video_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY (video_id, category_id),
  FOREIGN KEY (video_id) REFERENCES videos(id),
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS video_tags (
  video_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (video_id, tag_id),
  FOREIGN KEY (video_id) REFERENCES videos(id),
  FOREIGN KEY (tag_id) REFERENCES tags(id)
);

CREATE TABLE IF NOT EXISTS video_casts (
  video_id TEXT NOT NULL,
  cast_id TEXT NOT NULL,
  role_name TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY (video_id, cast_id),
  FOREIGN KEY (video_id) REFERENCES videos(id),
  FOREIGN KEY (cast_id) REFERENCES casts(id)
);

CREATE INDEX IF NOT EXISTS idx_video_categories_category
  ON video_categories (category_id);

CREATE INDEX IF NOT EXISTS idx_video_tags_tag
  ON video_tags (tag_id);

CREATE INDEX IF NOT EXISTS idx_video_casts_cast
  ON video_casts (cast_id);

-- Notices
CREATE TABLE IF NOT EXISTS notices (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  sent_at TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  push INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Coin settings
CREATE TABLE IF NOT EXISTS coin_settings (
  id TEXT PRIMARY KEY,
  price_yen INTEGER NOT NULL DEFAULT 0,
  place TEXT NOT NULL DEFAULT '',
  target TEXT NOT NULL DEFAULT '',
  period TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
