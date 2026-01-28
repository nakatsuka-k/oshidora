-- Add per-user SMS auth skip flag

ALTER TABLE users ADD COLUMN sms_auth_skip INTEGER NOT NULL DEFAULT 0;
