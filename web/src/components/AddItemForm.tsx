/**
 * AddItemForm Component
 * Modal/dialog for adding a shopping item with template quick-add chips.
 * Uses ItemAutocomplete for name input with category auto-fill.
 * Includes list selector to choose which shopping list to add to.
 *
 * Requirements: 7.1, 7.2, 7.3, 8.1, 9.1, 9.2
 */

import React, { useState, useEffect } from 'react';
import type { ShoppingItem, ItemTemplate, Category, ShoppingList } from '@/types';
import { shoppingApi, categoryApi, shoppingListApi } from '@/services/api';
import { ItemAutocomplete } from '@/components/ItemAutocomplete';

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
  const [category, setCategory] = useState<Category>('uncategorized');
  const [categories, setCategories] = useState<string[]>([]);
  const [templates, setTemplates] = useState<ItemTemplate[]>([]);
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [selectedListId, setSelectedListId] = useState(listId || '');
  const [submitting, setSubmitting] = useState(false);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [previousCategory, setPreviousCategory] = useState<Category>('uncategorized');

  useEffect(() => {
    if (open) {
      shoppingApi.getTemplates().then(setTemplates).catch(() => {});
      categoryApi.getAll().then((cats) => {
        const names = cats.map((c) => c.name).filter((n) => n.toLowerCase() !== 'uncategorized');
        setCategories(names);
      }).catch(() => {});
      shoppingListApi.getAll().then(setLists).catch(() => {});
      // Reset selectedListId to prop value when form opens
      setSelectedListId(listId || '');
    }
  }, [open, listId]);

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
    if (!name.trim()) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      const effectiveListId = selectedListId || listId;
      const item = await shoppingApi.addItem({
        name: name.trim(),
        category,
        addedBy: currentUserId,
        listId: effectiveListId,
      });
      onAdded(item);
      setName('');
      setCategory('uncategorized');
      onClose();
    } catch {
      setSubmitError('Failed to save item');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectItem = (selectedName: string, selectedCategory: string) => {
    setName(selectedName);
    // Auto-fill category if it exists in the available categories
    if (categories.includes(selectedCategory)) {
      setCategory(selectedCategory as Category);
      setShowNewCategory(false);
      setNewCategoryName('');
      setCategoryError('');
    }
  };

  const handleQuickAdd = async (template: ItemTemplate) => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const effectiveListId = selectedListId || listId;
      const item = await shoppingApi.addItemFromTemplate(template.id, currentUserId, effectiveListId);
      onAdded(item);
    } catch {
      setSubmitError('Failed to add item');
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
            <ItemAutocomplete
              value={name}
              onChange={setName}
              onSelectItem={handleSelectItem}
              placeholder="Enter item name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="item-category">Category *</label>
            <select
              id="item-category"
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

          {lists.length > 0 && (
            <div className="form-group">
              <label htmlFor="item-list">List</label>
              <select
                id="item-list"
                value={selectedListId}
                onChange={(e) => setSelectedListId(e.target.value)}
              >
                {!selectedListId && <option value="">Select a list...</option>}
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {submitError && (
            <p style={{ color: 'var(--color-danger, #e74c3c)', fontSize: '0.8rem', margin: '4px 0 0 0' }}>
              {submitError}
            </p>
          )}

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
