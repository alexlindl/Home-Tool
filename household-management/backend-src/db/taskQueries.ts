/**
 * Task database queries
 * Provides functions to interact with the tasks, task_templates, and task_history tables
 */

import { query } from './connection';
import { 
  Task, 
  TaskRow, 
  taskFromRow, 
  TaskTemplate, 
  TaskTemplateRow, 
  taskTemplateFromRow,
  TaskHistory, 
  TaskHistoryRow, 
  taskHistoryFromRow 
} from '../models/Task';

/**
 * Input type for creating a new task
 */
export interface CreateTaskInput {
  title: string;
  description?: string;
  assignedTo: string;
  createdBy: string;
  dueDate: Date;
  isRecurring: boolean;
  recurrenceFrequency?: 'daily' | 'weekly' | 'monthly';
  recurrenceInterval?: number;
  recurrenceEndDate?: Date;
  listId?: string;
}

/**
 * Input type for updating a task
 */
export interface UpdateTaskInput {
  title?: string;
  description?: string;
  assignedTo?: string;
  dueDate?: Date;
  isRecurring?: boolean;
  recurrenceFrequency?: 'daily' | 'weekly' | 'monthly';
  recurrenceInterval?: number;
  recurrenceEndDate?: Date;
  status?: 'pending' | 'completed';
  completedAt?: Date;
  completedBy?: string;
}

/**
 * Filters for querying tasks
 */
export interface TaskFilters {
  assignedTo?: string;
  status?: 'pending' | 'completed';
  dueDateFrom?: Date;
  dueDateTo?: Date;
  listId?: string;
}

/**
 * Create a new task in the database
 * @param input Task creation data
 * @returns Promise<Task> The created task
 */
export const createTask = async (input: CreateTaskInput): Promise<Task> => {
  const result = await query(
    `INSERT INTO tasks (
      title, description, assigned_to, created_by, due_date,
      is_recurring, recurrence_frequency, recurrence_interval, recurrence_end_date, list_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      input.title,
      input.description || null,
      input.assignedTo,
      input.createdBy,
      input.dueDate,
      input.isRecurring,
      input.recurrenceFrequency || null,
      input.recurrenceInterval || null,
      input.recurrenceEndDate || null,
      input.listId || null,
    ]
  );

  return taskFromRow(result.rows[0] as TaskRow);
};

/**
 * Update an existing task
 * @param id Task UUID
 * @param input Task update data
 * @returns Promise<Task | null> The updated task or null if not found
 */
export const updateTask = async (id: string, input: UpdateTaskInput): Promise<Task | null> => {
  // Build dynamic update query based on provided fields
  const updates: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (input.title !== undefined) {
    updates.push(`title = $${paramCount++}`);
    values.push(input.title);
  }
  if (input.description !== undefined) {
    updates.push(`description = $${paramCount++}`);
    values.push(input.description || null);
  }
  if (input.assignedTo !== undefined) {
    updates.push(`assigned_to = $${paramCount++}`);
    values.push(input.assignedTo);
  }
  if (input.dueDate !== undefined) {
    updates.push(`due_date = $${paramCount++}`);
    values.push(input.dueDate);
  }
  if (input.isRecurring !== undefined) {
    updates.push(`is_recurring = $${paramCount++}`);
    values.push(input.isRecurring);
  }
  if (input.recurrenceFrequency !== undefined) {
    updates.push(`recurrence_frequency = $${paramCount++}`);
    values.push(input.recurrenceFrequency || null);
  }
  if (input.recurrenceInterval !== undefined) {
    updates.push(`recurrence_interval = $${paramCount++}`);
    values.push(input.recurrenceInterval || null);
  }
  if (input.recurrenceEndDate !== undefined) {
    updates.push(`recurrence_end_date = $${paramCount++}`);
    values.push(input.recurrenceEndDate || null);
  }
  if (input.status !== undefined) {
    updates.push(`status = $${paramCount++}`);
    values.push(input.status);
  }
  if (input.completedAt !== undefined) {
    updates.push(`completed_at = $${paramCount++}`);
    values.push(input.completedAt || null);
  }
  if (input.completedBy !== undefined) {
    updates.push(`completed_by = $${paramCount++}`);
    values.push(input.completedBy || null);
  }

  // Always update the updated_at timestamp
  updates.push(`updated_at = CURRENT_TIMESTAMP`);

  if (updates.length === 1) {
    // Only updated_at would be updated, nothing to do
    return getTaskById(id);
  }

  values.push(id);
  const result = await query(
    `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    return null;
  }

  return taskFromRow(result.rows[0] as TaskRow);
};

