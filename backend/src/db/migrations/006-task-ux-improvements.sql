-- Migration 006: Enhanced recurrence patterns and backlog tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_type VARCHAR(30);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_day_of_week VARCHAR(10);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_ordinal_week INTEGER;

-- Allow due_date to be NULL for backlog tasks
ALTER TABLE tasks ALTER COLUMN due_date DROP NOT NULL;

-- Index for backlog task queries
CREATE INDEX IF NOT EXISTS idx_tasks_due_date_null
  ON tasks((due_date IS NULL)) WHERE due_date IS NULL;
