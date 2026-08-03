/**
 * ShoppingItemCard Component
 * Displays a shopping item with purchase checkbox, category badge, action menu,
 * and expandable detail panel showing category, added-by user, and creation date.
 *
 * Requirements: 7.1, 7.2, 14.2, 14.3, 14.4, 14.5, 14.6, 15.1, 4.1
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
  /** Whether this item's detail panel is expanded */
  isExpanded?: boolean;
  /** Callback to toggle detail panel expansion */
  onToggleExpand?: (itemId: string) => void;
  /** Map of user IDs to display names */
  userNames?: Record<string, string>;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export const ShoppingItemCard: React.FC<ShoppingItemCardProps> = ({
  item,
  onPurchase,
  onEdit,
  onMoveToList,
  canMove = false,
  isExpanded = false,
  onToggleExpand,
  userNames = {},
}) => {
  const [fading, setFading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  const handlePurchase = () => {
    setFading(true);
    setTimeout(() => {
      onPurchase(item.id);
    }, 300);
  };

  const handleNameClick = () => {
    if (onToggleExpand) {
      onToggleExpand(item.id);
    }
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

  // Build detail fields (only show non-null, non-empty values)
  const detailFields: { label: string; value: string }[] = [];
  if (item.category) {
    detailFields.push({ label: 'Category', value: item.category.charAt(0).toUpperCase() + item.category.slice(1) });
  }
  if (item.addedBy) {
    const addedByName = userNames[item.addedBy] || item.addedBy;
    detailFields.push({ label: 'Added by', value: addedByName });
  }
  if (item.createdAt) {
    detailFields.push({ label: 'Created', value: formatDate(item.createdAt) });
  }

  return (
    <div className={`shopping-item-wrapper ${isExpanded ? 'shopping-item-wrapper--expanded' : ''}`}>
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
        <span
          className="shopping-item-name shopping-item-name--clickable"
          onClick={handleNameClick}
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} details for ${item.name}`}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNameClick(); } }}
        >
          {item.name}
        </span>
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
      {/* Expandable detail panel */}
      <div
        ref={detailRef}
        className={`shopping-item-detail-panel ${isExpanded ? 'shopping-item-detail-panel--open' : ''}`}
        aria-hidden={!isExpanded}
      >
        {detailFields.length > 0 && (
          <div className="shopping-item-detail-content">
            {detailFields.map((field) => (
              <div key={field.label} className="shopping-item-detail-row">
                <span className="shopping-item-detail-label">{field.label}:</span>
                <span className="shopping-item-detail-value">{field.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
