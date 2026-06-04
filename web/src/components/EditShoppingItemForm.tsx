/**
 * EditShoppingItemForm Component
 * Modal/dialog for editing an existing shopping item's name and category.
 *
 * Requirements: 15.1, 15.2, 15.3, 15.4
 */

import React, { useState, useEffect } from 'react';
import type { ShoppingItem, Category } from '@/types';
import { shoppingApi } from '@/services/api';

interface EditShoppingItemFormProps {
  open: boolean;
  item: ShoppingItem | null;
  onClose: () => void;
  onSaved: (item: ShoppingItem) => void;
}

const categories: Category[] = [
  'produce',
  'dairy',
  'bakery',
  'meat',
  'frozen',
  'pantry',
  'household',
];

export const EditShoppingItemForm: React.FC<EditShoppingItemFormProps> = ({
  open,
  item,
  onClose,
  onSaved,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('produce');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setCategory(item.category);
    }
  }, [item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !item) return;

    setSubmitting(true);
    try {
      const updated = await shoppingApi.updateItem(item.id, {
        name: name.trim(),
        category,
      });
      onSaved(updated);
      onClose();
    } catch {
      // Error handling
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !item) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-label="Edit shopping item">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Item</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="edit-item-name">Item Name *</label>
            <input
              id="edit-item-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter item name"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-item-category">Category *</label>
            <select
              id="edit-item-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={submitting || !name.trim()}
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
