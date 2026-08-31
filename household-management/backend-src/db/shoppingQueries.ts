/**
 * Shopping item database queries
 * Provides functions to interact with the shopping_items and item_templates tables
 */

import { query } from './connection';
import {
  ShoppingItem,
  ShoppingItemRow,
  shoppingItemFromRow,
  ItemTemplate,
  ItemTemplateRow,
  itemTemplateFromRow,
  Category,
} from '../models/Shopping';
import { PaginatedResponse } from '../models';
import { encodeCursor, clampLimit } from '../utils/cursor';

/**
 * Opaque cursor payload for the shopping list keyset pagination.
 * Encodes the ordering-key tuple (category, name, id) of the last row seen.
 */
export interface ShoppingListCursor {
  category: string;
  name: string;
  id: string; // shopping_items row id (tie-break)
}

/**
 * Input type for adding a new shopping item
 */
export interface AddItemInput {
  name: string;
  category: Category;
  addedBy: string;
  listId?: string;
}

/**
 * Input type for updating a shopping item
 */
export interface UpdateItemInput {
  name?: string;
  category?: Category;
}

/**
 * Add a new shopping item to the database
 * @param input Shopping item creation data
 * @returns Promise<ShoppingItem> The created shopping item
 */
export const addItem = async (input: AddItemInput): Promise<ShoppingItem> => {
  // Default to the default list if no listId provided
  let listId = input.listId || null;
  if (!listId) {
    const defaultListResult = await query('SELECT id FROM shopping_lists WHERE is_default = TRUE LIMIT 1');
    if (defaultListResult.rows.length > 0) {
      listId = (defaultListResult.rows[0] as { id: string }).id;
    }
  }

  const result = await query(
    `INSERT INTO shopping_items (name, category, added_by, list_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [input.name, input.category, input.addedBy, listId]
  );

  return shoppingItemFromRow(result.rows[0] as ShoppingItemRow);
};

/**
 * Get a shopping item by its ID
 * @param id Shopping item UUID
 * @returns Promise<ShoppingItem | null> Shopping item or null if not found
 */
export const getItemById = async (id: string): Promise<ShoppingItem | null> => {
  const result = await query('SELECT * FROM shopping_items WHERE id = $1', [id]);

  if (result.rows.length === 0) {
    return null;
  }

  return shoppingItemFromRow(result.rows[0] as ShoppingItemRow);
};

/**
 * Get the shopping list (unpurchased items), optionally filtered by category.
 * Items are ordered by category then name to support category grouping.
 * @param category Optional category filter
 * @returns Promise<ShoppingItem[]> Array of unpurchased shopping items
 */
export const getShoppingList = async (category?: Category, listId?: string): Promise<ShoppingItem[]> => {
  const conditions: string[] = ['is_purchased = FALSE'];
  const values: any[] = [];
  let paramCount = 1;

  if (category !== undefined) {
    conditions.push(`category = $${paramCount++}`);
    values.push(category);
  }

  if (listId !== undefined) {
    conditions.push(`list_id = $${paramCount++}`);
    values.push(listId);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const result = await query(
    `SELECT * FROM shopping_items ${whereClause} ORDER BY category ASC, name ASC`,
    values
  );

  return result.rows.map((row: ShoppingItemRow) => shoppingItemFromRow(row));
};

/**
 * Get a bounded page of the shopping list (unpurchased items) using
 * cursor-based (keyset) pagination.
 *
 * Rows are returned in a stable ordering (`category ASC, name ASC, id ASC`) so
 * that no record is skipped or duplicated across consecutive pages. The cursor
 * encodes the (category, name, id) tuple of the last row of the previous page;
 * the query fetches `limit + 1` rows to detect whether more pages remain.
 *
 * @param cursor Decoded cursor from a previous page, or null for the first page.
 * @param limit Requested page size (clamped to max 200, default 50).
 * @param listId Optional shopping list filter.
 * @returns PaginatedResponse envelope with items, nextCursor, and pageSize.
 */
export const getShoppingItemsPage = async (
  cursor: ShoppingListCursor | null,
  limit?: number,
  listId?: string
): Promise<PaginatedResponse<ShoppingItem>> => {
  const pageSize = clampLimit(limit);

  const conditions: string[] = ['is_purchased = FALSE'];
  const values: any[] = [];
  let paramCount = 1;

  if (listId !== undefined) {
    conditions.push(`list_id = $${paramCount++}`);
    values.push(listId);
  }

  // Keyset predicate for (category, name, id) ASC.
  if (cursor) {
    const catParam = paramCount++;
    const nameParam = paramCount++;
    const idParam = paramCount++;
    conditions.push(
      `(category, name, id) > ($${catParam}::text, $${nameParam}::text, $${idParam}::uuid)`
    );
    values.push(cursor.category, cursor.name, cursor.id);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const limitParam = paramCount++;
  values.push(pageSize + 1);

  const result = await query(
    `SELECT * FROM shopping_items ${whereClause}
     ORDER BY category ASC, name ASC, id ASC
     LIMIT $${limitParam}`,
    values
  );

  const rows = result.rows as ShoppingItemRow[];
  const hasMore = rows.length > pageSize;
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
  const items = pageRows.map((row) => shoppingItemFromRow(row));

  let nextCursor: string | null = null;
  if (hasMore) {
    const last = pageRows[pageRows.length - 1];
    if (last) {
      nextCursor = encodeCursor({
        category: last.category,
        name: last.name,
        id: last.id,
      } satisfies ShoppingListCursor);
    }
  }

  return { items, nextCursor, pageSize };
};

/**
 * Update a shopping item
 * @param id Shopping item UUID
 * @param input Fields to update
 * @returns Promise<ShoppingItem | null> Updated item or null if not found
 */
export const updateItem = async (
  id: string,
  input: UpdateItemInput
): Promise<ShoppingItem | null> => {
  const updates: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (input.name !== undefined) {
    updates.push(`name = $${paramCount++}`);
    values.push(input.name);
  }

  if (input.category !== undefined) {
    updates.push(`category = $${paramCount++}`);
    values.push(input.category);
  }

  // Always update the updated_at timestamp
  updates.push(`updated_at = CURRENT_TIMESTAMP`);

  if (updates.length === 1) {
    // Only updated_at would change — nothing meaningful to update
    return getItemById(id);
  }

  values.push(id);
  const result = await query(
    `UPDATE shopping_items SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    return null;
  }

  return shoppingItemFromRow(result.rows[0] as ShoppingItemRow);
};

