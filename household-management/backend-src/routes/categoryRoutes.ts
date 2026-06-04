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
  updateCategory,
  deleteCategory,
} from '../db/categoryQueries';
import { query } from '../db/connection';

const router = Router();

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

    const category = await updateCategory(id, trimmedName);
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

    // Reassign shopping items with this category to "uncategorized"
    // Use the category name since shopping_items stores category as a string
    await query(
      "UPDATE shopping_items SET category = 'household' WHERE category = $1",
      [existing.name]
    );

    // Also reassign item templates
    await query(
      "UPDATE item_templates SET category = 'household' WHERE category = $1",
      [existing.name]
    );

    const deleted = await deleteCategory(id);
    if (!deleted) {
      res.status(500).json({
        status: 'error',
        message: 'Failed to delete category',
      });
      return;
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
