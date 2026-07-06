/**
 * TaskHistory Page
 * Displays completed tasks with date range filter.
 *
 * Requirements: 5.1
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { taskApi, userApi, shoppingApi } from '@/services/api';
import { UserBadge } from '@/components/UserBadge';
import type { TaskHistory as TaskHistoryType, User, ShoppingItem } from '@/types';

export const TaskHistory: React.FC = () => {
  const [history, setHistory] = useState<TaskHistoryType[]>([]);
  const [purchases, setPurchases] = useState<ShoppingItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [undoingId, setUndoingId] = useState<string | null>(null);

  const userNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const u of users) {
      map[u.id] = u.name;
    }
    return map;
  }, [users]);

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [data, userList, purchaseData] = await Promise.all([
        taskApi.getHistory(days),
        userApi.getAllUsers(),
        shoppingApi.getRecentPurchases(days),
      ]);
      setHistory(data);
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
      setHistory((prev) => prev.filter((h) => h.id !== entry.id));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to undo task';
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

      {!loading && history.length === 0 && (
        <div className="empty-state">
          <p>No completed tasks in this period.</p>
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

      {/* Recent Shopping Purchases Section */}
      {purchases.length > 0 && (
        <>
          <h3 className="history-section-title">🛒 Recent Purchases</h3>
          <div className="history-list">
            {purchases.map((item) => (
              <div key={item.id} className="history-card">
                <div className="history-card-main">
                  <span className="history-card-title">{item.name}</span>
                  <span className="history-card-date">
                    {item.purchasedAt ? formatDate(item.purchasedAt) : ''}
                  </span>
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
