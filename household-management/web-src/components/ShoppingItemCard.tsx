/**
 * ShoppingItemCard Component
 * Displays a shopping item with purchase checkbox, category badge, and edit button.
 *
 * Requirements: 7.1, 7.2, 15.1
 */

import React, { useState } from 'react';
import type { ShoppingItem } from '@/types';

interface ShoppingItemCardProps {
  item: ShoppingItem;
  onPurchase: (itemId: string) => void;
  onEdit?: (item: ShoppingItem) => void;
}

export const ShoppingItemCard: React.FC<ShoppingItemCardProps> = ({ item, onPurchase, onEdit }) => {
  const [fading, setFading] = useState(false);

  const handlePurchase = () => {
    setFading(true);
    setTimeout(() => {
      onPurchase(item.id);
    }, 300);
  };

  return (
    <div
      className={`shopping-item-card ${fading ? 'shopping-item-card--fading' : ''}`}
      role="article"
      aria-label={`Shopping item: ${item.name}`}
    >
      <label className="shopping-item-checkbox">
        <input
          type="checkbox"
          onChange={handlePurchase}
          checked={fading}
          aria-label={`Purchase: ${item.name}`}
        />
        <span className="shopping-item-checkmark" />
      </label>
      <span className="shopping-item-name">{item.name}</span>
      <span className={`category-badge category-badge--${item.category}`}>
        {item.category}
      </span>
      {onEdit && (
        <button
          className="shopping-item-edit"
          onClick={(e) => { e.stopPropagation(); onEdit(item); }}
          aria-label="Edit item"
        >
          ✏️
        </button>
      )}
    </div>
  );
};
