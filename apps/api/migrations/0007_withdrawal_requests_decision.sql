-- Add decision metadata for admin approval/rejection

ALTER TABLE withdrawal_requests ADD COLUMN decided_at TEXT;
ALTER TABLE withdrawal_requests ADD COLUMN decided_by TEXT;
ALTER TABLE withdrawal_requests ADD COLUMN decision_note TEXT;

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_decided_at ON withdrawal_requests(decided_at);
