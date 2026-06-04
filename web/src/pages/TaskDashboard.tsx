/**
 * TaskDashboard Page
 * Main task view with list selector, filter bar, task list, and create button.
 *
 * Requirements: 4.1, 4.2, 5.1, 14.1, 14.2, 14.3, 14.4, 14.5
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTasks } from '@/hooks/useTasks';
import { useAuth } from '@/hooks/useAuth';
import { TaskCard } from '@/components/TaskCard';
import { TaskForm } from '@/components/TaskForm';
import { ListSelector } from '@/components/ListSelector';
import { userApi, taskListApi } from '@/services/api';
import type { Task, User, TaskList } from '@/types';

type FilterMode = 'my' | 'all';

export const TaskDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [filter, setFilter] = useState<FilterMode>('my');
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [listsLoaded, setListsLoaded] = useState(false);

  // Load users
  useEffect(() => {
    userApi.getAllUsers().then(setUsers).catch(() => {});
  }, []);

  // Load lists and set default
  useEffect(() => {
    taskListApi.getAll().then((lists: TaskList[]) => {
      const defaultList = lists.find((l) => l.isDefault);
      if (defaultList && !selectedListId) {
        setSelectedListId(defaultList.id);
      }
      setListsLoaded(true);
    }).catch(() => {
      setListsLoaded(true);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const userNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const u of users) {
      map[u.id] = u.name;
    }
    return map;
  }, [users]);

  const taskOptions = useMemo(
    () => ({
      assignedTo: filter === 'my' ? currentUser?.id : undefined,
      status: 'pending' as const,
      userName: currentUser?.name,
      listId: selectedListId === 'all' ? undefined : selectedListId || undefined,
    }),
    [filter, currentUser?.id, currentUser?.name, selectedListId],
  );

  const { tasks, loading, error, completeTask, refreshTasks } = useTasks(taskOptions);

  const sortedTasks = useMemo(() => {
    return [...tasks].sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    );
  }, [tasks]);

  const handleComplete = async (taskId: string) => {
    if (!currentUser) return;
    await completeTask(taskId, currentUser.id);
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
  };

  const handleCreatedOrUpdated = (_task: Task) => {
    refreshTasks();
    setEditingTask(null);
  };

  const handleListRefresh = useCallback(() => {
    refreshTasks();
  }, [refreshTasks]);

  if (!listsLoaded) {
    return (
      <div className="page task-dashboard">
        <div className="loading-state">Loading...</div>
      </div>
    );
  }

  return (
    <div className="page task-dashboard">
      <ListSelector
        type="task"
        selectedId={selectedListId}
        onSelect={setSelectedListId}
        onRefresh={handleListRefresh}
        showAllOption={true}
      />

      <div className="filter-bar">
        <button
          className={`filter-btn ${filter === 'my' ? 'filter-btn--active' : ''}`}
          onClick={() => setFilter('my')}
        >
          My Tasks
        </button>
        <button
          className={`filter-btn ${filter === 'all' ? 'filter-btn--active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All Tasks
        </button>
      </div>

      {loading && <div className="loading-state">Loading tasks...</div>}
      {error && <div className="error-state">{error}</div>}

      {!loading && sortedTasks.length === 0 && (
        <div className="empty-state">
          <p>No tasks yet. Create one to get started!</p>
        </div>
      )}

      <div className="task-list">
        {sortedTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onComplete={handleComplete}
            onEdit={handleEdit}
            userNames={userNames}
            isCurrentUser={task.assignedTo === currentUser?.id}
          />
        ))}
      </div>

      <button
        className="fab"
        onClick={() => setShowForm(true)}
        aria-label="Create new task"
      >
        +
      </button>

      {/* Create task modal */}
      <TaskForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onCreated={handleCreatedOrUpdated}
        currentUserId={currentUser?.id || ''}
        listId={selectedListId === 'all' ? undefined : selectedListId}
      />

      {/* Edit task modal */}
      <TaskForm
        open={!!editingTask}
        onClose={() => setEditingTask(null)}
        onCreated={handleCreatedOrUpdated}
        currentUserId={currentUser?.id || ''}
        editTask={editingTask}
        listId={selectedListId === 'all' ? undefined : selectedListId}
      />
    </div>
  );
};
