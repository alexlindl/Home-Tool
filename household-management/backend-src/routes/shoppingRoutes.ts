/**
 * Shopping API routes
 * Handles shopping list HTTP endpoints for CRUD operations, purchases, and templates
 */

import { Router, Request, Response } from 'express';
import { shoppingService, ShoppingValidationError } from '../services/ShoppingService';
import { Category } from '../models/Shopping';
import { getAllCategories } from '../db/categoryQueries';
import { searchItemTemplates, getItemById, moveShoppingItem } from '../db/shoppingQueries';
import { getShoppingListById } from '../db/listQueries';

const router = Router();

/**
 * POST /api/shopping
 * Add a new shopping item
 *
 * Request body:
 * {
 *   "name": "Milk",
 *   "category": "dairy",
 *   "addedBy": "uuid",
 *   "templateId": "uuid"  // optional – use a template instead
 * }
 *
 * Response: 201 Created
 * { "item": { ... } }
 *
 * Response: 400 Bad Request (validation error)
 * { "status": "error", "message": "..." }
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, category, addedBy, templateId, listId } = req.body;

    let item;

    if (templateId) {
      // Add item from template
      if (!addedBy) {
        res.status(400).json({
          status: 'error',
          message: 'Missing required field: addedBy',
        });
        return;
      }

      item = await shoppingService.addItemFromTemplate(templateId, { addedBy, listId });
    } else {
      // Add item directly
      const missingFields: string[] = [];
      if (!name) missingFields.push('name');
      if (!category) missingFields.push('category');
      if (!addedBy) missingFields.push('addedBy');

      if (missingFields.length > 0) {
        res.status(400).json({
          status: 'error',
          message: `Missing required fields: ${missingFields.join(', ')}`,
        });
        return;
      }

      item = await shoppingService.addItem({
        name,
        category,
        addedBy,
        listId,
      });
    }

    res.status(201).json({ item });
  } catch (error) {
    console.error('Error adding shopping item:', error);

    if (error instanceof ShoppingValidationError) {
      res.status(400).json({
        status: 'error',
        message: error.message,
      });
      return;
    }

    if (error instanceof Error && error.message.includes('template')) {
      res.status(404).json({
        status: 'error',
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      status: 'error',
      message: 'Failed to add shopping item',
    });
  }
});

/**
 * GET /api/shopping/templates
 * Get all item templates with optional filtering
 *
 * Query parameters:
 *   isPrePopulated - Filter by template type ('true' | 'false')
 *
 * Response: 200 OK
 * { "templates": [ ... ] }
 *
 * NOTE: This route MUST be registered before GET /:id so Express does not
 * treat the literal string "templates" as an item ID.
 *
 * Requirements: 8.1, 8.2, 8.4
 */
router.get('/templates', async (req: Request, res: Response): Promise<void> => {
  try {
    const { isPrePopulated } = req.query;

    const filters: { isPrePopulated?: boolean } = {};

    if (isPrePopulated !== undefined) {
      if (isPrePopulated !== 'true' && isPrePopulated !== 'false') {
        res.status(400).json({
          status: 'error',
          message: 'Invalid isPrePopulated parameter. Must be "true" or "false"',
        });
        return;
      }
      filters.isPrePopulated = isPrePopulated === 'true';
    }

    const templates = await shoppingService.getItemTemplates(
      Object.keys(filters).length > 0 ? filters : undefined
    );

    res.status(200).json({ templates });
  } catch (error) {
    console.error('Error fetching item templates:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch item templates',
    });
  }
});

/**
 * GET /api/shopping/templates/search
 * Search item templates by name substring (for autocomplete)
 *
 * Query parameters:
 *   q     - Search query (required, min 2 characters)
 *   limit - Maximum results to return (optional, default 8, max 20)
 *
 * Response: 200 OK
 * { "templates": [ ... ] }
 *
 * Response: 400 Bad Request
 * { "status": "error", "message": "Search query must be at least 2 characters" }
 *
 * Requirements: 3.2, 3.3, 3.5
 */
