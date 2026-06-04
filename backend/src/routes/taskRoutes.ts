/**
 * Task API routes
 * Handles task-related HTTP endpoints for CRUD operations
 */

import { Router, Request, Response } from 'express';
import { taskService } from '../services/TaskService';
import { TaskValidationError } from '../services/TaskService';
import { TaskFilters } from '../db/taskQueries';

const router = Router();

/**
 * POST /api/tasks
 * Create a new task
 *
 * Request body:
 * {
 *   "title": "Vacuum Living Room",
 *   "description": "Optional description",
 *   "assignedTo": "uuid",
 *   "createdBy": "uuid",
 *   "dueDate": "2024-01-15T10:00:00.000Z",
 *   "isRecurring": false,
 *   "recurrenceFrequency": "weekly",   // required if isRecurring=true
 *   "recurrenceInterval": 1,           // required if isRecurring=true
 *   "recurrenceEndDate": "2024-12-31T00:00:00.000Z"  // optional
 * }
 *
 * Response: 201 Created
 * { "task": { ... } }
 *
 * Response: 400 Bad Request (validation error)
 * { "status": "error", "message": "..." }
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      title,
      description,
      assignedTo,
      createdBy,
      dueDate,
      isRecurring,
      recurrenceFrequency,
      recurrenceInterval,
      recurrenceEndDate,
      fromPrePopulatedTemplate,
      listId,
    } = req.body;

    // Validate required fields
    const missingFields: string[] = [];
    if (!title) missingFields.push('title');
    if (!assignedTo) missingFields.push('assignedTo');
    if (!createdBy) missingFields.push('createdBy');
    if (!dueDate) missingFields.push('dueDate');
    if (isRecurring === undefined || isRecurring === null) missingFields.push('isRecurring');

    if (missingFields.length > 0) {
      res.status(400).json({
        status: 'error',
        message: `Missing required fields: ${missingFields.join(', ')}`,
      });
      return;
    }

    // Parse dueDate
    const parsedDueDate = new Date(dueDate);
    if (isNaN(parsedDueDate.getTime())) {
      res.status(400).json({
        status: 'error',
        message: 'Invalid dueDate format. Must be a valid ISO date string',
      });
      return;
    }

    // Parse recurrenceEndDate if provided
    let parsedRecurrenceEndDate: Date | undefined;
    if (recurrenceEndDate) {
      parsedRecurrenceEndDate = new Date(recurrenceEndDate);
      if (isNaN(parsedRecurrenceEndDate.getTime())) {
        res.status(400).json({
          status: 'error',
          message: 'Invalid recurrenceEndDate format. Must be a valid ISO date string',
        });
        return;
      }
    }

    const task = await taskService.createTask({
      title,
      description,
      assignedTo,
      createdBy,
      dueDate: parsedDueDate,
      isRecurring: Boolean(isRecurring),
      recurrenceFrequency,
      recurrenceInterval: recurrenceInterval !== undefined ? Number(recurrenceInterval) : undefined,
      recurrenceEndDate: parsedRecurrenceEndDate,
      fromPrePopulatedTemplate,
      listId,
    });

    res.status(201).json({ task });
  } catch (error) {
    console.error('Error creating task:', error);

    if (error instanceof TaskValidationError) {
      res.status(400).json({
        status: 'error',
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      status: 'error',
      message: 'Failed to create task',
    });
  }
});

/**
 * GET /api/tasks/history
 * Get task history for the past N days (default 30)
 *
 * Query parameters:
 *   days - Number of days to look back (default: 30, must be a positive integer)
 *
 * Response: 200 OK
 * { "history": [ ... ] }
 *
 * Response: 400 Bad Request (invalid days param)
 * { "status": "error", "message": "..." }
 *
 * NOTE: This route MUST be registered before GET /:id so Express does not
 * treat the literal string "history" as a task ID.
 */
router.get('/history', async (req: Request, res: Response): Promise<void> => {
  try {
    const { days } = req.query;

    let parsedDays = 30;

    if (days !== undefined) {
      const num = Number(days);
      if (!Number.isInteger(num) || num <= 0 || isNaN(num)) {
        res.status(400).json({
          status: 'error',
          message: 'Invalid days parameter. Must be a positive integer',
        });
        return;
      }
      parsedDays = num;
    }

    const history = await taskService.getTaskHistory(parsedDays);
    res.status(200).json({ history });
  } catch (error) {
    console.error('Error fetching task history:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch task history',
    });
  }
});

