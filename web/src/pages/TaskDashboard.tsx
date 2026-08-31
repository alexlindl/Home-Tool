/**
 * TaskDashboard Page
 * Main task view with list selector, filter bar, task list, and create button.
 * Includes filter/sort toolbar for overdue filtering and multi-field sorting.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 14.1, 14.2, 14.3, 14.4, 14.5
 */

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTasks } from '@/hooks/useTasks';
import { useAuth } from '@/hooks/useAuth';
import { useUndoSnackbar } from '@/contexts/UndoSnackbarContext';
import { TaskCard } from '@/components/TaskCard';
import { TaskForm } from '@/components/TaskForm';
import { ListSelector } from '@/components/ListSelector';
import { MoveToListModal } from '@/components/MoveToListModal';
import { userApi, taskListApi, taskApi, userSettingsApi } from '@/services/api';
import type { Task, User, TaskList } from '@/types';

type FilterMode = 'my' | 'all';
type SortOption = 'dueDate' | 'assignee' | 'title';

const SORT_STORAGE_KEY = 'taskSort';

function getInitialSort(): SortOption {
  try {
    const stored = sessionStorage.getItem(SORT_STORAGE_KEY);
    if (stored === 'dueDate' || stored === 'assignee' || stored === 'title') {
      return stored;
    }
  } catch {
    // sessionStorage unavailable
  }
  return 'dueDate';
}

