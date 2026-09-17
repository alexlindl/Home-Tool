-- Migration 016: Recipe source URL
-- Records where an imported recipe came from (the page it was imported from).
-- Nullable; recipes created manually or via paste have no source URL.

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS source_url TEXT;
