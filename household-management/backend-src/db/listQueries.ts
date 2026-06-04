/**
 * List database queries
 * Provides CRUD functions for task_lists and shopping_lists tables
 */

import { query } from './connection';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TaskList {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
}

export interface ShoppingList {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
}

interface ListRow {
  id: string;
  name: string;
  is_default: boolean;
  created_at: string;
}

function listFromRow(row: ListRow): TaskList | ShoppingList {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.is_default,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Task Lists
// ---------------------------------------------------------------------------

export const getTaskLists = async (): Promise<TaskList[]> => {
  const result = await query(
    'SELECT * FROM task_lists ORDER BY is_default DESC, name ASC'
  );
  return result.rows.map((row: ListRow) => listFromRow(row) as TaskList);
};

export const getTaskListById = async (id: string): Promise<TaskList | null> => {
  const result = await query('SELECT * FROM task_lists WHERE id = $1', [id]);
  if (result.rows.length === 0) return null;
  return listFromRow(result.rows[0] as ListRow) as TaskList;
};

export const getDefaultTaskList = async (): Promise<TaskList | null> => {
  const result = await query('SELECT * FROM task_lists WHERE is_default = TRUE LIMIT 1');
  if (result.rows.length === 0) return null;
  return listFromRow(result.rows[0] as ListRow) as TaskList;
};

export const createTaskList = async (name: string): Promise<TaskList> => {
  const result = await query(
    'INSERT INTO task_lists (name) VALUES ($1) RETURNING *',
    [name]
  );
  return listFromRow(result.rows[0] as ListRow) as TaskList;
};

export const updateTaskList = async (id: string, name: string): Promise<TaskList | null> => {
  const result = await query(
    'UPDATE task_lists SET name = $1 WHERE id = $2 RETURNING *',
    [name, id]
  );
  if (result.rows.length === 0) return null;
  return listFromRow(result.rows[0] as ListRow) as TaskList;
};

export const deleteTaskList = async (id: string): Promise<boolean> => {
  // Delete all tasks in this list first
  await query('DELETE FROM tasks WHERE list_id = $1', [id]);
  const result = await query('DELETE FROM task_lists WHERE id = $1', [id]);
  return result.rowCount !== null && result.rowCount > 0;
};

// ---------------------------------------------------------------------------
// Shopping Lists
// ---------------------------------------------------------------------------

export const getShoppingLists = async (): Promise<ShoppingList[]> => {
  const result = await query(
    'SELECT * FROM shopping_lists ORDER BY is_default DESC, name ASC'
  );
  return result.rows.map((row: ListRow) => listFromRow(row) as ShoppingList);
};

export const getShoppingListById = async (id: string): Promise<ShoppingList | null> => {
  const result = await query('SELECT * FROM shopping_lists WHERE id = $1', [id]);
  if (result.rows.length === 0) return null;
  return listFromRow(result.rows[0] as ListRow) as ShoppingList;
};

export const getDefaultShoppingList = async (): Promise<ShoppingList | null> => {
  const result = await query('SELECT * FROM shopping_lists WHERE is_default = TRUE LIMIT 1');
  if (result.rows.length === 0) return null;
  return listFromRow(result.rows[0] as ListRow) as ShoppingList;
};

export const createShoppingList = async (name: string): Promise<ShoppingList> => {
  const result = await query(
    'INSERT INTO shopping_lists (name) VALUES ($1) RETURNING *',
    [name]
  );
  return listFromRow(result.rows[0] as ListRow) as ShoppingList;
};

export const updateShoppingList = async (id: string, name: string): Promise<ShoppingList | null> => {
  const result = await query(
    'UPDATE shopping_lists SET name = $1 WHERE id = $2 RETURNING *',
    [name, id]
  );
  if (result.rows.length === 0) return null;
  return listFromRow(result.rows[0] as ListRow) as ShoppingList;
};

export const deleteShoppingList = async (id: string): Promise<boolean> => {
  // Delete all shopping items in this list first
  await query('DELETE FROM shopping_items WHERE list_id = $1', [id]);
  const result = await query('DELETE FROM shopping_lists WHERE id = $1', [id]);
  return result.rowCount !== null && result.rowCount > 0;
};
