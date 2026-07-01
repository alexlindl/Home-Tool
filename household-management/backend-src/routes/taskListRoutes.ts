/**
 * Task List API routes
 * CRUD endpoints for managing multiple task lists
 */

import { Router, Request, Response } from 'express';
import {
  getTaskLists,
  getTaskListById,
  createTaskList,
  updateTaskList,
  deleteTaskList,
  findTaskListByName,
} from '../db/listQueries';

const router = Router();

/**
 * GET /api/task-lists
 * Get all task lists
 *
 * Response: 200 OK
 * { "lists": [ ... ] }
 */
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const lists = await getTaskLists();
    res.status(200).json({ lists });
  } catch (error) {
    console.error('Error fetching task lists:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch task lists',
    });
  }
});

/**
 * POST /api/task-lists
 * Create a new task list
 *
 * Request body: { "name": "Work Tasks" }
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

    const list = await createTaskList(name.trim());
    res.status(201).json({ list });
  } catch (error) {
    console.error('Error creating task list:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create task list',
    });
  }
});

/**
 * PUT /api/task-lists/:id
 * Update a task list name
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
    const duplicate = await findTaskListByName(trimmedName, id);
    if (duplicate) {
      res.status(409).json({
        status: 'error',
        message: 'A task list with this name already exists',
      });
      return;
    }

    const list = await updateTaskList(id, trimmedName);

    if (!list) {
      res.status(404).json({
        status: 'error',
        message: `Task list with ID ${id} not found`,
      });
      return;
    }

    res.status(200).json({ list });
  } catch (error) {
    console.error('Error updating task list:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update task list',
    });
  }
});

/**
 * DELETE /api/task-lists/:id
 * Delete a task list and all tasks in it.
 * Cannot delete the default list.
 *
 * Response: 200 OK
 * { "message": "Task list deleted successfully" }
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    // Check if this is the default list
    const list = await getTaskListById(id);
    if (!list) {
      res.status(404).json({
        status: 'error',
        message: `Task list with ID ${id} not found`,
      });
      return;
    }

    if (list.isDefault) {
      res.status(400).json({
        status: 'error',
        message: 'Cannot delete the default task list',
      });
      return;
    }

    await deleteTaskList(id);
    res.status(200).json({ message: 'Task list deleted successfully' });
  } catch (error) {
    console.error('Error deleting task list:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete task list',
    });
  }
});

export default router;
