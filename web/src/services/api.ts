/**
 * API Client Service
 * Axios-based HTTP client for communicating with the Household Management backend.
 *
 * Requirements: 12.4, 11.4
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  User,
  Task,
  TaskTemplate,
  TaskHistory,
  ShoppingItem,
  ItemTemplate,
  CreateTaskInput,
  UpdateTaskInput,
  AddShoppingItemInput,
  UpdateShoppingItemInput,
  TaskFilters,
  Category,
  TaskList,
  ShoppingList,
  ShoppingSearchResult,
  PaginatedResponse,
  BackupStatus,
  Recipe,
  CreateRecipeInput,
  UpdateRecipeInput,
  AddIngredientsResult,
} from '@/types';

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------

// Detect base path for ingress: use the current page's directory as base for API calls.
// Under HA ingress the page loads at /api/hassio_ingress/<token>/ and API lives at ./api/
// Under direct access the page loads at / and API lives at /api/
function detectApiBase(): string {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  // Get the pathname directory (ensures trailing slash)
  const pathname = window.location.pathname;
  const base = pathname.endsWith('/') ? pathname : pathname.substring(0, pathname.lastIndexOf('/') + 1);
  return `${base}api`;
}

const BASE_URL = detectApiBase();

const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ---------------------------------------------------------------------------
// Request / Response interceptors
// ---------------------------------------------------------------------------

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config;

    // Simple retry logic: retry once on network errors or 5xx
    if (
      config &&
      !(config as unknown as Record<string, unknown>)['__retried'] &&
      (error.code === 'ECONNABORTED' ||
        !error.response ||
        (error.response.status >= 500 && error.response.status < 600))
    ) {
      (config as unknown as Record<string, unknown>)['__retried'] = true;
      return apiClient(config);
    }

    return Promise.reject(error);
  },
);

// ---------------------------------------------------------------------------
// User API
// ---------------------------------------------------------------------------

export const userApi = {
  /** Get all users (Alex, Becky, Sam) */
  async getAllUsers(): Promise<User[]> {
    const response = await apiClient.get<{ users: User[] }>('/users');
    return response.data.users;
  },

  /** Select the current user by ID or name */
  async selectUser(name: string): Promise<void> {
    await apiClient.post('/users/select', { userName: name });
  },

  /**
   * GET /api/auth/me — attempt auto-login via HA ingress header.
   * Returns the matched user or null if no match / not in ingress.
   */
  async getAuthMe(): Promise<User | null> {
    const response = await apiClient.get<{ user: User | null }>('/auth/me');
    return response.data.user;
  },

  /** Create a new user */
  async createUser(name: string): Promise<User> {
    const response = await apiClient.post<{ user: User }>('/users', { name });
    return response.data.user;
  },

  /** Rename a user */
  async updateUser(id: string, name: string): Promise<User> {
    const response = await apiClient.put<{ user: User }>(`/users/${id}`, { name });
    return response.data.user;
  },

  /** Delete a user */
  async deleteUser(id: string): Promise<void> {
    await apiClient.delete(`/users/${id}`);
  },

  /** Link or unlink a Home Assistant username */
  async patchHaLink(id: string, haUsername: string): Promise<User> {
    const response = await apiClient.patch<{ user: User }>(`/users/${id}/ha-link`, { haUsername });
    return response.data.user;
  },

  /** Fetch HA person entities for linking dropdown */
  async getHaUsers(): Promise<{ entityId: string; name: string; userId: string | null }[]> {
    const response = await apiClient.get<{ users: { entityId: string; name: string; userId: string | null }[] }>('/users/ha-users');
    return response.data.users;
  },
};

// ---------------------------------------------------------------------------
// Task API
// ---------------------------------------------------------------------------

