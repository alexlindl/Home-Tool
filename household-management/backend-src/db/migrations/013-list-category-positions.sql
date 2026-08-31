-- Migration 013: Per-list category positions
-- Adds a join table that lets each shopping list override the global
-- category sort order with its own per-list positions.
--
-- This migration is idempotent (safe to run repeatedly) thanks to
-- IF NOT EXISTS guards on the table and index.

-- ---------------------------------------------------------------------------
-- 1. Create the list_category_positions table.
--    Each row maps a (list_id, category_id) pair to a per-list sort_position.
--    - list_id: the shopping list whose ordering is being customised.
--    - category_id: FK to categories; CASCADE-deleted when the category is
--      removed so orphan rows never accumulate.
--    - sort_position: non-negative integer controlling display order within
--      the list.  The CHECK constraint mirrors the one on categories.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS list_category_positions (
  list_id       UUID    NOT NULL,
  category_id   UUID    NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  sort_position INTEGER NOT NULL DEFAULT 0 CHECK (sort_position >= 0),
  PRIMARY KEY (list_id, category_id)
);

-- ---------------------------------------------------------------------------
-- 2. Index for efficient per-list lookups ordered by position.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_lcp_list
  ON list_category_positions (list_id, sort_position);
