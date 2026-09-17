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
  haUsername: string | null;
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
  type: 'every_n_days' | 'every_specific_day' | 'every_nth_day' | 'every_n_weeks_on_day' | 'every_n_months' | 'every_n_years';
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
  recurrenceType?: string; // Enhanced pattern type (every_n_days, every_n_months, etc.)
  recurrenceInterval?: number; // Raw interval value
  status: 'pending' | 'completed';
  completedAt?: string; // ISO date string
  completedBy?: string; // User ID
  notificationLeadHours?: number; // per-task notification override (hours)
  rotationEnabled: boolean; // whether task rotates through users
  rotationUserIds: string[]; // ordered user IDs for rotation
  rotationCurrentIndex: number; // current position in rotation
  listId?: string; // Task list UUID (which list the task belongs to)
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
 * Structured category record as returned by GET /api/categories.
 * Mirrors the API contract; `sortPosition` is a required non-negative integer
 * defining the ascending display order of categories.
 */
export interface CategoryRecord {
  id: string;
  name: string;
  is_default: boolean;
  created_at: string;
  sortPosition: number; // required non-negative integer
}

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
  listId?: string; // Shopping list UUID (which list the item belongs to)
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

/**
 * Shopping search result - returned by the shopping item autocomplete endpoint
 */
export interface ShoppingSearchResult {
  name: string;
  category: string;
  usageCount: number;
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
// User Settings Types
// ============================================================

/**
 * UserSetting model - per-user key/value preference
 */
export interface UserSetting {
  id: string;
  userId: string;
  settingKey: string;
  settingValue: string;
  updatedAt: string; // ISO date string
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
  notificationLeadHours?: number; // per-task notification override (hours)
  saveAsTemplate?: boolean; // opt-in template saving
  rotationEnabled?: boolean; // opt-in rotation through users
  rotationUserIds?: string[]; // ordered user IDs for rotation
  rotationCurrentIndex?: number; // starting position in rotation
}

/**
 * Input for updating an existing task
 */
export interface UpdateTaskInput {
  title?: string;
  description?: string;
  assignedTo?: string;
  dueDate?: string | null; // null to explicitly clear due date
  isRecurring?: boolean;
  recurrencePattern?: AnyRecurrencePattern | null; // null to explicitly clear recurrence
  notificationLeadHours?: number | null; // per-task notification override (hours), null to clear
  rotationEnabled?: boolean; // opt-in rotation through users
  rotationUserIds?: string[]; // ordered user IDs for rotation
  rotationCurrentIndex?: number; // current position in rotation
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
 * Paginated response envelope (cursor-based).
 * Mirrors the backend `PaginatedResponse<T>` shape returned by the
 * cursor-paginated Activity_Log, Task_History, and large-list endpoints.
 * `nextCursor` is an opaque base64 cursor; `null` signals no further pages.
 */
export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
  pageSize: number;
}

/**
 * Scheduled backup configuration status, as reported by
 * GET /api/admin/backup/config. Never includes the encryption key value itself.
 */
export interface BackupStatus {
  enabled: boolean;
  schedule: 'daily' | 'weekly';
  encryptionEnabled: boolean;
  hasEncryptionKey: boolean;
  retentionCount: number;
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

// ============================================================
// Recipe Types
// ============================================================

/**
 * A single recipe ingredient as returned by the API.
 */
export interface RecipeIngredient {
  id: string;
  recipeId: string;
  name: string;
  quantity?: string; // free-form measure, e.g. "2 cups"
  category?: string; // shopping category
  sortPosition: number;
  createdAt: string; // ISO date string
}

/**
 * Recipe model as returned by GET /api/recipes and GET /api/recipes/:id.
 * Ingredients are nested; steps is an ordered array of step strings.
 */
export interface Recipe {
  id: string;
  name: string;
  summary?: string;
  steps: string[];
  createdBy?: string; // User ID (attribution)
  sourceUrl?: string; // URL the recipe was imported from, if any
  ingredients: RecipeIngredient[];
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

/**
 * A recipe preview returned by POST /api/recipes/import — parsed from a web
 * page but not yet saved. The user reviews/edits it before creating a recipe.
 */
export interface ImportedRecipe {
  name: string;
  summary: string;
  ingredients: RecipeIngredientInput[];
  steps: string[];
  sourceUrl: string;
}

/**
 * Ingredient payload when creating/updating a recipe.
 */
export interface RecipeIngredientInput {
  name: string;
  quantity?: string;
  category?: string;
}

/**
 * Input for creating a new recipe.
 */
export interface CreateRecipeInput {
  name: string;
  summary?: string;
  steps: string[];
  ingredients: RecipeIngredientInput[];
  createdBy?: string;
  sourceUrl?: string;
}

/**
 * Input for updating an existing recipe. Provided fields replace their value;
 * `steps` and `ingredients` fully replace the existing set when present.
 */
export interface UpdateRecipeInput {
  name?: string;
  summary?: string | null;
  steps?: string[];
  ingredients?: RecipeIngredientInput[];
  sourceUrl?: string | null;
}

/**
 * Result of POST /api/recipes/:id/add-to-shopping.
 */
export interface AddIngredientsResult {
  added: ShoppingItem[];
  skipped: string[];
}