/**
 * GET /api/tasks
 * Get all tasks with optional filters
 *
 * Query parameters:
 *   assignedTo  - Filter by user ID
 *   status      - Filter by status ('pending' | 'completed')
 *   dueDateFrom - Filter tasks with dueDate >= this date (ISO string)
 *   dueDateTo   - Filter tasks with dueDate <= this date (ISO string)
 *
 * Response: 200 OK
 * { "tasks": [ ... ] }
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { assignedTo, status, dueDateFrom, dueDateTo, listId } = req.query;

    // Validate status if provided
    if (status && !['pending', 'completed'].includes(status as string)) {
      res.status(400).json({
        status: 'error',
        message: 'Invalid status. Must be one of: pending, completed',
      });
      return;
    }

    const filters: TaskFilters = {};

    if (assignedTo) {
      filters.assignedTo = assignedTo as string;
    }

    if (status) {
      filters.status = status as 'pending' | 'completed';
    }

    if (dueDateFrom) {
      const parsed = new Date(dueDateFrom as string);
      if (isNaN(parsed.getTime())) {
        res.status(400).json({
          status: 'error',
          message: 'Invalid dueDateFrom format. Must be a valid ISO date string',
        });
        return;
      }
      filters.dueDateFrom = parsed;
    }

    if (dueDateTo) {
      const parsed = new Date(dueDateTo as string);
      if (isNaN(parsed.getTime())) {
        res.status(400).json({
          status: 'error',
          message: 'Invalid dueDateTo format. Must be a valid ISO date string',
        });
        return;
      }
      filters.dueDateTo = parsed;
    }

    if (listId) {
      filters.listId = listId as string;
    }

    const tasks = await taskService.getTasks(filters);
    res.status(200).json({ tasks });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch tasks',
    });
  }
});

/**
 * GET /api/tasks/templates
 * Get all task templates with optional filtering
 *
 * Query parameters:
 *   isPrePopulated - Filter by template type ('true' | 'false')
 *                    When omitted, returns both pre-populated and custom templates
 *
 * Response: 200 OK
 * { "templates": [ ... ] }
 *
 * Response: 400 Bad Request (invalid isPrePopulated param)
 * { "status": "error", "message": "..." }
 *
 * NOTE: This route MUST be registered before GET /:id so Express does not
 * treat the literal string "templates" as a task ID.
 *
 * Requirements: 3.1, 3.2, 3.4
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

    const templates = await taskService.getTaskTemplates(
      Object.keys(filters).length > 0 ? filters : undefined
    );

    res.status(200).json({ templates });
  } catch (error) {
    console.error('Error fetching task templates:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch task templates',
    });
  }
});

/**
 * PUT /api/tasks/templates/:id
 * Update a task template
 *
 * Request body:
 * { "title": "New Title", "description": "New desc" }
 *
 * Response: 200 OK
 * { "template": { ... } }
 */
router.put('/templates/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;

    // At least one field should be provided
    if (title === undefined && description === undefined) {
      res.status(400).json({
        status: 'error',
        message: 'At least one field (title or description) must be provided',
      });
      return;
    }

    // Validate title if provided
    if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0)) {
      res.status(400).json({
        status: 'error',
        message: 'Title must be a non-empty string',
      });
      return;
    }

    const { updateTaskTemplate } = await import('../db/taskQueries');
    const template = await updateTaskTemplate(id as string, title?.trim(), description);

    if (!template) {
      res.status(404).json({
        status: 'error',
        message: `Task template with ID ${id} not found`,
      });
      return;
    }

    res.status(200).json({ template });
  } catch (error) {
    console.error('Error updating task template:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update task template',
    });
  }
});

/**
 * DELETE /api/tasks/templates/:id
 * Delete a task template
 *
 * Response: 200 OK
 * { "message": "Task template deleted successfully" }
 */
router.delete('/templates/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const { deleteTaskTemplate } = await import('../db/taskQueries');
    const deleted = await deleteTaskTemplate(id as string);

    if (!deleted) {
      res.status(404).json({
        status: 'error',
        message: `Task template with ID ${id} not found`,
      });
      return;
    }

    res.status(200).json({ message: 'Task template deleted successfully' });
  } catch (error) {
    console.error('Error deleting task template:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete task template',
    });
  }
});

