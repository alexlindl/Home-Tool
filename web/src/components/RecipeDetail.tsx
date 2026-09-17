/**
 * RecipeDetail Component
 * Modal showing a recipe's name, summary, and steps, plus an interactive
 * ingredient checklist. The user ticks the ingredients they already HAVE; the
 * remaining (needed) ingredients can be added to a chosen shopping list.
 */

import React, { useState, useEffect, useMemo } from 'react';
import type { Recipe, ShoppingList } from '@/types';
import { recipeApi, shoppingListApi } from '@/services/api';

interface RecipeDetailProps {
  open: boolean;
  recipe: Recipe | null;
  onClose: () => void;
  currentUserId: string;
  onEdit: (recipe: Recipe) => void;
  onDelete: (recipe: Recipe) => void;
}

export const RecipeDetail: React.FC<RecipeDetailProps> = ({
  open,
  recipe,
  onClose,
  currentUserId,
  onEdit,
  onDelete,
}) => {
  // Set of ingredient IDs the user has marked as "already have".
  const [haveIds, setHaveIds] = useState<Set<string>>(new Set());
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [selectedListId, setSelectedListId] = useState('');
  const [adding, setAdding] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (!open) return;
    setHaveIds(new Set());
    setFeedback('');
    shoppingListApi
      .getAll()
      .then((fetched) => {
        setLists(fetched);
        const defaultList = fetched.find((l) => l.isDefault) ?? fetched[0];
        setSelectedListId(defaultList ? defaultList.id : '');
      })
      .catch(() => {});
  }, [open, recipe]);

  const toggleHave = (id: string) => {
    setHaveIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const neededIngredients = useMemo(
    () => (recipe ? recipe.ingredients.filter((ing) => !haveIds.has(ing.id)) : []),
    [recipe, haveIds],
  );

  const handleAddNeeded = async () => {
    if (!recipe || neededIngredients.length === 0) return;
    setAdding(true);
    setFeedback('');
    try {
      const result = await recipeApi.addToShopping(
        recipe.id,
        currentUserId,
        selectedListId || undefined,
        neededIngredients.map((ing) => ing.name),
      );
      setFeedback(
        `Added ${result.added.length} item${result.added.length === 1 ? '' : 's'} to the shopping list.`,
      );
    } catch {
      setFeedback('Failed to add items to the shopping list.');
    } finally {
      setAdding(false);
    }
  };

  if (!open || !recipe) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-label={recipe.name}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{recipe.name}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {recipe.summary && <p style={{ marginTop: 0 }}>{recipe.summary}</p>}

        <div className="form-group">
          <label>Ingredients — check what you already have</label>
          {recipe.ingredients.length === 0 ? (
            <p style={{ opacity: 0.7 }}>No ingredients listed.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {recipe.ingredients.map((ing) => {
                const have = haveIds.has(ing.id);
                return (
                  <li
                    key={ing.id}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}
                  >
                    <input
                      type="checkbox"
                      id={`have-${ing.id}`}
                      checked={have}
                      onChange={() => toggleHave(ing.id)}
                    />
                    <label
                      htmlFor={`have-${ing.id}`}
                      style={{
                        margin: 0,
                        textDecoration: have ? 'line-through' : 'none',
                        opacity: have ? 0.6 : 1,
                      }}
                    >
                      {ing.quantity ? `${ing.quantity} ` : ''}
                      {ing.name}
                      {ing.category ? ` (${ing.category})` : ''}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {recipe.ingredients.length > 0 && (
          <div className="form-group">
            <label htmlFor="recipe-target-list">Add needed items to</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select
                id="recipe-target-list"
                value={selectedListId}
                onChange={(e) => setSelectedListId(e.target.value)}
                style={{ flex: 1 }}
              >
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleAddNeeded}
                disabled={adding || neededIngredients.length === 0}
              >
                {adding
                  ? 'Adding...'
                  : `Add ${neededIngredients.length} needed`}
              </button>
            </div>
            {feedback && (
              <p style={{ fontSize: '0.8rem', margin: '6px 0 0 0' }}>{feedback}</p>
            )}
          </div>
        )}

        {recipe.steps.length > 0 && (
          <div className="form-group">
            <label>Steps</label>
            <ol style={{ margin: 0, paddingLeft: '20px' }}>
              {recipe.steps.map((step, index) => (
                <li key={index} style={{ marginBottom: '6px' }}>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => onDelete(recipe)}
          >
            Delete
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => onEdit(recipe)}
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  );
};
