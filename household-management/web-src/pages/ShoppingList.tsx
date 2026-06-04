/**
 * ShoppingList Page
 * Shopping items grouped by category with collapsible sections.
 * Supports multiple lists via ListSelector.
 *
 * Requirements: 7.1, 7.2, 8.1, 15.1, 15.2, 15.3, 15.4
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useShopping } from '@/hooks/useShopping';
import { useAuth } from '@/hooks/useAuth';
import { ShoppingItemCard } from '@/components/ShoppingItemCard';
import { AddItemForm } from '@/components/AddItemForm';
import { EditShoppingItemForm } from '@/components/EditShoppingItemForm';
import { ListSelector } from '@/components/ListSelector';
import { shoppingListApi } from '@/services/api';
import type { ShoppingItem, ShoppingList as ShoppingListType, Category } from '@/types';

const categoryOrder: Category[] = [
  'produce',
  'dairy',
  'bakery',
  'meat',
  'frozen',
  'pantry',
  'household',
];

const categoryLabels: Record<Category, string> = {
  produce: '🥬 Produce',
  dairy: '🥛 Dairy',
  bakery: '🍞 Bakery',
  meat: '🥩 Meat',
  frozen: '🧊 Frozen',
  pantry: '🫙 Pantry',
  household: '🏠 Household',
};

export const ShoppingList: React.FC = () => {
  const { currentUser } = useAuth();
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [listsLoaded, setListsLoaded] = useState(false);

  // Load lists and set default
  useEffect(() => {
    shoppingListApi.getAll().then((lists: ShoppingListType[]) => {
      const defaultList = lists.find((l) => l.isDefault);
      if (defaultList && !selectedListId) {
        setSelectedListId(defaultList.id);
      }
      setListsLoaded(true);
    }).catch(() => {
      setListsLoaded(true);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { items, loading, error, purchaseItem, refreshList } = useShopping({
    userName: currentUser?.name,
    listId: selectedListId || undefined,
  });
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<Category>>(new Set());

  const groupedItems = useMemo(() => {
    const groups: Record<Category, ShoppingItem[]> = {
      produce: [],
      dairy: [],
      bakery: [],
      meat: [],
      frozen: [],
      pantry: [],
      household: [],
    };
    for (const item of items) {
      if (!item.isPurchased) {
        groups[item.category].push(item);
      }
    }
    return groups;
  }, [items]);

  const toggleCategory = (category: Category) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handlePurchase = async (itemId: string) => {
    if (!currentUser) return;
    await purchaseItem(itemId, currentUser.id);
  };

  const handleEdit = (item: ShoppingItem) => {
    setEditingItem(item);
  };

  const handleEditSaved = (_item: ShoppingItem) => {
    refreshList();
  };

  const handleAdded = (_item: ShoppingItem) => {
    refreshList();
  };

  const handleListRefresh = useCallback(() => {
    refreshList();
  }, [refreshList]);

  if (!listsLoaded) {
    return (
      <div className="page shopping-list">
        <div className="loading-state">Loading...</div>
      </div>
    );
  }

  return (
    <div className="page shopping-list">
      <ListSelector
        type="shopping"
        selectedId={selectedListId}
        onSelect={setSelectedListId}
        onRefresh={handleListRefresh}
      />

      {loading && <div className="loading-state">Loading shopping list...</div>}
      {error && <div className="error-state">{error}</div>}

      {!loading && items.filter((i) => !i.isPurchased).length === 0 && (
        <div className="empty-state">
          <p>Shopping list is empty. Add items to get started!</p>
        </div>
      )}

      <div className="category-groups">
        {categoryOrder.map((category) => {
          const categoryItems = groupedItems[category];
          if (categoryItems.length === 0) return null;

          const isCollapsed = collapsedCategories.has(category);

          return (
            <div key={category} className="category-group">
              <button
                className="category-header"
                onClick={() => toggleCategory(category)}
                aria-expanded={!isCollapsed}
              >
                <span className="category-header-label">
                  {categoryLabels[category]}
                </span>
                <span className="category-header-count">{categoryItems.length}</span>
                <span className="category-header-chevron">
                  {isCollapsed ? '▸' : '▾'}
                </span>
              </button>
              {!isCollapsed && (
                <div className="category-items">
                  {categoryItems.map((item) => (
                    <ShoppingItemCard
                      key={item.id}
                      item={item}
                      onPurchase={handlePurchase}
                      onEdit={handleEdit}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        className="fab"
        onClick={() => setShowForm(true)}
        aria-label="Add shopping item"
      >
        +
      </button>

      <AddItemForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onAdded={handleAdded}
        currentUserId={currentUser?.id || ''}
        listId={selectedListId || undefined}
      />

      <EditShoppingItemForm
        open={!!editingItem}
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onSaved={handleEditSaved}
      />
    </div>
  );
};
