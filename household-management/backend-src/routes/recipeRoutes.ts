/**
 * Recipe API routes
 * CRUD endpoints for shared household recipes, plus an endpoint to add a
 * recipe's ingredients to a shopping list.
 *
 * NOTE on route ordering: literal routes (e.g. /restore) are registered before
 * parameterized routes (/:id) so Express does not treat the literal as an id.
 */

import { Router, Request, Response } from 'express';
import {
  recipeService,
  RecipeValidationError,
} from '../services/RecipeService';
import { restoreRecipe } from '../db/recipeQueries';
import { importRecipeFromUrl, RecipeImportError } from '../services/recipeImport';
import { query } from '../db/connection';

const router = Router();

/**
 * GET /api/recipes
 * List all recipes with their ingredients.
 *
 * Response: 200 OK { "recipes": [ ... ] }
 */
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const recipes = await recipeService.getRecipes();
    res.status(200).json({ recipes });
  } catch (error) {
    console.error('Error fetching recipes:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch recipes' });
  }
});

/**
 * POST /api/recipes
 * Create a new recipe.
 *
 * Request body:
 * {
 *   "name": "Pancakes",
 *   "summary": "Fluffy breakfast pancakes",
 *   "steps": ["Mix dry", "Add wet", "Cook"],
 *   "ingredients": [ { "name": "Flour", "quantity": "2 cups", "category": "pantry" } ],
 *   "createdBy": "uuid"
 * }
 *
 * Response: 201 Created { "recipe": { ... } }
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, summary, steps, ingredients, createdBy, sourceUrl } = req.body;

    const recipe = await recipeService.createRecipe({
      name,
      summary,
      steps: Array.isArray(steps) ? steps : [],
      ingredients: Array.isArray(ingredients) ? ingredients : [],
      createdBy,
      sourceUrl,
    });

    try {
      await query(
        'INSERT INTO activity_log (event_type, item_title, user_id) VALUES ($1, $2, $3)',
        ['recipe_created', recipe.name, createdBy ?? null]
      );
    } catch {
      /* non-fatal */
    }

    res.status(201).json({ recipe });
  } catch (error) {
    if (error instanceof RecipeValidationError) {
      const status = error.message.includes('already exists') ? 409 : 400;
      res.status(status).json({ status: 'error', message: error.message });
      return;
    }
    console.error('Error creating recipe:', error);
    res.status(500).json({ status: 'error', message: 'Failed to create recipe' });
  }
});

/**
 * POST /api/recipes/restore
 * Restore (recreate) a previously deleted recipe from a full payload including
 * its original id. Uses INSERT ... ON CONFLICT (id) DO NOTHING. Powers Undo.
 *
 * Response: 200 OK { "message": "Recipe restored successfully" }
 */
router.post('/restore', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body ?? {};
    const id = body.id;
    const name = body.name;

    if (!id || !name) {
      const missing: string[] = [];
      if (!id) missing.push('id');
      if (!name) missing.push('name');
      res.status(400).json({
        status: 'error',
        message: `Missing required fields: ${missing.join(', ')}`,
      });
      return;
    }

    await restoreRecipe({
      id,
      name,
      summary: body.summary ?? null,
      steps: Array.isArray(body.steps) ? body.steps : [],
      createdBy: body.createdBy ?? body.created_by ?? null,
      sourceUrl: body.sourceUrl ?? body.source_url ?? null,
      ingredients: Array.isArray(body.ingredients) ? body.ingredients : [],
      createdAt: body.createdAt ?? body.created_at ?? null,
    });

    res.status(200).json({ message: 'Recipe restored successfully' });
  } catch (error) {
    console.error('Error restoring recipe:', error);
    res.status(500).json({ status: 'error', message: 'Failed to restore recipe' });
  }
});

/**
 * POST /api/recipes/import
 * Fetch a recipe web page server-side and return a normalized preview parsed
 * from its schema.org/Recipe structured data (with a plain-text fallback). The
 * result is NOT saved — the client pre-fills the form so the user can review
 * and edit before creating the recipe.
 *
 * Request body: { "url": "https://example.com/recipe" }
 *
 * Response: 200 OK
 * { "recipe": { name, summary, ingredients: [{name, quantity}], steps: [], sourceUrl } }
 *
 * Response: 400 Bad Request when the URL is invalid/blocked or no recipe found.
 */
