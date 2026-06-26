/**
 * TypeScript interfaces for the Household Management App web client.
 * These types mirror the backend models in backend/src/models/
 */

// ============================================================
// User Types
// ============================================================

/**
 * User model - represents a household member
 */
export interface User {
  id: string;
  name: 'Alex' | 'Becky' | 'Sam';
  createdAt: string; // ISO date string from API
}

// ============================================================
// Task Types
// ============================================================

/**
 * Legacy recurrence pattern for recurring tasks
 */
export interface RecurrencePattern {
  frequency: 'daily' | 'weekly' | 'monthly';
  interval: number; // e.g., every 2 weeks
  endDate?: string; // ISO date string
}

/**
 * Enhanced recurrence pattern (new format)
 */
export interface EnhancedRecurrencePattern {
  type: 'every_n_days' | 'every_specific_day' | 'every_nth_day' | 'every_n_weeks_on_day';
  interval: number;
  dayOfWeek?: string;
  ordinalWeek?: number;
  endDate?: string;
}

/**
 * Combined recurrence pattern type (accepts legacy or enhanced)
 */
export type AnyRecurrencePattern = RecurrencePattern | EnhancedRecurrencePattern;

/**
 * Task model - represents a chore or activity
 */
export interface Task {
  id: string;
  title: string;
  description?: string;
  assignedTo: string | null; // User ID or null for "Anyone"
  createdBy: string; // User ID
  dueDate: string | null; // ISO date string, null for backlog tasks
  isRecurring: boolean;
  recurrencePattern?: RecurrencePattern;
  status: 'pending' | 'completed';
  completedAt?: string; // ISO date string
  completedBy?: string; // User ID
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

/**
 * Task template model - pre-populated or previously created task definitions
 */
export interface TaskTemplate {
  id: string;
  title: string;
  description?: string;
  isPrePopulated: boolean;
  createdBy?: string; // User ID for custom templates
  usageCount: number;
  createdAt: string; // ISO date string
}

/**
 * Task history model - record of completed tasks
 */
export interface TaskHistory {
  id: string;
  taskId: string;
  title: string;
  assignedTo: string | null; // User ID or null for "Anyone" tasks
  completedBy: string; // User ID
  completedAt: string; // ISO date string
  wasRecurring: boolean;
}

// ============================================================
// Shopping Types
// ============================================================

/**
 * Valid categories for shopping items.
 * Widened to string — categories are now managed dynamically via /api/categories.
 */
export type Category = string;

/**
 * Shopping item model
 */
export interface ShoppingItem {
  id: string;
  name: string;
  category: Category;
  addedBy: string; // User ID
  isPurchased: boolean;
  purchasedBy?: string; // User ID
  purchasedAt?: string; // ISO date string
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

/**
 * Item template model - pre-populated or previously created shopping item definitions
 */
export interface ItemTemplate {
  id: string;
  name: string;
  category: Category;
  isPrePopulated: boolean;
  createdBy?: string; // User ID for custom templates
  usageCount: number;
  createdAt: string; // ISO date string
}

// ============================================================
// API Request Types
// ============================================================

/**
 * Input for creating a new task
 */
export interface CreateTaskInput {
  title: string;
  description?: string;
  assignedTo: string | null; // User ID or null for "Anyone"
  dueDate: string | null; // ISO date string, null for backlog tasks
  isRecurring: boolean;
  recurrencePattern?: AnyRecurrencePattern;
  saveAsTemplate?: boolean; // opt-in template saving
}

/**
 * Input for updating an existing task
 */
export interface UpdateTaskInput {
  title?: string;
  description?: string;
  assignedTo?: string;
  dueDate?: string;
  isRecurring?: boolean;
  recurrencePattern?: AnyRecurrencePattern;
}

/**
 * Input for adding a shopping item
 */
export interface AddShoppingItemInput {
  name: string;
  category: Category;
}

/**
 * Input for updating a shopping item
 */
export interface UpdateShoppingItemInput {
  name?: string;
  category?: Category;
}

// ============================================================
// API Response Types
// ============================================================

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

/**
 * Error response from the API
 */
export interface ApiErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Tasks list response
 */
export type TasksResponse = ApiResponse<Task[]>;

/**
 * Single task response
 */
export type TaskResponse = ApiResponse<Task>;

/**
 * Task templates response
 */
export type TaskTemplatesResponse = ApiResponse<TaskTemplate[]>;

/**
 * Task history response
 */
export type TaskHistoryResponse = ApiResponse<TaskHistory[]>;

/**
 * Shopping list response
 */
export type ShoppingResponse = ApiResponse<ShoppingItem[]>;

/**
 * Single shopping item response
 */
export type ShoppingItemResponse = ApiResponse<ShoppingItem>;

/**
 * Item templates response
 */
export type ItemTemplatesResponse = ApiResponse<ItemTemplate[]>;

/**
 * Users list response
 */
export type UsersResponse = ApiResponse<User[]>;

// ============================================================
// WebSocket Event Types
// ============================================================

/**
 * WebSocket events emitted by the client
 */
export interface ClientSocketEvents {
  'task:created': Task;
  'task:updated': Task;
  'task:completed': { taskId: string; userId: string };
  'shopping:added': ShoppingItem;
  'shopping:purchased': { itemId: string; userId: string };
}

/**
 * WebSocket events received from the server
 */
export interface ServerSocketEvents {
  'task:sync': Task[];
  'shopping:sync': ShoppingItem[];
  'reminder:notify': { taskId: string; type: 'upcoming' | 'overdue' };
}

// ============================================================
// Filter Types
// ============================================================

/**
 * Task filter options
 */
export interface TaskFilters {
  assignedTo?: string; // User ID
  status?: 'pending' | 'completed';
  isRecurring?: boolean;
  listId?: string;
}

// ============================================================
// List Types
// ============================================================

/**
 * Task list model - represents a named collection of tasks
 */
export interface TaskList {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
}

/**
 * Shopping list model - represents a named collection of shopping items
 */
export interface ShoppingList {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
}
