/**
 * Recipe Service
 * Business logic for recipes: validation, CRUD delegation, and the
 * "add ingredients to the shopping list" flow that reuses the shopping service.
 */

import {
  Recipe,
  CreateRecipeInput,
  UpdateRecipeInput,
  RecipeIngredientInput,
} from '../models/Recipe';
import {
  getRecipes as dbGetRecipes,
  getRecipeById as dbGetRecipeById,
  createRecipe as dbCreateRecipe,
  updateRecipe as dbUpdateRecipe,
  deleteRecipe as dbDeleteRecipe,
  findRecipeByName,
} from '../db/recipeQueries';
import { getAllCategories } from '../db/categoryQueries';
import { shoppingService } from './ShoppingService';
import { ShoppingItem } from '../models/Shopping';

/**
 * Validation error thrown when recipe input is invalid.
 */
export class RecipeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecipeValidationError';
  }
}

/**
 * Result of adding selected recipe ingredients to a shopping list.
 */
export interface AddIngredientsResult {
  added: ShoppingItem[];
  /** Ingredient names that were skipped (e.g. blank names). */
  skipped: string[];
}

/**
 * RecipeService — manages recipe CRUD and shopping-list population.
 */
export class RecipeService {
  /**
   * Normalize + validate recipe fields shared by create and update.
   * Returns cleaned steps/ingredients arrays.
   */
  private normalizeContent(
    steps: string[] | undefined,
    ingredients: RecipeIngredientInput[] | undefined
  ): { steps: string[]; ingredients: RecipeIngredientInput[] } {
    const cleanedSteps = (steps ?? [])
      .map((s) => (typeof s === 'string' ? s.trim() : ''))
      .filter((s) => s.length > 0);

    const cleanedIngredients = (ingredients ?? [])
      .map((ing) => ({
        name: typeof ing.name === 'string' ? ing.name.trim() : '',
        quantity:
          ing.quantity && ing.quantity.trim().length > 0
            ? ing.quantity.trim()
            : undefined,
        category:
          ing.category && ing.category.trim().length > 0
            ? ing.category.trim()
            : undefined,
      }))
      .filter((ing) => ing.name.length > 0);

    return { steps: cleanedSteps, ingredients: cleanedIngredients };
  }

  /**
   * Get all recipes with their ingredients.
   */
  async getRecipes(): Promise<Recipe[]> {
    return dbGetRecipes();
  }

  /**
   * Get a recipe by ID, or null if not found.
   */
  async getRecipeById(id: string): Promise<Recipe | null> {
    return dbGetRecipeById(id);
  }

  /**
   * Create a new recipe with validation.
   * @throws RecipeValidationError if the name is missing or already used.
   */
  async createRecipe(input: CreateRecipeInput): Promise<Recipe> {
    const name = (input.name ?? '').trim();
    if (name.length === 0) {
      throw new RecipeValidationError('Recipe name is required');
    }

    const duplicate = await findRecipeByName(name);
    if (duplicate) {
      throw new RecipeValidationError('A recipe with this name already exists');
    }

    const { steps, ingredients } = this.normalizeContent(
      input.steps,
      input.ingredients
    );

    return dbCreateRecipe({
      name,
      summary:
        input.summary && input.summary.trim().length > 0
          ? input.summary.trim()
          : undefined,
      steps,
      ingredients,
      createdBy: input.createdBy,
    });
  }

  /**
   * Update an existing recipe with validation.
   * @throws RecipeValidationError if the name is blank or a duplicate.
   * @returns the updated recipe, or null if it does not exist.
   */
  async updateRecipe(id: string, input: UpdateRecipeInput): Promise<Recipe | null> {
    const patch: UpdateRecipeInput = {};

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (name.length === 0) {
        throw new RecipeValidationError('Recipe name cannot be blank');
      }
      const duplicate = await findRecipeByName(name, id);
      if (duplicate) {
        throw new RecipeValidationError('A recipe with this name already exists');
      }
      patch.name = name;
    }

    if (input.summary !== undefined) {
      patch.summary =
        input.summary && input.summary.trim().length > 0
          ? input.summary.trim()
          : null;
    }

    if (input.steps !== undefined) {
      patch.steps = this.normalizeContent(input.steps, undefined).steps;
    }

    if (input.ingredients !== undefined) {
      patch.ingredients = this.normalizeContent(
        undefined,
        input.ingredients
      ).ingredients;
    }

    return dbUpdateRecipe(id, patch);
  }

  /**
   * Delete a recipe. Returns true if a recipe was deleted.
   */
  async deleteRecipe(id: string): Promise<boolean> {
    return dbDeleteRecipe(id);
  }

  /**
   * Add the selected ingredients of a recipe to a shopping list.
   *
   * Each ingredient becomes a shopping item via the shopping service. When an
   * ingredient's category is not a valid shopping category it falls back to
   * "uncategorized" so the add never fails on an unknown category. If no
   * ingredient names are supplied, all of the recipe's ingredients are added.
   *
   * @param recipeId Recipe UUID
   * @param addedBy User ID adding the items
   * @param listId Optional target shopping list (defaults to the default list)
   * @param ingredientNames Optional subset of ingredient names to add
   * @throws RecipeValidationError if the recipe or user context is invalid
   */
  async addIngredientsToShoppingList(
    recipeId: string,
    addedBy: string,
    listId?: string,
    ingredientNames?: string[]
  ): Promise<AddIngredientsResult> {
    const recipe = await dbGetRecipeById(recipeId);
    if (!recipe) {
      throw new RecipeValidationError(`Recipe with ID ${recipeId} not found`);
    }

    if (!addedBy || addedBy.trim().length === 0) {
      throw new RecipeValidationError('addedBy user is required');
    }

    // Determine which ingredients to add.
    let selected = recipe.ingredients;
    if (ingredientNames && ingredientNames.length > 0) {
      const wanted = new Set(ingredientNames.map((n) => n.trim().toLowerCase()));
      selected = recipe.ingredients.filter((ing) =>
        wanted.has(ing.name.trim().toLowerCase())
      );
    }

    // Load valid categories once so we can validate/fallback per ingredient.
    const categories = await getAllCategories();
    const validCategories = new Set(categories.map((c) => c.name.toLowerCase()));

    const added: ShoppingItem[] = [];
    const skipped: string[] = [];

    for (const ingredient of selected) {
      const name = ingredient.name.trim();
      if (name.length === 0) {
        skipped.push(ingredient.name);
        continue;
      }

      let category = ingredient.category?.trim() || 'uncategorized';
      if (
        category.toLowerCase() !== 'uncategorized' &&
        !validCategories.has(category.toLowerCase())
      ) {
        category = 'uncategorized';
      }

      const item = await shoppingService.addItem({
        name,
        category,
        addedBy,
        listId,
      });
      added.push(item);
    }

    return { added, skipped };
  }
}

/**
 * Singleton RecipeService instance.
 */
export const recipeService = new RecipeService();