/**
 * GET /api/tasks/:id
 * Get a specific task by ID
 *
 * Response: 200 OK
 * { "task": { ... } }
 *
 * Response: 404 Not Found
 * { "status": "error", "message": "Task not found" }
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const task = await taskService.getTaskById(id as string);

    if (!task) {
      res.status(404).json({
        status: 'error',
        message: `Task with ID ${id} not found`,
      });
      return;
    }

    res.status(200).json({ task });
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch task',
    });
  }
});

/**
 * POST /api/tasks/:id/complete
 * Mark a task as complete
 *
 * Request body:
 * {
 *   "userId": "uuid"   // ID of the user completing the task
 * }
 *
 * Response: 200 OK
 * { "message": "Task completed successfully" }
 *
 * Response: 404 Not Found
 * { "status": "error", "message": "Task not found" }
 *
 * Response: 400 Bad Request (missing userId or user not found)
 * { "status": "error", "message": "..." }
 */
router.post('/:id/complete', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({
        status: 'error',
        message: 'userId is required',
      });
      return;
    }

    await taskService.completeTask(id as string, userId as string);

    res.status(200).json({ message: 'Task completed successfully' });
  } catch (error) {
    console.error('Error completing task:', error);

    if (error instanceof TaskValidationError) {
      res.status(400).json({
        status: 'error',
        message: error.message,
      });
      return;
    }

    if (error instanceof Error && error.message.match(/Task with ID .+ not found/)) {
      res.status(404).json({
        status: 'error',
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      status: 'error',
      message: 'Failed to complete task',
    });
  }
});

/**
 * PUT /api/tasks/:id
 * Update an existing task (partial update)
 *
 * Request body: Partial task fields
 * {
 *   "title": "Updated title",
 *   "dueDate": "2024-02-01T10:00:00.000Z",
 *   "status": "completed",
 *   ...
 * }
 *
 * Response: 200 OK
 * { "task": { ... } }
 *
 * Response: 404 Not Found
 * { "status": "error", "message": "Task not found" }
 */
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    // Parse date fields if provided
    if (updates.dueDate) {
      const parsed = new Date(updates.dueDate);
      if (isNaN(parsed.getTime())) {
        res.status(400).json({
          status: 'error',
          message: 'Invalid dueDate format. Must be a valid ISO date string',
        });
        return;
      }
      updates.dueDate = parsed;
    }

    if (updates.recurrenceEndDate) {
      const parsed = new Date(updates.recurrenceEndDate);
      if (isNaN(parsed.getTime())) {
        res.status(400).json({
          status: 'error',
          message: 'Invalid recurrenceEndDate format. Must be a valid ISO date string',
        });
        return;
      }
      updates.recurrenceEndDate = parsed;
    }

    if (updates.completedAt) {
      const parsed = new Date(updates.completedAt);
      if (isNaN(parsed.getTime())) {
        res.status(400).json({
          status: 'error',
          message: 'Invalid completedAt format. Must be a valid ISO date string',
        });
        return;
      }
      updates.completedAt = parsed;
    }

    // Validate status if provided
    if (updates.status && !['pending', 'completed'].includes(updates.status)) {
      res.status(400).json({
        status: 'error',
        message: 'Invalid status. Must be one of: pending, completed',
      });
      return;
    }

    // Validate recurrenceFrequency if provided
    if (updates.recurrenceFrequency &&
        !['daily', 'weekly', 'monthly'].includes(updates.recurrenceFrequency)) {
      res.status(400).json({
        status: 'error',
        message: 'Invalid recurrenceFrequency. Must be one of: daily, weekly, monthly',
      });
      return;
    }

    const task = await taskService.updateTask(id as string, updates);
    res.status(200).json({ task });
  } catch (error) {
    console.error('Error updating task:', error);

    // TaskValidationError: invalid input (e.g. assigned user not found)
    if (error instanceof TaskValidationError ||
        (error as Error)?.name === 'TaskValidationError') {
      res.status(400).json({
        status: 'error',
        message: (error as Error).message,
      });
      return;
    }

    // Generic "not found" error: task doesn't exist
    if (error instanceof Error && error.message.match(/Task with ID .+ not found/)) {
      res.status(404).json({
        status: 'error',
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      status: 'error',
      message: 'Failed to update task',
    });
  }
});

/**
 * DELETE /api/tasks/:id
 * Delete a task by ID
 *
 * Response: 200 OK
 * { "message": "Task deleted successfully" }
 *
 * Response: 404 Not Found
 * { "status": "error", "message": "Task not found" }
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await taskService.deleteTask(id as string);

    res.status(200).json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);

    if (error instanceof Error && error.message.match(/Task with ID .+ not found/)) {
      res.status(404).json({
        status: 'error',
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      status: 'error',
      message: 'Failed to delete task',
    });
  }
});

export default router;
