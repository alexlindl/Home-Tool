/**
 * Recipe data models
 * Represents shared household recipes and their ingredient lists.
 *
 * A recipe has a name, an optional summary, an ordered list of step strings,
 * and a list of ingredients. Ingredients carry an optional quantity and an
 * optional shopping category so they can be used to populate the shopping list.
 */

/**
 * A single recipe ingredient (domain model, camelCase).
 */
export interface RecipeIngredient {
  id: string; // UUID
  recipeId: string; // parent recipe UUID
  name: string;
  quantity?: string; // free-form measure, e.g. "2 cups"
  category?: string; // shopping category (maps to shopping categories)
  sortPosition: number;
  createdAt: Date;
}

/**
 * Recipe ingredient database row (matches PostgreSQL schema).
 */
export interface RecipeIngredientRow {
  id: string;
  recipe_id: string;
  name: string;
  quantity: string | null;
  category: string | null;
  sort_position: number;
  created_at: Date;
}

/**
 * Convert a database row to a RecipeIngredient model.
 */
export const recipeIngredientFromRow = (
  row: RecipeIngredientRow
): RecipeIngredient => {
  return {
    id: row.id,
    recipeId: row.recipe_id,
    name: row.name,
    quantity: row.quantity || undefined,
    category: row.category || undefined,
    sortPosition: row.sort_position,
    createdAt: row.created_at,
  };
};

/**
 * Recipe domain model (camelCase). Ingredients are nested.
 */
export interface Recipe {
  id: string; // UUID
  name: string;
  summary?: string;
  steps: string[]; // ordered step strings
  createdBy?: string; // User ID (attribution only)
  ingredients: RecipeIngredient[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Recipe database row (matches PostgreSQL schema). Does NOT include ingredients;
 * those are loaded separately and attached by the query layer.
 *
 * `steps` is stored as JSONB. The `pg` driver parses JSONB columns into JS
 * values, so this arrives already as an array of strings (not a JSON string).
 */
export interface RecipeRow {
  id: string;
  name: string;
  summary: string | null;
  steps: string[] | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Convert a database row (plus its already-loaded ingredients) to a Recipe.
 */
export const recipeFromRow = (
  row: RecipeRow,
  ingredients: RecipeIngredient[] = []
): Recipe => {
  return {
    id: row.id,
    name: row.name,
    summary: row.summary || undefined,
    steps: Array.isArray(row.steps) ? row.steps : [],
    createdBy: row.created_by || undefined,
    ingredients,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

/**
 * Input for a single ingredient when creating/updating a recipe.
 */
export interface RecipeIngredientInput {
  name: string;
  quantity?: string;
  category?: string;
}

/**
 * Input for creating a new recipe.
 */
export interface CreateRecipeInput {
  name: string;
  summary?: string;
  steps: string[];
  ingredients: RecipeIngredientInput[];
  createdBy?: string;
}

/**
 * Input for updating an existing recipe. Any provided field replaces the
 * existing value; when `ingredients` or `steps` are provided they fully
 * replace the existing set.
 */
export interface UpdateRecipeInput {
  name?: string;
  summary?: string | null;
  steps?: string[];
  ingredients?: RecipeIngredientInput[];
}
