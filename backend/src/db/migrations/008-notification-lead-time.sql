-- Migration 008: Configurable notification lead time
-- Adds per-task notification lead time override and a global app_settings table.

-- Per-task notification lead time override (in hours)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS notification_lead_hours INTEGER;

-- App settings table for global defaults
CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed default notification lead time (24 hours)
INSERT INTO app_settings (key, value)
VALUES ('notification_lead_hours', '24')
ON CONFLICT (key) DO NOTHING;
