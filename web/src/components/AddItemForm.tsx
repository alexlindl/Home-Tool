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
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState('');

  useEffect(() => {
    if (open) {
      shoppingApi.getTemplates().then(setTemplates).catch(() => {});
      categoryApi.getAll().then((cats) => {
        const names = cats.map((c) => c.name);
        setCategories(names);
        if (names.length > 0 && !names.includes(category)) {
          setCategory(names[0]!);
        }
      }).catch(() => {});
    }
  }, [open]);

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '__new__') {
      setShowNewCategory(true);
      setCategoryError('');
    } else {
      setCategory(value as Category);
      setShowNewCategory(false);
      setNewCategoryName('');
      setCategoryError('');
    }
  };

  const handleCreateCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    setCategoryError('');
    try {
      const created = await categoryApi.create(trimmed);
      setCategories((prev) => [...prev, created.name]);
      setCategory(created.name as Category);
      setShowNewCategory(false);
      setNewCategoryName('');
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { error?: string } } };
      if (error.response?.status === 409) {
        setCategoryError('Category already exists');
      } else if (error.response?.status === 400) {
        setCategoryError(error.response?.data?.error || 'Invalid category name');
      } else {
        setCategoryError('Failed to create category');
      }
    }
  };

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
      const item = await shoppingApi.addItemFromTemplate(template.id, currentUserId, listId);
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
              value={showNewCategory ? '__new__' : category}
              onChange={handleCategoryChange}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
              <option value="__new__">+ Add new category...</option>
            </select>
            {showNewCategory && (
              <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => { setNewCategoryName(e.target.value); setCategoryError(''); }}
                  placeholder="New category name"
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={handleCreateCategory}
                  style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                >
                  Create
                </button>
              </div>
            )}
            {categoryError && (
              <p style={{ color: 'var(--color-danger, #e74c3c)', fontSize: '0.8rem', margin: '4px 0 0 0' }}>
                {categoryError}
              </p>
            )}
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
