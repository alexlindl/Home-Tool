/**
 * AddItemForm Component
 * Modal/dialog for adding a shopping item with template quick-add chips.
 *
 * Requirements: 7.1, 8.1
 */

import React, { useState, useEffect } from 'react';
import type { ShoppingItem, ItemTemplate, Category } from '@/types';
import { shoppingApi, categoryApi } from '@/services/api';

interface AddItemFormProps {
  open: boolean;
  onClose: () => void;
  onAdded: (item: ShoppingItem) => void;
  currentUserId: string;
  /** Optional list ID to add the item to */
  listId?: string;
}

export const AddItemForm: React.FC<AddItemFormProps> = ({
  open,
  onClose,
  onAdded,
  currentUserId,
  listId,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('produce');
  const [categories, setCategories] = useState<string[]>([]);
  const [templates, setTemplates] = useState<ItemTemplate[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      shoppingApi.getTemplates().then(setTemplates).catch(() => {});
      categoryApi.getAll().then((cats) => {
        const names = cats.map((c) => c.name);
        setCategories(names);
        if (names.length > 0 && !names.includes(category)) {
          setCategory(names[0]);
        }
      }).catch(() => {});
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      const item = await shoppingApi.addItem({
        name: name.trim(),
        category,
        addedBy: currentUserId,
        listId,
      });
      onAdded(item);
      setName('');
      setCategory('produce');
      onClose();
    } catch {
      // Error handling
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickAdd = async (template: ItemTemplate) => {
    setSubmitting(true);
    try {
      const item = await shoppingApi.addItemFromTemplate(template.id, currentUserId);
      onAdded(item);
    } catch {
      // Error handling
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-label="Add shopping item">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Item</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {templates.length > 0 && (
          <div className="quick-add-section">
            <p className="quick-add-label">Quick Add:</p>
            <div className="quick-add-chips">
              {templates.slice(0, 12).map((t) => (
                <button
                  key={t.id}
                  className={`chip chip--${t.category}`}
                  onClick={() => handleQuickAdd(t)}
                  disabled={submitting}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="add-item-form">
          <div className="form-group">
            <label htmlFor="item-name">Item Name *</label>
            <input
              id="item-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter item name"
              required
              list="item-templates"
            />
            <datalist id="item-templates">
              {templates.map((t) => (
                <option key={t.id} value={t.name} />
              ))}
            </datalist>
          </div>

          <div className="form-group">
            <label htmlFor="item-category">Category *</label>
            <select
              id="item-category"
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
              {submitting ? 'Adding...' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
