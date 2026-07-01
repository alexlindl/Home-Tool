/**
 * ShoppingList Page
 * Shopping items grouped by category with collapsible sections.
 * Supports multiple lists via ListSelector.
 *
 * Requirements: 7.1, 7.2, 8.1, 15.1, 15.2, 15.3, 15.4
 */

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useShopping } from '@/hooks/useShopping';
import { useAuth } from '@/hooks/useAuth';
import { ShoppingItemCard } from '@/components/ShoppingItemCard';
import { AddItemForm } from '@/components/AddItemForm';
import { EditShoppingItemForm } from '@/components/EditShoppingItemForm';
import { ListSelector } from '@/components/ListSelector';
import { MoveToListModal } from '@/components/MoveToListModal';
import { shoppingListApi, shoppingApi } from '@/services/api';
import { useUndoSnackbar } from '@/contexts/UndoSnackbarContext';
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

const categoryLabels: Record<string, string> = {
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
  const { showUndo } = useUndoSnackbar();
  const [searchParams] = useSearchParams();
  const deepLinkApplied = useRef(false);

  // Read deep link query params
  const listIdParam = searchParams.get('listId');
  const actionParam = searchParams.get('action');

  const [selectedListId, setSelectedListId] = useState<string>(listIdParam || '');
  const [listsLoaded, setListsLoaded] = useState(false);
  const [shoppingLists, setShoppingLists] = useState<ShoppingListType[]>([]);
  const [movingItem, setMovingItem] = useState<ShoppingItem | null>(null);
  const [moveSnackbar, setMoveSnackbar] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });

  // Load lists and set default (skip default if listId came from deep link)
  useEffect(() => {
    shoppingListApi.getAll().then((lists: ShoppingListType[]) => {
      setShoppingLists(lists);
      if (!listIdParam) {
        const defaultList = lists.find((l) => l.isDefault);
        if (defaultList && !selectedListId) {
          setSelectedListId(defaultList.id);
        }
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

  // Apply deep link action=add to auto-open the AddItemForm on mount
  useEffect(() => {
    if (!deepLinkApplied.current && actionParam === 'add') {
      setShowForm(true);
      deepLinkApplied.current = true;
    }
  }, [actionParam]);
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<Category>>(new Set());

  const groupedItems = useMemo(() => {
    const groups: Record<string, ShoppingItem[]> = {};
    // Initialize known categories
    for (const cat of categoryOrder) {
      groups[cat] = [];
    }
    for (const item of items) {
      if (!item.isPurchased) {
        if (!groups[item.category]) {
          groups[item.category] = [];
        }
        groups[item.category]!.push(item);
      }
    }
    return groups;
  }, [items]);

  // Build display order: known categories first, then any custom ones
  const displayOrder = useMemo(() => {
    const customCategories = Object.keys(groupedItems).filter(
      (cat) => !categoryOrder.includes(cat) && groupedItems[cat]!.length > 0
    );
    return [...categoryOrder, ...customCategories];
  }, [groupedItems]);

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
    const item = items.find((i) => i.id === itemId);
    await purchaseItem(itemId, currentUser.id);
    if (item) {
      showUndo({
        itemName: item.name,
        actionDescription: 'Item purchased',
        onUndo: async () => {
          await shoppingApi.unpurchaseItem(itemId);
          refreshList();
        },
      });
    }
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
    // Re-fetch lists to keep canMove accurate
    shoppingListApi.getAll().then(setShoppingLists).catch(() => {});
  }, [refreshList]);

  const handleMoveToList = (item: ShoppingItem) => {
    setMovingItem(item);
  };

  const handleMoveSelect = async (targetListId: string, targetListName: string) => {
    if (!movingItem) return;
    try {
      await shoppingApi.moveItem(movingItem.id, targetListId);
      setMovingItem(null);
      refreshList();
      setMoveSnackbar({ visible: true, message: `Moved to "${targetListName}"` });
      setTimeout(() => setMoveSnackbar({ visible: false, message: '' }), 3000);
    } catch {
      setMovingItem(null);
      setMoveSnackbar({ visible: true, message: 'Failed to move item. Please try again.' });
      setTimeout(() => setMoveSnackbar({ visible: false, message: '' }), 3000);
    }
  };

  // Determine if other lists exist for the "Move to list" option
  const canMoveItem = shoppingLists.length > 1;

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
        {displayOrder.map((category) => {
          const categoryItems = groupedItems[category] || [];
          if (categoryItems.length === 0) return null;

          const isCollapsed = collapsedCategories.has(category);
          const label = categoryLabels[category] || `📦 ${category.charAt(0).toUpperCase() + category.slice(1)}`;

          return (
            <div key={category} className="category-group">
              <button
                className="category-header"
                onClick={() => toggleCategory(category)}
                aria-expanded={!isCollapsed}
              >
                <span className="category-header-label">
                  {label}
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
                      onMoveToList={handleMoveToList}
                      canMove={canMoveItem}
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

      {/* Move to list modal */}
      <MoveToListModal
        open={!!movingItem}
        type="shopping"
        currentListId={selectedListId}
        itemName={movingItem?.name || ''}
        onSelect={handleMoveSelect}
        onClose={() => setMovingItem(null)}
      />

      {/* Move confirmation snackbar */}
      {moveSnackbar.visible && (
        <div className="move-snackbar" role="status" aria-live="polite">
          <span className="move-snackbar-text">{moveSnackbar.message}</span>
        </div>
      )}
    </div>
  );
};