export const taskApi = {
  /** Move a task to a different list */
  async moveTask(id: string, targetListId: string): Promise<Task> {
    const response = await apiClient.patch<{ task: Task }>(`/tasks/${id}/move`, { targetListId });
    return response.data.task;
  },

  /** Get tasks with optional filters */
  async getTasks(filters?: TaskFilters): Promise<Task[]> {
    const params: Record<string, string> = {};
    if (filters?.assignedTo) params.assignedTo = filters.assignedTo;
    if (filters?.status) params.status = filters.status;
    if (filters?.isRecurring !== undefined) params.isRecurring = String(filters.isRecurring);
    if (filters?.listId) params.listId = filters.listId;

    const response = await apiClient.get<{ tasks: Task[] }>('/tasks', { params });
    return response.data.tasks;
  },

  /** Get a specific task by ID */
  async getTask(id: string): Promise<Task> {
    const response = await apiClient.get<{ task: Task }>(`/tasks/${id}`);
    return response.data.task;
  },

  /** Create a new task */
  async createTask(input: CreateTaskInput & { createdBy: string }): Promise<Task> {
    const response = await apiClient.post<{ task: Task }>('/tasks', input);
    return response.data.task;
  },

  /** Update an existing task */
  async updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
    const response = await apiClient.put<{ task: Task }>(`/tasks/${id}`, input);
    return response.data.task;
  },

  /** Delete a task */
  async deleteTask(id: string): Promise<void> {
    await apiClient.delete(`/tasks/${id}`);
  },

  /**
   * Restore (recreate) a previously deleted task from a full payload including
   * its original id. Backed by `POST /api/tasks/restore` which uses
   * `INSERT ... ON CONFLICT (id) DO NOTHING`, so restoring a task that still
   * exists is a harmless no-op success. Used by the Undo_Snackbar undo action.
   */
  async restoreTask(payload: Record<string, unknown>): Promise<void> {
    await apiClient.post('/tasks/restore', payload);
  },

  /** Mark a task as complete */
  async completeTask(id: string, userId: string): Promise<void> {
    await apiClient.post(`/tasks/${id}/complete`, { userId });
  },

  /** Revert a completed task back to pending */
  async uncompleteTask(id: string): Promise<Task> {
    const response = await apiClient.post<{ task: Task }>(`/tasks/${id}/uncomplete`);
    return response.data.task;
  },

  /** Get task history (completed tasks) */
  async getHistory(days?: number): Promise<TaskHistory[]> {
    const params: Record<string, string> = {};
    if (days !== undefined) params.days = String(days);

    const response = await apiClient.get<{ history: TaskHistory[] }>('/tasks/history', { params });
    return response.data.history;
  },

  /**
   * Get a cursor-paginated page of task history (completed tasks).
   * Returns a PaginatedResponse envelope: `{ items, nextCursor, pageSize }`.
   * Pass `cursor` from a previous response's `nextCursor` to fetch the next
   * page; omit `limit` to use the backend default Page_Size (50).
   */
  async getHistoryPaginated(cursor?: string, limit?: number): Promise<PaginatedResponse<TaskHistory>> {
    const params: Record<string, string> = {};
    if (cursor) params.cursor = cursor;
    if (limit !== undefined) params.limit = String(limit);

    const response = await apiClient.get<PaginatedResponse<TaskHistory>>('/tasks/history/paginated', { params });
    return response.data;
  },

  /** Get task templates */
  async getTemplates(): Promise<TaskTemplate[]> {
    const response = await apiClient.get<{ templates: TaskTemplate[] }>('/tasks/templates');
    return response.data.templates;
  },

  /** Search distinct task titles for autocomplete */
  async searchTitles(q: string): Promise<string[]> {
    const response = await apiClient.get<{ titles: string[] }>('/tasks/titles', { params: { q } });
    return response.data.titles;
  },
};

// ---------------------------------------------------------------------------
// Shopping API
// ---------------------------------------------------------------------------

