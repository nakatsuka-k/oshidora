-- CMS admin password reset tokens

CREATE TABLE IF NOT EXISTS cms_admin_password_resets (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  used_at TEXT,
  FOREIGN KEY (admin_id) REFERENCES cms_admins(id)
);

CREATE INDEX IF NOT EXISTS idx_cms_admin_password_resets_token
  ON cms_admin_password_resets (token_hash);

CREATE INDEX IF NOT EXISTS idx_cms_admin_password_resets_admin
  ON cms_admin_password_resets (admin_id, created_at);
