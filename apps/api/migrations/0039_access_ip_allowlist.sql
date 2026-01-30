-- IP allowlist shared across sites (router + admin UI)
-- `rule` supports either an exact IP (v4/v6) or IPv4 CIDR (e.g. 203.0.113.0/24).

CREATE TABLE IF NOT EXISTS access_ip_allowlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule TEXT NOT NULL UNIQUE,
  note TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_access_ip_allowlist_enabled ON access_ip_allowlist(enabled);

-- Seed existing hardcoded allowlist (safe to re-run).
INSERT OR IGNORE INTO access_ip_allowlist (rule, note, enabled) VALUES ('223.135.200.51', 'seed: legacy allowlist', 1);
INSERT OR IGNORE INTO access_ip_allowlist (rule, note, enabled) VALUES ('117.102.205.215', 'seed: legacy allowlist', 1);
INSERT OR IGNORE INTO access_ip_allowlist (rule, note, enabled) VALUES ('133.232.96.225', 'seed: legacy allowlist', 1);
INSERT OR IGNORE INTO access_ip_allowlist (rule, note, enabled) VALUES ('3.114.72.126', 'seed: legacy allowlist', 1);
INSERT OR IGNORE INTO access_ip_allowlist (rule, note, enabled) VALUES ('2400:2412:2e2:a800:a121:14c:42fa:4ce2', 'seed: legacy allowlist', 1);
