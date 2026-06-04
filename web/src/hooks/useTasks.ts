/**
 * useTasks Hook
 * Manages task list state, API operations, and real-time sync.
 *
 * Requirements: 4.1
 */

import { useState, useEffect, useCallback } from 'react';
import type { Task, CreateTaskInput, TaskFilters } from '@/types';
import { taskApi } from '@/services/api';
import { useWebSocket } from './useWebSocket';

interface UseTasksOptions {
  /** Filter by assigned user ID */
  assignedTo?: string;
  /** Filter by task status */
  status?: 'pending' | 'completed';
  /** Current user name for WebSocket identification */
  userName?: string;
  /** Filter by list ID */
  listId?: string;
}

interface UseTasksReturn {
  /** List of tasks matching the current filters */
  tasks: Task[];
  /** Whether the task list is loading */
  loading: boolean;
  /** Error message if the last operation failed */
  error: string | null;
  /** Create a new task */
  createTask: (input: CreateTaskInput & { createdBy: string }) => Promise<Task>;
  /** Mark a task as complete */
  completeTask: (taskId: string, userId: string) => Promise<void>;
  /** Manually refresh the task list */
  refreshTasks: () => Promise<void>;
}

/**
 * Hook to fetch and manage the task list.
 * Automatically refreshes when WebSocket task:sync events are received.
 */
export function useTasks(options: UseTasksOptions = {}): UseTasksReturn {
  const { assignedTo, status, userName, listId } = options;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { on, off } = useWebSocket({ userName });

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const filters: TaskFilters = {};
      if (assignedTo) filters.assignedTo = assignedTo;
      if (status) filters.status = status;
      if (listId) filters.listId = listId;
      const data = await taskApi.getTasks(filters);
      setTasks(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch tasks';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [assignedTo, status, listId]);

  // Initial fetch
  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  // Listen for real-time task sync events
  useEffect(() => {
    const handleSync = () => {
      void fetchTasks();
    };

    on('task:sync', handleSync);
    return () => {
      off('task:sync', handleSync);
    };
  }, [on, off, fetchTasks]);

  const createTask = useCallback(
    async (input: CreateTaskInput & { createdBy: string }): Promise<Task> => {
      const task = await taskApi.createTask(input);
      // Optimistic: add to local state immediately
      setTasks((prev) => [...prev, task]);
      return task;
    },
    [],
  );

  const completeTask = useCallback(
    async (taskId: string, userId: string): Promise<void> => {
      await taskApi.completeTask(taskId, userId);
      // Optimistic: remove from local state
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    },
    [],
  );

  return {
    tasks,
    loading,
    error,
    createTask,
    completeTask,
    refreshTasks: fetchTasks,
  };
}
