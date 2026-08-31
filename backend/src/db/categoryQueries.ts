/**
 * Category database queries
 * Provides CRUD functions for the categories table
 */

import { query, getClient } from './connection';

/**
 * Error thrown by reorderCategories when the submitted ordered list of
 * category identifiers references an id that does not exist. When thrown the
 * reorder transaction has been rolled back, so no category's sort_position has
 * changed.
 */
export class UnknownCategoryError extends Error {
  constructor(message = 'One or more category identifiers do not exist') {
    super(message);
    this.name = 'UnknownCategoryError';
    // Restore prototype chain for correct instanceof behavior when targeting ES5.
    Object.setPrototypeOf(this, UnknownCategoryError.prototype);
  }
}

/**
 * Category model
 */
export interface CategoryRecord {
  id: string;
  name: string;
  isDefault: boolean;
  sortPosition: number;
  createdAt: Date;
}

/**
 * Category database row
 */
export interface CategoryRow {
  id: string;
  name: string;
  is_default: boolean;
  sort_position: number;
  created_at: Date;
}

/**
 * Convert database row to Category model
 */
export const categoryFromRow = (row: CategoryRow): CategoryRecord => ({
  id: row.id,
  name: row.name,
  isDefault: row.is_default,
  sortPosition: row.sort_position,
  createdAt: row.created_at,
});

/**
 * Get all categories
 * Ordered by sort_position ascending, with a case-insensitive name tie-breaker.
 */
export const getAllCategories = async (): Promise<CategoryRecord[]> => {
  const result = await query(
    'SELECT * FROM categories ORDER BY sort_position ASC, LOWER(name) ASC'
  );
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
 * Get a category by name (case-insensitive)
 */
export const getCategoryByName = async (name: string): Promise<CategoryRecord | null> => {
  const result = await query('SELECT * FROM categories WHERE LOWER(name) = LOWER($1)', [name]);
  if (result.rows.length === 0) return null;
  return categoryFromRow(result.rows[0] as CategoryRow);
};

/**
 * Create a new category
 * Assigns a sort_position equal to one greater than the current maximum
 * position across all categories, or 0 when the table is empty. Because the
 * assigned value is strictly greater than every existing position, it is
 * guaranteed to be unique. The single INSERT ... SELECT keeps the assignment
 * atomic with respect to concurrent reads.
 */
export const createCategory = async (name: string): Promise<CategoryRecord> => {
  const result = await query(
    'INSERT INTO categories (name, sort_position) VALUES ($1, (SELECT COALESCE(MAX(sort_position) + 1, 0) FROM categories)) RETURNING *',
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
 * Update a category's sort_position
 * Persists exactly the submitted sort_position value for the target category
 * and leaves the row's other fields (including name) unchanged. Returns null
 * when no category matches the supplied id.
 */
export const updateCategorySortPosition = async (
  id: string,
  sortPosition: number
): Promise<CategoryRecord | null> => {
  const result = await query(
    'UPDATE categories SET sort_position = $1 WHERE id = $2 RETURNING *',
    [sortPosition, id]
  );
  if (result.rows.length === 0) return null;
  return categoryFromRow(result.rows[0] as CategoryRow);
};

/**
 * Atomically reorder categories.
 *
 * Assigns sort_position values 0..k-1 to the supplied orderedIds in the exact
 * submitted sequence, then appends every omitted (existing) category after them
 * at positions k.., ordered by their prior sort_position and then by
 * case-insensitive name. The whole operation runs inside a single transaction:
 * every id in orderedIds is verified to exist before any write, and if any id
 * is unknown the transaction is rolled back and an UnknownCategoryError is
 * thrown so that no sort_position changes. On any other failure the transaction
 * is likewise rolled back. Returns the full set of categories in the resulting
 * ascending sort_position order after commit.
 */
export const reorderCategories = async (
  orderedIds: string[]
): Promise<CategoryRecord[]> => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Verify every submitted id exists before applying any change.
    const existingResult = await client.query('SELECT id FROM categories');
    const existingIds = new Set<string>(
      existingResult.rows.map((row: { id: string }) => row.id)
    );
    for (const id of orderedIds) {
      if (!existingIds.has(id)) {
        await client.query('ROLLBACK');
        throw new UnknownCategoryError();
      }
    }

    // Assign positions 0..k-1 to the submitted ids in order.
    for (let i = 0; i < orderedIds.length; i++) {
      await client.query('UPDATE categories SET sort_position = $1 WHERE id = $2', [
        i,
        orderedIds[i],
      ]);
    }

    // Append omitted categories after the reordered ones, ordered by their
    // prior sort_position then case-insensitive name.
    const orderedSet = new Set<string>(orderedIds);
    const omittedResult = await client.query(
      'SELECT id FROM categories ORDER BY sort_position ASC, LOWER(name) ASC'
    );
    let nextPosition = orderedIds.length;
    for (const row of omittedResult.rows as Array<{ id: string }>) {
      if (orderedSet.has(row.id)) continue;
      await client.query('UPDATE categories SET sort_position = $1 WHERE id = $2', [
        nextPosition,
        row.id,
      ]);
      nextPosition++;
    }

    await client.query('COMMIT');
  } catch (error) {
    // Roll back on any failure that has not already rolled back. A double
    // rollback (e.g. after the UnknownCategoryError path) is harmless.
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback errors; the original error is more meaningful.
    }
    throw error;
  } finally {
    client.release();
  }

  return getAllCategories();
};

