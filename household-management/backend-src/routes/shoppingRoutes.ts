/**
 * Shopping API routes
 * Handles shopping list HTTP endpoints for CRUD operations, purchases, and templates
 */

import { Router, Request, Response } from 'express';
import { shoppingService, ShoppingValidationError } from '../services/ShoppingService';
import { Category } from '../models/Shopping';
import { getAllCategories } from '../db/categoryQueries';
import { searchItemTemplates, searchShoppingItems, getItemById, moveShoppingItem, getRecentPurchases, getShoppingItemsPage, ShoppingListCursor } from '../db/shoppingQueries';
import { getShoppingListById } from '../db/listQueries';
import { query } from '../db/connection';
import { decodeCursor } from '../utils/cursor';

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

    // Log activity for the new shopping item
    try {
      await query(
        'INSERT INTO activity_log (event_type, item_title, user_id) VALUES ($1, $2, $3)',
        ['shopping_item_added', item.name, addedBy]
      );
    } catch { /* non-fatal */ }

    // Log activity for item template creation (templates are implicitly created when adding items directly)
    if (!templateId) {
      try {
        await query(
          'INSERT INTO activity_log (event_type, item_title, user_id) VALUES ($1, $2, $3)',
          ['item_template_created', item.name, addedBy]
        );
      } catch (err) {
        console.error('Failed to log item_template_created activity:', err);
      }
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
 * POST /api/shopping/restore
 * Restore (recreate) a previously deleted shopping item from a full payload
 * including its original id. Uses INSERT ... ON CONFLICT (id) DO NOTHING so
 * restoring an item that still exists is a harmless no-op success, and
 * restoring one that was deleted recreates it.
 *
 * Request body (full shopping item, camelCase or snake_case accepted):
 * {
 *   "id": "uuid",
 *   "name": "Milk",
 *   "category": "dairy",
 *   "addedBy": "uuid",
 *   "isPurchased": false,
 *   "purchasedBy": "uuid" | null,
 *   "listId": "uuid" | null,
 *   "createdAt": "..."
 * }
 *
 * Response: 200 OK
 * { "message": "Shopping item restored successfully" }
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
    const category = body.category;
    const addedBy = body.addedBy ?? body.added_by;
    const isPurchased = body.isPurchased ?? body.is_purchased ?? false;
    const purchasedBy = body.purchasedBy ?? body.purchased_by ?? null;
    const listId = body.listId ?? body.list_id ?? null;
    const createdAt = body.createdAt ?? body.created_at ?? null;

    const missingFields: string[] = [];
    if (!id) missingFields.push('id');
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

    await query(
      `INSERT INTO shopping_items (id, name, category, added_by, is_purchased, purchased_by, list_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, CURRENT_TIMESTAMP))
       ON CONFLICT (id) DO NOTHING`,
      [id, name, category, addedBy, isPurchased, purchasedBy, listId, createdAt]
    );

    res.status(200).json({ message: 'Shopping item restored successfully' });
  } catch (error) {
    console.error('Error restoring shopping item:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to restore shopping item',
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
 * GET /api/shopping/search
 * Search shopping items by name for autocomplete (returns name-category pairs)
 *
 * Query parameters:
 *   q     - Search query (required, min 1 character)
 *   limit - Maximum results to return (optional, default 8)
 *
 * Response: 200 OK
 * { "results": [{ "name": "...", "category": "...", "usageCount": 5 }] }
 *
 * Response: 400 Bad Request
 * { "status": "error", "message": "Search query must be at least 1 character" }
 *
 * Requirements: 8.1, 8.2, 8.3
 */
router.get('/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const { q, limit } = req.query;

    const searchQuery = (q as string || '').trim();

    if (searchQuery.length < 1) {
      res.status(400).json({
        status: 'error',
        message: 'Search query must be at least 1 character',
      });
      return;
    }

    const parsedLimit = limit ? Math.min(Math.max(1, parseInt(limit as string, 10) || 8), 20) : 8;

    const results = await searchShoppingItems(searchQuery, parsedLimit);

    res.status(200).json({ results });
  } catch (error) {
    console.error('Error searching shopping items:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to search shopping items',
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
      // "uncategorized" is a special reserved value, always valid
      if (category.toLowerCase() !== 'uncategorized') {
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

    // Log activity for item template update
    try {
      await query(
        'INSERT INTO activity_log (event_type, item_title, user_id) VALUES ($1, $2, $3)',
        ['item_template_updated', template.name, req.body.userId || null]
      );
    } catch (err) {
      console.error('Failed to log item_template_updated activity:', err);
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

    const { deleteItemTemplate, getItemTemplateById } = await import('../db/shoppingQueries');

    // Fetch template name before deletion for activity logging
    const templateToDelete = await getItemTemplateById(id);

    const deleted = await deleteItemTemplate(id);

    if (!deleted) {
      res.status(404).json({
        status: 'error',
        message: `Item template with ID ${id} not found`,
      });
      return;
    }

    // Log activity for item template deletion
    if (templateToDelete) {
      try {
        await query(
          'INSERT INTO activity_log (event_type, item_title, user_id) VALUES ($1, $2, $3)',
          ['item_template_deleted', templateToDelete.name, req.body.userId || null]
        );
      } catch (err) {
        console.error('Failed to log item_template_deleted activity:', err);
      }
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
 * GET /api/shopping/purchases
 * Get recently purchased shopping items for history display
 *
 * Query parameters:
 *   days  - Number of days to look back (optional, default 30)
 *   limit - Maximum results to return (optional, default 30)
 *
 * Response: 200 OK
 * { "items": [ ... ] }
 */
router.get('/purchases', async (req: Request, res: Response): Promise<void> => {
  try {
    const { days, limit } = req.query;

    const parsedDays = days ? Math.min(Math.max(1, parseInt(days as string, 10) || 30), 365) : 30;
    const parsedLimit = limit ? Math.min(Math.max(1, parseInt(limit as string, 10) || 30), 100) : 30;

    const items = await getRecentPurchases(parsedDays, parsedLimit);

    res.status(200).json({ items });
  } catch (error) {
    console.error('Error fetching recent purchases:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch recent purchases',
    });
  }
});

/**
 * GET /api/shopping/paginated?limit=<n>&cursor=<opaque>&listId=<id>
 * Cursor-paginated shopping list (unpurchased items) with a stable
 * (category ASC, name ASC, id ASC) ordering.
 *
 * Query parameters:
 *   limit  - page size (clamped to max 200, default 50)
 *   cursor - opaque base64 cursor from a previous response's nextCursor
 *   listId - optional shopping list filter
 *
 * Response: 200 OK
 *   { "items": [ ShoppingItem ], "nextCursor": string | null, "pageSize": number }
 *
 * A malformed cursor yields 400.
 *
 * NOTE: Registered before GET /:id so Express does not treat "paginated" as an id.
 */
router.get('/paginated', async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit, cursor, listId } = req.query;

    let decoded: ShoppingListCursor | null = null;
    if (cursor !== undefined && cursor !== '') {
      try {
        decoded = decodeCursor<ShoppingListCursor>(cursor as string);
      } catch {
        res.status(400).json({
          status: 'error',
          message: 'Invalid cursor parameter',
        });
        return;
      }
    }

    const parsedLimit = limit !== undefined ? Number(limit) : undefined;
    const listIdFilter = listId !== undefined && listId !== '' ? (listId as string) : undefined;
    const page = await getShoppingItemsPage(decoded, parsedLimit, listIdFilter);
    res.status(200).json(page);
  } catch (error) {
    console.error('Error fetching paginated shopping list:', error);
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

    // Log activity for the edited shopping item
    try {
      await query(
        'INSERT INTO activity_log (event_type, item_title, user_id) VALUES ($1, $2, $3)',
        ['shopping_item_edited', item.name, req.body.userId || item.addedBy || null]
      );
    } catch { /* non-fatal */ }

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

    // Fetch item name before deletion for activity logging
    const itemToDelete = await getItemById(id);

    await shoppingService.deleteItem(id);

    // Log activity for the removed shopping item
    if (itemToDelete) {
      try {
        await query(
          'INSERT INTO activity_log (event_type, item_title, user_id) VALUES ($1, $2, $3)',
          ['shopping_item_removed', itemToDelete.name, req.body.userId || itemToDelete.addedBy || null]
        );
      } catch { /* non-fatal */ }
    }

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

    // Log activity for shopping item move
    if (updatedItem) {
      try {
        await query(
          'INSERT INTO activity_log (event_type, item_title, user_id) VALUES ($1, $2, $3)',
          ['shopping_item_moved', updatedItem.name, req.body.userId || null]
        );
      } catch (err) {
        console.error('Failed to log shopping_item_moved activity:', err);
      }
    }

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
