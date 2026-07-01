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
} from '@/types';

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------

const BASE_URL = import.meta.env.VITE_API_BASE_URL || './api';

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

  /** Get task templates */
  async getTemplates(): Promise<TaskTemplate[]> {
    const response = await apiClient.get<{ templates: TaskTemplate[] }>('/tasks/templates');
    return response.data.templates;
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

  /** Get item templates */
  async getTemplates(): Promise<ItemTemplate[]> {
    const response = await apiClient.get<{ templates: ItemTemplate[] }>('/shopping/templates');
    return response.data.templates;
  },
};

// ---------------------------------------------------------------------------
// Admin API
// ---------------------------------------------------------------------------

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
    );
    return response.data;
  },

  /** Get current server config */
  async getConfig(): Promise<{ port: number }> {
    const response = await apiClient.get<{ port: number }>('/admin/config');
    return response.data;
  },

  /** Update server config (port) */
  async updateConfig(config: { port: number }): Promise<{ message: string; port: number; restartRequired: boolean }> {
    const response = await apiClient.put<{ message: string; port: number; restartRequired: boolean }>(
      '/admin/config',
      config,
    );
    return response.data;
  },

  /** Export full database backup as JSON blob */
  async exportBackup(): Promise<Blob> {
    const response = await apiClient.get('/admin/backup', { responseType: 'blob' });
    return response.data;
  },

  /** Import a backup JSON file */
  async importBackup(data: unknown): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>('/admin/restore', { data, confirm: true });
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
}

export const categoryApi = {
  /** Get all categories */
  async getAll(): Promise<CategoryRecord[]> {
    const response = await apiClient.get<{ categories: CategoryRecord[] }>('/categories');
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

  /** Delete a category */
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/categories/${id}`);
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
};
