/**
 * Task data models
 * Represents tasks (chores) assigned to household members
 */

import type {
  EnhancedRecurrencePattern,
  RecurrencePatternType,
  DayOfWeek,
} from '../utils/recurrenceEngine';

/**
 * Recurrence pattern for recurring tasks
 */
export interface RecurrencePattern {
  frequency: 'daily' | 'weekly' | 'monthly';
  interval: number;        // e.g., every 2 weeks
  endDate?: Date;
}

/**
 * Task model
 */
export interface Task {
  id: string;              // UUID
  title: string;
  description?: string;
  assignedTo: string | null; // User ID or null for "Anyone" assignment
  createdBy: string;       // User ID
  dueDate: Date | null;    // Nullable for backlog tasks
  isRecurring: boolean;
  recurrencePattern?: RecurrencePattern;
  recurrenceType?: string;           // Enhanced pattern type
  recurrenceDayOfWeek?: string;      // Day for day-based enhanced patterns
  recurrenceOrdinalWeek?: number;    // 1-5 for Nth occurrence patterns
  status: 'pending' | 'completed';
  completedAt?: Date;
  completedBy?: string;    // User ID
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Task database row (matches PostgreSQL schema)
 */
export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string | null; // NULL for "Anyone" assignment
  created_by: string;
  due_date: Date | null;                    // Nullable for backlog tasks
  is_recurring: boolean;
  recurrence_frequency: string | null;      // Legacy
  recurrence_interval: number | null;       // Shared
  recurrence_end_date: Date | null;
  recurrence_type: string | null;           // New: enhanced pattern type
  recurrence_day_of_week: string | null;    // New: day for day-based patterns
  recurrence_ordinal_week: number | null;   // New: 1-5 for Nth occurrence
  status: string;
  completed_at: Date | null;
  completed_by: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Convert database row to Task model
 */
export const taskFromRow = (row: TaskRow): Task => {
  const task: Task = {
    id: row.id,
    title: row.title,
    description: row.description || undefined,
    assignedTo: row.assigned_to, // null means "Anyone"
    createdBy: row.created_by,
    dueDate: row.due_date,       // null for backlog tasks
    isRecurring: row.is_recurring,
    status: row.status as 'pending' | 'completed',
    completedAt: row.completed_at || undefined,
    completedBy: row.completed_by || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  // Add recurrence pattern if task is recurring
  if (row.is_recurring && row.recurrence_frequency && row.recurrence_interval) {
    task.recurrencePattern = {
      frequency: row.recurrence_frequency as 'daily' | 'weekly' | 'monthly',
      interval: row.recurrence_interval,
      endDate: row.recurrence_end_date || undefined,
    };
  }

  // Add enhanced recurrence fields if present
  if (row.recurrence_type) {
    task.recurrenceType = row.recurrence_type;
  }
  if (row.recurrence_day_of_week) {
    task.recurrenceDayOfWeek = row.recurrence_day_of_week;
  }
  if (row.recurrence_ordinal_week != null) {
    task.recurrenceOrdinalWeek = row.recurrence_ordinal_week;
  }

  return task;
};

/**
 * Serialized form of an EnhancedRecurrencePattern for database storage.
 * Each field maps directly to a column in the tasks table.
 */
export interface SerializedRecurrencePattern {
  recurrence_type: string;
  recurrence_interval: number;
  recurrence_day_of_week: string | null;
  recurrence_ordinal_week: number | null;
  recurrence_end_date: Date | null;
}

/**
 * Serialize an EnhancedRecurrencePattern to individual DB column values.
 *
 * Validates: Requirements 2.7
 */
export function serializeRecurrencePattern(
  pattern: EnhancedRecurrencePattern,
): SerializedRecurrencePattern {
  return {
    recurrence_type: pattern.type,
    recurrence_interval: pattern.interval,
    recurrence_day_of_week: pattern.dayOfWeek ?? null,
    recurrence_ordinal_week: pattern.ordinalWeek ?? null,
    recurrence_end_date: pattern.endDate ?? null,
  };
}

/**
 * Deserialize individual DB column values back to an EnhancedRecurrencePattern.
 * Returns null if recurrence_type is not present.
 *
 * Validates: Requirements 2.7
 */
export function deserializeRecurrencePattern(
  columns: {
    recurrence_type: string | null;
    recurrence_interval: number | null;
    recurrence_day_of_week: string | null;
    recurrence_ordinal_week: number | null;
    recurrence_end_date: Date | null;
  },
): EnhancedRecurrencePattern | null {
  if (!columns.recurrence_type) {
    return null;
  }

  const pattern: EnhancedRecurrencePattern = {
    type: columns.recurrence_type as RecurrencePatternType,
    interval: columns.recurrence_interval ?? 1,
  };

  if (columns.recurrence_day_of_week) {
    pattern.dayOfWeek = columns.recurrence_day_of_week as DayOfWeek;
  }

  if (columns.recurrence_ordinal_week != null) {
    pattern.ordinalWeek = columns.recurrence_ordinal_week;
  }

  if (columns.recurrence_end_date != null) {
    pattern.endDate = columns.recurrence_end_date;
  }

  return pattern;
}

/**
 * Task template model
 */
export interface TaskTemplate {
  id: string;              // UUID
  title: string;
  description?: string;
  isPrePopulated: boolean; // true for system templates
  createdBy?: string;      // User ID for custom templates
  usageCount: number;      // Track popularity
  createdAt: Date;
}

/**
 * Task template database row (matches PostgreSQL schema)
 */
export interface TaskTemplateRow {
  id: string;
  title: string;
  description: string | null;
  is_prepopulated: boolean;
  created_by: string | null;
  usage_count: number;
  created_at: Date;
}

/**
 * Convert database row to TaskTemplate model
 */
export const taskTemplateFromRow = (row: TaskTemplateRow): TaskTemplate => {
  return {
    id: row.id,
    title: row.title,
    description: row.description || undefined,
    isPrePopulated: row.is_prepopulated,
    createdBy: row.created_by || undefined,
    usageCount: row.usage_count,
    createdAt: row.created_at,
  };
};

/**
 * Task history model
 */
export interface TaskHistory {
  id: string;              // UUID
  taskId: string;
  title: string;
  assignedTo: string | null; // User ID or null for "Anyone" tasks
  completedBy: string;     // User ID
  completedAt: Date;
  wasRecurring: boolean;
}

/**
 * Task history database row (matches PostgreSQL schema)
 */
export interface TaskHistoryRow {
  id: string;
  task_id: string;
  title: string;
  assigned_to: string | null;
  completed_by: string;
  completed_at: Date;
  was_recurring: boolean;
}

/**
 * Determine whether a task is overdue.
 *
 * A task is overdue when:
 *  - It has a non-null dueDate AND
 *  - The dueDate is strictly before the reference date (defaults to now)
 *
 * Backlog tasks (dueDate === null) are NEVER overdue.
 *
 * Validates: Requirements 5.6
 *
 * @param task The task to check
 * @param referenceDate The date to compare against (defaults to current time)
 * @returns true if the task is overdue, false otherwise
 */
export function isTaskOverdue(task: Task, referenceDate?: Date): boolean {
  if (task.dueDate === null) {
    return false;
  }
  const now = referenceDate ?? new Date();
  return task.dueDate < now;
}

/**
 * Convert database row to TaskHistory model
 */
export const taskHistoryFromRow = (row: TaskHistoryRow): TaskHistory => {
  return {
    id: row.id,
    taskId: row.task_id,
    title: row.title,
    assignedTo: row.assigned_to,
    completedBy: row.completed_by,
    completedAt: row.completed_at,
    wasRecurring: row.was_recurring,
  };
};
