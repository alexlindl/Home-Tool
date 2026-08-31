/**
 * Shopping List API routes
 * CRUD endpoints for managing multiple shopping lists
 */

import { Router, Request, Response } from 'express';
import {
  getShoppingLists,
  getShoppingListById,
  createShoppingList,
  updateShoppingList,
  deleteShoppingList,
  findShoppingListByName,
} from '../db/listQueries';
import { query } from '../db/connection';

const router = Router();

/**
 * GET /api/shopping-lists
 * Get all shopping lists
 *
 * Response: 200 OK
 * { "lists": [ ... ] }
 */
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const lists = await getShoppingLists();
    res.status(200).json({ lists });
  } catch (error) {
    console.error('Error fetching shopping lists:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch shopping lists',
    });
  }
});

/**
 * POST /api/shopping-lists
 * Create a new shopping list
 *
 * Request body: { "name": "Party Supplies" }
 *
 * Response: 201 Created
 * { "list": { ... } }
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

    const list = await createShoppingList(name.trim());
    res.status(201).json({ list });
  } catch (error) {
    console.error('Error creating shopping list:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create shopping list',
    });
  }
});

/**
 * POST /api/shopping-lists/restore
 * Restore (recreate) a previously deleted shopping list from a full payload
 * including its original id. Uses INSERT ... ON CONFLICT (id) DO NOTHING so
 * restoring a list that still exists is a harmless no-op success, and
 * restoring one that was deleted recreates it.
 *
 * Request body (full shopping list, camelCase or snake_case accepted):
 * {
 *   "id": "uuid",
 *   "name": "Party Supplies",
 *   "isDefault": false,
 *   "createdAt": "..."
 * }
 *
 * Response: 200 OK
 * { "message": "Shopping list restored successfully" }
 *
 * Response: 400 Bad Request (missing payload)
 * { "status": "error", "message": "..." }
 *
 * Requirements: 4.9, 4.10
 */
router.post('/restore', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body ?? {};
    const id = body.id;
    const name = body.name;
    const isDefault = body.isDefault ?? body.is_default ?? false;
    const createdAt = body.createdAt ?? body.created_at ?? null;

    const missingFields: string[] = [];
    if (!id) missingFields.push('id');
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      missingFields.push('name');
    }

    if (missingFields.length > 0) {
      res.status(400).json({
        status: 'error',
        message: `Missing required fields: ${missingFields.join(', ')}`,
      });
      return;
    }

    await query(
      `INSERT INTO shopping_lists (id, name, is_default, created_at)
       VALUES ($1, $2, $3, COALESCE($4, CURRENT_TIMESTAMP))
       ON CONFLICT (id) DO NOTHING`,
      [id, name, isDefault, createdAt]
    );

    res.status(200).json({ message: 'Shopping list restored successfully' });
  } catch (error) {
    console.error('Error restoring shopping list:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to restore shopping list',
    });
  }
});

/**
 * PUT /api/shopping-lists/:id
 * Update a shopping list name
 *
 * Request body: { "name": "New Name" }
 *
 * Response: 200 OK
 * { "list": { ... } }
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

    const trimmedName = name.trim();

    if (trimmedName.length > 100) {
      res.status(400).json({
        status: 'error',
        message: 'Name must not exceed 100 characters',
      });
      return;
    }

    // Check for duplicate name (case-insensitive), excluding current list
    const duplicate = await findShoppingListByName(trimmedName, id);
    if (duplicate) {
      res.status(409).json({
        status: 'error',
        message: 'A shopping list with this name already exists',
      });
      return;
    }

    const list = await updateShoppingList(id, trimmedName);

    if (!list) {
      res.status(404).json({
        status: 'error',
        message: `Shopping list with ID ${id} not found`,
      });
      return;
    }

    res.status(200).json({ list });
  } catch (error) {
    console.error('Error updating shopping list:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update shopping list',
    });
  }
});

/**
 * DELETE /api/shopping-lists/:id
 * Delete a shopping list and all items in it.
 * Cannot delete the default list.
 *
 * Response: 200 OK
 * { "message": "Shopping list deleted successfully" }
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    // Check if this is the default list
    const list = await getShoppingListById(id);
    if (!list) {
      res.status(404).json({
        status: 'error',
        message: `Shopping list with ID ${id} not found`,
      });
      return;
    }

    if (list.isDefault) {
      res.status(400).json({
        status: 'error',
        message: 'Cannot delete the default shopping list',
      });
      return;
    }

    await deleteShoppingList(id);
    res.status(200).json({ message: 'Shopping list deleted successfully' });
  } catch (error) {
    console.error('Error deleting shopping list:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete shopping list',
    });
  }
});

export default router;