/**
 * Delete a task from the database
 * @param id Task UUID
 * @returns Promise<boolean> True if task was deleted, false if not found
 */
export const deleteTask = async (id: string): Promise<boolean> => {
  const result = await query('DELETE FROM tasks WHERE id = $1', [id]);
  return result.rowCount !== null && result.rowCount > 0;
};

/**
 * Get a task by its ID
 * @param id Task UUID
 * @returns Promise<Task | null> Task object or null if not found
 */
export const getTaskById = async (id: string): Promise<Task | null> => {
  const result = await query('SELECT * FROM tasks WHERE id = $1', [id]);

  if (result.rows.length === 0) {
    return null;
  }

  return taskFromRow(result.rows[0] as TaskRow);
};

/**
 * Get tasks with optional filtering
 * @param filters Optional filters for querying tasks
 * @returns Promise<Task[]> Array of tasks matching the filters
 */
export const getTasks = async (filters?: TaskFilters): Promise<Task[]> => {
  const conditions: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (filters?.assignedTo) {
    conditions.push(`assigned_to = $${paramCount++}`);
    values.push(filters.assignedTo);
  }

  if (filters?.status) {
    conditions.push(`status = $${paramCount++}`);
    values.push(filters.status);
  }

  if (filters?.dueDateFrom) {
    conditions.push(`due_date >= $${paramCount++}`);
    values.push(filters.dueDateFrom);
  }

  if (filters?.dueDateTo) {
    conditions.push(`due_date <= $${paramCount++}`);
    values.push(filters.dueDateTo);
  }

  if (filters?.listId) {
    conditions.push(`list_id = $${paramCount++}`);
    values.push(filters.listId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(
    `SELECT * FROM tasks ${whereClause} ORDER BY due_date ASC`,
    values
  );

  return result.rows.map((row: TaskRow) => taskFromRow(row));
};

/**
 * Get task history with optional date range filtering
 * @param days Number of days to look back (default: 30)
 * @returns Promise<TaskHistory[]> Array of task history entries
 */
export const getTaskHistory = async (days: number = 30): Promise<TaskHistory[]> => {
  const result = await query(
    `SELECT * FROM task_history 
     WHERE completed_at >= CURRENT_TIMESTAMP - INTERVAL '${days} days'
     ORDER BY completed_at DESC`
  );

  return result.rows.map((row: TaskHistoryRow) => taskHistoryFromRow(row));
};

/**
 * Create a task history entry
 * @param taskId Original task UUID
 * @param title Task title
 * @param assignedTo User ID who was assigned the task
 * @param completedBy User ID who completed the task
 * @param completedAt Completion timestamp
 * @param wasRecurring Whether the task was recurring
 * @returns Promise<TaskHistory> The created history entry
 */
export const createHistoryEntry = async (
  taskId: string,
  title: string,
  assignedTo: string,
  completedBy: string,
  completedAt: Date,
  wasRecurring: boolean
): Promise<TaskHistory> => {
  const result = await query(
    `INSERT INTO task_history (
      task_id, title, assigned_to, completed_by, completed_at, was_recurring
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *`,
    [taskId, title, assignedTo, completedBy, completedAt, wasRecurring]
  );

  return taskHistoryFromRow(result.rows[0] as TaskHistoryRow);
};

/**
 * Input type for creating a new task template
 */
export interface CreateTaskTemplateInput {
  title: string;
  description?: string;
  isPrePopulated: boolean;
  createdBy?: string;
}

/**
 * Filters for querying task templates
 */
export interface TaskTemplateFilters {
  isPrePopulated?: boolean;
  createdBy?: string;
}

/**
 * Create a new task template in the database
 * @param input Task template creation data
 * @returns Promise<TaskTemplate> The created task template
 */
export const createTaskTemplate = async (input: CreateTaskTemplateInput): Promise<TaskTemplate> => {
  const result = await query(
    `INSERT INTO task_templates (
      title, description, is_prepopulated, created_by
    ) VALUES ($1, $2, $3, $4)
    RETURNING *`,
    [
      input.title,
      input.description || null,
      input.isPrePopulated,
      input.createdBy || null,
    ]
  );

  return taskTemplateFromRow(result.rows[0] as TaskTemplateRow);
};

/**
 * Get a task template by its ID
 * @param id Task template UUID
 * @returns Promise<TaskTemplate | null> Task template object or null if not found
 */
export const getTaskTemplateById = async (id: string): Promise<TaskTemplate | null> => {
  const result = await query('SELECT * FROM task_templates WHERE id = $1', [id]);

  if (result.rows.length === 0) {
    return null;
  }

  return taskTemplateFromRow(result.rows[0] as TaskTemplateRow);
};

/**
 * Get task templates with optional filtering
 * @param filters Optional filters for querying task templates
 * @returns Promise<TaskTemplate[]> Array of task templates matching the filters
 */
export const getTaskTemplates = async (filters?: TaskTemplateFilters): Promise<TaskTemplate[]> => {
  const conditions: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (filters?.isPrePopulated !== undefined) {
    conditions.push(`is_prepopulated = $${paramCount++}`);
    values.push(filters.isPrePopulated);
  }

  if (filters?.createdBy) {
    conditions.push(`created_by = $${paramCount++}`);
    values.push(filters.createdBy);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(
    `SELECT * FROM task_templates ${whereClause} ORDER BY usage_count DESC, title ASC`,
    values
  );

  return result.rows.map((row: TaskTemplateRow) => taskTemplateFromRow(row));
};

/**
 * Increment the usage count for a task template
 * @param id Task template UUID
 * @returns Promise<TaskTemplate | null> Updated task template or null if not found
 */
export const incrementTemplateUsage = async (id: string): Promise<TaskTemplate | null> => {
  const result = await query(
    `UPDATE task_templates 
     SET usage_count = usage_count + 1 
     WHERE id = $1 
     RETURNING *`,
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return taskTemplateFromRow(result.rows[0] as TaskTemplateRow);
};

/**
 * Update a task template
 * @param id Task template UUID
 * @param title New title
 * @param description New description
 * @returns Promise<TaskTemplate | null> Updated task template or null if not found
 */
export const updateTaskTemplate = async (
  id: string,
  title?: string,
  description?: string
): Promise<TaskTemplate | null> => {
  const updates: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (title !== undefined) {
    updates.push(`title = $${paramCount++}`);
    values.push(title);
  }

  if (description !== undefined) {
    updates.push(`description = $${paramCount++}`);
    values.push(description || null);
  }

  if (updates.length === 0) {
    return getTaskTemplateById(id);
  }

  values.push(id);
  const result = await query(
    `UPDATE task_templates SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    return null;
  }

  return taskTemplateFromRow(result.rows[0] as TaskTemplateRow);
};

/**
 * Delete a task template from the database
 * @param id Task template UUID
 * @returns Promise<boolean> True if template was deleted, false if not found
 */
export const deleteTaskTemplate = async (id: string): Promise<boolean> => {
  const result = await query('DELETE FROM task_templates WHERE id = $1', [id]);
  return result.rowCount !== null && result.rowCount > 0;
};
