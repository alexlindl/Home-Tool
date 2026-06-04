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
} from '../db/listQueries';

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

    const list = await updateShoppingList(id, name.trim());

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
