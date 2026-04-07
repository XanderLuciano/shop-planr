-- Add pin_hash column to users (nullable for gradual PIN setup)
ALTER TABLE users ADD COLUMN pin_hash TEXT;

-- Crypto key storage for ES256 JWT signing
CREATE TABLE crypto_keys (
  id TEXT PRIMARY KEY,
  algorithm TEXT NOT NULL,
  public_key TEXT NOT NULL,
  private_key TEXT NOT NULL,
  created_at TEXT NOT NULL
);
