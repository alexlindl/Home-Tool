/**
 * Recipes Page
 * Shared household recipe collection. Lists recipes as cards; a FAB opens the
 * add form. Selecting a recipe opens the detail view with the ingredient
 * checklist that can populate the shopping list. Deleting a recipe surfaces an
 * Undo snackbar.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUndoSnackbar } from '@/contexts/UndoSnackbarContext';
import { recipeApi } from '@/services/api';
import type { Recipe } from '@/types';
import { RecipeCard } from '@/components/RecipeCard';
import { RecipeForm } from '@/components/RecipeForm';
import { RecipeDetail } from '@/components/RecipeDetail';

export const Recipes: React.FC = () => {
  const { currentUser } = useAuth();
  const { showUndo } = useUndoSnackbar();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [detailRecipe, setDetailRecipe] = useState<Recipe | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    recipeApi
      .getAll()
      .then((fetched) => {
        setRecipes(fetched);
        setError('');
      })
      .catch(() => setError('Failed to load recipes'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddClick = () => {
    setEditingRecipe(null);
    setFormOpen(true);
  };

  const handleSaved = (saved: Recipe) => {
    setRecipes((prev) => {
      const exists = prev.some((r) => r.id === saved.id);
      const next = exists
        ? prev.map((r) => (r.id === saved.id ? saved : r))
        : [...prev, saved];
      return next.sort((a, b) => a.name.localeCompare(b.name));
    });
    // If we were editing the currently-open detail, refresh it.
    setDetailRecipe((cur) => (cur && cur.id === saved.id ? saved : cur));
    setEditingRecipe(null);
  };

  const handleEdit = (recipe: Recipe) => {
    setDetailRecipe(null);
    setEditingRecipe(recipe);
    setFormOpen(true);
  };

  const handleDelete = async (recipe: Recipe) => {
    setDetailRecipe(null);
    setRecipes((prev) => prev.filter((r) => r.id !== recipe.id));
    try {
      await recipeApi.remove(recipe.id);
      // Offer undo: restore the full recipe (including ingredients) on demand.
      showUndo({
        itemName: recipe.name,
        actionDescription: 'deleted',
        onUndo: async () => {
          await recipeApi.restore({
            id: recipe.id,
            name: recipe.name,
            summary: recipe.summary ?? null,
            steps: recipe.steps,
            createdBy: recipe.createdBy ?? null,
            sourceUrl: recipe.sourceUrl ?? null,
            ingredients: recipe.ingredients.map((ing) => ({
              name: ing.name,
              quantity: ing.quantity,
              category: ing.category,
            })),
            createdAt: recipe.createdAt,
          });
          load();
        },
      });
    } catch {
      setError('Failed to delete recipe');
      load();
    }
  };

  return (
    <div className="page recipes-page">
      <div className="page-header">
        <h1>Recipes</h1>
      </div>

      {loading && <p>Loading recipes...</p>}
      {error && (
        <p style={{ color: 'var(--color-danger, #e74c3c)' }}>{error}</p>
      )}

      {!loading && !error && recipes.length === 0 && (
        <div className="empty-state" style={{ textAlign: 'center', opacity: 0.8, padding: '32px 12px' }}>
          <p>No recipes yet.</p>
          <p>Add one, or paste a recipe from another source.</p>
        </div>
      )}

      {!loading && recipes.length > 0 && (
        <div className="recipe-list">
          {recipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} onOpen={setDetailRecipe} />
          ))}
        </div>
      )}

      <button
        type="button"
        className="fab"
        onClick={handleAddClick}
        aria-label="Add recipe"
      >
        +
      </button>

      <RecipeForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingRecipe(null);
        }}
        onSaved={handleSaved}
        currentUserId={currentUser?.id ?? ''}
        recipe={editingRecipe}
      />

      <RecipeDetail
        open={detailRecipe !== null}
        recipe={detailRecipe}
        onClose={() => setDetailRecipe(null)}
        currentUserId={currentUser?.id ?? ''}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
};

export default Recipes;