export const TaskDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const { showUndo } = useUndoSnackbar();
  const [searchParams] = useSearchParams();
  const deepLinkApplied = useRef(false);

  const [filter, setFilter] = useState<FilterMode>('my');
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [listsLoaded, setListsLoaded] = useState(false);
  const [dueOverdueFilter, setDueOverdueFilter] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>(getInitialSort);
  const [movingTask, setMovingTask] = useState<Task | null>(null);
  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [moveSnackbar, setMoveSnackbar] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [defaultSaved, setDefaultSaved] = useState(false);

  // Deep link: apply query parameters on mount
  useEffect(() => {
    if (deepLinkApplied.current) return;
    deepLinkApplied.current = true;

    const listIdParam = searchParams.get('listId');
    const assignedToParam = searchParams.get('assignedTo');
    const actionParam = searchParams.get('action');

    if (listIdParam) {
      setSelectedListId(listIdParam);
    }

    if (assignedToParam) {
      // When a specific user is requested via deep link, show all tasks filtered to that user
      // The useTasks hook will pick up assignedTo from taskOptions based on filter mode
      setFilter('all');
    }

    if (actionParam === 'create') {
      setShowForm(true);
    }
  }, [searchParams]);

  // Load users
  useEffect(() => {
    userApi.getAllUsers().then(setUsers).catch(() => {});
  }, []);

  // Load lists and set default from user preference (skip if deep link already set a listId)
  useEffect(() => {
    taskListApi.getAll().then(async (lists: TaskList[]) => {
      setTaskLists(lists);
      // Check user's saved preference
      if (currentUser && !selectedListId) {
        try {
          const savedListId = await userSettingsApi.get(currentUser.id, 'default_task_list_id');
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
      } else if (!selectedListId) {
        const defaultList = lists.find((l) => l.isDefault);
        if (defaultList) setSelectedListId(defaultList.id);
      }
      setListsLoaded(true);
    }).catch(() => { setListsLoaded(true); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load default task filter preference
  useEffect(() => {
    if (!currentUser) return;
    userSettingsApi.get(currentUser.id, 'default_task_filter').then((val) => {
      if (val === 'all') setFilter('all');
      // default is 'my' so only change if explicitly 'all'
    }).catch(() => {});
  }, [currentUser]);

  // Persist sort option in sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(SORT_STORAGE_KEY, sortOption);
    } catch {
      // sessionStorage unavailable
    }
  }, [sortOption]);

  // Debounce search query (100ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 100);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const userNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const u of users) {
      map[u.id] = u.name;
    }
    return map;
  }, [users]);

  // Deep link: resolve assignedTo from query param
  const assignedToParam = searchParams.get('assignedTo');

  const taskOptions = useMemo(
    () => ({
      assignedTo: assignedToParam
        ? assignedToParam
        : filter === 'my'
          ? currentUser?.id
          : undefined,
      status: 'pending' as const,
      userName: currentUser?.name,
      listId: selectedListId === 'all' ? undefined : selectedListId || undefined,
    }),
    [filter, currentUser?.id, currentUser?.name, selectedListId, assignedToParam],
  );

  const { tasks, loading, error, completeTask, refreshTasks } = useTasks(taskOptions);

  const filteredAndSortedTasks = useMemo(() => {
    let result = [...tasks];

    // Apply search filter: ≥2 chars triggers case-insensitive substring match on title
    if (debouncedSearchQuery.length >= 2) {
      const query = debouncedSearchQuery.toLowerCase();
      result = result.filter((task) => task.title.toLowerCase().includes(query));
    }

    // Apply "Due / Overdue" filter: show only pending tasks where dueDate <= now
    if (dueOverdueFilter) {
      const now = new Date();
      result = result.filter((task) => {
        if (task.status !== 'pending') return false;
        if (!task.dueDate) return false; // Backlog tasks are never overdue
        const due = new Date(task.dueDate);
        return due <= now;
      });
    }

    // Apply sort
    result.sort((a, b) => {
      switch (sortOption) {
        case 'dueDate':
          // Null due dates (backlog) sort last
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        case 'assignee': {
          const nameA = a.assignedTo === null ? '' : (userNames[a.assignedTo] || a.assignedTo).toLowerCase();
          const nameB = b.assignedTo === null ? '' : (userNames[b.assignedTo] || b.assignedTo).toLowerCase();
          return nameA.localeCompare(nameB);
        }
        case 'title':
          return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
        default:
          return 0;
      }
    });

    return result;
  }, [tasks, debouncedSearchQuery, dueOverdueFilter, sortOption, userNames]);

  const handleComplete = async (taskId: string) => {
    if (!currentUser) return;
    const task = tasks.find((t) => t.id === taskId);
    try {
      await completeTask(taskId, currentUser.id);
      // Refresh to pick up newly spawned recurring task
      await refreshTasks();
      if (task) {
        showUndo({
          itemName: task.title,
          actionDescription: 'Task completed',
          onUndo: async () => {
            await taskApi.uncompleteTask(taskId);
            refreshTasks();
          },
        });
      }
    } catch {
      // Refresh to get the true state from the server
      await refreshTasks();
    }
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
  };

  const handleCreatedOrUpdated = (_task: Task) => {
    refreshTasks();
    setEditingTask(null);
  };

  const handleDeleted = (deletedTask: Task) => {
    // The task was already deleted (it disappears from the list immediately).
    refreshTasks();
    setEditingTask(null);
    // Offer an Undo_Snackbar bound to the captured payload. The restore
    // endpoint recreates the task from its original id via ON CONFLICT DO NOTHING.
    // Prefer the deleted task's OWN list so undo restores it to where it lived,
    // regardless of the current list filter (falling back to the selected list,
    // then null, only when the task carried no list of its own).
    const listId =
      deletedTask.listId ??
      (selectedListId && selectedListId !== 'all' ? selectedListId : null);
    showUndo({
      itemName: deletedTask.title,
      actionDescription: 'Task deleted',
      onUndo: async () => {
        await taskApi.restoreTask({
          id: deletedTask.id,
          title: deletedTask.title,
          description: deletedTask.description ?? null,
          assignedTo: deletedTask.assignedTo,
          createdBy: deletedTask.createdBy,
          dueDate: deletedTask.dueDate,
          isRecurring: deletedTask.isRecurring,
          recurrenceFrequency: deletedTask.recurrencePattern?.frequency ?? null,
          recurrenceInterval:
            deletedTask.recurrencePattern?.interval ?? deletedTask.recurrenceInterval ?? null,
          recurrenceEndDate: deletedTask.recurrencePattern?.endDate ?? null,
          recurrenceType: deletedTask.recurrenceType ?? null,
          status: deletedTask.status,
          listId,
          notificationLeadHours: deletedTask.notificationLeadHours ?? null,
          rotationEnabled: deletedTask.rotationEnabled,
          rotationUserIds: deletedTask.rotationUserIds,
          rotationCurrentIndex: deletedTask.rotationCurrentIndex,
          createdAt: deletedTask.createdAt,
        });
        refreshTasks();
      },
    });
  };

  const handleListRefresh = useCallback(() => {
    refreshTasks();
    // Re-fetch lists to keep canMove accurate
    taskListApi.getAll().then(setTaskLists).catch(() => {});
  }, [refreshTasks]);

  const handleMoveToList = (task: Task) => {
    setMovingTask(task);
  };

  const handleMoveSelect = async (targetListId: string, targetListName: string) => {
    if (!movingTask) return;
    try {
      await taskApi.moveTask(movingTask.id, targetListId);
      setMovingTask(null);
      refreshTasks();
      setMoveSnackbar({ visible: true, message: `Moved to "${targetListName}"` });
      setTimeout(() => setMoveSnackbar({ visible: false, message: '' }), 3000);
    } catch {
      setMovingTask(null);
      setMoveSnackbar({ visible: true, message: 'Failed to move task. Please try again.' });
      setTimeout(() => setMoveSnackbar({ visible: false, message: '' }), 3000);
    }
  };

  // Determine if other lists exist for the "Move to list" option
  const canMoveTask = selectedListId !== 'all' && taskLists.length > 1;

  const handleToggleExpand = (taskId: string) => {
    setExpandedTaskId((prev) => (prev === taskId ? null : taskId));
  };

  const handleSetAsDefault = async () => {
    if (!currentUser) return;
    try {
      await Promise.all([
        userSettingsApi.put(currentUser.id, 'default_task_list_id', selectedListId === 'all' ? '' : selectedListId),
        userSettingsApi.put(currentUser.id, 'default_task_filter', filter),
      ]);
      setDefaultSaved(true);
      setTimeout(() => setDefaultSaved(false), 2000);
    } catch {
      // silent fail
    }
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortOption(e.target.value as SortOption);
  };

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

      {/* Filter/Sort Toolbar */}
      <div className="task-toolbar">
        <button
          className={`task-filter-btn ${dueOverdueFilter ? 'task-filter-btn--active' : ''}`}
          onClick={() => setDueOverdueFilter((prev) => !prev)}
          aria-pressed={dueOverdueFilter}
        >
          Due / Overdue
        </button>
        <select
          className="task-sort-select"
          value={sortOption}
          onChange={handleSortChange}
          aria-label="Sort tasks by"
        >
          <option value="dueDate">Due Date</option>
          <option value="assignee">Assignee</option>
          <option value="title">Title</option>
        </select>
        <button
          className="btn btn--text"
          onClick={handleSetAsDefault}
          style={{ fontSize: '0.75rem', padding: '2px 8px', opacity: 0.7 }}
          title="Save current list and filter as your default view"
        >
          {defaultSaved ? '✓ Saved' : '📌 Set as default'}
        </button>
      </div>

      {/* Search Input */}
      <div className="search-input-container">
        <input
          type="text"
          className="search-input"
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search tasks"
        />
        {searchQuery && (
          <button
            className="search-clear-btn"
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {loading && <div className="loading-state">Loading tasks...</div>}
      {error && <div className="error-state">{error}</div>}

      {!loading && filteredAndSortedTasks.length === 0 && debouncedSearchQuery.length >= 2 && (
        <div className="empty-state">
          <p>No items match your search.</p>
        </div>
      )}

      {!loading && filteredAndSortedTasks.length === 0 && debouncedSearchQuery.length < 2 && (
        <div className="empty-state">
          <p>No tasks yet. Create one to get started!</p>
        </div>
      )}

      <div className="task-list">
        {filteredAndSortedTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onComplete={handleComplete}
            onEdit={handleEdit}
            onMoveToList={handleMoveToList}
            canMove={canMoveTask}
            userNames={userNames}
            isCurrentUser={task.assignedTo === currentUser?.id}
            isExpanded={expandedTaskId === task.id}
            onToggleExpand={handleToggleExpand}
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
        onDeleted={handleDeleted}
        currentUserId={currentUser?.id || ''}
        editTask={editingTask}
        listId={selectedListId === 'all' ? undefined : selectedListId}
      />

      {/* Move to list modal */}
      <MoveToListModal
        open={!!movingTask}
        type="task"
        currentListId={selectedListId}
        itemName={movingTask?.title || ''}
        onSelect={handleMoveSelect}
        onClose={() => setMovingTask(null)}
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
