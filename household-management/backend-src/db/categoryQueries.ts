/**
 * Category database queries
 * Provides CRUD functions for the categories table
 */

import { query } from './connection';

/**
 * Category model
 */
export interface CategoryRecord {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: Date;
}

/**
 * Category database row
 */
export interface CategoryRow {
  id: string;
  name: string;
  is_default: boolean;
  created_at: Date;
}

/**
 * Convert database row to Category model
 */
export const categoryFromRow = (row: CategoryRow): CategoryRecord => ({
  id: row.id,
  name: row.name,
  isDefault: row.is_default,
  createdAt: row.created_at,
});

/**
 * Get all categories
 */
export const getAllCategories = async (): Promise<CategoryRecord[]> => {
  const result = await query('SELECT * FROM categories ORDER BY name ASC');
  return result.rows.map((row: CategoryRow) => categoryFromRow(row));
};

/**
 * Get a category by ID
 */
export const getCategoryById = async (id: string): Promise<CategoryRecord | null> => {
  const result = await query('SELECT * FROM categories WHERE id = $1', [id]);
  if (result.rows.length === 0) return null;
  return categoryFromRow(result.rows[0] as CategoryRow);
};

/**
 * Get a category by name
 */
export const getCategoryByName = async (name: string): Promise<CategoryRecord | null> => {
  const result = await query('SELECT * FROM categories WHERE name = $1', [name]);
  if (result.rows.length === 0) return null;
  return categoryFromRow(result.rows[0] as CategoryRow);
};

/**
 * Create a new category
 */
export const createCategory = async (name: string): Promise<CategoryRecord> => {
  const result = await query(
    'INSERT INTO categories (name) VALUES ($1) RETURNING *',
    [name]
  );
  return categoryFromRow(result.rows[0] as CategoryRow);
};

/**
 * Update a category's name
 */
export const updateCategory = async (id: string, name: string): Promise<CategoryRecord | null> => {
  const result = await query(
    'UPDATE categories SET name = $1 WHERE id = $2 RETURNING *',
    [name, id]
  );
  if (result.rows.length === 0) return null;
  return categoryFromRow(result.rows[0] as CategoryRow);
};

/**
 * Delete a category
 */
export const deleteCategory = async (id: string): Promise<boolean> => {
  const result = await query('DELETE FROM categories WHERE id = $1', [id]);
  return result.rowCount !== null && result.rowCount > 0;
};