export const shoppingApi = {
  /** Move a shopping item to a different list */
  async moveItem(id: string, targetListId: string): Promise<ShoppingItem> {
    const response = await apiClient.patch<{ item: ShoppingItem }>(`/shopping/${id}/move`, { targetListId });
    return response.data.item;
  },

  /** Get shopping list with optional category and list filter */
  async getList(category?: Category, listId?: string): Promise<ShoppingItem[]> {
    const params: Record<string, string> = {};
    if (category) params.category = category;
    if (listId) params.listId = listId;

    const response = await apiClient.get<{ items: ShoppingItem[] }>('/shopping', { params });
    return response.data.items;
  },

  /** Get a specific shopping item by ID */
  async getItem(id: string): Promise<ShoppingItem> {
    const response = await apiClient.get<{ item: ShoppingItem }>(`/shopping/${id}`);
    return response.data.item;
  },

  /** Add a new shopping item */
  async addItem(input: AddShoppingItemInput & { addedBy: string; listId?: string }): Promise<ShoppingItem> {
    const response = await apiClient.post<{ item: ShoppingItem }>('/shopping', input);
    return response.data.item;
  },

  /** Add a shopping item from a template */
  async addItemFromTemplate(templateId: string, addedBy: string, listId?: string): Promise<ShoppingItem> {
    const response = await apiClient.post<{ item: ShoppingItem }>('/shopping', {
      templateId,
      addedBy,
      listId,
    });
    return response.data.item;
  },

  /** Update a shopping item */
  async updateItem(id: string, input: UpdateShoppingItemInput): Promise<ShoppingItem> {
    const response = await apiClient.put<{ item: ShoppingItem }>(`/shopping/${id}`, input);
    return response.data.item;
  },

  /** Delete a shopping item */
  async deleteItem(id: string): Promise<void> {
    await apiClient.delete(`/shopping/${id}`);
  },

  /**
   * Restore (recreate) a previously deleted shopping item from a full payload
   * including its original id. Backed by `POST /api/shopping/restore` which uses
   * `INSERT ... ON CONFLICT (id) DO NOTHING`, so restoring an item that still
   * exists is a harmless no-op success. Used by the Undo_Snackbar undo action.
   */
  async restoreItem(payload: Record<string, unknown>): Promise<void> {
    await apiClient.post('/shopping/restore', payload);
  },

  /** Mark a shopping item as purchased */
  async purchaseItem(id: string, userId: string): Promise<ShoppingItem> {
    const response = await apiClient.post<{ item: ShoppingItem }>(`/shopping/${id}/purchase`, {
      userId,
    });
    return response.data.item;
  },

  /** Revert a purchased item back to unpurchased */
  async unpurchaseItem(id: string): Promise<ShoppingItem> {
    const response = await apiClient.post<{ item: ShoppingItem }>(`/shopping/${id}/unpurchase`);
    return response.data.item;
  },

  /** Search shopping items by name for autocomplete */
  async search(q: string): Promise<ShoppingSearchResult[]> {
    const response = await apiClient.get<{ results: ShoppingSearchResult[] }>('/shopping/search', {
      params: { q },
    });
    return response.data.results;
  },

  /** Get recently purchased shopping items for history */
  async getRecentPurchases(days?: number): Promise<ShoppingItem[]> {
    const params: Record<string, string> = {};
    if (days !== undefined) params.days = String(days);

    const response = await apiClient.get<{ items: ShoppingItem[] }>('/shopping/purchases', { params });
    return response.data.items;
  },

  /** Get item templates */
  async getTemplates(): Promise<ItemTemplate[]> {
    const response = await apiClient.get<{ templates: ItemTemplate[] }>('/shopping/templates');
    return response.data.templates;
  },
};

// ---------------------------------------------------------------------------
// Admin API
// ---------------------------------------------------------------------------

/**
 * Resolve the admin shared secret.
 *
 * Priority:
 * 1. Runtime config injected by the add-on at container start
 *    (window.__RUNTIME_CONFIG__.ADMIN_API_SECRET, written by run.sh from the
 *    admin_api_secret add-on option) — no rebuild needed to change it.
 * 2. Build-time VITE_ADMIN_API_SECRET, for local development.
 */
function resolveAdminSecret(): string {
  const runtime = (window as unknown as {
    __RUNTIME_CONFIG__?: { ADMIN_API_SECRET?: string };
  }).__RUNTIME_CONFIG__?.ADMIN_API_SECRET;
  if (runtime && runtime.length > 0) return runtime;
  return import.meta.env.VITE_ADMIN_API_SECRET || '';
}

/**
 * Build request config carrying the admin shared secret when configured.
 *
 * The backend admin guard is opt-in: if ADMIN_API_SECRET is unset on the
 * server, the header is ignored. When a secret is configured, it is sent as
 * X-Admin-Secret so the Settings UI keeps working against a guarded backend.
 */
function adminRequestConfig(extra?: Record<string, unknown>): Record<string, unknown> {
  const secret = resolveAdminSecret();
  const headers = secret ? { 'X-Admin-Secret': secret } : undefined;
  return { ...(extra ?? {}), ...(headers ? { headers } : {}) };
}

