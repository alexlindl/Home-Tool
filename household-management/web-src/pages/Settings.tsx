/**
 * Settings Page
 * Administrative interface with tabbed sub-section navigation.
 * Contains inline sub-components for Users, Database, Categories, Templates, Port.
 *
 * Requirements: 16.1, 17.1, 18.1, 19.1, 20.1
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  userApi,
  adminApi,
  categoryApi,
  templateApi,
  taskApi,
  shoppingApi,
  taskListApi,
  shoppingListApi,
  CategoryRecord,
} from '@/services/api';
import type { User, TaskTemplate, ItemTemplate, TaskList, ShoppingList } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import DashboardIntegration from '@/components/DashboardIntegration';

type SettingsTab = 'users' | 'database' | 'categories' | 'templates' | 'lists' | 'backup' | 'theme' | 'dashboard' | 'about';

const tabs: { id: SettingsTab; label: string }[] = [
  { id: 'templates', label: 'Templates' },
  { id: 'categories', label: 'Categories' },
  { id: 'users', label: 'Users' },
  { id: 'lists', label: 'Lists' },
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
// DatabaseManagement
// ===========================================================================

const DatabaseManagement: React.FC = () => {
  const [clearHistory, setClearHistory] = useState(false);
  const [clearTasks, setClearTasks] = useState(false);
  const [clearShopping, setClearShopping] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const nothingSelected = !clearHistory && !clearTasks && !clearShopping;

  const handleReset = async () => {
    if (confirmText !== 'RESET') return;
    setLoading(true);
    try {
      const result = await adminApi.resetDatabase({
        confirm: true,
        clearHistory: clearHistory || undefined,
        clearTasks: clearTasks || undefined,
        clearShopping: clearShopping || undefined,
      });
      setStatus({ type: 'success', message: `Reset completed. Cleared: ${result.cleared.join(', ')}` });
      setShowConfirm(false);
      setConfirmText('');
      setClearHistory(false);
      setClearTasks(false);
      setClearShopping(false);
    } catch {
      setStatus({ type: 'error', message: 'Failed to reset database' });
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
            <input type="checkbox" checked={clearHistory} onChange={(e) => setClearHistory(e.target.checked)} />
            Clear Task History
          </label>
        </div>
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

const CategoryManagement: React.FC = () => {
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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
    try {
      await categoryApi.remove(id);
      setConfirmDeleteId(null);
      await fetchCategories();
    } catch {
      setError('Failed to delete category');
    }
  };

  if (loading) return <p className="loading-state">Loading categories...</p>;

  return (
    <div className="settings-section">
      <h2>Categories</h2>
      {error && <p className="error-state">{error}</p>}

      <div className="settings-list">
        {categories.map((cat) => (
          <div key={cat.id} className="settings-list-item">
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
          </div>
        ))}
      </div>

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
            <p>Are you sure you want to delete this category? Items using it will be reassigned to "household".</p>
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

const THEME_STORAGE_KEY = 'household_theme';

const ThemeSelector: React.FC = () => {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    return (localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode) || 'system';
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

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme, applyTheme]);

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
    </div>
  );
};

// ===========================================================================
// ListManagement
// ===========================================================================

const ListManagement: React.FC = () => {
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
    try {
      await shoppingListApi.remove(id);
      await fetchLists();
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
    </div>
  );
};

// ===========================================================================
// AboutSection
// ===========================================================================

const APP_VERSION = '0.6.2-alpha';

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
        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'database' && <DatabaseManagement />}
        {activeTab === 'categories' && <CategoryManagement />}
        {activeTab === 'templates' && <TemplateManagement />}
        {activeTab === 'lists' && <ListManagement />}
        {activeTab === 'dashboard' && <DashboardIntegrationTab />}
        {activeTab === 'backup' && <BackupRestore />}
        {activeTab === 'theme' && <ThemeSelector />}
        {activeTab === 'about' && <AboutSection />}
      </div>
    </div>
  );
};
