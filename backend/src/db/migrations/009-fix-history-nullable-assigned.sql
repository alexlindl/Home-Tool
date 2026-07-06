-- Migration 009: Allow null assigned_to in task_history
-- Tasks assigned to "Anyone" have NULL assigned_to, which must be allowed in history too.

ALTER TABLE task_history ALTER COLUMN assigned_to DROP NOT NULL;