export const adminApi = {
  /** Reset database with options */
  async resetDatabase(options: {
    confirm: true;
    clearHistory?: boolean;
    clearTasks?: boolean;
    clearShopping?: boolean;
  }): Promise<{ message: string; cleared: string[] }> {
    const response = await apiClient.post<{ message: string; cleared: string[] }>(
      '/admin/reset',
      options,
      adminRequestConfig(),
    );
    return response.data;
  },

  /** Get current server config */
  async getConfig(): Promise<{ port: number }> {
    const response = await apiClient.get<{ port: number }>('/admin/config', adminRequestConfig());
    return response.data;
  },

  /** Update server config (port) */
  async updateConfig(config: { port: number }): Promise<{ message: string; port: number; restartRequired: boolean }> {
    const response = await apiClient.put<{ message: string; port: number; restartRequired: boolean }>(
      '/admin/config',
      config,
      adminRequestConfig(),
    );
    return response.data;
  },

  /** Export full database backup as JSON blob */
  async exportBackup(): Promise<Blob> {
    const response = await apiClient.get('/admin/backup', adminRequestConfig({ responseType: 'blob' }));
    return response.data;
  },

  /** Import a backup JSON file */
  async importBackup(data: unknown): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>(
      '/admin/restore',
      { data, confirm: true },
      adminRequestConfig(),
    );
    return response.data;
  },

  /**
   * Get the effective scheduled-backup configuration status.
   *
   * Sourced from add-on options (applied on restart); never returns the
   * encryption key value itself, only whether one is present.
   */
  async getBackupConfig(): Promise<BackupStatus> {
    const response = await apiClient.get<BackupStatus>('/admin/backup/config', adminRequestConfig());
    return response.data;
  },

  /**
   * Clear all rows from the Activity_Log.
   *
   * Sends the action-specific confirmation token `activity_log` so a generic
   * confirm cannot clear the wrong table. Guarded by requireAdminSecret, so the
   * admin secret header is attached via adminRequestConfig().
   */
  async clearActivityLog(): Promise<{ message: string; deletedCount: number }> {
    const response = await apiClient.post<{ message: string; deletedCount: number }>(
      '/admin/clear-activity-log',
      { confirm: 'activity_log' },
      adminRequestConfig(),
    );
    return response.data;
  },

  /**
   * Clear all rows from the Task_History.
   *
   * Sends the action-specific confirmation token `task_history` so a generic
   * confirm cannot clear the wrong table. Guarded by requireAdminSecret, so the
   * admin secret header is attached via adminRequestConfig().
   */
  async clearTaskHistory(): Promise<{ message: string; deletedCount: number }> {
    const response = await apiClient.post<{ message: string; deletedCount: number }>(
      '/admin/clear-task-history',
      { confirm: 'task_history' },
      adminRequestConfig(),
    );
    return response.data;
  },

  /**
   * Complete every overdue pending task, applying the existing completion
   * semantics (writes task_history, advances recurring tasks, completes
   * non-recurring tasks). Returns the count of tasks that were completed.
   *
   * Guarded by requireAdminSecret, so the admin secret header is attached via
   * adminRequestConfig().
   */
  async bringTasksUpToDate(userId: string): Promise<{ completedCount: number }> {
    const response = await apiClient.post<{ completedCount: number }>(
      '/admin/bring-tasks-up-to-date',
      { confirm: true, userId },
      adminRequestConfig(),
    );
    return response.data;
  },
};

// ---------------------------------------------------------------------------
// Activity API
// ---------------------------------------------------------------------------

export interface ActivityEntry {
  type: 'task_completed' | 'item_purchased' | 'task_created' | 'task_edited' | 'task_deleted' | 'shopping_item_added' | 'shopping_item_edited' | 'shopping_item_removed';
  title: string;
  userId: string;
  timestamp: string;
}

/**
 * A single Activity_Log entry as returned by the cursor-paginated feed
 * (`GET /api/activity/paginated`). Mirrors the backend `ActivityLogEntry`
 * shape: it carries a stable `id` (used as a React key / tie-break) and a
 * nullable `userId`. `type` is a plain string because the activity_log table
 * may store event types beyond the curated `ActivityEntry` union.
 */
export interface PaginatedActivityEntry {
  id: string;
  type: string;
  title: string;
  userId: string | null;
  timestamp: string;
}

