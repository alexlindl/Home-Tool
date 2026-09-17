/**
 * Recipe database queries
 * Provides CRUD functions for the recipes and recipe_ingredients tables.
 *
 * A recipe and its ingredients are read/written together. Create and update
 * run inside a transaction so a recipe is never left without its ingredients.
 */

import { query, getClient } from './connection';
import {
  Recipe,
  RecipeRow,
  recipeFromRow,
  RecipeIngredient,
  RecipeIngredientRow,
  recipeIngredientFromRow,
  CreateRecipeInput,
  UpdateRecipeInput,
  RecipeIngredientInput,
} from '../models/Recipe';

/**
 * Load and map the ingredients for a set of recipe IDs, grouped by recipe ID.
 */
const loadIngredientsFor = async (
  recipeIds: string[]
): Promise<Map<string, RecipeIngredient[]>> => {
  const map = new Map<string, RecipeIngredient[]>();
  if (recipeIds.length === 0) return map;

  const result = await query(
    `SELECT * FROM recipe_ingredients
     WHERE recipe_id = ANY($1::uuid[])
     ORDER BY sort_position ASC, created_at ASC`,
    [recipeIds]
  );

  for (const row of result.rows as RecipeIngredientRow[]) {
    const ingredient = recipeIngredientFromRow(row);
    const existing = map.get(ingredient.recipeId);
    if (existing) {
      existing.push(ingredient);
    } else {
      map.set(ingredient.recipeId, [ingredient]);
    }
  }

  return map;
};

/**
 * Get all recipes with their ingredients, ordered by name.
 */
export const getRecipes = async (): Promise<Recipe[]> => {
  const result = await query('SELECT * FROM recipes ORDER BY name ASC');
  const rows = result.rows as RecipeRow[];
  const ingredientsByRecipe = await loadIngredientsFor(rows.map((r) => r.id));
  return rows.map((row) => recipeFromRow(row, ingredientsByRecipe.get(row.id) ?? []));
};

/**
 * Get a single recipe by ID with its ingredients, or null if not found.
 */
export const getRecipeById = async (id: string): Promise<Recipe | null> => {
  const result = await query('SELECT * FROM recipes WHERE id = $1', [id]);
  if (result.rows.length === 0) return null;

  const row = result.rows[0] as RecipeRow;
  const ingredientsByRecipe = await loadIngredientsFor([row.id]);
  return recipeFromRow(row, ingredientsByRecipe.get(row.id) ?? []);
};

/**
 * Insert the ingredient rows for a recipe using the provided queryable.
 * The queryable is a transaction-scoped client (client.query) or the pool.
 */
const insertIngredients = async (
  exec: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }>,
  recipeId: string,
  ingredients: RecipeIngredientInput[]
): Promise<void> => {
  for (let i = 0; i < ingredients.length; i++) {
    const ingredient = ingredients[i]!;
    await exec(
      `INSERT INTO recipe_ingredients (recipe_id, name, quantity, category, sort_position)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        recipeId,
        ingredient.name,
        ingredient.quantity ?? null,
        ingredient.category ?? null,
        i,
      ]
    );
  }
};

/**
 * Create a new recipe together with its ingredients, in a transaction.
 */
export const createRecipe = async (input: CreateRecipeInput): Promise<Recipe> => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const recipeResult = await client.query(
      `INSERT INTO recipes (name, summary, steps, created_by)
       VALUES ($1, $2, $3::jsonb, $4)
       RETURNING *`,
      [
        input.name,
        input.summary ?? null,
        JSON.stringify(input.steps ?? []),
        input.createdBy ?? null,
      ]
    );

    const recipeRow = recipeResult.rows[0] as RecipeRow;
    await insertIngredients(
      (text, params) => client.query(text, params as unknown[]),
      recipeRow.id,
      input.ingredients ?? []
    );

    await client.query('COMMIT');

    const created = await getRecipeById(recipeRow.id);
    // getRecipeById cannot return null here since we just inserted the row.
    return created as Recipe;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Update an existing recipe. Any provided field replaces its current value.
 * When `steps` or `ingredients` are provided they fully replace the existing
 * set. Returns the updated recipe, or null if the recipe does not exist.
 */
export const updateRecipe = async (
  id: string,
  input: UpdateRecipeInput
): Promise<Recipe | null> => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT id FROM recipes WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramCount = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(input.name);
    }
    if (input.summary !== undefined) {
      updates.push(`summary = $${paramCount++}`);
      values.push(input.summary);
    }
    if (input.steps !== undefined) {
      updates.push(`steps = $${paramCount++}::jsonb`);
      values.push(JSON.stringify(input.steps));
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    await client.query(
      `UPDATE recipes SET ${updates.join(', ')} WHERE id = $${paramCount}`,
      values
    );

    // Replace ingredients wholesale when provided.
    if (input.ingredients !== undefined) {
      await client.query('DELETE FROM recipe_ingredients WHERE recipe_id = $1', [id]);
      await insertIngredients(
        (text, params) => client.query(text, params as unknown[]),
        id,
        input.ingredients
      );
    }

    await client.query('COMMIT');
    return getRecipeById(id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Delete a recipe (and, via ON DELETE CASCADE, its ingredients).
 * @returns true if a recipe was deleted, false if not found.
 */
export const deleteRecipe = async (id: string): Promise<boolean> => {
  const result = await query('DELETE FROM recipes WHERE id = $1', [id]);
  return result.rowCount !== null && result.rowCount > 0;
};

/**
 * Find a recipe by name (case-insensitive), optionally excluding an ID.
 * Used to prevent duplicate recipe names.
 */
export const findRecipeByName = async (
  name: string,
  excludeId?: string
): Promise<Recipe | null> => {
  const sql = excludeId
    ? 'SELECT * FROM recipes WHERE LOWER(name) = LOWER($1) AND id != $2 LIMIT 1'
    : 'SELECT * FROM recipes WHERE LOWER(name) = LOWER($1) LIMIT 1';
  const params = excludeId ? [name, excludeId] : [name];
  const result = await query(sql, params);
  if (result.rows.length === 0) return null;
  const row = result.rows[0] as RecipeRow;
  const ingredientsByRecipe = await loadIngredientsFor([row.id]);
  return recipeFromRow(row, ingredientsByRecipe.get(row.id) ?? []);
};

/**
 * Restore (recreate) a recipe from a full payload including its original id.
 * Uses INSERT ... ON CONFLICT (id) DO NOTHING so restoring an existing recipe
 * is a harmless no-op. Ingredients are re-inserted only when the recipe row
 * was actually (re)created. Powers the Undo snackbar.
 */
export const restoreRecipe = async (payload: {
  id: string;
  name: string;
  summary?: string | null;
  steps?: string[];
  createdBy?: string | null;
  ingredients?: RecipeIngredientInput[];
  createdAt?: string | null;
}): Promise<void> => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const inserted = await client.query(
      `INSERT INTO recipes (id, name, summary, steps, created_by, created_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, COALESCE($6, CURRENT_TIMESTAMP))
       ON CONFLICT (id) DO NOTHING`,
      [
        payload.id,
        payload.name,
        payload.summary ?? null,
        JSON.stringify(payload.steps ?? []),
        payload.createdBy ?? null,
        payload.createdAt ?? null,
      ]
    );

    // Only (re)insert ingredients when the recipe row was actually created.
    if (inserted.rowCount && inserted.rowCount > 0 && payload.ingredients) {
      await insertIngredients(
        (text, params) => client.query(text, params as unknown[]),
        payload.id,
        payload.ingredients
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
