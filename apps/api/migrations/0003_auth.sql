-- Auth schema (email + SMS) for 推しドラ

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  phone TEXT,
  phone_verified INTEGER NOT NULL DEFAULT 0,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS verification_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  kind TEXT NOT NULL,
  target TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  consumed_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_verification_codes_lookup
  ON verification_codes (kind, target, expires_at, consumed_at);

CREATE INDEX IF NOT EXISTS idx_users_phone
  ON users (phone);