/**
 * Delete a shopping item from the database
 * @param id Shopping item UUID
 * @returns Promise<boolean> True if item was deleted, false if not found
 */
export const deleteItem = async (id: string): Promise<boolean> => {
  const result = await query('DELETE FROM shopping_items WHERE id = $1', [id]);
  return result.rowCount !== null && result.rowCount > 0;
};

/**
 * Mark a shopping item as purchased
 * @param id Shopping item UUID
 * @param userId ID of the user who purchased the item
 * @returns Promise<ShoppingItem | null> Updated item or null if not found
 */
export const purchaseItem = async (
  id: string,
  userId: string
): Promise<ShoppingItem | null> => {
  const result = await query(
    `UPDATE shopping_items
     SET is_purchased = TRUE,
         purchased_by = $1,
         purchased_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING *`,
    [userId, id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return shoppingItemFromRow(result.rows[0] as ShoppingItemRow);
};

/**
 * Mark a shopping item as unpurchased (undo purchase)
 * @param id Shopping item UUID
 * @returns Promise<ShoppingItem | null> Updated item or null if not found
 */
export const unpurchaseItem = async (id: string): Promise<ShoppingItem | null> => {
  const result = await query(
    `UPDATE shopping_items
     SET is_purchased = FALSE, purchased_by = NULL, purchased_at = NULL, updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return shoppingItemFromRow(result.rows[0] as ShoppingItemRow);
};

/**
 * Move a shopping item to a different list
 * @param itemId Shopping item UUID
 * @param targetListId Target list UUID
 * @returns Promise<ShoppingItem | null> The updated item or null if not found
 */
export const moveShoppingItem = async (itemId: string, targetListId: string): Promise<ShoppingItem | null> => {
  const result = await query(
    'UPDATE shopping_items SET list_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [targetListId, itemId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return shoppingItemFromRow(result.rows[0] as ShoppingItemRow);
};

/**
 * Get recently purchased shopping items, ordered by purchased_at DESC.
 * Used for the history page to show who purchased what.
 * @param days Number of days to look back (default 30)
 * @param limit Maximum number of results to return (default 30)
 * @returns Promise<ShoppingItem[]> Array of purchased shopping items
 */
export const getRecentPurchases = async (
  days: number = 30,
  limit: number = 30
): Promise<ShoppingItem[]> => {
  const result = await query(
    `SELECT * FROM shopping_items
     WHERE is_purchased = TRUE
       AND purchased_at >= CURRENT_TIMESTAMP - INTERVAL '1 day' * $1
     ORDER BY purchased_at DESC
     LIMIT $2`,
    [days, limit]
  );

  return result.rows.map((row: ShoppingItemRow) => shoppingItemFromRow(row));
};

// ---------------------------------------------------------------------------
// Shopping item search (autocomplete)
// ---------------------------------------------------------------------------

/**
 * Result type for shopping item search
 */
export interface ShoppingSearchResult {
  name: string;
  category: string;
  usageCount: number;
}

/**
 * Search shopping items by name substring (case-insensitive) for autocomplete.
 * Returns distinct name-category pairs ordered by usage count descending.
 * @param searchQuery Search string to match against item names
 * @param limit Maximum number of results to return (default 8)
 * @returns Promise<ShoppingSearchResult[]> Array of matching name-category pairs
 */
export const searchShoppingItems = async (
  searchQuery: string,
  limit: number = 8
): Promise<ShoppingSearchResult[]> => {
  const result = await query(
    `(SELECT name, category, COUNT(*) as usage_count
      FROM shopping_items
      WHERE name ILIKE '%' || $1 || '%'
      GROUP BY name, category)
    UNION ALL
    (SELECT name, category, usage_count::bigint as usage_count
      FROM item_templates
      WHERE name ILIKE '%' || $1 || '%')
    ORDER BY usage_count DESC
    LIMIT $2`,
    [searchQuery, limit]
  );

  return result.rows.map((row: { name: string; category: string; usage_count: string }) => ({
    name: row.name,
    category: row.category,
    usageCount: parseInt(row.usage_count, 10),
  }));
};

// ---------------------------------------------------------------------------
// Item Template queries
// ---------------------------------------------------------------------------

/**
 * Input type for creating a new item template
 */
export interface CreateItemTemplateInput {
  name: string;
  category: Category;
  isPrePopulated: boolean;
  createdBy?: string;
}

/**
 * Filters for querying item templates
 */
export interface ItemTemplateFilters {
  isPrePopulated?: boolean;
  createdBy?: string;
}

/**
 * Create a new item template in the database
 * @param input Item template creation data
 * @returns Promise<ItemTemplate> The created item template
 */
export const createItemTemplate = async (
  input: CreateItemTemplateInput
): Promise<ItemTemplate> => {
  const result = await query(
    `INSERT INTO item_templates (name, category, is_prepopulated, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [input.name, input.category, input.isPrePopulated, input.createdBy || null]
  );

  return itemTemplateFromRow(result.rows[0] as ItemTemplateRow);
};

/**
 * Get an item template by its ID
 * @param id Item template UUID
 * @returns Promise<ItemTemplate | null> Item template or null if not found
 */
export const getItemTemplateById = async (id: string): Promise<ItemTemplate | null> => {
  const result = await query('SELECT * FROM item_templates WHERE id = $1', [id]);

  if (result.rows.length === 0) {
    return null;
  }

  return itemTemplateFromRow(result.rows[0] as ItemTemplateRow);
};

/**
 * Get item templates with optional filtering
 * @param filters Optional filters for querying item templates
 * @returns Promise<ItemTemplate[]> Array of item templates matching the filters
 */
export const getItemTemplates = async (
  filters?: ItemTemplateFilters
): Promise<ItemTemplate[]> => {
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
    `SELECT * FROM item_templates ${whereClause} ORDER BY usage_count DESC, name ASC`,
    values
  );

  return result.rows.map((row: ItemTemplateRow) => itemTemplateFromRow(row));
};

/**
 * Search item templates by substring match (case-insensitive), ordered by usage_count DESC
 * @param searchQuery Search string to match against template names
 * @param limit Maximum number of results to return (default 8, max 20)
 * @returns Promise<ItemTemplate[]> Array of matching item templates
 */
export const searchItemTemplates = async (
  searchQuery: string,
  limit?: number
): Promise<ItemTemplate[]> => {
  const effectiveLimit = Math.min(limit ?? 8, 20);
  const result = await query(
    `SELECT * FROM item_templates
     WHERE LOWER(name) LIKE '%' || LOWER($1) || '%'
     ORDER BY usage_count DESC
     LIMIT $2`,
    [searchQuery, effectiveLimit]
  );

  return result.rows.map((row: ItemTemplateRow) => itemTemplateFromRow(row));
};

/**
 * Increment the usage count for an item template
 * @param id Item template UUID
 * @returns Promise<ItemTemplate | null> Updated item template or null if not found
 */
export const incrementItemTemplateUsage = async (id: string): Promise<ItemTemplate | null> => {
  const result = await query(
    `UPDATE item_templates
     SET usage_count = usage_count + 1
     WHERE id = $1
     RETURNING *`,
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return itemTemplateFromRow(result.rows[0] as ItemTemplateRow);
};

/**
 * Delete an item template from the database
 * @param id Item template UUID
 * @returns Promise<boolean> True if template was deleted, false if not found
 */
export const deleteItemTemplate = async (id: string): Promise<boolean> => {
  const result = await query('DELETE FROM item_templates WHERE id = $1', [id]);
  return result.rowCount !== null && result.rowCount > 0;
};

/**
 * Update an item template
 * @param id Item template UUID
 * @param name New name (optional)
 * @param category New category (optional)
 * @returns Promise<ItemTemplate | null> Updated template or null if not found
 */
export const updateItemTemplate = async (
  id: string,
  name?: string,
  category?: Category
): Promise<ItemTemplate | null> => {
  const updates: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (name !== undefined) {
    updates.push(`name = $${paramCount++}`);
    values.push(name);
  }

  if (category !== undefined) {
    updates.push(`category = $${paramCount++}`);
    values.push(category);
  }

  if (updates.length === 0) {
    return getItemTemplateById(id);
  }

  values.push(id);
  const result = await query(
    `UPDATE item_templates SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    return null;
  }

  return itemTemplateFromRow(result.rows[0] as ItemTemplateRow);
};
