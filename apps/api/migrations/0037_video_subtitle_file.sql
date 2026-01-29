-- Add subtitle file URL for videos (WebVTT)

ALTER TABLE videos ADD COLUMN subtitle_url TEXT NOT NULL DEFAULT '';