router.get('/templates/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const { q, limit } = req.query;

    const searchQuery = (q as string || '').trim();

    if (searchQuery.length < 2) {
      res.status(400).json({
        status: 'error',
        message: 'Search query must be at least 2 characters',
      });
      return;
    }

    const parsedLimit = limit ? Math.min(Math.max(1, parseInt(limit as string, 10) || 8), 20) : 8;

    const templates = await searchItemTemplates(searchQuery, parsedLimit);

    res.status(200).json({ templates });
  } catch (error) {
    console.error('Error searching item templates:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to search item templates',
    });
  }
});

/**
 * PUT /api/shopping/templates/:id
 * Update an item template
 *
 * Request body:
 * { "name": "New Name", "category": "dairy" }
 *
 * Response: 200 OK
 * { "template": { ... } }
 */
router.put('/templates/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { name, category } = req.body;

    // At least one field should be provided
    if (name === undefined && category === undefined) {
      res.status(400).json({
        status: 'error',
        message: 'At least one field (name or category) must be provided',
      });
      return;
    }

    // Validate name if provided
    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      res.status(400).json({
        status: 'error',
        message: 'Name must be a non-empty string',
      });
      return;
    }

    // Validate category if provided
    if (category !== undefined) {
      const categories = await getAllCategories();
      const validCategoryNames = categories.map(c => c.name);
      if (!validCategoryNames.includes(category)) {
        res.status(400).json({
          status: 'error',
          message: `Invalid category. Must be one of: ${validCategoryNames.join(', ')}`,
        });
        return;
      }
    }

    const { updateItemTemplate } = await import('../db/shoppingQueries');
    const template = await updateItemTemplate(id, name?.trim(), category);

    if (!template) {
      res.status(404).json({
        status: 'error',
        message: `Item template with ID ${id} not found`,
      });
      return;
    }

    res.status(200).json({ template });
  } catch (error) {
    console.error('Error updating item template:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update item template',
    });
  }
});

/**
 * DELETE /api/shopping/templates/:id
 * Delete an item template
 *
 * Response: 200 OK
 * { "message": "Item template deleted successfully" }
 */
router.delete('/templates/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const { deleteItemTemplate } = await import('../db/shoppingQueries');
    const deleted = await deleteItemTemplate(id);

    if (!deleted) {
      res.status(404).json({
        status: 'error',
        message: `Item template with ID ${id} not found`,
      });
      return;
    }

    res.status(200).json({ message: 'Item template deleted successfully' });
  } catch (error) {
    console.error('Error deleting item template:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete item template',
    });
  }
});

/**
 * GET /api/shopping
 * Get the shopping list (unpurchased items)
 *
 * Query parameters:
 *   category - Filter by category (optional)
 *
 * Response: 200 OK
 * { "items": [ ... ] }
 *
 * Requirements: 7.1, 9.1, 9.2, 9.3
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, listId } = req.query;

    let items;

    if (category) {
      items = await shoppingService.getItemsByCategory(category as Category, listId as string | undefined);
    } else {
      items = await shoppingService.getShoppingList(listId as string | undefined);
    }

    res.status(200).json({ items });
  } catch (error) {
    console.error('Error fetching shopping list:', error);

    if (error instanceof ShoppingValidationError) {
      res.status(400).json({
        status: 'error',
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch shopping list',
    });
  }
});

/**
 * GET /api/shopping/:id
 * Get a specific shopping item by ID
 *
 * Response: 200 OK
 * { "item": { ... } }
 *
 * Response: 404 Not Found
 * { "status": "error", "message": "..." }
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const item = await shoppingService.getItemById(id);

    if (!item) {
      res.status(404).json({
        status: 'error',
        message: `Shopping item with ID ${id} not found`,
      });
      return;
    }

    res.status(200).json({ item });
  } catch (error) {
    console.error('Error fetching shopping item:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch shopping item',
    });
  }
});

/**
 * PUT /api/shopping/:id
 * Update a shopping item
 *
 * Request body:
 * {
 *   "name": "Organic Milk",   // optional
 *   "category": "dairy"       // optional
 * }
 *
 * Response: 200 OK
 * { "item": { ... } }
 *
 * Response: 404 Not Found
 * { "status": "error", "message": "..." }
 */
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { name, category } = req.body;

    const item = await shoppingService.updateItem(id, { name, category });
    res.status(200).json({ item });
  } catch (error) {
    console.error('Error updating shopping item:', error);

    if (error instanceof ShoppingValidationError) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          status: 'error',
          message: error.message,
        });
        return;
      }

      res.status(400).json({
        status: 'error',
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      status: 'error',
      message: 'Failed to update shopping item',
    });
  }
});

