/**
 * RecipeCard Component
 * Compact display of a recipe in the recipe list. Clicking opens the detail
 * view. Shows the recipe name and ingredient/step counts.
 *
 * All colors come from theme CSS variables so the card is readable in both the
 * light and dark themes (a hardcoded background previously left the name
 * unreadable in dark mode).
 */

import React from 'react';
import type { Recipe } from '@/types';

interface RecipeCardProps {
  recipe: Recipe;
  onOpen: (recipe: Recipe) => void;
}

export const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, onOpen }) => {
  const ingredientCount = recipe.ingredients.length;
  const stepCount = recipe.steps.length;

  return (
    <button
      type="button"
      className="recipe-card"
      onClick={() => onOpen(recipe)}
      aria-label={`Open recipe ${recipe.name}`}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '12px 14px',
        marginBottom: '8px',
        border: '1px solid var(--color-border)',
        borderRadius: '8px',
        background: 'var(--color-surface)',
        color: 'var(--color-text)',
        cursor: 'pointer',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--color-text)' }}>
        🍳 {recipe.name}
      </div>
      <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem', marginTop: '6px' }}>
        {ingredientCount} ingredient{ingredientCount === 1 ? '' : 's'} ·{' '}
        {stepCount} step{stepCount === 1 ? '' : 's'}
      </div>
    </button>
  );
};
