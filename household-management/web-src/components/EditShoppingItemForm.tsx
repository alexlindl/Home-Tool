/**
 * EditShoppingItemForm Component
 * Modal/dialog for editing an existing shopping item's name and category.
 * Also provides a delete action. Supports inline category creation.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 15.1, 15.2, 15.3, 15.4
 */

import React, { useState, useEffect } from 'react';
import type { ShoppingItem, Category } from '@/types';
import { shoppingApi, categoryApi } from '@/services/api';

interface EditShoppingItemFormProps {
  open: boolean;
  item: ShoppingItem | null;
  onClose: () => void;
  onSaved: (item: ShoppingItem) => void;
  onDeleted?: () => void;
}

export const EditShoppingItemForm: React.FC<EditShoppingItemFormProps> = ({
  open,
  item,
  onClose,
  onSaved,
  onDeleted,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('produce');
  const [categories, setCategories] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [previousCategory, setPreviousCategory] = useState<Category>('produce');

  useEffect(() => {
    if (item) {
      setName(item.name);
      setCategory(item.category);
    }
  }, [item]);

  useEffect(() => {
    if (open) {
      categoryApi.getAll().then((cats) => {
        const names = cats.map((c) => c.name).filter((n) => n.toLowerCase() !== 'uncategorized');
        setCategories(names);
      }).catch(() => {});
      // Reset inline category input state when form opens
      setShowNewCategory(false);
      setNewCategoryName('');
      setCategoryError('');
    }
  }, [open]);

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '__add_new__') {
      setPreviousCategory(category);
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
    if (!trimmed) {
      setCategoryError('Category name cannot be blank');
      return;
    }
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

  const handleCancelNewCategory = () => {
    setShowNewCategory(false);
    setNewCategoryName('');
    setCategoryError('');
    setCategory(previousCategory);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !item) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      const updated = await shoppingApi.updateItem(item.id, {
        name: name.trim(),
        category,
      });
      onSaved(updated);
      onClose();
    } catch {
      setSubmitError('Failed to save item');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!item) return;
    setDeleting(true);
    setSubmitError('');
    try {
      await shoppingApi.deleteItem(item.id);
      onClose();
      if (onDeleted) {
        onDeleted();
      }
    } catch {
      setSubmitError('Failed to delete item');
    } finally {
      setDeleting(false);
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
              value={showNewCategory ? '__add_new__' : category}
              onChange={handleCategoryChange}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
              <option value="uncategorized">Uncategorized</option>
              <option value="__add_new__">+ Add new category...</option>
            </select>
            {showNewCategory && (
              <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => { setNewCategoryName(e.target.value); setCategoryError(''); }}
                  placeholder="New category name"
                  maxLength={100}
                  style={{ flex: 1 }}
                  aria-label="New category name"
                />
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={handleCreateCategory}
                  style={{ padding: '6px 10px', fontSize: '1rem', lineHeight: 1 }}
                  aria-label="Confirm new category"
                >
                  ✓
                </button>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={handleCancelNewCategory}
                  style={{ padding: '6px 10px', fontSize: '1rem', lineHeight: 1 }}
                  aria-label="Cancel new category"
                >
                  ✕
                </button>
              </div>
            )}
            {categoryError && (
              <p style={{ color: 'var(--color-danger, #e74c3c)', fontSize: '0.8rem', margin: '4px 0 0 0' }}>
                {categoryError}
              </p>
            )}
          </div>

          {submitError && (
            <p style={{ color: 'var(--color-danger, #e74c3c)', fontSize: '0.8rem', margin: '4px 0 0 0' }}>
              {submitError}
            </p>
          )}

          <div className="form-actions">
            <button
              type="button"
              className="btn btn--secondary settings-btn-danger"
              onClick={handleDelete}
              disabled={deleting || submitting}
            >
              {deleting ? 'Deleting...' : '🗑️ Delete'}
            </button>
            <div style={{ flex: 1 }} />
            <button type="button" className="btn btn--secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={submitting || deleting || !name.trim()}
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