/**
 * DELETE /api/shopping/:id
 * Delete a shopping item
 *
 * Response: 200 OK
 * { "message": "Shopping item deleted successfully" }
 *
 * Response: 404 Not Found
 * { "status": "error", "message": "..." }
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    await shoppingService.deleteItem(id);
    res.status(200).json({ message: 'Shopping item deleted successfully' });
  } catch (error) {
    console.error('Error deleting shopping item:', error);

    if (error instanceof ShoppingValidationError) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          status: 'error',
          message: error.message,
        });
        return;
      }

      res.status(400).json({
        status: 'error',
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      status: 'error',
      message: 'Failed to delete shopping item',
    });
  }
});

/**
 * POST /api/shopping/:id/purchase
 * Mark a shopping item as purchased
 *
 * Request body:
 * {
 *   "userId": "uuid"   // ID of the user who purchased the item
 * }
 *
 * Response: 200 OK
 * { "item": { ... } }
 *
 * Response: 400 Bad Request (validation error)
 * { "status": "error", "message": "..." }
 *
 * Response: 404 Not Found
 * { "status": "error", "message": "..." }
 *
 * Requirements: 10.1, 10.2
 */
router.post('/:id/purchase', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({
        status: 'error',
        message: 'userId is required',
      });
      return;
    }

    const item = await shoppingService.purchaseItem(id, userId as string);
    res.status(200).json({ item });
  } catch (error) {
    console.error('Error purchasing shopping item:', error);

    if (error instanceof ShoppingValidationError) {
      // Only return 404 for shopping item not found, not for user not found
      if (error.message.includes('Shopping item') && error.message.includes('not found')) {
        res.status(404).json({
          status: 'error',
          message: error.message,
        });
        return;
      }

      res.status(400).json({
        status: 'error',
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      status: 'error',
      message: 'Failed to purchase shopping item',
    });
  }
});

/**
 * POST /api/shopping/:id/unpurchase
 * Revert a shopping item to unpurchased state
 *
 * Response: 200 OK
 * { "item": { ... } }
 *
 * Response: 404 Not Found
 * { "status": "error", "message": "..." }
 *
 * Requirements: 9.3
 */
router.post('/:id/unpurchase', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const item = await shoppingService.unpurchaseItem(id);
    res.status(200).json({ item });
  } catch (error) {
    console.error('Error unpurchasing shopping item:', error);

    if (error instanceof ShoppingValidationError) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          status: 'error',
          message: error.message,
        });
        return;
      }

      res.status(400).json({
        status: 'error',
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      status: 'error',
      message: 'Failed to unpurchase shopping item',
    });
  }
});

/**
 * PATCH /api/shopping/:id/move
 * Move a shopping item to a different list
 *
 * Request body:
 * { "targetListId": "uuid" }
 *
 * Response: 200 OK
 * { "item": { ... } }
 *
 * Response: 400 Bad Request (missing targetListId)
 * { "status": "error", "message": "targetListId is required" }
 *
 * Response: 404 Not Found (target list or item not found)
 * { "status": "error", "message": "..." }
 */
router.patch('/:id/move', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { targetListId } = req.body;

    // Validate targetListId is present
    if (!targetListId) {
      res.status(400).json({
        status: 'error',
        message: 'targetListId is required',
      });
      return;
    }

    // Validate target list exists
    const targetList = await getShoppingListById(targetListId);
    if (!targetList) {
      res.status(404).json({
        status: 'error',
        message: `Target list with ID ${targetListId} not found`,
      });
      return;
    }

    // Validate shopping item exists
    const existingItem = await getItemById(id as string);
    if (!existingItem) {
      res.status(404).json({
        status: 'error',
        message: `Shopping item with ID ${id} not found`,
      });
      return;
    }

    // Move the item
    const updatedItem = await moveShoppingItem(id as string, targetListId);
    res.status(200).json({ item: updatedItem });
  } catch (error) {
    console.error('Error moving shopping item:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to move shopping item',
    });
  }
});

export default router;