export const activityApi = {
  /** Get activity log for the past N days */
  async getActivity(days: number = 30): Promise<ActivityEntry[]> {
    const response = await apiClient.get<{ entries: ActivityEntry[] }>('/activity', {
      params: { days: String(days) },
    });
    return response.data.entries;
  },

  /**
   * Get a cursor-paginated page of the Activity_Log feed.
   * Returns a PaginatedResponse envelope: `{ items, nextCursor, pageSize }`.
   * Pass `cursor` from a previous response's `nextCursor` to fetch the next
   * page; omit `limit` to use the backend default Page_Size (50).
   */
  async getActivityPaginated(cursor?: string, limit?: number): Promise<PaginatedResponse<PaginatedActivityEntry>> {
    const params: Record<string, string> = {};
    if (cursor) params.cursor = cursor;
    if (limit !== undefined) params.limit = String(limit);

    const response = await apiClient.get<PaginatedResponse<PaginatedActivityEntry>>('/activity/paginated', { params });
    return response.data;
  },

  /** Clear all activity history */
  async clearHistory(): Promise<{ message: string }> {
    const response = await apiClient.delete<{ message: string }>('/activity');
    return response.data;
  },
};

// ---------------------------------------------------------------------------
// Category API
// ---------------------------------------------------------------------------

export interface CategoryRecord {
  id: string;
  name: string;
  is_default: boolean;
  created_at: string;
  sortPosition: number; // required non-negative integer, mirrors API sort_position
}

export const categoryApi = {
  /** Get all categories. When `listId` is provided, categories are ordered by
   *  that list's per-list order (falling back to canonical order for any
   *  category without an explicit per-list position). */
  async getAll(listId?: string): Promise<CategoryRecord[]> {
    const params: Record<string, string> = {};
    if (listId) params.listId = listId;
    const response = await apiClient.get<{ categories: CategoryRecord[] }>('/categories', { params });
    return response.data.categories;
  },

  /** Create a new category */
  async create(name: string): Promise<CategoryRecord> {
    const response = await apiClient.post<{ category: CategoryRecord }>('/categories', { name });
    return response.data.category;
  },

  /** Rename a category */
  async update(id: string, name: string): Promise<CategoryRecord> {
    const response = await apiClient.put<{ category: CategoryRecord }>(`/categories/${id}`, { name });
    return response.data.category;
  },

  /** Update a single category's sort position */
  async updatePosition(id: string, sortPosition: number): Promise<CategoryRecord> {
    const response = await apiClient.put<{ category: CategoryRecord }>(
      `/categories/${id}/position`,
      { sortPosition },
    );
    return response.data.category;
  },

  /** Reorder categories: assign positions matching the submitted id sequence */
  async reorder(orderedIds: string[]): Promise<CategoryRecord[]> {
    const response = await apiClient.put<{ categories: CategoryRecord[] }>(
      '/categories/reorder',
      { orderedIds },
    );
    return response.data.categories;
  },

  /** Delete a category */
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/categories/${id}`);
  },

  /**
   * Restore (recreate) a previously deleted category from a full payload
   * including its original id and `sortPosition`. Backed by
   * `POST /api/categories/restore` which uses `INSERT ... ON CONFLICT (id) DO
   * NOTHING`, so restoring a category that still exists is a harmless no-op
   * success. Used by the Undo_Snackbar undo action.
   */
  async restore(payload: Record<string, unknown>): Promise<void> {
    await apiClient.post('/categories/restore', payload);
  },
};

// ---------------------------------------------------------------------------
// Template API (CRUD for task and shopping templates)
// ---------------------------------------------------------------------------

export const templateApi = {
  /** Update a task template */
  async updateTaskTemplate(id: string, data: { title?: string; description?: string }): Promise<TaskTemplate> {
    const response = await apiClient.put<{ template: TaskTemplate }>(`/tasks/templates/${id}`, data);
    return response.data.template;
  },

  /** Delete a task template */
  async deleteTaskTemplate(id: string): Promise<void> {
    await apiClient.delete(`/tasks/templates/${id}`);
  },

  /** Update a shopping item template */
  async updateItemTemplate(id: string, data: { name?: string; category?: string }): Promise<ItemTemplate> {
    const response = await apiClient.put<{ template: ItemTemplate }>(`/shopping/templates/${id}`, data);
    return response.data.template;
  },

  /** Delete a shopping item template */
  async deleteItemTemplate(id: string): Promise<void> {
    await apiClient.delete(`/shopping/templates/${id}`);
  },
};

// ---------------------------------------------------------------------------
// User Settings API
// ---------------------------------------------------------------------------

export const userSettingsApi = {
  /** Get a per-user setting value */
  async get(userId: string, key: string): Promise<string | null> {
    try {
      const response = await apiClient.get<{ value: string }>(`/user-settings/${userId}/${key}`);
      return response.data.value;
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number } };
      if (axiosErr.response?.status === 404) return null;
      throw err;
    }
  },

  /** Upsert a per-user setting value */
  async put(userId: string, key: string, value: string): Promise<void> {
    await apiClient.put(`/user-settings/${userId}/${key}`, { value });
  },
};

export default apiClient;

// ---------------------------------------------------------------------------
// Task List API
// ---------------------------------------------------------------------------

export const taskListApi = {
  /** Get all task lists */
  async getAll(): Promise<TaskList[]> {
    const response = await apiClient.get<{ lists: TaskList[] }>('/task-lists');
    return response.data.lists;
  },

  /** Create a new task list */
  async create(name: string): Promise<TaskList> {
    const response = await apiClient.post<{ list: TaskList }>('/task-lists', { name });
    return response.data.list;
  },

  /** Rename a task list */
  async update(id: string, name: string): Promise<TaskList> {
    const response = await apiClient.put<{ list: TaskList }>(`/task-lists/${id}`, { name });
    return response.data.list;
  },

  /** Delete a task list */
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/task-lists/${id}`);
  },
};