/**
 * Get categories ordered for a specific shopping list.
 *
 * Resolves each category's effective position as its per-list sort_position
 * from list_category_positions when present, falling back to the category's
 * global sort_position otherwise. Categories are returned ordered by that
 * effective position ascending, with a case-insensitive name tie-breaker. When
 * the list has no per-list positions at all, every category falls back to its
 * global sort_position, i.e. the Canonical_Category_Order. The extra
 * effective_position column selected by the query is ignored by categoryFromRow.
 */
export const getCategoriesForList = async (
  listId: string
): Promise<CategoryRecord[]> => {
  const result = await query(
    'SELECT c.*, COALESCE(lcp.sort_position, c.sort_position) AS effective_position FROM categories c LEFT JOIN list_category_positions lcp ON lcp.category_id = c.id AND lcp.list_id = $1 ORDER BY effective_position ASC, LOWER(c.name) ASC',
    [listId]
  );
  return result.rows.map((row: CategoryRow) => categoryFromRow(row));
};

/**
 * Atomically reorder categories for a specific shopping list.
 *
 * Assigns per-list sort_position values 0..k-1 to the supplied orderedIds in
 * the exact submitted sequence by upserting rows into list_category_positions
 * for the given listId only, leaving other lists' orders unchanged. The whole
 * operation runs inside a single transaction: every id in orderedIds is
 * verified to exist before any write, and if any id is unknown the transaction
 * is rolled back and an UnknownCategoryError is thrown so that no per-list
 * position changes. On any other failure the transaction is likewise rolled
 * back. Returns the categories in this list's resulting effective order after
 * commit.
 */
export const reorderCategoriesForList = async (
  listId: string,
  orderedIds: string[]
): Promise<CategoryRecord[]> => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Verify every submitted id exists before applying any change.
    const existingResult = await client.query('SELECT id FROM categories');
    const existingIds = new Set<string>(
      existingResult.rows.map((row: { id: string }) => row.id)
    );
    for (const id of orderedIds) {
      if (!existingIds.has(id)) {
        await client.query('ROLLBACK');
        throw new UnknownCategoryError();
      }
    }

    // Upsert per-list positions 0..k-1 for the submitted ids in order,
    // targeting this listId only.
    for (let i = 0; i < orderedIds.length; i++) {
      await client.query(
        'INSERT INTO list_category_positions (list_id, category_id, sort_position) VALUES ($1, $2, $3) ON CONFLICT (list_id, category_id) DO UPDATE SET sort_position = EXCLUDED.sort_position',
        [listId, orderedIds[i], i]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    // Roll back on any failure that has not already rolled back. A double
    // rollback (e.g. after the UnknownCategoryError path) is harmless.
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback errors; the original error is more meaningful.
    }
    throw error;
  } finally {
    client.release();
  }

  return getCategoriesForList(listId);
};

/**
 * Delete a category
 */
export const deleteCategory = async (id: string): Promise<boolean> => {
  const result = await query('DELETE FROM categories WHERE id = $1', [id]);
  return result.rowCount !== null && result.rowCount > 0;
};
