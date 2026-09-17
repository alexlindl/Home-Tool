/**
 * RecipeDetail Component
 * Modal showing a recipe's name, summary, and steps, plus an interactive
 * ingredient checklist. Each ingredient is ticked to mean "add this to the
 * shopping list"; untick the ones you already have. All are ticked by default,
 * so adding everything is one tap.
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
  // Set of ingredient IDs the user has ticked to ADD to the shopping list.
  // Defaults to every ingredient when the modal opens.
  const [addIds, setAddIds] = useState<Set<string>>(new Set());
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [selectedListId, setSelectedListId] = useState('');
  const [adding, setAdding] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (!open) return;
    // Tick every ingredient by default so "add all" is one action.
    setAddIds(new Set(recipe ? recipe.ingredients.map((ing) => ing.id) : []));
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

  const toggleAdd = (id: string) => {
    setAddIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectedIngredients = useMemo(
    () => (recipe ? recipe.ingredients.filter((ing) => addIds.has(ing.id)) : []),
    [recipe, addIds],
  );

  const handleAddSelected = async () => {
    if (!recipe || selectedIngredients.length === 0) return;
    setAdding(true);
    setFeedback('');
    try {
      const result = await recipeApi.addToShopping(
        recipe.id,
        currentUserId,
        selectedListId || undefined,
        selectedIngredients.map((ing) => ing.id),
      );
      const skippedNote =
        result.skipped.length > 0
          ? ` ${result.skipped.length} could not be added.`
          : '';
      setFeedback(
        `Added ${result.added.length} item${result.added.length === 1 ? '' : 's'} to the shopping list.${skippedNote}`,
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

        {recipe.sourceUrl && (
          <p style={{ marginTop: 0, fontSize: '0.85rem' }}>
            <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer">
              View original source ↗
            </a>
          </p>
        )}

        <div className="form-group">
          <label>Ingredients — tick the ones to add to your shopping list</label>
          {recipe.ingredients.length === 0 ? (
            <p style={{ opacity: 0.7 }}>No ingredients listed.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {recipe.ingredients.map((ing) => {
                const willAdd = addIds.has(ing.id);
                return (
                  <li
                    key={ing.id}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}
                  >
                    <input
                      type="checkbox"
                      id={`add-${ing.id}`}
                      checked={willAdd}
                      onChange={() => toggleAdd(ing.id)}
                    />
                    <label
                      htmlFor={`add-${ing.id}`}
                      style={{
                        margin: 0,
                        textDecoration: willAdd ? 'none' : 'line-through',
                        opacity: willAdd ? 1 : 0.6,
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
            <label htmlFor="recipe-target-list">Add ticked items to</label>
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
                onClick={handleAddSelected}
                disabled={adding || selectedIngredients.length === 0}
              >
                {adding
                  ? 'Adding...'
                  : `Add ${selectedIngredients.length} item${selectedIngredients.length === 1 ? '' : 's'}`}
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
