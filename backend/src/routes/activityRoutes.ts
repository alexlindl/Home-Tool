/**
 * Activity API routes
 * Provides a unified activity feed combining task completions and shopping purchases.
 */

import { Router, Request, Response } from 'express';
import { query } from '../db/connection';
import { getActivityLogPage, ActivityLogCursor } from '../db/activityQueries';
import { decodeCursor } from '../utils/cursor';

const router = Router();

interface ActivityEntry {
  type: 'task_completed' | 'item_purchased' | 'task_created' | 'task_edited' | 'task_deleted' | 'shopping_item_added' | 'shopping_item_edited' | 'shopping_item_removed';
  title: string;
  userId: string;
  timestamp: string;
}

/**
 * GET /api/activity?days=30
 * Get combined activity log (task completions + shopping purchases).
 * Returns entries sorted by timestamp DESC, limited to 100.
 *
 * Query parameters:
 *   days - number of days to look back (default 30, max 90)
 *
 * Response: 200 OK
 * { "entries": [ { type, title, userId, timestamp } ] }
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { days } = req.query;
    const parsedDays = days ? Math.min(Math.max(1, parseInt(days as string, 10) || 30), 90) : 30;

    // Query task completions
    const taskResult = await query(
      `SELECT title, completed_by AS user_id, completed_at AS timestamp
       FROM task_history
       WHERE completed_at >= CURRENT_TIMESTAMP - INTERVAL '1 day' * $1
       ORDER BY completed_at DESC
       LIMIT 100`,
      [parsedDays]
    );

    // Query shopping purchases
    const shoppingResult = await query(
      `SELECT name AS title, purchased_by AS user_id, purchased_at AS timestamp
       FROM shopping_items
       WHERE is_purchased = TRUE
         AND purchased_at >= CURRENT_TIMESTAMP - INTERVAL '1 day' * $1
         AND purchased_by IS NOT NULL
         AND purchased_at IS NOT NULL
       ORDER BY purchased_at DESC
       LIMIT 100`,
      [parsedDays]
    );

    // Combine and sort
    const entries: ActivityEntry[] = [];

    for (const row of taskResult.rows) {
      entries.push({
        type: 'task_completed',
        title: row.title,
        userId: row.user_id,
        timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : String(row.timestamp),
      });
    }

    for (const row of shoppingResult.rows) {
      entries.push({
        type: 'item_purchased',
        title: row.title,
        userId: row.user_id,
        timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : String(row.timestamp),
      });
    }

    // Query activity_log entries
    const activityLogResult = await query(
      `SELECT event_type AS type, item_title AS title, user_id, created_at AS timestamp
       FROM activity_log
       WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '1 day' * $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [parsedDays]
    );

    // Map activity_log rows into entries
    for (const row of activityLogResult.rows) {
      entries.push({
        type: row.type,
        title: row.title,
        userId: row.user_id,
        timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : String(row.timestamp),
      });
    }

    // Sort combined by timestamp descending
    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Limit to 100 total
    const limited = entries.slice(0, 100);

    res.status(200).json({ entries: limited });
  } catch (error) {
    console.error('Error fetching activity log:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch activity log',
    });
  }
});

/**
 * GET /api/activity/paginated?limit=<n>&cursor=<opaque>
 * Cursor-paginated Activity_Log feed with a stable (created_at, id) ordering.
 *
 * Query parameters:
 *   limit  - page size (clamped to max 200, default 50)
 *   cursor - opaque base64 cursor from a previous response's nextCursor
 *
 * Response: 200 OK
 *   { "items": [ { id, type, title, userId, timestamp } ], "nextCursor": string | null, "pageSize": number }
 *
 * A malformed cursor yields 400.
 */
router.get('/paginated', async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit, cursor } = req.query;

    let decoded: ActivityLogCursor | null = null;
    if (cursor !== undefined && cursor !== '') {
      try {
        decoded = decodeCursor<ActivityLogCursor>(cursor as string);
      } catch {
        res.status(400).json({
          status: 'error',
          message: 'Invalid cursor parameter',
        });
        return;
      }
    }

    const parsedLimit = limit !== undefined ? Number(limit) : undefined;
    const page = await getActivityLogPage(decoded, parsedLimit);
    res.status(200).json(page);
  } catch (error) {
    console.error('Error fetching paginated activity log:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch activity log',
    });
  }
});

/**
 * DELETE /api/activity
 * Clear all task history entries (activity log cleanup).
 *
 * Response: 200 OK
 * { "message": "Activity history cleared" }
 */
router.delete('/', async (req: Request, res: Response): Promise<void> => {
  try {
    await query('DELETE FROM task_history');

    // Log activity for history cleared
    try {
      const { userId } = req.body;
      await query(
        'INSERT INTO activity_log (event_type, item_title, user_id) VALUES ($1, $2, $3)',
        ['history_cleared', 'Task History', userId || null]
      );
    } catch (logError) {
      console.error('Failed to log history_cleared activity:', logError);
    }

    res.status(200).json({ message: 'Activity history cleared' });
  } catch (error) {
    console.error('Error clearing activity history:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to clear activity history',
    });
  }
});

export default router;
