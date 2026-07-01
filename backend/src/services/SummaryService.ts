/**
 * Summary Service
 * Provides aggregated data for Home Assistant dashboard integration.
 * Queries existing task, shopping, and user tables to produce
 * HA-friendly JSON responses for REST sensor polling.
 */

import { query } from '../db/connection';
import { TaskRow } from '../models/Task';
import { getUserById } from '../db/userQueries';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface TaskSummaryItem {
  id: string;
  title: string;
  assigneeName: string | null;
  dueDate: string | null; // ISO 8601 or null
}

export interface UserTaskSummary {
  name: string;
  pendingCount: number;
  overdueCount: number;
}

export interface TaskSummaryResponse {
  totalPending: number;
  totalOverdue: number;
  tasks: TaskSummaryItem[];
  perUser: UserTaskSummary[];
  lastUpdated: string; // ISO 8601
}

export interface ShoppingSummaryItem {
  id: string;
  name: string;
  category: string;
}

export interface ShoppingSummaryResponse {
  totalUnpurchased: number;
  items: ShoppingSummaryItem[];
  byCategory: Record<string, ShoppingSummaryItem[]>;
  lastUpdated: string; // ISO 8601
}

export interface UserSummaryResponse {
  userName: string;
  pendingCount: number;
  overdueCount: number;
  completedLast7Days: number;
  nextTask: { title: string; dueDate: string } | null;
  lastUpdated: string; // ISO 8601
}

export interface TaskSummaryFilters {
  assignedTo?: string;
  listId?: string;
  limit?: number;
}

