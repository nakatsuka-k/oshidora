-- Video approval workflow (CMS_00005/00006)
-- Adds fields to support listing/approving/rejecting submitted videos.

ALTER TABLE videos ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE videos ADD COLUMN approval_requested_at TEXT;
ALTER TABLE videos ADD COLUMN submitted_by_user_id TEXT;
ALTER TABLE videos ADD COLUMN approval_decided_at TEXT;
ALTER TABLE videos ADD COLUMN approval_decided_by_admin_id TEXT;
ALTER TABLE videos ADD COLUMN rejection_reason TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_videos_approval_status_requested
  ON videos (approval_status, approval_requested_at);
