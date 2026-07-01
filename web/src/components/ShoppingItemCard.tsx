/**
 * ShoppingItemCard Component
 * Displays a shopping item with purchase checkbox, category badge, and action menu
 * with edit and move options.
 *
 * Requirements: 7.1, 7.2, 15.1, 4.1
 */

import React, { useState, useRef, useEffect } from 'react';
import type { ShoppingItem } from '@/types';

interface ShoppingItemCardProps {
  item: ShoppingItem;
  onPurchase: (itemId: string) => void;
  onEdit?: (item: ShoppingItem) => void;
  onMoveToList?: (item: ShoppingItem) => void;
  /** Whether other lists exist (to show/hide move option) */
  canMove?: boolean;
}

export const ShoppingItemCard: React.FC<ShoppingItemCardProps> = ({
  item,
  onPurchase,
  onEdit,
  onMoveToList,
  canMove = false,
}) => {
  const [fading, setFading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handlePurchase = () => {
    setFading(true);
    setTimeout(() => {
      onPurchase(item.id);
    }, 300);
  };

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const showMenu = onEdit || (onMoveToList && canMove);

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
      {showMenu && (
        <div className="shopping-item-actions" ref={menuRef}>
          <button
            className="shopping-item-menu-btn"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            aria-label="Item actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            ⋮
          </button>
          {menuOpen && (
            <div className="shopping-item-menu" role="menu">
              {onEdit && (
                <button
                  className="shopping-item-menu-item"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onEdit(item);
                  }}
                >
                  ✏️ Edit
                </button>
              )}
              {onMoveToList && canMove && (
                <button
                  className="shopping-item-menu-item"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onMoveToList(item);
                  }}
                >
                  📋 Move to list
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
