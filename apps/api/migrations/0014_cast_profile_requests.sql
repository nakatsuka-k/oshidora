-- Cast profile requests (individual actor/staff registration approval)

CREATE TABLE IF NOT EXISTS cast_profile_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  email TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  draft_json TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_at TEXT NOT NULL,
  decided_at TEXT,
  decided_by_admin_id TEXT,
  rejection_reason TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_cast_profile_requests_status_submitted
  ON cast_profile_requests (status, submitted_at);
