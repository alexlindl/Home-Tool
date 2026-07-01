/**
 * Summary API routes
 * Provides aggregated data endpoints for Home Assistant dashboard integration.
 * All responses include Cache-Control: max-age=30 for HA REST sensor polling.
 */

import { Router, Request, Response } from 'express';
import { summaryService, SummaryNotFoundError } from '../services';

const router = Router();

/**
 * GET /api/summary/tasks
 * Get aggregated task summary for HA dashboard consumption.
 *
 * Query parameters:
 *   assignedTo - Filter by user ID
 *   listId     - Filter by task list ID
 *   limit      - Maximum number of tasks in the array (positive integer)
 *
 * Response: 200 OK with Cache-Control: max-age=30
 * { totalPending, totalOverdue, tasks, perUser, lastUpdated }
 *
 * Response: 400 Bad Request (invalid limit)
 * { "status": "error", "message": "limit must be a positive integer" }
 */
router.get('/tasks', async (req: Request, res: Response): Promise<void> => {
  try {
    const { assignedTo, listId, limit } = req.query;

    // Validate limit if provided
    if (limit !== undefined) {
      const num = Number(limit);
      if (!Number.isInteger(num) || num <= 0 || isNaN(num)) {
        res.status(400).json({
          status: 'error',
          message: 'limit must be a positive integer',
        });
        return;
      }
    }

    const filters: { assignedTo?: string; listId?: string; limit?: number } = {};

    if (assignedTo) {
      filters.assignedTo = assignedTo as string;
    }
    if (listId) {
      filters.listId = listId as string;
    }
    if (limit !== undefined) {
      filters.limit = Number(limit);
    }

    const summary = await summaryService.getTaskSummary(filters);

    res.setHeader('Cache-Control', 'max-age=30');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json(summary);
  } catch (error) {
    console.error('Error fetching task summary:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error',
    });
  }
});

/**
 * GET /api/summary/shopping
 * Get aggregated shopping summary for HA dashboard consumption.
 *
 * Query parameters:
 *   listId - Filter by shopping list ID
 *   limit  - Maximum number of items in the flat array (positive integer)
 *
 * Response: 200 OK with Cache-Control: max-age=30
 * { totalUnpurchased, items, byCategory, lastUpdated }
 *
 * Response: 400 Bad Request (invalid limit)
 * { "status": "error", "message": "limit must be a positive integer" }
 */
router.get('/shopping', async (req: Request, res: Response): Promise<void> => {
  try {
    const { listId, limit } = req.query;

    // Validate limit if provided
    if (limit !== undefined) {
      const num = Number(limit);
      if (!Number.isInteger(num) || num <= 0 || isNaN(num)) {
        res.status(400).json({
          status: 'error',
          message: 'limit must be a positive integer',
        });
        return;
      }
    }

    const filters: { listId?: string; limit?: number } = {};

    if (listId) {
      filters.listId = listId as string;
    }
    if (limit !== undefined) {
      filters.limit = Number(limit);
    }

    const summary = await summaryService.getShoppingSummary(filters);

    res.setHeader('Cache-Control', 'max-age=30');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json(summary);
  } catch (error) {
    console.error('Error fetching shopping summary:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error',
    });
  }
});

/**
 * GET /api/summary/user/:userId
 * Get per-user summary for HA dashboard consumption.
 *
 * Response: 200 OK with Cache-Control: max-age=30
 * { userName, pendingCount, overdueCount, completedLast7Days, nextTask, lastUpdated }
 *
 * Response: 404 Not Found (invalid user ID)
 * { "status": "error", "message": "User not found" }
 */
router.get('/user/:userId', async (req: Request<{ userId: string }>, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const summary = await summaryService.getUserSummary(userId);

    res.setHeader('Cache-Control', 'max-age=30');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json(summary);
  } catch (error) {
    if (error instanceof SummaryNotFoundError) {
      res.status(404).json({
        status: 'error',
        message: error.message,
      });
      return;
    }

    console.error('Error fetching user summary:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error',
    });
  }
});

export default router;
