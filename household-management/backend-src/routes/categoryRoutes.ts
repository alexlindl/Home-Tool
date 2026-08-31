/**
 * Category API routes
 * Handles CRUD operations for shopping item categories
 */

import { Router, Request, Response } from 'express';
import {
  getAllCategories,
  getCategoryById,
  getCategoryByName,
  createCategory,
  updateCategorySortPosition,
  reorderCategories,
  UnknownCategoryError,
} from '../db/categoryQueries';
import { query, getClient } from '../db/connection';

const router = Router();

/** Maximum value storable in a PostgreSQL INTEGER column. */
const MAX_SORT_POSITION = 2147483647;

/**
 * GET /api/categories
 * Get all categories
 *
 * Response: 200 OK
 * { "categories": [...] }
 */
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const categories = await getAllCategories();
    res.status(200).json({ categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch categories',
    });
  }
});

/**
 * POST /api/categories
 * Create a new category
 *
 * Request body:
 * { "name": "snacks" }
 *
 * Response: 201 Created
 * { "category": { ... } }
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({
        status: 'error',
        message: 'Name is required and must be a non-empty string',
      });
      return;
    }

    const trimmedName = name.trim().toLowerCase();

    // Reject reserved "uncategorized" name
    if (trimmedName === 'uncategorized') {
      res.status(400).json({
        status: 'error',
        message: "The category name 'uncategorized' is reserved",
      });
      return;
    }

    // Check uniqueness
    const existing = await getCategoryByName(trimmedName);
    if (existing) {
      res.status(409).json({
        status: 'error',
        message: `A category with the name "${trimmedName}" already exists`,
      });
      return;
    }

    const category = await createCategory(trimmedName);

    // Log activity (non-fatal)
    try {
      const { userId } = req.body;
      await query(
        'INSERT INTO activity_log (event_type, item_title, user_id) VALUES ($1, $2, $3)',
        ['category_created', trimmedName, userId || null]
      );
    } catch (logError) {
      console.error('Failed to log category_created activity:', logError);
    }

    res.status(201).json({ category });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create category',
    });
  }
});

/**
 * PUT /api/categories/reorder
 * Atomically reorder categories.
 *
 * IMPORTANT: This route MUST be registered before the `/:id`-parameterized
 * routes below so Express does not treat the literal "reorder" as an `:id`.
 *
 * Request body:
 * { "orderedIds": ["<id>", "<id>", ...] }
 *
 * Responses:
 * - 400 when orderedIds is missing, not an array, empty, contains a non-string
 *   or empty-string id, or contains duplicate ids (all positions unchanged)
 * - 400 when any id is unknown (all positions unchanged; verified before write)
 * - 200 with { "categories": [...] } in resulting ascending sort_position order
 */
router.put('/reorder', async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderedIds } = req.body;

    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      res.status(400).json({
        status: 'error',
        message: 'orderedIds is required and must be a non-empty array',
      });
      return;
    }

    if (
      orderedIds.some(
        (id) => typeof id !== 'string' || id.trim().length === 0
      )
    ) {
      res.status(400).json({
        status: 'error',
        message: 'orderedIds must contain only non-empty string identifiers',
      });
      return;
    }

    if (new Set(orderedIds).size !== orderedIds.length) {
      res.status(400).json({
        status: 'error',
        message: 'orderedIds must not contain duplicate identifiers',
      });
      return;
    }

    try {
      const categories = await reorderCategories(orderedIds as string[]);
      res.status(200).json({ categories });
    } catch (reorderError) {
      if (reorderError instanceof UnknownCategoryError) {
        res.status(400).json({
          status: 'error',
          message: 'One or more category identifiers do not exist',
        });
        return;
      }
      throw reorderError;
    }
  } catch (error) {
    console.error('Error reordering categories:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to reorder categories',
    });
  }
});

/**
 * PUT /api/categories/:id/position
 * Update a single category's sort_position
 *
 * Request body:
 * { "sortPosition": 5 }
 *
 * Responses:
 * - 400 when sortPosition is missing, non-numeric, non-integer, negative, or
 *   greater than 2,147,483,647 (target category unchanged)
 * - 404 when the id does not exist (all positions unchanged)
 * - 200 with { "category": { ...includes sortPosition } } on success
 */
router.put('/:id/position', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { sortPosition } = req.body;

    if (
      sortPosition === undefined ||
      sortPosition === null ||
      typeof sortPosition !== 'number' ||
      !Number.isInteger(sortPosition) ||
      sortPosition < 0 ||
      sortPosition > MAX_SORT_POSITION
    ) {
      res.status(400).json({
        status: 'error',
        message:
          'The sortPosition value is invalid; it must be an integer between 0 and 2147483647',
      });
      return;
    }

    const category = await updateCategorySortPosition(id, sortPosition);
    if (!category) {
      res.status(404).json({
        status: 'error',
        message: `Category with ID ${id} not found`,
      });
      return;
    }

    res.status(200).json({ category });
  } catch (error) {
    console.error('Error updating category position:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update category position',
    });
  }
});

