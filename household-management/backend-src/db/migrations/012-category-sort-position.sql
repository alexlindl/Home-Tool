-- Migration 012: Category sort position
-- Adds a persistent, user-controllable numeric ordering to every category.
--
-- This migration is idempotent (safe to run repeatedly) and transactional
-- (each migration file executes inside an implicit per-file transaction, so a
-- mid-migration failure rolls back all schema and data changes in this file,
-- leaving the categories table identical to its pre-migration state).

-- ---------------------------------------------------------------------------
-- 1. Add the sort_position column (idempotent via IF NOT EXISTS).
--    NOT NULL with a default of 0, constrained to non-negative integers.
--    The upper bound (2,147,483,647) is enforced by the INTEGER type itself.
-- ---------------------------------------------------------------------------
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_position INTEGER NOT NULL DEFAULT 0;

-- Add the non-negative CHECK constraint only if it does not already exist,
-- so re-running the migration does not raise a duplicate-object error.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'categories_sort_position_non_negative'
  ) THEN
    ALTER TABLE categories
      ADD CONSTRAINT categories_sort_position_non_negative CHECK (sort_position >= 0);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Back-fill contiguous, zero-based sort_position values.
--
--    A single deterministic UPDATE ... FROM (SELECT ... ROW_NUMBER()) computes
--    the complete assignment from scratch every run, so a second application
--    recomputes the identical result (idempotent).
--
--    Ordering rank:
--      - Default categories in supermarket-layout order:
--          produce(0), dairy(1), bakery(2), meat(3), frozen(4), pantry(5), household(6)
--      - Remaining default categories next, by ascending id (creation order).
--      - Custom categories last (strictly greater than every default position),
--        by ascending id (creation order).
--
--    The layout_rank CASE places the seven known defaults first (ranks 0-6),
--    other defaults get a large-but-below-custom rank (1), and custom
--    categories get the highest rank (2). Within each group ordering falls
--    back to id ascending, and ROW_NUMBER() then produces contiguous 0-based
--    positions with no gaps and no duplicates across the whole table.
-- ---------------------------------------------------------------------------
UPDATE categories AS c
SET sort_position = ordered.new_position
FROM (
  SELECT
    id,
    (ROW_NUMBER() OVER (
      ORDER BY
        CASE
          WHEN is_default THEN
            CASE name
              WHEN 'produce'   THEN 0
              WHEN 'dairy'     THEN 1
              WHEN 'bakery'    THEN 2
              WHEN 'meat'      THEN 3
              WHEN 'frozen'    THEN 4
              WHEN 'pantry'    THEN 5
              WHEN 'household' THEN 6
              ELSE 1000000000  -- remaining defaults: after known layout, before custom
            END
          ELSE 2000000000       -- custom categories: strictly after all defaults
        END,
        id
    ) - 1) AS new_position
  FROM categories
) AS ordered
WHERE c.id = ordered.id;