router.post('/import', async (req: Request, res: Response): Promise<void> => {
  try {
    const { url } = req.body ?? {};

    if (!url || typeof url !== 'string') {
      res.status(400).json({ status: 'error', message: 'A url is required' });
      return;
    }

    const imported = await importRecipeFromUrl(url);
    res.status(200).json({ recipe: imported });
  } catch (error) {
    if (error instanceof RecipeImportError) {
      res.status(400).json({ status: 'error', message: error.message });
      return;
    }
    console.error('Error importing recipe:', error);
    res.status(500).json({ status: 'error', message: 'Failed to import recipe' });
  }
});

/**
 * GET /api/recipes/:id
 * Get a single recipe with its ingredients.
 *
 * Response: 200 OK { "recipe": { ... } } | 404 Not Found
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const recipe = await recipeService.getRecipeById(id);
    if (!recipe) {
      res.status(404).json({
        status: 'error',
        message: `Recipe with ID ${id} not found`,
      });
      return;
    }
    res.status(200).json({ recipe });
  } catch (error) {
    console.error('Error fetching recipe:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch recipe' });
  }
});

/**
 * PUT /api/recipes/:id
 * Update a recipe. Provided fields replace their current value; when `steps`
 * or `ingredients` are provided they fully replace the existing set.
 *
 * Response: 200 OK { "recipe": { ... } } | 404 Not Found
 */
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { name, summary, steps, ingredients, sourceUrl } = req.body;

    const recipe = await recipeService.updateRecipe(id, {
      ...(name !== undefined ? { name } : {}),
      ...(summary !== undefined ? { summary } : {}),
      ...(steps !== undefined ? { steps } : {}),
      ...(ingredients !== undefined ? { ingredients } : {}),
      ...(sourceUrl !== undefined ? { sourceUrl } : {}),
    });

    if (!recipe) {
      res.status(404).json({
        status: 'error',
        message: `Recipe with ID ${id} not found`,
      });
      return;
    }

    res.status(200).json({ recipe });
  } catch (error) {
    if (error instanceof RecipeValidationError) {
      const status = error.message.includes('already exists') ? 409 : 400;
      res.status(status).json({ status: 'error', message: error.message });
      return;
    }
    console.error('Error updating recipe:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update recipe' });
  }
});

/**
 * DELETE /api/recipes/:id
 * Delete a recipe (cascades to its ingredients).
 *
 * Response: 200 OK { "message": "Recipe deleted successfully" } | 404 Not Found
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const deleted = await recipeService.deleteRecipe(id);
    if (!deleted) {
      res.status(404).json({
        status: 'error',
        message: `Recipe with ID ${id} not found`,
      });
      return;
    }
    res.status(200).json({ message: 'Recipe deleted successfully' });
  } catch (error) {
    console.error('Error deleting recipe:', error);
    res.status(500).json({ status: 'error', message: 'Failed to delete recipe' });
  }
});

/**
 * POST /api/recipes/:id/add-to-shopping
 * Add selected recipe ingredients to a shopping list. When `ingredientNames`
 * is omitted or empty, all of the recipe's ingredients are added.
 *
 * Request body:
 * {
 *   "addedBy": "uuid",
 *   "listId": "uuid",             // optional; defaults to the default list
 *   "ingredientIds": ["uuid"]     // optional subset of ingredient IDs
 * }
 *
 * Response: 200 OK { "added": [ ShoppingItem ], "skipped": [ string ] }
 */
router.post('/:id/add-to-shopping', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { addedBy, listId, ingredientIds } = req.body;

    if (!addedBy) {
      res.status(400).json({
        status: 'error',
        message: 'Missing required field: addedBy',
      });
      return;
    }

    const result = await recipeService.addIngredientsToShoppingList(
      id,
      addedBy,
      listId,
      Array.isArray(ingredientIds) ? ingredientIds : undefined
    );

    // Log activity (non-fatal).
    try {
      await query(
        'INSERT INTO activity_log (event_type, item_title, user_id) VALUES ($1, $2, $3)',
        ['recipe_ingredients_added', `${result.added.length} item(s)`, addedBy]
      );
    } catch {
      /* non-fatal */
    }

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof RecipeValidationError) {
      const status = error.message.includes('not found') ? 404 : 400;
      res.status(status).json({ status: 'error', message: error.message });
      return;
    }
    console.error('Error adding recipe ingredients to shopping list:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to add ingredients to shopping list',
    });
  }
});

export default router;