export interface ShoppingSummaryFilters {
  listId?: string;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Error class for 404-style errors
// ---------------------------------------------------------------------------

export class SummaryNotFoundError extends Error {
  public statusCode: number;
  constructor(message: string) {
    super(message);
    this.name = 'SummaryNotFoundError';
    this.statusCode = 404;
  }
}

// ---------------------------------------------------------------------------
// SummaryService class
// ---------------------------------------------------------------------------

export class SummaryService {
  /**
   * Get aggregated task summary for HA dashboard consumption.
   *
   * Computes totalPending, totalOverdue, a flat tasks array (sorted by
   * due date ascending, nulls last), and a perUser breakdown.
   *
   * Supports optional filters: assignedTo, listId, limit.
   */
  async getTaskSummary(filters?: TaskSummaryFilters): Promise<TaskSummaryResponse> {
    const now = new Date();

    // Build WHERE clause for pending tasks
    const conditions: string[] = [`t.status = 'pending'`];
    const values: any[] = [];
    let paramCount = 1;

    if (filters?.assignedTo) {
      conditions.push(`(t.assigned_to = $${paramCount} OR t.assigned_to IS NULL)`);
      values.push(filters.assignedTo);
      paramCount++;
    }

    if (filters?.listId) {
      conditions.push(`t.list_id = $${paramCount}`);
      values.push(filters.listId);
      paramCount++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Fetch all matching pending tasks (sorted by due_date ASC NULLS LAST)
    const tasksResult = await query(
      `SELECT t.*, u.name as assignee_name
       FROM tasks t
       LEFT JOIN users u ON t.assigned_to = u.id
       ${whereClause}
       ORDER BY t.due_date ASC NULLS LAST`,
      values
    );

    const rows = tasksResult.rows as (TaskRow & { assignee_name: string | null })[];

    // Compute counts
    let totalPending = rows.length;
    let totalOverdue = 0;

    for (const row of rows) {
      if (row.due_date && new Date(row.due_date) < now) {
        totalOverdue++;
      }
    }

    // Build task items array (apply limit if specified)
    const limitedRows = filters?.limit ? rows.slice(0, filters.limit) : rows;
    const tasks: TaskSummaryItem[] = limitedRows.map((row) => ({
      id: row.id,
      title: row.title,
      assigneeName: row.assignee_name || null,
      dueDate: row.due_date ? new Date(row.due_date).toISOString() : null,
    }));

    // Compute perUser summary from ALL matching tasks (not limited)
    const userMap = new Map<string, { name: string; pendingCount: number; overdueCount: number }>();

    for (const row of rows) {
      const userName = row.assignee_name || 'Anyone';
      const key = row.assigned_to || '__anyone__';

      if (!userMap.has(key)) {
        userMap.set(key, { name: userName, pendingCount: 0, overdueCount: 0 });
      }

      const entry = userMap.get(key)!;
      entry.pendingCount++;
      if (row.due_date && new Date(row.due_date) < now) {
        entry.overdueCount++;
      }
    }

    const perUser: UserTaskSummary[] = Array.from(userMap.values());

    return {
      totalPending,
      totalOverdue,
      tasks,
      perUser,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Get aggregated shopping summary for HA dashboard consumption.
   *
   * Computes totalUnpurchased, a flat items array, and a byCategory grouping.
   *
   * Supports optional filters: listId, limit.
   */
  async getShoppingSummary(filters?: ShoppingSummaryFilters): Promise<ShoppingSummaryResponse> {
    // Build WHERE clause for unpurchased items
    const conditions: string[] = ['si.is_purchased = FALSE'];
    const values: any[] = [];
    let paramCount = 1;

    if (filters?.listId) {
      conditions.push(`si.list_id = $${paramCount}`);
      values.push(filters.listId);
      paramCount++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Fetch all matching unpurchased items
    const itemsResult = await query(
      `SELECT si.id, si.name, si.category
       FROM shopping_items si
       ${whereClause}
       ORDER BY si.category ASC, si.name ASC`,
      values
    );

    const allRows = itemsResult.rows as { id: string; name: string; category: string }[];

    const totalUnpurchased = allRows.length;

    // Apply limit to flat items array
    const limitedRows = filters?.limit ? allRows.slice(0, filters.limit) : allRows;
    const items: ShoppingSummaryItem[] = limitedRows.map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
    }));

    // Build byCategory grouping from the limited items
    const byCategory: Record<string, ShoppingSummaryItem[]> = {};
    for (const item of items) {
      if (!byCategory[item.category]) {
        byCategory[item.category] = [];
      }
      byCategory[item.category].push(item);
    }

    return {
      totalUnpurchased,
      items,
      byCategory,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Get per-user summary for HA dashboard consumption.
   *
   * Returns pending/overdue counts, completed in last 7 days,
   * next upcoming task, and the user's display name.
   *
   * Throws SummaryNotFoundError (404) if user is not found.
   */
  async getUserSummary(userId: string): Promise<UserSummaryResponse> {
    // Verify user exists
    const user = await getUserById(userId);
    if (!user) {
      throw new SummaryNotFoundError('User not found');
    }

    const now = new Date();

    // Get pending tasks for this user (assigned to them OR assigned to anyone/null)
    const pendingResult = await query(
      `SELECT id, title, due_date
       FROM tasks
       WHERE (assigned_to = $1 OR assigned_to IS NULL)
         AND status = 'pending'
       ORDER BY due_date ASC NULLS LAST`,
      [userId]
    );

    const pendingTasks = pendingResult.rows as { id: string; title: string; due_date: Date | null }[];

    let pendingCount = pendingTasks.length;
    let overdueCount = 0;
    let nextTask: { title: string; dueDate: string } | null = null;

    for (const task of pendingTasks) {
      if (task.due_date) {
        const dueDate = new Date(task.due_date);
        if (dueDate < now) {
          overdueCount++;
        } else if (!nextTask) {
          // First task with future due date (already sorted ASC)
          nextTask = {
            title: task.title,
            dueDate: dueDate.toISOString(),
          };
        }
      }
    }

    // Get completed tasks in last 7 days from task_history
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const historyResult = await query(
      `SELECT COUNT(*) as count
       FROM task_history
       WHERE completed_by = $1
         AND completed_at >= $2`,
      [userId, sevenDaysAgo]
    );

    const completedLast7Days = parseInt(historyResult.rows[0]?.count || '0', 10);

    return {
      userName: user.name,
      pendingCount,
      overdueCount,
      completedLast7Days,
      nextTask,
      lastUpdated: new Date().toISOString(),
    };
  }
}

// Export singleton instance
export const summaryService = new SummaryService();