// ---------------------------------------------------------------------------
// Shopping List API
// ---------------------------------------------------------------------------

export const shoppingListApi = {
  /** Get all shopping lists */
  async getAll(): Promise<ShoppingList[]> {
    const response = await apiClient.get<{ lists: ShoppingList[] }>('/shopping-lists');
    return response.data.lists;
  },

  /** Create a new shopping list */
  async create(name: string): Promise<ShoppingList> {
    const response = await apiClient.post<{ list: ShoppingList }>('/shopping-lists', { name });
    return response.data.list;
  },

  /** Rename a shopping list */
  async update(id: string, name: string): Promise<ShoppingList> {
    const response = await apiClient.put<{ list: ShoppingList }>(`/shopping-lists/${id}`, { name });
    return response.data.list;
  },

  /** Delete a shopping list */
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/shopping-lists/${id}`);
  },

  /**
   * Restore (recreate) a previously deleted shopping list from a full payload
   * including its original id. Backed by `POST /api/shopping-lists/restore`
   * which uses `INSERT ... ON CONFLICT (id) DO NOTHING`, so restoring a list
   * that still exists is a harmless no-op success. Used by the Undo_Snackbar
   * undo action.
   */
  async restore(payload: Record<string, unknown>): Promise<void> {
    await apiClient.post('/shopping-lists/restore', payload);
  },
};

// ---------------------------------------------------------------------------
// Recipe API
// ---------------------------------------------------------------------------

export const recipeApi = {
  /** Get all recipes with their ingredients */
  async getAll(): Promise<Recipe[]> {
    const response = await apiClient.get<{ recipes: Recipe[] }>('/recipes');
    return response.data.recipes;
  },

  /** Get a single recipe by ID */
  async getById(id: string): Promise<Recipe> {
    const response = await apiClient.get<{ recipe: Recipe }>(`/recipes/${id}`);
    return response.data.recipe;
  },

  /** Create a new recipe */
  async create(input: CreateRecipeInput): Promise<Recipe> {
    const response = await apiClient.post<{ recipe: Recipe }>('/recipes', input);
    return response.data.recipe;
  },

  /** Update an existing recipe */
  async update(id: string, input: UpdateRecipeInput): Promise<Recipe> {
    const response = await apiClient.put<{ recipe: Recipe }>(`/recipes/${id}`, input);
    return response.data.recipe;
  },

  /** Delete a recipe */
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/recipes/${id}`);
  },

  /**
   * Add selected recipe ingredients to a shopping list. Omit `ingredientNames`
   * to add every ingredient. Returns the created shopping items plus any
   * skipped ingredient names.
   */
  async addToShopping(
    id: string,
    addedBy: string,
    listId?: string,
    ingredientNames?: string[],
  ): Promise<AddIngredientsResult> {
    const response = await apiClient.post<AddIngredientsResult>(
      `/recipes/${id}/add-to-shopping`,
      { addedBy, listId, ingredientNames },
    );
    return response.data;
  },

  /**
   * Restore (recreate) a previously deleted recipe from a full payload
   * including its original id. Backed by `POST /api/recipes/restore` which uses
   * `INSERT ... ON CONFLICT (id) DO NOTHING`, so restoring a recipe that still
   * exists is a harmless no-op success. Used by the Undo snackbar.
   */
  async restore(payload: Record<string, unknown>): Promise<void> {
    await apiClient.post('/recipes/restore', payload);
  },
};
