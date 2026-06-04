/**
 * Task data models
 * Represents tasks (chores) assigned to household members
 */

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
  assignedTo: string;      // User ID
  createdBy: string;       // User ID
  dueDate: Date;
  isRecurring: boolean;
  recurrencePattern?: RecurrencePattern;
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
  assigned_to: string;
  created_by: string;
  due_date: Date;
  is_recurring: boolean;
  recurrence_frequency: string | null;
  recurrence_interval: number | null;
  recurrence_end_date: Date | null;
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
    assignedTo: row.assigned_to,
    createdBy: row.created_by,
    dueDate: row.due_date,
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

  return task;
};

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
  assignedTo: string;      // User ID
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
  assigned_to: string;
  completed_by: string;
  completed_at: Date;
  was_recurring: boolean;
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
