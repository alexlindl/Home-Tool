/**
 * Settings Page
 * Administrative interface with tabbed sub-section navigation.
 * Contains inline sub-components for Users, Database, Categories, Templates, Port.
 *
 * Requirements: 16.1, 17.1, 18.1, 19.1, 20.1
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  userApi,
  adminApi,
  categoryApi,
  templateApi,
  taskApi,
  shoppingApi,
  activityApi,
  taskListApi,
  shoppingListApi,
  userSettingsApi,
  CategoryRecord,
} from '@/services/api';
import type { User, TaskTemplate, ItemTemplate, TaskList, ShoppingList, BackupStatus } from '@/types';
import type { ActivityEntry, PaginatedActivityEntry } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { useUndoSnackbar } from '@/contexts/UndoSnackbarContext';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import DashboardIntegration from '@/components/DashboardIntegration';

type SettingsTab = 'users' | 'database' | 'categories' | 'templates' | 'lists' | 'backup' | 'theme' | 'dashboard' | 'activity' | 'about';

const tabs: { id: SettingsTab; label: string }[] = [
  { id: 'templates', label: 'Templates' },
  { id: 'categories', label: 'Categories' },
  { id: 'users', label: 'Users' },
  { id: 'lists', label: 'Lists' },
  { id: 'activity', label: 'Activity' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'database', label: 'Database' },
  { id: 'backup', label: 'Backup' },
  { id: 'theme', label: 'Theme' },
  { id: 'about', label: 'About' },
];

// ===========================================================================
// UserManagement
// ===========================================================================

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  // HA linking state
  const [editingHaId, setEditingHaId] = useState<string | null>(null);
  const [haInput, setHaInput] = useState('');
  const [haError, setHaError] = useState('');
  const [haLoading, setHaLoading] = useState(false);
  const [haUsers, setHaUsers] = useState<{ entityId: string; name: string; userId: string | null }[]>([]);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await userApi.getAllUsers();
      setUsers(data);
      setError('');
    } catch {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Fetch HA person entities on mount (graceful — empty array if unavailable)
  useEffect(() => {
    userApi.getHaUsers().then(setHaUsers).catch(() => {});
  }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await userApi.createUser(newName.trim());
      setNewName('');
      await fetchUsers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to add user';
      setError(msg);
    }
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) return;
    try {
      await userApi.updateUser(id, editName.trim());
      setEditingId(null);
      await fetchUsers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to rename user';
      setError(msg);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await userApi.deleteUser(id);
      setConfirmDeleteId(null);
      await fetchUsers();
    } catch {
      setError('Failed to delete user');
    }
  };

  const handleHaEdit = (user: User) => {
    setEditingHaId(user.id);
    setHaInput(user.haUsername || '');
    setHaError('');
  };

  const handleHaCancel = () => {
    setEditingHaId(null);
    setHaInput('');
    setHaError('');
  };

  const handleHaConfirm = async (id: string) => {
    setHaLoading(true);
    setHaError('');
    try {
      await userApi.patchHaLink(id, haInput.trim());
      setEditingHaId(null);
      setHaInput('');
      await fetchUsers();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { message?: string } } };
      if (axiosErr.response?.status === 409) {
        setHaError(axiosErr.response.data?.message || 'This HA username is already linked to another user');
      } else {
        setHaError(axiosErr.response?.data?.message || 'Failed to update HA link');
      }
    } finally {
      setHaLoading(false);
    }
  };

  const handleHaUnlink = async (id: string) => {
    setHaLoading(true);
    setHaError('');
    try {
      await userApi.patchHaLink(id, '');
      await fetchUsers();
    } catch {
      setHaError('Failed to unlink HA account');
    } finally {
      setHaLoading(false);
    }
  };

  if (loading) return <p className="loading-state">Loading users...</p>;

  return (
    <div className="settings-section">
      <h2>Users</h2>
      {error && <p className="error-state">{error}</p>}

      <div className="settings-list">
        {users.map((user) => (
          <div key={user.id} className="settings-list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            {editingId === user.id ? (
              <div className="settings-inline-edit">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRename(user.id)}
                  autoFocus
                />
                <button className="btn btn--primary" onClick={() => handleRename(user.id)}>Save</button>
                <button className="btn btn--secondary" onClick={() => setEditingId(null)}>Cancel</button>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span className="settings-list-name">{user.name}</span>
                <div className="settings-list-actions">
                  <button
                    className="btn btn--text"
                    onClick={() => { setEditingId(user.id); setEditName(user.name); }}
                  >
                    Rename
                  </button>
                  <button
                    className="btn btn--text settings-btn-danger"
                    onClick={() => setConfirmDeleteId(user.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}

            {/* Home Assistant Account Section */}
            <div className="settings-ha-section" style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--color-border, #e0e0e0)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                  Home Assistant Account
                </span>
              </div>
              {editingHaId === user.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="settings-inline-edit">
                    {haUsers.length > 0 ? (
                      <select
                        value={haInput}
                        onChange={(e) => setHaInput(e.target.value)}
                        autoFocus
                        disabled={haLoading}
                        style={{ flex: 1 }}
                      >
                        <option value="">Not linked</option>
                        {haUsers.map((haUser) => (
                          <option key={haUser.entityId} value={haUser.name}>
                            {haUser.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={haInput}
                        onChange={(e) => setHaInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleHaConfirm(user.id);
                          if (e.key === 'Escape') handleHaCancel();
                        }}
                        placeholder="HA username"
                        maxLength={128}
                        autoFocus
                        disabled={haLoading}
                      />
                    )}
                    <button
                      className="btn btn--primary"
                      onClick={() => handleHaConfirm(user.id)}
                      disabled={haLoading}
                    >
                      {haLoading ? '...' : 'Save'}
                    </button>
                    <button
                      className="btn btn--secondary"
                      onClick={handleHaCancel}
                      disabled={haLoading}
                    >
                      Cancel
                    </button>
                  </div>
                  {haError && <p className="error-state" style={{ margin: 0, fontSize: '0.8rem' }}>{haError}</p>}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                    {user.haUsername ? (
                      <>
                        <span style={{ color: 'var(--color-text)' }}>{user.haUsername}</span>
                        <span style={{ marginLeft: 8 }}>Notifications: Active</span>
                      </>
                    ) : (
                      <span>Not linked — Link HA account to enable notifications</span>
                    )}
                  </div>
                  <div className="settings-list-actions">
                    <button
                      className="btn btn--text"
                      onClick={() => handleHaEdit(user)}
                      style={{ fontSize: '0.8rem' }}
                    >
                      {user.haUsername ? 'Edit' : 'Link'}
                    </button>
                    {user.haUsername && (
                      <button
                        className="btn btn--text settings-btn-danger"
                        onClick={() => handleHaUnlink(user.id)}
                        style={{ fontSize: '0.8rem' }}
                        disabled={haLoading}
                      >
                        Unlink
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="settings-add-form">
        <input
          type="text"
          placeholder="New user name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button className="btn btn--primary" onClick={handleAdd} disabled={!newName.trim()}>
          Add User
        </button>
      </div>

      {confirmDeleteId && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteId(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm Delete</h2>
              <button className="modal-close" onClick={() => setConfirmDeleteId(null)}>✕</button>
            </div>
            <p>Are you sure you want to delete this user? Their tasks will be reassigned to another user.</p>
            <div className="form-actions">
              <button className="btn btn--secondary" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
              <button className="btn btn--primary settings-btn-danger" onClick={() => handleDelete(confirmDeleteId)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ===========================================================================
// DefaultListPreference
// ===========================================================================

const DefaultListPreference: React.FC = () => {
  const { currentUser } = useAuth();
  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [shoppingLists, setShoppingLists] = useState<ShoppingList[]>([]);
  const [defaultTaskListId, setDefaultTaskListId] = useState<string>('');
  const [defaultTaskFilter, setDefaultTaskFilter] = useState<string>('my');
  const [defaultShoppingListId, setDefaultShoppingListId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!currentUser) return;
    const fetchData = async () => {
      try {
        const [tl, sl] = await Promise.all([
          taskListApi.getAll(),
          shoppingListApi.getAll(),
        ]);
        setTaskLists(tl);
        setShoppingLists(sl);

        // Load current settings
        const [taskListVal, taskFilterVal, shoppingListVal] = await Promise.all([
          userSettingsApi.get(currentUser.id, 'default_task_list_id'),
          userSettingsApi.get(currentUser.id, 'default_task_filter'),
          userSettingsApi.get(currentUser.id, 'default_shopping_list_id'),
        ]);
        // When no preference saved (null), show what the page actually defaults to:
        // the list marked isDefault in the DB, or '' for "All Lists" if none
        const defaultTaskList = tl.find((l) => l.isDefault);
        const defaultShoppingList = sl.find((l) => l.isDefault);
        setDefaultTaskListId(taskListVal ?? (defaultTaskList?.id || ''));
        setDefaultTaskFilter(taskFilterVal ?? 'my');
        setDefaultShoppingListId(shoppingListVal ?? (defaultShoppingList?.id || ''));
      } catch {
        // ignore fetch errors — defaults remain
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentUser]);

  const handleSave = async (key: string, value: string, setter: (v: string) => void) => {
    if (!currentUser) return;
    setError('');
    setConfirmation('');
    setSaving(key);
    try {
      await userSettingsApi.put(currentUser.id, key, value);
      setter(value);
      setConfirmation('Saved!');
      setTimeout(() => setConfirmation(''), 2000);
    } catch {
      setError('Failed to save preference');
    } finally {
      setSaving(null);
    }
  };

  if (!currentUser) return null;
  if (loading) return <p className="loading-state">Loading preference...</p>;

  return (
    <div className="settings-section">
      <h2>Default List Preferences</h2>
      <p style={{ marginBottom: 12, color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
        Choose which list and filter to show when each page loads.
      </p>

      <div className="form-group" style={{ marginBottom: 16 }}>
        <label htmlFor="default-task-list" style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>
          Default Task List
        </label>
        <select
          id="default-task-list"
          value={defaultTaskListId}
          onChange={(e) => handleSave('default_task_list_id', e.target.value, setDefaultTaskListId)}
          disabled={saving === 'default_task_list_id'}
          aria-label="Default task list preference"
          style={{ width: '100%', maxWidth: 300 }}
        >
          <option value="">All Lists</option>
          {taskLists.map((list) => (
            <option key={list.id} value={list.id}>
              {list.name}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group" style={{ marginBottom: 16 }}>
        <label htmlFor="default-task-filter" style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>
          Default Task Filter
        </label>
        <select
          id="default-task-filter"
          value={defaultTaskFilter}
          onChange={(e) => handleSave('default_task_filter', e.target.value, setDefaultTaskFilter)}
          disabled={saving === 'default_task_filter'}
          aria-label="Default task filter preference"
          style={{ width: '100%', maxWidth: 300 }}
        >
          <option value="my">My Tasks</option>
          <option value="all">All Tasks</option>
        </select>
      </div>

      <div className="form-group" style={{ marginBottom: 16 }}>
        <label htmlFor="default-shopping-list" style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>
          Default Shopping List
        </label>
        <select
          id="default-shopping-list"
          value={defaultShoppingListId}
          onChange={(e) => handleSave('default_shopping_list_id', e.target.value, setDefaultShoppingListId)}
          disabled={saving === 'default_shopping_list_id'}
          aria-label="Default shopping list preference"
          style={{ width: '100%', maxWidth: 300 }}
        >
          <option value="">All Lists</option>
          {shoppingLists.map((list) => (
            <option key={list.id} value={list.id}>
              {list.name}
            </option>
          ))}
        </select>
      </div>

      {confirmation && (
        <p style={{ color: 'var(--color-primary)', fontSize: '0.875rem', marginTop: 8 }}>
          {confirmation}
        </p>
      )}
      {error && (
        <p className="error-state" style={{ marginTop: 8 }}>
          {error}
        </p>
      )}
    </div>
  );
};

// ===========================================================================
// DatabaseManagement
// ===========================================================================

const DatabaseManagement: React.FC = () => {
  const { currentUser } = useAuth();
  // Task-history clearing lives in the dedicated "History" section below
  // (handleClearTaskHistory), so it is intentionally NOT one of the reset
  // checkboxes here — that avoided a duplicate "Clear Task History" control.
  const [clearTasks, setClearTasks] = useState(false);
  const [clearShopping, setClearShopping] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Admin history / maintenance controls (Req 8 & 9). Each action has its own
  // busy flag so the buttons disable independently while their request runs.
  const [clearingActivity, setClearingActivity] = useState(false);
  const [clearingTaskHistory, setClearingTaskHistory] = useState(false);
  const [bringingUpToDate, setBringingUpToDate] = useState(false);

  const nothingSelected = !clearTasks && !clearShopping;

  // Map an admin request error to a user-facing detail string, surfacing the
  // 401 admin-authorization hint consistent with handleReset above.
  const adminErrorDetail = (err: unknown): string => {
    const e = err as { response?: { status?: number; data?: { message?: string } } };
    const serverMsg = e?.response?.data?.message;
    const httpStatus = e?.response?.status;
    return httpStatus === 401
      ? 'admin authorization required (set the admin secret in both the add-on config and the web build, then restart)'
      : serverMsg || 'unknown error';
  };

  const handleClearActivityLog = async () => {
    if (!window.confirm('Clear the entire activity log? This cannot be undone. Task history is left untouched.')) return;
    setClearingActivity(true);
    try {
      const result = await adminApi.clearActivityLog();
      setStatus({ type: 'success', message: `Activity log cleared (${result.deletedCount} entries removed).` });
    } catch (err: unknown) {
      setStatus({ type: 'error', message: `Failed to clear activity log: ${adminErrorDetail(err)}` });
    } finally {
      setClearingActivity(false);
    }
  };

  const handleClearTaskHistory = async () => {
    if (!window.confirm('Clear the entire completed task history? This cannot be undone. The activity log is left untouched.')) return;
    setClearingTaskHistory(true);
    try {
      const result = await adminApi.clearTaskHistory();
      setStatus({ type: 'success', message: `Task history cleared (${result.deletedCount} entries removed).` });
    } catch (err: unknown) {
      setStatus({ type: 'error', message: `Failed to clear task history: ${adminErrorDetail(err)}` });
    } finally {
      setClearingTaskHistory(false);
    }
  };

  const handleBringTasksUpToDate = async () => {
    if (!currentUser) {
      setStatus({ type: 'error', message: 'Cannot bring tasks up to date: no current user.' });
      return;
    }
    if (!window.confirm('Complete every overdue task? Recurring tasks advance to their next occurrence; non-recurring overdue tasks are marked completed.')) return;
    setBringingUpToDate(true);
    try {
      const result = await adminApi.bringTasksUpToDate(currentUser.id);
      setStatus({ type: 'success', message: `Brought tasks up to date. ${result.completedCount} overdue task(s) completed.` });
    } catch (err: unknown) {
      setStatus({ type: 'error', message: `Failed to bring tasks up to date: ${adminErrorDetail(err)}` });
    } finally {
      setBringingUpToDate(false);
    }
  };

  const handleReset = async () => {
    if (confirmText !== 'RESET') return;
    setLoading(true);
    try {
      const result = await adminApi.resetDatabase({
        confirm: true,
        clearTasks: clearTasks || undefined,
        clearShopping: clearShopping || undefined,
      });
      setStatus({ type: 'success', message: `Reset completed. Cleared: ${result.cleared.join(', ')}` });
      setShowConfirm(false);
      setConfirmText('');
      setClearTasks(false);
      setClearShopping(false);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { message?: string } } };
      const serverMsg = e?.response?.data?.message;
      const status = e?.response?.status;
      const detail = status === 401
        ? 'admin authorization required (set the admin secret in both the add-on config and the web build, then restart)'
        : serverMsg || 'unknown error';
      setStatus({ type: 'error', message: `Failed to reset database: ${detail}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-section">
      <h2>Database</h2>
      {status && (
        <p className={status.type === 'success' ? 'loading-state' : 'error-state'}>
          {status.message}
        </p>
      )}

      <div className="settings-danger-zone">
        <p style={{ marginBottom: 12, color: 'var(--color-text-secondary)' }}>
          Select what to clear. User accounts and pre-populated templates are always preserved.
        </p>

        <div className="form-group form-group--inline">
          <label>
            <input type="checkbox" checked={clearTasks} onChange={(e) => setClearTasks(e.target.checked)} />
            Clear All Tasks
          </label>
        </div>
        <div className="form-group form-group--inline">
          <label>
            <input type="checkbox" checked={clearShopping} onChange={(e) => setClearShopping(e.target.checked)} />
            Clear All Shopping Items
          </label>
        </div>

        <button
          className="btn btn--primary settings-btn-danger"
          disabled={nothingSelected}
          onClick={() => setShowConfirm(true)}
          style={{ marginTop: 16 }}
        >
          Reset Selected
        </button>
      </div>

      {showConfirm && (
        <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm Database Reset</h2>
              <button className="modal-close" onClick={() => setShowConfirm(false)}>✕</button>
            </div>
            <p style={{ marginBottom: 12 }}>
              This action is <strong>irreversible</strong>. Type <code>RESET</code> to confirm.
            </p>
            <div className="form-group">
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder='Type "RESET" to confirm'
                autoFocus
              />
            </div>
            <div className="form-actions">
              <button className="btn btn--secondary" onClick={() => { setShowConfirm(false); setConfirmText(''); }}>
                Cancel
              </button>
              <button
                className="btn btn--primary settings-btn-danger"
                disabled={confirmText !== 'RESET' || loading}
                onClick={handleReset}
              >
                {loading ? 'Resetting...' : 'Confirm Reset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History maintenance (Req 8) — clear each feed independently */}
      <div className="settings-danger-zone" style={{ marginTop: 24 }}>
        <h3 style={{ marginBottom: 8 }}>History</h3>
        <p style={{ marginBottom: 12, color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
          Clear the activity feed and completed task history independently. Each action asks for confirmation and cannot be undone.
        </p>
        <button
          className="btn btn--primary settings-btn-danger"
          disabled={clearingActivity}
          onClick={handleClearActivityLog}
          style={{ marginRight: 12 }}
        >
          {clearingActivity ? 'Clearing…' : 'Clear Activity Log'}
        </button>
        <button
          className="btn btn--primary settings-btn-danger"
          disabled={clearingTaskHistory}
          onClick={handleClearTaskHistory}
        >
          {clearingTaskHistory ? 'Clearing…' : 'Clear Task History'}
        </button>
      </div>

      {/* Bring tasks up to date (Req 9) — complete every overdue task */}
      <div className="settings-danger-zone" style={{ marginTop: 24 }}>
        <h3 style={{ marginBottom: 8 }}>Overdue Tasks</h3>
        <p style={{ marginBottom: 12, color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
          Complete every overdue task in one step. Recurring tasks advance to their next occurrence; non-recurring overdue tasks are marked completed. This action asks for confirmation.
        </p>
        <button
          className="btn btn--primary"
          disabled={bringingUpToDate}
          onClick={handleBringTasksUpToDate}
        >
          {bringingUpToDate ? 'Working…' : 'Bring Tasks Up To Date'}
        </button>
      </div>

      {/* Factory Reset */}
      <div className="settings-danger-zone" style={{ marginTop: 24 }}>
        <h3 style={{ color: 'var(--color-overdue)', marginBottom: 8 }}>⚠️ Factory Reset</h3>
        <p style={{ marginBottom: 12, color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
          Completely wipe all data and return to a fresh install state. This deletes ALL tasks, shopping items, history, templates, categories, lists, and users. This cannot be undone.
        </p>
        <button
          className="btn btn--primary settings-btn-danger"
          onClick={async () => {
            const first = window.confirm('Are you sure you want to factory reset? ALL data will be permanently deleted.');
            if (!first) return;
            const second = window.prompt('Type "FACTORY RESET" to confirm:');
            if (second !== 'FACTORY RESET') return;
            try {
              const response = await fetch('./api/admin/factory-reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirm: true }),
              });
              if (response.ok) {
                window.alert('Factory reset complete. The app will now reload.');
                window.location.reload();
              } else {
                setStatus({ type: 'error', message: 'Factory reset failed.' });
              }
            } catch {
              setStatus({ type: 'error', message: 'Factory reset failed.' });
            }
          }}
        >
          Factory Reset
        </button>
      </div>
    </div>
  );
};

// ===========================================================================
// CategoryManagement
// ===========================================================================

// Reject an order change that does not complete within this many milliseconds (Req 3.4).
const REORDER_TIMEOUT_MS = 10000;

/**
 * Sortable wrapper for a single category row (Req 3.1). Uses dnd-kit's useSortable to
 * wire the row into the surrounding SortableContext: `attributes` + `listeners` make the
 * row draggable (via pointer) and keyboard-operable (via the DndContext KeyboardSensor),
 * and the transform/transition styles animate the row while dragging.
 */
const SortableCategoryRow: React.FC<{
  id: string;
  disabled: boolean;
  children: React.ReactNode;
}> = ({ id, disabled, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="settings-list-item"
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
};

const CategoryManagement: React.FC = () => {
  const { showUndo } = useUndoSnackbar();
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  // Guards against overlapping reorder requests clobbering each other's revert state.
  const reorderInFlight = useRef(false);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await categoryApi.getAll();
      setCategories(data);
      setError('');
    } catch {
      setError('Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      await categoryApi.create(newName.trim());
      setNewName('');
      await fetchCategories();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to add category';
      setError(msg);
    }
  };

  // Drag-and-drop sensors. PointerSensor handles mouse/touch dragging; KeyboardSensor
  // (Req 3.5) makes dnd-kit itself keyboard-operable, using the sortable coordinate
  // getter so arrow keys move a picked-up category. The up/down ▲▼ buttons below remain
  // as an explicit, always-available keyboard fallback that produces the same orderedIds.
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /**
   * Apply a fully-computed new category order optimistically, persist it, and reconcile
   * with the server. Shared by both the ▲▼ buttons (handleMove) and drag-and-drop
   * (handleDragEnd) so both paths send the identical orderedIds sequence to the
   * Reorder_Endpoint (Req 3.2, 3.5).
   *
   * - Applies `nextOrder` to local state optimistically before the response (Req 3.3).
   * - Calls categoryApi.reorder with the resulting orderedIds (Req 3.2).
   * - On success, refreshes the displayed list from the returned payload (Req 3.6).
   * - On rejection or a >10s timeout, reverts to the pre-change order and shows an
   *   error indication (Req 3.4).
   */
  const applyReorder = async (nextOrder: CategoryRecord[]) => {
    if (reorderInFlight.current) return;

    // Snapshot the order shown before the change so we can revert on failure (Req 3.4).
    const previousOrder = categories;
    const orderedIds = nextOrder.map((cat) => cat.id);

    reorderInFlight.current = true;
    setReordering(true);
    setError('');
    setCategories(nextOrder);

    // Race the request against an explicit 10-second timeout (Req 3.4).
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('timeout')), REORDER_TIMEOUT_MS);
    });

    try {
      const updated = await Promise.race([categoryApi.reorder(orderedIds), timeout]);
      // Refresh the displayed list from the persisted order the API returned (Req 3.6).
      setCategories(updated);
    } catch (err: unknown) {
      // Revert to the order shown before the change was attempted (Req 3.4).
      setCategories(previousOrder);
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to reorder categories';
      setError(msg);
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      reorderInFlight.current = false;
      setReordering(false);
    }
  };

  /**
   * Keyboard fallback (Req 3.5): move the category at `index` up (delta -1) or down
   * (delta +1) by swapping it with its neighbor, then delegate to applyReorder.
   */
  const handleMove = (index: number, delta: number) => {
    if (reorderInFlight.current) return;

    const target = index + delta;
    if (target < 0 || target >= categories.length) return;

    const moved = categories[index];
    const neighbor = categories[target];
    if (!moved || !neighbor) return;

    // Compute the optimistic new order by swapping the two rows.
    const nextOrder = [...categories];
    nextOrder[index] = neighbor;
    nextOrder[target] = moved;

    void applyReorder(nextOrder);
  };

  /**
   * Drag-and-drop reorder (Req 3.1): when a drag ends over a different row, compute the
   * new order with arrayMove and delegate to applyReorder.
   */
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categories.findIndex((cat) => cat.id === active.id);
    const newIndex = categories.findIndex((cat) => cat.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // arrayMove returns a new array; noUncheckedIndexedAccess is satisfied because we
    // never index into it directly (applyReorder maps over the whole array).
    const nextOrder = arrayMove(categories, oldIndex, newIndex);
    void applyReorder(nextOrder);
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) return;
    try {
      await categoryApi.update(id, editName.trim());
      setEditingId(null);
      await fetchCategories();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to rename category';
      setError(msg);
    }
  };

  const handleDelete = async (id: string) => {
    // Capture the full entity payload BEFORE deleting so it can be restored.
    const deletedCategory = categories.find((c) => c.id === id);
    try {
      await categoryApi.remove(id);
      setConfirmDeleteId(null);
      await fetchCategories();
      if (deletedCategory) {
        // Offer an Undo_Snackbar bound to the captured payload. The restore
        // endpoint recreates the category (preserving sort_position) from its
        // original id via ON CONFLICT DO NOTHING.
        showUndo({
          itemName: deletedCategory.name,
          actionDescription: 'Category deleted',
          onUndo: async () => {
            await categoryApi.restore({
              id: deletedCategory.id,
              name: deletedCategory.name,
              isDefault: deletedCategory.is_default,
              sortPosition: deletedCategory.sortPosition,
              createdAt: deletedCategory.created_at,
            });
            await fetchCategories();
          },
        });
      }
    } catch {
      setError('Failed to delete category');
    }
  };

  if (loading) return <p className="loading-state">Loading categories...</p>;

  return (
    <div className="settings-section">
      <h2>Categories</h2>
      {error && <p className="error-state">{error}</p>}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={categories.map((cat) => cat.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="settings-list">
            {categories.map((cat, index) => (
              <SortableCategoryRow
                key={cat.id}
                id={cat.id}
                disabled={editingId === cat.id || reordering}
              >
                {editingId === cat.id ? (
              <div className="settings-inline-edit">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRename(cat.id)}
                  autoFocus
                />
                <button className="btn btn--primary" onClick={() => handleRename(cat.id)}>Save</button>
                <button className="btn btn--secondary" onClick={() => setEditingId(null)}>Cancel</button>
              </div>
            ) : (
              <>
                <div className="settings-list-reorder">
                  <button
                    className="btn btn--text"
                    aria-label={`Move ${cat.name} up`}
                    title="Move up"
                    disabled={index === 0 || reordering}
                    onClick={() => handleMove(index, -1)}
                  >
                    ▲
                  </button>
                  <button
                    className="btn btn--text"
                    aria-label={`Move ${cat.name} down`}
                    title="Move down"
                    disabled={index === categories.length - 1 || reordering}
                    onClick={() => handleMove(index, 1)}
                  >
                    ▼
                  </button>
                </div>
                <span className="settings-list-name">
                  {cat.name}
                  {cat.is_default && <span className="settings-badge">default</span>}
                </span>
                <div className="settings-list-actions">
                  <button
                    className="btn btn--text"
                    onClick={() => { setEditingId(cat.id); setEditName(cat.name); }}
                  >
                    Rename
                  </button>
                  {!cat.is_default && (
                    <button
                      className="btn btn--text settings-btn-danger"
                      onClick={() => setConfirmDeleteId(cat.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </>
            )}
              </SortableCategoryRow>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="settings-add-form">
        <input
          type="text"
          placeholder="New category name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button className="btn btn--primary" onClick={handleAdd} disabled={!newName.trim()}>
          Add Category
        </button>
      </div>

      {confirmDeleteId && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteId(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm Delete</h2>
              <button className="modal-close" onClick={() => setConfirmDeleteId(null)}>✕</button>
            </div>
            <p>Are you sure you want to delete this category? Items using it will be reassigned to &quot;uncategorized&quot;.</p>
            <div className="form-actions">
              <button className="btn btn--secondary" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
              <button className="btn btn--primary settings-btn-danger" onClick={() => handleDelete(confirmDeleteId)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ===========================================================================
// TemplateManagement
// ===========================================================================

const TemplateManagement: React.FC = () => {
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([]);
  const [itemTemplates, setItemTemplates] = useState<ItemTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemName, setEditItemName] = useState('');

  const fetchTemplates = useCallback(async () => {
    try {
      const [tasks, items] = await Promise.all([
        taskApi.getTemplates(),
        shoppingApi.getTemplates(),
      ]);
      setTaskTemplates(tasks);
      setItemTemplates(items);
      setError('');
    } catch {
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const handleUpdateTaskTemplate = async (id: string) => {
    if (!editTaskTitle.trim()) return;
    try {
      await templateApi.updateTaskTemplate(id, { title: editTaskTitle.trim() });
      setEditingTaskId(null);
      await fetchTemplates();
    } catch {
      setError('Failed to update task template');
    }
  };

  const handleDeleteTaskTemplate = async (id: string) => {
    try {
      await templateApi.deleteTaskTemplate(id);
      await fetchTemplates();
    } catch {
      setError('Failed to delete task template');
    }
  };

  const handleUpdateItemTemplate = async (id: string) => {
    if (!editItemName.trim()) return;
    try {
      await templateApi.updateItemTemplate(id, { name: editItemName.trim() });
      setEditingItemId(null);
      await fetchTemplates();
    } catch {
      setError('Failed to update item template');
    }
  };

  const handleDeleteItemTemplate = async (id: string) => {
    try {
      await templateApi.deleteItemTemplate(id);
      await fetchTemplates();
    } catch {
      setError('Failed to delete item template');
    }
  };

  if (loading) return <p className="loading-state">Loading templates...</p>;

  return (
    <div className="settings-section">
      <h2>Templates</h2>
      {error && <p className="error-state">{error}</p>}

      <h3 className="settings-subsection-title">Task Templates</h3>
      <div className="settings-list">
        {taskTemplates.length === 0 && <p className="settings-placeholder">No task templates found.</p>}
        {taskTemplates.map((t) => (
          <div key={t.id} className="settings-list-item">
            {editingTaskId === t.id ? (
              <div className="settings-inline-edit">
                <input
                  type="text"
                  value={editTaskTitle}
                  onChange={(e) => setEditTaskTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUpdateTaskTemplate(t.id)}
                  autoFocus
                />
                <button className="btn btn--primary" onClick={() => handleUpdateTaskTemplate(t.id)}>Save</button>
                <button className="btn btn--secondary" onClick={() => setEditingTaskId(null)}>Cancel</button>
              </div>
            ) : (
              <>
                <span className="settings-list-name">
                  {t.title}
                  {t.isPrePopulated && <span className="settings-badge">built-in</span>}
                </span>
                <div className="settings-list-actions">
                  <button
                    className="btn btn--text"
                    onClick={() => { setEditingTaskId(t.id); setEditTaskTitle(t.title); }}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn--text settings-btn-danger"
                    onClick={() => handleDeleteTaskTemplate(t.id)}
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <h3 className="settings-subsection-title">Shopping Templates</h3>
      <div className="settings-list">
        {itemTemplates.length === 0 && <p className="settings-placeholder">No shopping templates found.</p>}
        {itemTemplates.map((t) => (
          <div key={t.id} className="settings-list-item">
            {editingItemId === t.id ? (
              <div className="settings-inline-edit">
                <input
                  type="text"
                  value={editItemName}
                  onChange={(e) => setEditItemName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUpdateItemTemplate(t.id)}
                  autoFocus
                />
                <button className="btn btn--primary" onClick={() => handleUpdateItemTemplate(t.id)}>Save</button>
                <button className="btn btn--secondary" onClick={() => setEditingItemId(null)}>Cancel</button>
              </div>
            ) : (
              <>
                <span className="settings-list-name">
                  {t.name}
                  <span className="settings-badge settings-badge--category">{t.category}</span>
                  {t.isPrePopulated && <span className="settings-badge">built-in</span>}
                </span>
                <div className="settings-list-actions">
                  <button
                    className="btn btn--text"
                    onClick={() => { setEditingItemId(t.id); setEditItemName(t.name); }}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn--text settings-btn-danger"
                    onClick={() => handleDeleteItemTemplate(t.id)}
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ===========================================================================
// ThemeSelector
// ===========================================================================

type ThemeMode = 'light' | 'dark' | 'system';
type ColorScheme = 'blue' | 'green' | 'purple' | 'orange' | 'teal' | 'rose';

const THEME_STORAGE_KEY = 'household_theme';
const COLOR_SCHEME_STORAGE_KEY = 'colorScheme';

const COLOR_SCHEMES: { id: ColorScheme; label: string; color: string }[] = [
  { id: 'blue', label: 'Blue', color: '#4a90d9' },
  { id: 'green', label: 'Green', color: '#4caf50' },
  { id: 'purple', label: 'Purple', color: '#7c4dff' },
  { id: 'orange', label: 'Orange', color: '#ff9800' },
  { id: 'teal', label: 'Teal', color: '#009688' },
  { id: 'rose', label: 'Rose', color: '#e91e63' },
];

const ThemeSelector: React.FC = () => {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    return (localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode) || 'system';
  });

  const [colorScheme, setColorScheme] = useState<ColorScheme>(() => {
    return (localStorage.getItem(COLOR_SCHEME_STORAGE_KEY) as ColorScheme) || 'blue';
  });

  const applyTheme = useCallback((mode: ThemeMode) => {
    const root = document.documentElement;
    if (mode === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', mode);
    }
  }, []);

  const applyColorScheme = useCallback((scheme: ColorScheme) => {
    const root = document.documentElement;
    root.setAttribute('data-scheme', scheme);
  }, []);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme, applyTheme]);

  useEffect(() => {
    applyColorScheme(colorScheme);
    localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, colorScheme);
  }, [colorScheme, applyColorScheme]);

  // Listen for system theme changes when in system mode
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme, applyTheme]);

  const handleChange = (mode: ThemeMode) => {
    setTheme(mode);
  };

  const handleSchemeChange = (scheme: ColorScheme) => {
    setColorScheme(scheme);
  };

  return (
    <div className="settings-section">
      <h2>Theme</h2>
      <p style={{ marginBottom: 16, color: 'var(--color-text-secondary)' }}>
        Choose how the app looks. System will follow your device settings.
      </p>

      <div className="settings-theme-options">
        {([
          { id: 'light' as ThemeMode, label: '☀️ Light', description: 'Light background with dark text' },
          { id: 'dark' as ThemeMode, label: '🌙 Dark', description: 'Dark background with light text' },
          { id: 'system' as ThemeMode, label: '💻 System', description: 'Follow your device preference' },
        ]).map((option) => (
          <button
            key={option.id}
            className={`settings-theme-btn ${theme === option.id ? 'settings-theme-btn--active' : ''}`}
            onClick={() => handleChange(option.id)}
          >
            <span className="settings-theme-label">{option.label}</span>
            <span className="settings-theme-desc">{option.description}</span>
          </button>
        ))}
      </div>

      <h3 className="settings-subsection-title" style={{ marginTop: 24 }}>Colour Scheme</h3>
      <p style={{ marginBottom: 12, color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
        Pick an accent colour for buttons, links, and highlights.
      </p>
      <div className="color-scheme-picker">
        {COLOR_SCHEMES.map((scheme) => (
          <button
            key={scheme.id}
            className={`color-scheme-swatch ${colorScheme === scheme.id ? 'color-scheme-swatch--active' : ''}`}
            style={{ '--swatch-color': scheme.color } as React.CSSProperties}
            onClick={() => handleSchemeChange(scheme.id)}
            aria-label={`${scheme.label} colour scheme`}
            title={scheme.label}
          >
            {colorScheme === scheme.id && <span className="color-scheme-check">✓</span>}
          </button>
        ))}
      </div>
    </div>
  );
};

// ===========================================================================
// ListManagement
// ===========================================================================

const ListManagement: React.FC = () => {
  const { showUndo } = useUndoSnackbar();
  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [shoppingLists, setShoppingLists] = useState<ShoppingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newTaskListName, setNewTaskListName] = useState('');
  const [newShoppingListName, setNewShoppingListName] = useState('');
  const [editingTaskListId, setEditingTaskListId] = useState<string | null>(null);
  const [editingShoppingListId, setEditingShoppingListId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [renameError, setRenameError] = useState('');
  const [renaming, setRenaming] = useState(false);
  const editInputRef = React.useRef<HTMLInputElement>(null);

  // Select all text when entering edit mode
  useEffect(() => {
    if ((editingTaskListId || editingShoppingListId) && editInputRef.current) {
      editInputRef.current.select();
    }
  }, [editingTaskListId, editingShoppingListId]);

  const fetchLists = useCallback(async () => {
    try {
      const [tl, sl] = await Promise.all([
        taskListApi.getAll(),
        shoppingListApi.getAll(),
      ]);
      setTaskLists(tl);
      setShoppingLists(sl);
      setError('');
    } catch {
      setError('Failed to load lists');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLists(); }, [fetchLists]);

  const handleAddTaskList = async () => {
    if (!newTaskListName.trim()) return;
    try {
      await taskListApi.create(newTaskListName.trim());
      setNewTaskListName('');
      await fetchLists();
    } catch {
      setError('Failed to create task list');
    }
  };

  const handleAddShoppingList = async () => {
    if (!newShoppingListName.trim()) return;
    try {
      await shoppingListApi.create(newShoppingListName.trim());
      setNewShoppingListName('');
      await fetchLists();
    } catch {
      setError('Failed to create shopping list');
    }
  };

  const handleRenameTaskList = async (id: string) => {
    if (!editName.trim()) return;
    setRenaming(true);
    setRenameError('');
    try {
      await taskListApi.update(id, editName.trim());
      setEditingTaskListId(null);
      setRenameError('');
      await fetchLists();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { message?: string } } };
      if (axiosErr.response?.status === 400 || axiosErr.response?.status === 409) {
        setRenameError(axiosErr.response.data?.message || 'Failed to rename task list');
      } else {
        setRenameError('Failed to rename task list. Please try again.');
      }
    } finally {
      setRenaming(false);
    }
  };

  const handleRenameShoppingList = async (id: string) => {
    if (!editName.trim()) return;
    setRenaming(true);
    setRenameError('');
    try {
      await shoppingListApi.update(id, editName.trim());
      setEditingShoppingListId(null);
      setRenameError('');
      await fetchLists();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { message?: string } } };
      if (axiosErr.response?.status === 400 || axiosErr.response?.status === 409) {
        setRenameError(axiosErr.response.data?.message || 'Failed to rename shopping list');
      } else {
        setRenameError('Failed to rename shopping list. Please try again.');
      }
    } finally {
      setRenaming(false);
    }
  };

  const cancelTaskListEdit = () => {
    setEditingTaskListId(null);
    setRenameError('');
  };

  const cancelShoppingListEdit = () => {
    setEditingShoppingListId(null);
    setRenameError('');
  };

  const handleDeleteTaskList = async (id: string) => {
    try {
      await taskListApi.remove(id);
      await fetchLists();
    } catch {
      setError('Failed to delete task list');
    }
  };

  const handleDeleteShoppingList = async (id: string) => {
    // Capture the full entity payload BEFORE deleting so it can be restored.
    const deletedList = shoppingLists.find((l) => l.id === id);
    try {
      await shoppingListApi.remove(id);
      await fetchLists();
      if (deletedList) {
        // Offer an Undo_Snackbar bound to the captured payload. The restore
        // endpoint recreates the list from its original id via ON CONFLICT DO NOTHING.
        showUndo({
          itemName: deletedList.name,
          actionDescription: 'Shopping list deleted',
          onUndo: async () => {
            await shoppingListApi.restore({
              id: deletedList.id,
              name: deletedList.name,
              isDefault: deletedList.isDefault,
              createdAt: deletedList.createdAt,
            });
            await fetchLists();
          },
        });
      }
    } catch {
      setError('Failed to delete shopping list');
    }
  };

  if (loading) return <p className="loading-state">Loading lists...</p>;

  return (
    <div className="settings-section">
      <h2>Lists</h2>
      {error && <p className="error-state">{error}</p>}

      <h3 className="settings-subsection-title">Task Lists</h3>
      <div className="settings-list">
        {taskLists.map((list) => (
          <div key={list.id} className="settings-list-item">
            {editingTaskListId === list.id ? (
              <div className="settings-inline-edit">
                <div style={{ flex: 1 }}>
                  <input
                    ref={editInputRef}
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !renaming) handleRenameTaskList(list.id);
                      if (e.key === 'Escape') cancelTaskListEdit();
                    }}
                    onBlur={() => { if (!renaming) cancelTaskListEdit(); }}
                    maxLength={100}
                    autoFocus
                    disabled={renaming}
                  />
                  {renameError && editingTaskListId === list.id && (
                    <p className="error-state" style={{ margin: '4px 0 0', fontSize: '0.8rem' }}>{renameError}</p>
                  )}
                </div>
                <button
                  className="btn btn--primary"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleRenameTaskList(list.id)}
                  disabled={renaming}
                >
                  {renaming ? '...' : 'Save'}
                </button>
                <button
                  className="btn btn--secondary"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={cancelTaskListEdit}
                  disabled={renaming}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <span className="settings-list-name">
                  {list.name}
                  {list.isDefault && <span className="settings-badge">default</span>}
                </span>
                <div className="settings-list-actions">
                  <button
                    className="btn btn--text"
                    onClick={() => { setEditingTaskListId(list.id); setEditName(list.name); setRenameError(''); }}
                  >
                    ✏️ Rename
                  </button>
                  {!list.isDefault && (
                    <button
                      className="btn btn--text settings-btn-danger"
                      onClick={() => handleDeleteTaskList(list.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="settings-add-form">
        <input
          type="text"
          placeholder="New task list name"
          value={newTaskListName}
          onChange={(e) => setNewTaskListName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddTaskList()}
        />
        <button className="btn btn--primary" onClick={handleAddTaskList} disabled={!newTaskListName.trim()}>
          Add List
        </button>
      </div>

      <h3 className="settings-subsection-title">Shopping Lists</h3>
      <div className="settings-list">
        {shoppingLists.map((list) => (
          <div key={list.id} className="settings-list-item">
            {editingShoppingListId === list.id ? (
              <div className="settings-inline-edit">
                <div style={{ flex: 1 }}>
                  <input
                    ref={editInputRef}
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !renaming) handleRenameShoppingList(list.id);
                      if (e.key === 'Escape') cancelShoppingListEdit();
                    }}
                    onBlur={() => { if (!renaming) cancelShoppingListEdit(); }}
                    maxLength={100}
                    autoFocus
                    disabled={renaming}
                  />
                  {renameError && editingShoppingListId === list.id && (
                    <p className="error-state" style={{ margin: '4px 0 0', fontSize: '0.8rem' }}>{renameError}</p>
                  )}
                </div>
                <button
                  className="btn btn--primary"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleRenameShoppingList(list.id)}
                  disabled={renaming}
                >
                  {renaming ? '...' : 'Save'}
                </button>
                <button
                  className="btn btn--secondary"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={cancelShoppingListEdit}
                  disabled={renaming}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <span className="settings-list-name">
                  {list.name}
                  {list.isDefault && <span className="settings-badge">default</span>}
                </span>
                <div className="settings-list-actions">
                  <button
                    className="btn btn--text"
                    onClick={() => { setEditingShoppingListId(list.id); setEditName(list.name); setRenameError(''); }}
                  >
                    ✏️ Rename
                  </button>
                  {!list.isDefault && (
                    <button
                      className="btn btn--text settings-btn-danger"
                      onClick={() => handleDeleteShoppingList(list.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="settings-add-form">
        <input
          type="text"
          placeholder="New shopping list name"
          value={newShoppingListName}
          onChange={(e) => setNewShoppingListName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddShoppingList()}
        />
        <button className="btn btn--primary" onClick={handleAddShoppingList} disabled={!newShoppingListName.trim()}>
          Add List
        </button>
      </div>
    </div>
  );
};

// ===========================================================================
// BackupRestore
// ===========================================================================

const BackupRestore: React.FC = () => {
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  // Read-only scheduled-backup config status (from add-on options; null while
  // loading, 'unavailable' if the request fails so the panel never crashes).
  const [backupConfig, setBackupConfig] = useState<BackupStatus | null>(null);
  const [backupConfigUnavailable, setBackupConfigUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .getBackupConfig()
      .then((cfg) => {
        if (!cancelled) setBackupConfig(cfg);
      })
      .catch(() => {
        if (!cancelled) setBackupConfigUnavailable(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleExport = async () => {
    setExporting(true);
    setStatus(null);
    try {
      const blob = await adminApi.exportBackup();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `household-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus({ type: 'success', message: 'Backup exported successfully.' });
    } catch {
      setStatus({ type: 'error', message: 'Failed to export backup.' });
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Read file first
    let data: unknown;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      data = json.data || json;
    } catch {
      setStatus({ type: 'error', message: 'Failed to read file. Make sure it is a valid backup JSON.' });
      e.target.value = '';
      return;
    }

    // Confirm before restoring
    const confirmed = window.confirm(
      'WARNING: Restoring a backup will REPLACE all existing data (tasks, shopping items, users, history) with the contents of this file.\n\nThis action cannot be undone.\n\nAre you sure you want to proceed?'
    );

    if (!confirmed) {
      e.target.value = '';
      return;
    }

    setImporting(true);
    setStatus(null);
    try {
      await adminApi.importBackup(data);
      setStatus({ type: 'success', message: 'Backup restored successfully.' });
    } catch {
      setStatus({ type: 'error', message: 'Failed to restore backup.' });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div className="settings-section">
      <h2>Backup & Restore</h2>
      {status && (
        <p className={status.type === 'success' ? 'loading-state' : 'error-state'}>
          {status.message}
        </p>
      )}

      <p style={{ marginBottom: 16, color: 'var(--color-text-secondary)' }}>
        Export all data as a JSON file, or restore from a previously exported backup.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <button
            className="btn btn--primary"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? 'Exporting...' : '📦 Export Backup'}
          </button>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
            Import from file:
          </label>
          <input
            type="file"
            accept=".json"
            onChange={handleImport}
            disabled={importing}
            style={{ fontSize: '0.875rem' }}
          />
          {importing && <p style={{ marginTop: 8, fontSize: '0.875rem' }}>Restoring...</p>}
        </div>
      </div>

      <p className="settings-warning">
        ⚠️ Restoring a backup will replace all existing data. This action cannot be undone.
      </p>

      <h3 style={{ marginTop: 24, marginBottom: 8, fontSize: '1rem' }}>Scheduled Backups</h3>
      <p style={{ marginBottom: 12, color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
        These settings are configured in the add-on options and applied on restart (like the
        admin API secret). The encryption key is never shown here.
      </p>
      {backupConfigUnavailable ? (
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', fontStyle: 'italic' }}>
          Backup status unavailable.
        </p>
      ) : backupConfig === null ? (
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Loading backup status…</p>
      ) : (
        <div className="settings-list">
          <div className="settings-list-item">
            <span className="settings-list-name">Scheduled backups</span>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
              {backupConfig.enabled ? '✅ Enabled' : '⚪ Disabled'}
            </span>
          </div>
          <div className="settings-list-item">
            <span className="settings-list-name">Schedule</span>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', textTransform: 'capitalize' }}>
              {backupConfig.schedule}
            </span>
          </div>
          <div className="settings-list-item">
            <span className="settings-list-name">Encryption</span>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
              {backupConfig.encryptionEnabled ? '✅ Enabled' : '⚪ Disabled'}
            </span>
          </div>
          <div className="settings-list-item">
            <span className="settings-list-name">Encryption key</span>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
              {backupConfig.hasEncryptionKey ? '🔑 Configured' : '— Not set'}
            </span>
          </div>
          <div className="settings-list-item">
            <span className="settings-list-name">Retention count</span>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
              {backupConfig.retentionCount}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// ===========================================================================
// AboutSection
// ===========================================================================

const APP_VERSION = '1.5.0';

const AboutSection: React.FC = () => {
  const [serverInfo, setServerInfo] = useState<{ status: string; database?: string } | null>(null);

  useEffect(() => {
    fetch('./health/db')
      .then((res) => res.json())
      .then((data) => setServerInfo(data))
      .catch(() => setServerInfo(null));
  }, []);

  return (
    <div className="settings-section">
      <h2>About</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span style={{ fontSize: '2rem' }}>🏠</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Household Management</h3>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
              Home Assistant Add-on
            </p>
          </div>
        </div>

        <div className="settings-list">
          <div className="settings-list-item">
            <span className="settings-list-name">Version</span>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>{APP_VERSION}</span>
          </div>
          <div className="settings-list-item">
            <span className="settings-list-name">Database</span>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
              {serverInfo?.database === 'connected' ? '✅ Connected' : serverInfo?.database === 'error' ? '❌ Error' : '⏳ Checking...'}
            </span>
          </div>
          <div className="settings-list-item">
            <span className="settings-list-name">Platform</span>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Home Assistant (Ingress)</span>
          </div>
          <div className="settings-list-item">
            <span className="settings-list-name">Stack</span>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>React + Node.js + PostgreSQL</span>
          </div>
        </div>

        <div style={{ marginTop: 8 }}>
          <a
            href="https://github.com/alexlindl/Home-Tool"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--color-primary)', textDecoration: 'none', fontSize: '0.875rem' }}
          >
            📋 View on GitHub →
          </a>
        </div>

        <p style={{ marginTop: 8, color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>
          Manage household tasks and shopping lists directly from Home Assistant.
        </p>
      </div>
    </div>
  );
};

// ===========================================================================
// ActivityLog
// ===========================================================================

const getEventIcon = (type: ActivityEntry['type'] | string): string => {
  switch (type) {
    case 'task_completed': return '✅';
    case 'item_purchased': return '🛒';
    case 'task_created': return '📝';
    case 'task_edited': return '✏️';
    case 'task_deleted': return '🗑️';
    case 'shopping_item_added': return '➕';
    case 'shopping_item_edited': return '✏️';
    case 'shopping_item_removed': return '➖';
    default: return '📋';
  }
};

const getEventLabel = (type: ActivityEntry['type'] | string): string => {
  switch (type) {
    case 'task_completed': return 'completed task';
    case 'item_purchased': return 'purchased item';
    case 'task_created': return 'created task';
    case 'task_edited': return 'edited task';
    case 'task_deleted': return 'deleted task';
    case 'shopping_item_added': return 'added shopping item';
    case 'shopping_item_edited': return 'edited shopping item';
    case 'shopping_item_removed': return 'removed shopping item';
    default: return 'performed action';
  }
};

const ActivityLog: React.FC = () => {
  const [users, setUsers] = useState<Record<string, string>>({});
  const [usersError, setUsersError] = useState('');

  // Cursor-paginated activity feed with load-more + infinite scroll.
  // Default Page_Size (50) is applied server-side when limit is omitted.
  const fetchActivityPage = useCallback(
    (cursor?: string) => activityApi.getActivityPaginated(cursor),
    [],
  );
  const {
    items: entries,
    loading,
    loadingMore,
    hasMore,
    error: feedError,
    loadMore,
    sentinelRef,
  } = useInfiniteScroll<PaginatedActivityEntry>(fetchActivityPage, []);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersData = await userApi.getAllUsers();
        const userMap: Record<string, string> = {};
        for (const u of usersData) {
          userMap[u.id] = u.name;
        }
        setUsers(userMap);
        setUsersError('');
      } catch {
        setUsersError('Failed to load activity');
      }
    };
    void fetchUsers();
  }, []);

  const error = feedError ?? usersError;

  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) return <p className="loading-state">Loading activity...</p>;

  return (
    <div className="settings-section">
      <h2>Activity</h2>
      <p style={{ marginBottom: 16, color: 'var(--color-text-secondary)' }}>
        Recent activity across the household.
      </p>

      {error && <p className="error-state">{error}</p>}

      {entries.length === 0 && !error && (
        <div className="empty-state">
          <p>No activity yet.</p>
        </div>
      )}

      {entries.length > 0 && (
        <div className="settings-list">
          {entries.map((entry) => (
            <div key={entry.id} className="settings-list-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <span style={{ fontSize: '1.1rem' }}>
                  {getEventIcon(entry.type)}
                </span>
                <span className="settings-list-name" style={{ flex: 1 }}>
                  {entry.title}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                  {formatTimestamp(entry.timestamp)}
                </span>
              </div>
              <div style={{ paddingLeft: 28, fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                {entry.userId ? (users[entry.userId] ?? 'Unknown') : 'System'} — {getEventLabel(entry.type)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Infinite-scroll sentinel: loading the next page when scrolled near the end. */}
      {hasMore && <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />}

      {/* Explicit load-more control + "more available" indicator (Req 5.5, 5.6). */}
      {hasMore && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
};

// ===========================================================================
// DashboardIntegrationTab (wrapper that fetches users for DashboardIntegration)
// ===========================================================================

const DashboardIntegrationTab: React.FC = () => {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await userApi.getAllUsers();
        setUsers(data);
        setError('');
      } catch {
        setError('Failed to load users');
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  if (loading) return <p className="loading-state">Loading dashboard integration...</p>;
  if (error) return <p className="error-state">{error}</p>;
  if (users.length === 0) return <p className="loading-state">No users found. Add users first.</p>;

  const currentUserId = currentUser?.id || users[0]?.id || '';

  return <DashboardIntegration users={users} currentUserId={currentUserId} />;
};

// ===========================================================================
// Settings Page (Main)
// ===========================================================================

export const Settings: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SettingsTab>('templates');

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button
          className="settings-back"
          onClick={() => navigate('/')}
          aria-label="Back to app"
        >
          ← Back
        </button>
        <h1 className="settings-title">Settings</h1>
      </div>

      <div className="settings-tabs" role="tablist" aria-label="Settings sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`settings-tab ${activeTab === tab.id ? 'settings-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="settings-content" role="tabpanel" aria-label={`${activeTab} settings`}>
        {activeTab === 'users' && (
          <>
            <UserManagement />
            <DefaultListPreference />
          </>
        )}
        {activeTab === 'database' && <DatabaseManagement />}
        {activeTab === 'categories' && <CategoryManagement />}
        {activeTab === 'templates' && <TemplateManagement />}
        {activeTab === 'lists' && <ListManagement />}
        {activeTab === 'activity' && <ActivityLog />}
        {activeTab === 'dashboard' && <DashboardIntegrationTab />}
        {activeTab === 'backup' && <BackupRestore />}
        {activeTab === 'theme' && <ThemeSelector />}
        {activeTab === 'about' && <AboutSection />}
      </div>
    </div>
  );
};
