-- 推しドラ: 初期スキーマ（最小）

CREATE TABLE IF NOT EXISTS oshi (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
