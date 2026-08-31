/**
 * Activity_Log database queries
 *
 * Cursor-based (keyset) pagination over the `activity_log` table with a stable
 * `created_at DESC, id DESC` ordering so no record is skipped or duplicated
 * across consecutive pages.
 */

import { query } from './connection';
import { PaginatedResponse } from '../models';
import { encodeCursor, clampLimit } from '../utils/cursor';

/**
 * A single Activity_Log entry as returned by the paginated read path.
 */
export interface ActivityLogEntry {
  id: string;
  type: string;
  title: string;
  userId: string | null;
  timestamp: string; // created_at as ISO string
}

/**
 * Opaque cursor payload for Activity_Log keyset pagination.
 * Encodes the ordering-key tuple (created_at, id) of the last row seen.
 */
export interface ActivityLogCursor {
  ts: string; // created_at as ISO string
  id: string; // activity_log row id (tie-break)
}

interface ActivityLogRow {
  id: string;
  type: string;
  title: string | null;
  user_id: string | null;
  timestamp: Date | string;
}

/**
 * Get a bounded page of the Activity_Log using cursor-based (keyset)
 * pagination.
 *
 * NOTE: The unified activity feed (see `activityRoutes.ts`) merges multiple
 * sources (task completions, shopping purchases, activity_log). This function
 * paginates the primary `activity_log` table directly with a stable
 * (created_at, id) ordering and returns the pagination envelope. Merging the
 * other feeds under a single stable keyset cursor is out of scope for this
 * task; the activity_log query itself is the cursor-paginated primary source.
 *
 * The query fetches `limit + 1` rows to detect whether more pages remain.
 *
 * @param cursor Decoded cursor from a previous page, or null for the first page.
 * @param limit Requested page size (clamped to max 200, default 50).
 * @returns PaginatedResponse envelope with items, nextCursor, and pageSize.
 */
export const getActivityLogPage = async (
  cursor: ActivityLogCursor | null,
  limit?: number
): Promise<PaginatedResponse<ActivityLogEntry>> => {
  const pageSize = clampLimit(limit);

  const cursorTs = cursor ? cursor.ts : null;
  const cursorId = cursor ? cursor.id : null;

  const result = await query(
    `SELECT id, event_type AS type, item_title AS title, user_id, created_at AS timestamp
     FROM activity_log
     WHERE ($1::timestamptz IS NULL)
        OR (created_at, id) < ($1::timestamptz, $2::uuid)
     ORDER BY created_at DESC, id DESC
     LIMIT $3`,
    [cursorTs, cursorId, pageSize + 1]
  );

  const rows = result.rows as ActivityLogRow[];
  const hasMore = rows.length > pageSize;
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows;

  const items: ActivityLogEntry[] = pageRows.map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title ?? '',
    userId: row.user_id,
    timestamp:
      row.timestamp instanceof Date ? row.timestamp.toISOString() : String(row.timestamp),
  }));

  let nextCursor: string | null = null;
  if (hasMore) {
    const last = pageRows[pageRows.length - 1];
    if (last) {
      const ts =
        last.timestamp instanceof Date ? last.timestamp.toISOString() : String(last.timestamp);
      nextCursor = encodeCursor({ ts, id: last.id } satisfies ActivityLogCursor);
    }
  }

  return { items, nextCursor, pageSize };
};
