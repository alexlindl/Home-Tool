/**
 * TaskHistory Page
 * Displays completed tasks and purchased shopping items with tab navigation.
 *
 * Requirements: 5.1
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { taskApi, userApi, shoppingApi } from '@/services/api';
import { UserBadge } from '@/components/UserBadge';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import type { TaskHistory as TaskHistoryType, User, ShoppingItem } from '@/types';

type HistoryTab = 'tasks' | 'shopping';

export const TaskHistory: React.FC = () => {
  const [purchases, setPurchases] = useState<ShoppingItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [removedHistoryIds, setRemovedHistoryIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<HistoryTab>('tasks');

  const userNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const u of users) {
      map[u.id] = u.name;
    }
    return map;
  }, [users]);

  // Cursor-paginated task history feed with load-more + infinite scroll.
  // Default Page_Size (50) is applied server-side when limit is omitted.
  const fetchHistoryPage = useCallback(
    (cursor?: string) => taskApi.getHistoryPaginated(cursor),
    [],
  );
  const {
    items: historyItems,
    loading: historyLoading,
    loadingMore: historyLoadingMore,
    hasMore: historyHasMore,
    error: historyError,
    loadMore: loadMoreHistory,
    sentinelRef: historySentinelRef,
  } = useInfiniteScroll<TaskHistoryType>(fetchHistoryPage, []);

  // Undone entries are hidden client-side so we don't have to refetch a page.
  const history = useMemo(
    () => historyItems.filter((h) => !removedHistoryIds.has(h.id)),
    [historyItems, removedHistoryIds],
  );

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [userList, purchaseData] = await Promise.all([
        userApi.getAllUsers(),
        shoppingApi.getRecentPurchases(days),
      ]);
      setUsers(userList);
      setPurchases(purchaseData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch history';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  const handleUndo = async (entry: TaskHistoryType) => {
    setUndoingId(entry.id);
    try {
      await taskApi.uncompleteTask(entry.taskId);
      setRemovedHistoryIds((prev) => {
        const next = new Set(prev);
        next.add(entry.id);
        return next;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to undo task';
      setError(message);
    } finally {
      setUndoingId(null);
    }
  };

  const handleUndoPurchase = async (item: ShoppingItem) => {
    setUndoingId(item.id);
    try {
      await shoppingApi.unpurchaseItem(item.id);
      setPurchases((prev) => prev.filter((p) => p.id !== item.id));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to undo purchase';
      setError(message);
    } finally {
      setUndoingId(null);
    }
  };

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  return (
    <div className="page task-history">
      {/* Tab selector */}
      <div className="filter-bar">
        <button
          className={`filter-btn ${activeTab === 'tasks' ? 'filter-btn--active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          📋 Tasks
        </button>
        <button
          className={`filter-btn ${activeTab === 'shopping' ? 'filter-btn--active' : ''}`}
          onClick={() => setActiveTab('shopping')}
        >
          🛒 Shopping
        </button>
      </div>

      <div className="history-filter">
        <label htmlFor="history-days">Show last:</label>
        <select
          id="history-days"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <option value={7}>7 days</option>
          <option value={14}>14 days</option>
          <option value={30}>30 days</option>
          <option value={60}>60 days</option>
          <option value={90}>90 days</option>
        </select>
      </div>

      {loading && <div className="loading-state">Loading history...</div>}
      {error && <div className="error-state">{error}</div>}
      {activeTab === 'tasks' && historyError && <div className="error-state">{historyError}</div>}

      {/* Tasks Tab */}
      {activeTab === 'tasks' && !loading && historyLoading && (
        <div className="loading-state">Loading history...</div>
      )}
      {activeTab === 'tasks' && !loading && !historyLoading && (
        <>
          {history.length === 0 && (
            <div className="empty-state">
              <p>No completed tasks yet.</p>
            </div>
          )}

          <div className="history-list">
            {history.map((entry) => (
              <div key={entry.id} className="history-card">
                <div className="history-card-main">
                  <span className="history-card-title">{entry.title}</span>
                  <div className="history-card-actions">
                    <button
                      className="history-undo-btn"
                      onClick={() => handleUndo(entry)}
                      disabled={undoingId === entry.id}
                      title="Undo — mark as pending"
                      aria-label={`Undo completion of ${entry.title}`}
                    >
                      {undoingId === entry.id ? '...' : '↩'}
                    </button>
                    <span className="history-card-date">
                      {formatDate(entry.completedAt)}
                    </span>
                  </div>
                </div>
                <div className="history-card-details">
                  <span className="history-card-assigned">
                    Assigned to: <UserBadge userName={entry.assignedTo ? (userNames[entry.assignedTo] || entry.assignedTo) : 'Anyone'} size="sm" />
                    <span className="history-card-name">{entry.assignedTo ? (userNames[entry.assignedTo] || entry.assignedTo) : 'Anyone'}</span>
                  </span>
                  <span className="history-card-completed">
                    Completed by: <UserBadge userName={userNames[entry.completedBy] || entry.completedBy} size="sm" />
                    <span className="history-card-name">{userNames[entry.completedBy] || entry.completedBy}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Infinite-scroll sentinel: loads the next page when scrolled near the end. */}
          {historyHasMore && <div ref={historySentinelRef} aria-hidden="true" style={{ height: 1 }} />}

          {/* Explicit load-more control + "more available" indicator (Req 5.5, 5.6). */}
          {historyHasMore && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
              <button
                type="button"
                className="filter-btn"
                onClick={loadMoreHistory}
                disabled={historyLoadingMore}
              >
                {historyLoadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}

      {/* Shopping Tab */}
      {activeTab === 'shopping' && !loading && (
        <>
          {purchases.length === 0 && (
            <div className="empty-state">
              <p>No purchased items in this period.</p>
            </div>
          )}

          <div className="history-list">
            {purchases.map((item) => (
              <div key={item.id} className="history-card">
                <div className="history-card-main">
                  <span className="history-card-title">{item.name}</span>
                  <div className="history-card-actions">
                    <button
                      className="history-undo-btn"
                      onClick={() => handleUndoPurchase(item)}
                      disabled={undoingId === item.id}
                      title="Undo — mark as not purchased"
                      aria-label={`Undo purchase of ${item.name}`}
                    >
                      {undoingId === item.id ? '...' : '↩'}
                    </button>
                    <span className="history-card-date">
                      {item.purchasedAt ? formatDate(item.purchasedAt) : ''}
                    </span>
                  </div>
                </div>
                <div className="history-card-details">
                  <span className="history-card-assigned">
                    Category: <span className={`category-badge category-badge--${item.category}`}>{item.category}</span>
                  </span>
                  <span className="history-card-completed">
                    Purchased by: <UserBadge userName={item.purchasedBy ? (userNames[item.purchasedBy] || item.purchasedBy) : 'Unknown'} size="sm" />
                    <span className="history-card-name">{item.purchasedBy ? (userNames[item.purchasedBy] || item.purchasedBy) : 'Unknown'}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
