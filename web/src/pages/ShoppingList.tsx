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
import { shoppingListApi, shoppingApi, userApi, userSettingsApi, categoryApi } from '@/services/api';
import type { CategoryRecord } from '@/services/api';
import { useUndoSnackbar } from '@/contexts/UndoSnackbarContext';
import { buildCategoryGroups } from './shoppingListGrouping';
import { SEARCH_DEBOUNCE_MS, SEARCH_MIN_CHARS, useDebouncedValue } from '@/utils/searchConfig';
import type { ShoppingItem, ShoppingList as ShoppingListType, Category, User } from '@/types';

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

  // Search state — debounced via the shared search config so the shopping
  // search reuses the exact same debounce interval and min-character threshold
  // as the Tasks search.
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS);

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

  // Category ordering, driven by the Category API (sortPosition).
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [categoryOrderUnavailable, setCategoryOrderUnavailable] = useState(false);

  // Load categories so groups can be ordered by their configured sortPosition.
  // When a specific list is selected, fetch that list's per-list category order
  // (AC 7.5) so grouping honors the active list's ordering; when viewing "all"
  // or no list, fetch the global (canonical) order. Lists without an explicit
  // per-list order fall back to canonical order server-side.
  // On failure or empty results, fall back to a single "uncategorized" group
  // and surface an unavailable indication.
  const loadCategories = useCallback(() => {
    const listId = selectedListId && selectedListId !== 'all' ? selectedListId : undefined;
    categoryApi
      .getAll(listId)
      .then((cats) => {
        if (cats.length === 0) {
          setCategories([]);
          setCategoryOrderUnavailable(true);
        } else {
          setCategories(cats);
          setCategoryOrderUnavailable(false);
        }
      })
      .catch(() => {
        setCategories([]);
        setCategoryOrderUnavailable(true);
      });
  }, [selectedListId]);

  // Re-fetch categories whenever the loader changes, which includes changes to
  // the selected list, so grouping reflects the active list's category order.
  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

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

  // Filter items by search query. Below SEARCH_MIN_CHARS all items are shown
  // unfiltered; at/above the threshold, filter to items whose name contains the
  // term as a case-insensitive substring. Filtering happens BEFORE grouping so
  // category groups that become empty under the filter are omitted (the
  // grouping helper drops empty groups).
  const searchFilteredItems = useMemo(() => {
    const unpurchased = items.filter((i) => !i.isPurchased);
    if (debouncedSearch.length < SEARCH_MIN_CHARS) return unpurchased;
    const query = debouncedSearch.toLowerCase();
    return unpurchased.filter((item) => item.name.toLowerCase().includes(query));
  }, [items, debouncedSearch]);

  // Build ordered, non-empty category groups from the API sortPosition.
  // When categories are unavailable, `categories` is empty, so every item
  // folds into the "uncategorized" group.
  const categoryGroups = useMemo(
    () => buildCategoryGroups(searchFilteredItems, categories),
    [searchFilteredItems, categories],
  );

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

  const handleItemDeleted = (deletedItem: ShoppingItem) => {
    // The item was already deleted (it disappears from the list immediately).
    refreshList();
    // Offer an Undo_Snackbar bound to the captured payload. The restore
    // endpoint recreates the item from its original id via ON CONFLICT DO NOTHING.
    // Prefer the deleted item's OWN list so undo restores it to where it lived,
    // regardless of the current list filter (falling back to the selected list,
    // then null, only when the item carried no list of its own).
    const fallbackListId =
      selectedListId && selectedListId !== 'all' ? selectedListId : undefined;
    const listId = deletedItem.listId ?? fallbackListId;
    showUndo({
      itemName: deletedItem.name,
      actionDescription: 'Item deleted',
      onUndo: async () => {
        await shoppingApi.restoreItem({
          id: deletedItem.id,
          name: deletedItem.name,
          category: deletedItem.category,
          addedBy: deletedItem.addedBy,
          isPurchased: deletedItem.isPurchased,
          purchasedBy: deletedItem.purchasedBy ?? null,
          listId: listId ?? null,
          createdAt: deletedItem.createdAt,
        });
        refreshList();
      },
    });
  };

  const handleAdded = (_item: ShoppingItem) => {
    refreshList();
  };

  const handleListRefresh = useCallback(() => {
    refreshList();
    // Re-fetch lists to keep canMove accurate
    shoppingListApi.getAll().then(setShoppingLists).catch(() => {});
    // Re-fetch categories so the group order reflects the newest positions
    loadCategories();
  }, [refreshList, loadCategories]);

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

      {!loading && searchFilteredItems.length === 0 && debouncedSearch.length >= SEARCH_MIN_CHARS && (
        <div className="empty-state">
          <p>No items match your search.</p>
        </div>
      )}

      {categoryOrderUnavailable && !loading && searchFilteredItems.length > 0 && (
        <div className="category-order-unavailable" role="status" aria-live="polite">
          Category ordering unavailable
        </div>
      )}

      <div className="category-groups">
        {categoryGroups.map(({ category, items: categoryItems }) => {
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
        onDeleted={handleItemDeleted}
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
