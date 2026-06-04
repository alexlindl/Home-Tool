/**
 * useShopping Hook
 * Manages shopping list state, API operations, and real-time sync.
 *
 * Requirements: 7.1
 */

import { useState, useEffect, useCallback } from 'react';
import type { ShoppingItem, AddShoppingItemInput, Category } from '@/types';
import { shoppingApi } from '@/services/api';
import { useWebSocket } from './useWebSocket';

interface UseShoppingOptions {
  /** Filter by category */
  category?: Category;
  /** Current user name for WebSocket identification */
  userName?: string;
  /** Filter by list ID */
  listId?: string;
}

interface UseShoppingReturn {
  /** Shopping list items */
  items: ShoppingItem[];
  /** Whether the list is loading */
  loading: boolean;
  /** Error message if the last operation failed */
  error: string | null;
  /** Add a new item to the shopping list */
  addItem: (input: AddShoppingItemInput & { addedBy: string }) => Promise<ShoppingItem>;
  /** Mark a shopping item as purchased */
  purchaseItem: (itemId: string, userId: string) => Promise<void>;
  /** Manually refresh the shopping list */
  refreshList: () => Promise<void>;
}

/**
 * Hook to fetch and manage the shopping list.
 * Automatically refreshes when WebSocket shopping:sync events are received.
 */
export function useShopping(options: UseShoppingOptions = {}): UseShoppingReturn {
  const { category, userName, listId } = options;
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { on, off } = useWebSocket({ userName });

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await shoppingApi.getList(category, listId);
      setItems(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch shopping list';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [category, listId]);

  // Initial fetch
  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  // Listen for real-time shopping sync events
  useEffect(() => {
    const handleSync = () => {
      void fetchList();
    };

    on('shopping:sync', handleSync);
    return () => {
      off('shopping:sync', handleSync);
    };
  }, [on, off, fetchList]);

  const addItem = useCallback(
    async (input: AddShoppingItemInput & { addedBy: string }): Promise<ShoppingItem> => {
      const item = await shoppingApi.addItem(input);
      // Optimistic: add to local state
      setItems((prev) => [...prev, item]);
      return item;
    },
    [],
  );

  const purchaseItem = useCallback(
    async (itemId: string, userId: string): Promise<void> => {
      await shoppingApi.purchaseItem(itemId, userId);
      // Optimistic: remove from local state
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    },
    [],
  );

  return {
    items,
    loading,
    error,
    addItem,
    purchaseItem,
    refreshList: fetchList,
  };
}
