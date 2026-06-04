-- Migration 003: Multiple Lists
CREATE TABLE IF NOT EXISTS task_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shopping_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add list_id columns (nullable for backward compat)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS list_id UUID REFERENCES task_lists(id);
ALTER TABLE shopping_items ADD COLUMN IF NOT EXISTS list_id UUID REFERENCES shopping_lists(id);

-- Seed default lists
INSERT INTO task_lists (name, is_default) VALUES ('Tasks', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO shopping_lists (name, is_default) VALUES ('Shopping', TRUE) ON CONFLICT DO NOTHING;

-- Backfill existing rows with default list
UPDATE tasks SET list_id = (SELECT id FROM task_lists WHERE is_default = TRUE) WHERE list_id IS NULL;
UPDATE shopping_items SET list_id = (SELECT id FROM shopping_lists WHERE is_default = TRUE) WHERE list_id IS NULL;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_tasks_list_id ON tasks(list_id);
CREATE INDEX IF NOT EXISTS idx_shopping_items_list_id ON shopping_items(list_id);
