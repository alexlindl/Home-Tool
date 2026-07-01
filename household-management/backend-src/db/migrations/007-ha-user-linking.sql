-- Migration 007: Home Assistant user linking
-- Add ha_username column to users table for linking household members
-- to their Home Assistant accounts (used for HA notifications).

ALTER TABLE users ADD COLUMN IF NOT EXISTS ha_username VARCHAR(128);

-- Unique partial index: only one user can be linked to a given HA username,
-- but multiple users can have NULL (unlinked).
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_ha_username
  ON users(ha_username) WHERE ha_username IS NOT NULL;
