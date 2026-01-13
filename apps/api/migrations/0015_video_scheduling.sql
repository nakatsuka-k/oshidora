-- Video scheduling support for CMS_00003/00004

-- Track whether a scheduled video is active or cancelled
ALTER TABLE videos ADD COLUMN scheduled_status TEXT NOT NULL DEFAULT 'scheduled';
ALTER TABLE videos ADD COLUMN scheduled_cancelled_at TEXT;
