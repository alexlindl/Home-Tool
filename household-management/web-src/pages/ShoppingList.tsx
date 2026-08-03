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
import { shoppingListApi, shoppingApi, userApi, userSettingsApi } from '@/services/api';
import { useUndoSnackbar } from '@/contexts/UndoSnackbarContext';
import type { ShoppingItem, ShoppingList as ShoppingListType, Category, User } from '@/types';

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
  uncategorized: '📦 Uncategorized',
};

export const ShoppingList: React.FC = () => {
  const { currentUser } = useAuth();
  const { showUndo } = useUndoSnackbar();
  const [searchParams] = useSearchParams();
  const deepLinkApplied = useRef(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search input by 100ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 100);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Read deep link query params
  const listIdParam = searchParams.get('listId');
  const actionParam = searchParams.get('action');

  const [selectedListId, setSelectedListId] = useState<string>(listIdParam || '');
  const [listsLoaded, setListsLoaded] = useState(false);
  const [shoppingLists, setShoppingLists] = useState<ShoppingListType[]>([]);
  const [movingItem, setMovingItem] = useState<ShoppingItem | null>(null);
  const [moveSnackbar, setMoveSnackbar] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
  const [users, setUsers] = useState<User[]>([]);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [defaultSaved, setDefaultSaved] = useState(false);

  // Load lists and set default from user preference (skip default if listId came from deep link)
  useEffect(() => {
    shoppingListApi.getAll().then(async (lists: ShoppingListType[]) => {
      setShoppingLists(lists);
      if (!listIdParam && !selectedListId) {
        if (currentUser) {
          try {
            const savedListId = await userSettingsApi.get(currentUser.id, 'default_shopping_list_id');
            if (savedListId !== null) {
              setSelectedListId(savedListId || 'all');
            } else {
              // No preference saved — fall back to isDefault list
              const defaultList = lists.find((l) => l.isDefault);
              if (defaultList) setSelectedListId(defaultList.id);
            }
          } catch {
            const defaultList = lists.find((l) => l.isDefault);
            if (defaultList) setSelectedListId(defaultList.id);
          }
        } else {
          const defaultList = lists.find((l) => l.isDefault);
          if (defaultList) setSelectedListId(defaultList.id);
        }
      }
      setListsLoaded(true);
    }).catch(() => {
      setListsLoaded(true);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load users for name resolution in detail panel
  useEffect(() => {
    userApi.getAllUsers().then(setUsers).catch(() => {});
  }, []);

  const userNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const u of users) {
      map[u.id] = u.name;
    }
    return map;
  }, [users]);

  const { items, loading, error, purchaseItem, refreshList } = useShopping({
    userName: currentUser?.name,
    listId: selectedListId === 'all' ? undefined : selectedListId || undefined,
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

  // Filter items by search query (≥2 chars, case-insensitive substring on item name)
  const searchFilteredItems = useMemo(() => {
    const unpurchased = items.filter((i) => !i.isPurchased);
    if (debouncedSearch.length < 2) return unpurchased;
    const query = debouncedSearch.toLowerCase();
    return unpurchased.filter((item) => item.name.toLowerCase().includes(query));
  }, [items, debouncedSearch]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, ShoppingItem[]> = {};
    // Initialize known categories
    for (const cat of categoryOrder) {
      groups[cat] = [];
    }
    for (const item of searchFilteredItems) {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category]!.push(item);
    }
    return groups;
  }, [searchFilteredItems]);

  // Build display order: known categories first, then custom ones, "uncategorized" always last
  const displayOrder = useMemo(() => {
    const customCategories = Object.keys(groupedItems).filter(
      (cat) => !categoryOrder.includes(cat) && cat !== 'uncategorized' && groupedItems[cat]!.length > 0
    );
    const order = [...categoryOrder, ...customCategories];
    // Always push "uncategorized" to the end if it has items
    if (groupedItems['uncategorized'] && groupedItems['uncategorized'].length > 0) {
      order.push('uncategorized');
    }
    return order;
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

  const handleToggleExpand = (itemId: string) => {
    setExpandedItemId((prev) => (prev === itemId ? null : itemId));
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

  const handleSetAsDefault = async () => {
    if (!currentUser) return;
    try {
      await userSettingsApi.put(currentUser.id, 'default_shopping_list_id', selectedListId === 'all' ? '' : selectedListId);
      setDefaultSaved(true);
      setTimeout(() => setDefaultSaved(false), 2000);
    } catch {
      // silent fail
    }
  };

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
        showAllOption={true}
      />

      <button
        className="btn btn--text"
        onClick={handleSetAsDefault}
        style={{ fontSize: '0.75rem', padding: '2px 8px', opacity: 0.7 }}
        title="Save current list as your default view"
      >
        {defaultSaved ? '✓ Saved' : '📌 Set as default'}
      </button>

      {loading && <div className="loading-state">Loading shopping list...</div>}
      {error && <div className="error-state">{error}</div>}

      {!loading && items.filter((i) => !i.isPurchased).length === 0 && (
        <div className="empty-state">
          <p>Shopping list is empty. Add items to get started!</p>
        </div>
      )}

      {/* Search input */}
      <div className="search-input-container">
        <input
          type="text"
          className="search-input"
          placeholder="Search items..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search shopping items"
        />
        {searchQuery && (
          <button
            className="search-clear-btn"
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
            type="button"
          >
            ✕
          </button>
        )}
      </div>

      {!loading && searchFilteredItems.length === 0 && debouncedSearch.length >= 2 && (
        <div className="empty-state">
          <p>No items match your search.</p>
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
                      isExpanded={expandedItemId === item.id}
                      onToggleExpand={handleToggleExpand}
                      userNames={userNames}
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
        onDeleted={refreshList}
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
