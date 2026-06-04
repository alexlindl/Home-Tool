-- Migration 002: Categories table
-- Adds a categories table for managing shopping item categories

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed default categories
INSERT INTO categories (name, is_default) VALUES
  ('produce', TRUE),
  ('dairy', TRUE),
  ('bakery', TRUE),
  ('meat', TRUE),
  ('frozen', TRUE),
  ('pantry', TRUE),
  ('household', TRUE)
ON CONFLICT (name) DO NOTHING;
