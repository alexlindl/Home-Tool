-- Migration 015: Recipes
-- Shared household recipes with a flexible structure (name, summary, ordered
-- steps) plus a child ingredient list that can be used to populate the
-- shopping list. Recipes are shared across all household users (no per-user
-- scoping); created_by is retained only for attribution.

CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  summary TEXT,
  -- Ordered list of step strings, stored as a JSON array (e.g. ["Preheat oven", "Mix"]).
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  -- Free-form quantity/measure, e.g. "2 cups", "1 tbsp". Optional.
  quantity VARCHAR(100),
  -- Shopping category so ingredients can be added to the shopping list with a
  -- sensible category. Nullable; defaults to "uncategorized" when added.
  category VARCHAR(50),
  sort_position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipes_name ON recipes(name);