/**
 * PUT /api/categories/:id
 * Update a category name
 *
 * Request body:
 * { "name": "new-name" }
 *
 * Response: 200 OK
 * { "category": { ... } }
 */
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({
        status: 'error',
        message: 'Name is required and must be a non-empty string',
      });
      return;
    }

    const trimmedName = name.trim().toLowerCase();

    // Check category exists
    const existing = await getCategoryById(id);
    if (!existing) {
      res.status(404).json({
        status: 'error',
        message: `Category with ID ${id} not found`,
      });
      return;
    }

    // Check uniqueness
    const duplicate = await getCategoryByName(trimmedName);
    if (duplicate && duplicate.id !== id) {
      res.status(409).json({
        status: 'error',
        message: `A category with the name "${trimmedName}" already exists`,
      });
      return;
    }

    // Rename the category and cascade the new name to the denormalized
    // category strings on shopping_items and item_templates so items are not
    // orphaned. All three writes run inside a single transaction so they can't
    // partially apply. Follows the getClient BEGIN/COMMIT/ROLLBACK pattern from
    // categoryQueries.reorderCategories.
    let category = existing;
    if (trimmedName !== existing.name) {
      const client = await getClient();
      try {
        await client.query('BEGIN');

        const renameResult = await client.query(
          'UPDATE categories SET name = $1 WHERE id = $2 RETURNING *',
          [trimmedName, id]
        );

        // Cascade the rename to denormalized category strings.
        await client.query(
          'UPDATE shopping_items SET category = $1 WHERE category = $2',
          [trimmedName, existing.name]
        );
        await client.query(
          'UPDATE item_templates SET category = $1 WHERE category = $2',
          [trimmedName, existing.name]
        );

        await client.query('COMMIT');

        const renamedRow = renameResult.rows[0];
        if (renamedRow) {
          category = {
            id: renamedRow.id,
            name: renamedRow.name,
            isDefault: renamedRow.is_default,
            sortPosition: renamedRow.sort_position,
            createdAt: renamedRow.created_at,
          };
        }
      } catch (txnError) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // Ignore rollback errors; the original error is more meaningful.
        }
        throw txnError;
      } finally {
        client.release();
      }
    }

    // Log activity (non-fatal)
    try {
      const { userId } = req.body;
      await query(
        'INSERT INTO activity_log (event_type, item_title, user_id) VALUES ($1, $2, $3)',
        ['category_updated', trimmedName, userId || null]
      );
    } catch (logError) {
      console.error('Failed to log category_updated activity:', logError);
    }

    res.status(200).json({ category });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update category',
    });
  }
});

/**
 * DELETE /api/categories/:id
 * Delete a category and reassign shopping items to "uncategorized"
 *
 * Response: 200 OK
 * { "message": "Category deleted successfully" }
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    // Check category exists
    const existing = await getCategoryById(id);
    if (!existing) {
      res.status(404).json({
        status: 'error',
        message: `Category with ID ${id} not found`,
      });
      return;
    }

    // Reassign items/templates to the reserved "uncategorized" sentinel and
    // delete the category atomically inside a single transaction so they can't
    // partially apply. Follows the getClient BEGIN/COMMIT/ROLLBACK pattern from
    // categoryQueries.reorderCategories.
    let deleted = false;
    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Reassign shopping items with this category to "uncategorized"
      // Use the category name since shopping_items stores category as a string
      await client.query(
        "UPDATE shopping_items SET category = 'uncategorized' WHERE category = $1",
        [existing.name]
      );

      // Also reassign item templates to "uncategorized"
      await client.query(
        "UPDATE item_templates SET category = 'uncategorized' WHERE category = $1",
        [existing.name]
      );

      const deleteResult = await client.query(
        'DELETE FROM categories WHERE id = $1',
        [id]
      );
      deleted = deleteResult.rowCount !== null && deleteResult.rowCount > 0;

      await client.query('COMMIT');
    } catch (txnError) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Ignore rollback errors; the original error is more meaningful.
      }
      throw txnError;
    } finally {
      client.release();
    }

    if (!deleted) {
      res.status(500).json({
        status: 'error',
        message: 'Failed to delete category',
      });
      return;
    }

    // Log activity (non-fatal)
    try {
      const { userId } = req.body;
      await query(
        'INSERT INTO activity_log (event_type, item_title, user_id) VALUES ($1, $2, $3)',
        ['category_deleted', existing.name, userId || null]
      );
    } catch (logError) {
      console.error('Failed to log category_deleted activity:', logError);
    }

    res.status(200).json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete category',
    });
  }
});

export default router;
