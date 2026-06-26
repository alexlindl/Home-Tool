/**
 * TaskHistory Page
 * Displays completed tasks with date range filter.
 *
 * Requirements: 5.1
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { taskApi, userApi } from '@/services/api';
import { UserBadge } from '@/components/UserBadge';
import type { TaskHistory as TaskHistoryType, User } from '@/types';

export const TaskHistory: React.FC = () => {
  const [history, setHistory] = useState<TaskHistoryType[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

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
      const [data, userList] = await Promise.all([
        taskApi.getHistory(days),
        userApi.getAllUsers(),
      ]);
      setHistory(data);
      setUsers(userList);
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
              <span className="history-card-date">
                {formatDate(entry.completedAt)}
              </span>
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
    </div>
  );
};
