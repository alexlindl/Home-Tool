-- Migration 014: Pagination keyset indexes
-- Adds covering indexes that back the cursor-based (keyset) pagination for the
-- Task_History and Activity_Log feeds. Keyset pagination orders by a stable
-- (timestamp DESC, id DESC) tuple, so a matching composite index lets each page
-- request seek directly to the cursor position instead of scanning + sorting.
--
-- This migration is idempotent (safe to run repeatedly) and transactional
-- (each migration file executes inside an implicit per-file transaction, so a
-- mid-migration failure rolls back all changes in this file, leaving the
-- schema identical to its pre-migration state).

-- ---------------------------------------------------------------------------
-- 1. Task_History keyset index: ordered by completed_at DESC, id DESC.
--    Backs the paginated task history query
--    (WHERE (completed_at, id) < (cursor) ORDER BY completed_at DESC, id DESC).
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_task_history_keyset ON task_history (completed_at DESC, id DESC);

-- ---------------------------------------------------------------------------
-- 2. Activity_Log keyset index: ordered by created_at DESC, id DESC.
--    Backs the paginated activity log query
--    (WHERE (created_at, id) < (cursor) ORDER BY created_at DESC, id DESC).
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_activity_log_keyset ON activity_log (created_at DESC, id DESC);
