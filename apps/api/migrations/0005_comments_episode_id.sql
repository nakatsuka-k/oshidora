-- Add episode association for comments
-- Comments are still listed by work/content_id, but each comment is linked to a single episode.

ALTER TABLE comments ADD COLUMN episode_id TEXT;
