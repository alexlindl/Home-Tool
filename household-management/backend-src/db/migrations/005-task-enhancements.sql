-- Migration 005: Task enhancements - "Anyone" assignment support
-- Allow assigned_to to be NULL, which represents "Anyone" assignment.
-- When assigned_to IS NULL, the task appears in every household member's task list
-- and can be completed by any member.

-- Drop NOT NULL constraint on assigned_to to allow "Anyone" assignment
ALTER TABLE tasks ALTER COLUMN assigned_to DROP NOT NULL;

-- Add partial index for efficient NULL lookups when filtering "Anyone" tasks
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to_null ON tasks((assigned_to IS NULL)) WHERE assigned_to IS NULL;
