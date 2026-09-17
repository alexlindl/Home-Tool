/**
 * RecipeCard Component
 * Compact display of a recipe in the recipe list. Clicking opens the detail
 * view. Shows the name, summary, and ingredient/step counts.
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
        border: '1px solid var(--color-border, #e0e0e0)',
        borderRadius: '8px',
        background: 'var(--color-surface, #fff)',
        cursor: 'pointer',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>🍳 {recipe.name}</div>
      {recipe.summary && (
        <div style={{ opacity: 0.8, fontSize: '0.9rem', marginTop: '2px' }}>
          {recipe.summary}
        </div>
      )}
      <div style={{ opacity: 0.6, fontSize: '0.8rem', marginTop: '6px' }}>
        {ingredientCount} ingredient{ingredientCount === 1 ? '' : 's'} ·{' '}
        {stepCount} step{stepCount === 1 ? '' : 's'}
      </div>
    </button>
  );
};
