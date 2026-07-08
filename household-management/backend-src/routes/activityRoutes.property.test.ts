/**
 * Property-Based Tests for Activity Response Invariants
 *
 * Feature: notification-and-activity-fixes
 *
 * Property 7: Activity response sorted by timestamp descending
 * Property 8: Activity response limited to 100 entries
 * Property 9: Activity entries within days lookback window
 * Property 10: Activity log entries include all required fields
 *
 * **Validates: Requirements 3.9, 3.10, 3.11, 3.12**
 */

import * as fc from 'fast-check';
import { Request, Response } from 'express';

// Mock the database connection
jest.mock('../db/connection');
import { query } from '../db/connection';

const mockedQuery = query as jest.MockedFunction<typeof query>;

// Import the router after mocking
import activityRouter from './activityRoutes';

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Extract the GET / handler from the router */
function getRouteHandler(): (req: Request, res: Response) => Promise<void> {
  const layer = (activityRouter as unknown as { stack: Array<{ route: { path: string; methods: { get?: boolean } }; handle: (req: Request, res: Response) => Promise<void> }> }).stack.find(
    (l) => l.route && l.route.path === '/' && l.route.methods.get,
  );
  if (!layer) throw new Error('GET / route not found on activityRouter');
  // The actual handler is the last element of the route stack
  const routeStack = (layer.route as unknown as { stack: Array<{ method: string; handle: (req: Request, res: Response) => Promise<void> }> }).stack;
  const getHandler = routeStack.find((s) => s.method === 'get');
  if (!getHandler) throw new Error('GET handler not found');
  return getHandler.handle;
}

/** Create a mock Express request */
function createMockRequest(queryParams: Record<string, string> = {}): Request {
  return {
    query: queryParams,
  } as unknown as Request;
}

/** Create a mock Express response that captures the JSON output */
function createMockResponse(): Response & { _json: unknown; _status: number } {
  const res = {
    _json: null as unknown,
    _status: 200,
    status(code: number) {
      res._status = code;
      return res;
    },
    json(data: unknown) {
      res._json = data;
      return res;
    },
  } as unknown as Response & { _json: unknown; _status: number };
  return res;
}

// ─── Arbitraries ────────────────────────────────────────────────────────────────

/** Valid activity_log event types */
const eventTypeArb = fc.constantFrom(
  'task_created',
  'task_edited',
  'task_deleted',
  'shopping_item_added',
  'shopping_item_edited',
  'shopping_item_removed',
);

/** Generate a UUID */
const uuidArb = fc.uuid();

/** Generate a timestamp within the last N days */
function timestampWithinDaysArb(days: number): fc.Arbitrary<Date> {
  const now = Date.now();
  const minTime = now - days * 24 * 60 * 60 * 1000;
  return fc.date({ min: new Date(minTime), max: new Date(now), noInvalidDate: true });
}

/** Generate a random activity entry row (as returned by DB query) */
const activityRowArb = (withinDays: number): fc.Arbitrary<{ type: string; title: string; user_id: string; timestamp: Date }> =>
  fc.record({
    type: eventTypeArb,
    title: fc.string({ minLength: 1, maxLength: 50 }),
    user_id: uuidArb,
    timestamp: timestampWithinDaysArb(withinDays),
  });

/** Generate a task_history row */
const taskHistoryRowArb = (withinDays: number): fc.Arbitrary<{ title: string; user_id: string; timestamp: Date }> =>
  fc.record({
    title: fc.string({ minLength: 1, maxLength: 50 }),
    user_id: uuidArb,
    timestamp: timestampWithinDaysArb(withinDays),
  });

/** Generate a shopping purchase row */
const shoppingRowArb = (withinDays: number): fc.Arbitrary<{ title: string; user_id: string; timestamp: Date }> =>
  fc.record({
    title: fc.string({ minLength: 1, maxLength: 50 }),
    user_id: uuidArb,
    timestamp: timestampWithinDaysArb(withinDays),
  });

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('Feature: notification-and-activity-fixes, Property 7: Activity response sorted by timestamp descending', () => {
  let handler: (req: Request, res: Response) => Promise<void>;

  beforeAll(() => {
    handler = getRouteHandler();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * **Validates: Requirements 3.9**
   *
   * For all consecutive pairs of entries (entries[i], entries[i+1]),
   * the timestamp of entries[i] SHALL be >= timestamp of entries[i+1].
   */
  it('all entries are sorted by timestamp descending', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(taskHistoryRowArb(30), { minLength: 0, maxLength: 20 }),
        fc.array(shoppingRowArb(30), { minLength: 0, maxLength: 20 }),
        fc.array(activityRowArb(30), { minLength: 0, maxLength: 20 }),
        async (taskRows, shoppingRows, activityRows) => {
          mockedQuery.mockImplementation(async (sql: string) => {
            if (sql.includes('task_history')) {
              return { rows: taskRows, command: '', rowCount: taskRows.length, oid: 0, fields: [] };
            }
            if (sql.includes('shopping_items')) {
              return { rows: shoppingRows, command: '', rowCount: shoppingRows.length, oid: 0, fields: [] };
            }
            if (sql.includes('activity_log')) {
              return { rows: activityRows, command: '', rowCount: activityRows.length, oid: 0, fields: [] };
            }
            return { rows: [], command: '', rowCount: 0, oid: 0, fields: [] };
          });

          const req = createMockRequest({ days: '30' });
          const res = createMockResponse();

          await handler(req, res);

          expect(res._status).toBe(200);
          const body = res._json as { entries: Array<{ timestamp: string }> };
          const entries = body.entries;

          // Verify descending sort
          for (let i = 0; i < entries.length - 1; i++) {
            const current = new Date(entries[i].timestamp).getTime();
            const next = new Date(entries[i + 1].timestamp).getTime();
            expect(current).toBeGreaterThanOrEqual(next);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: notification-and-activity-fixes, Property 8: Activity response limited to 100 entries', () => {
  let handler: (req: Request, res: Response) => Promise<void>;

  beforeAll(() => {
    handler = getRouteHandler();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * **Validates: Requirements 3.10**
   *
   * Regardless of how many records exist, the response SHALL contain
   * at most 100 entries.
   */
  it('response contains at most 100 entries regardless of input size', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(taskHistoryRowArb(30), { minLength: 30, maxLength: 50 }),
        fc.array(shoppingRowArb(30), { minLength: 30, maxLength: 50 }),
        fc.array(activityRowArb(30), { minLength: 30, maxLength: 50 }),
        async (taskRows, shoppingRows, activityRows) => {
          mockedQuery.mockImplementation(async (sql: string) => {
            if (sql.includes('task_history')) {
              return { rows: taskRows, command: '', rowCount: taskRows.length, oid: 0, fields: [] };
            }
            if (sql.includes('shopping_items')) {
              return { rows: shoppingRows, command: '', rowCount: shoppingRows.length, oid: 0, fields: [] };
            }
            if (sql.includes('activity_log')) {
              return { rows: activityRows, command: '', rowCount: activityRows.length, oid: 0, fields: [] };
            }
            return { rows: [], command: '', rowCount: 0, oid: 0, fields: [] };
          });

          const req = createMockRequest({ days: '30' });
          const res = createMockResponse();

          await handler(req, res);

          expect(res._status).toBe(200);
          const body = res._json as { entries: Array<{ timestamp: string }> };

          // The total input is >= 90 entries (30+30+30 minimum), response must cap at 100
          expect(body.entries.length).toBeLessThanOrEqual(100);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: notification-and-activity-fixes, Property 9: Activity entries within days lookback window', () => {
  let handler: (req: Request, res: Response) => Promise<void>;

  beforeAll(() => {
    handler = getRouteHandler();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * **Validates: Requirements 3.11**
   *
   * For any response from GET /api/activity?days=N, all entries' timestamps
   * SHALL be within the last N days.
   */
  it('all returned entries have timestamps within the requested days window', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 90 }),
        fc.array(taskHistoryRowArb(90), { minLength: 1, maxLength: 15 }),
        fc.array(shoppingRowArb(90), { minLength: 1, maxLength: 15 }),
        fc.array(activityRowArb(90), { minLength: 1, maxLength: 15 }),
        async (days, taskRows, shoppingRows, activityRows) => {
          // The DB is responsible for filtering by days, so we simulate
          // it only returning rows within the window (as the real DB query does)
          const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
          const filteredTaskRows = taskRows.filter((r) => r.timestamp.getTime() >= cutoff);
          const filteredShoppingRows = shoppingRows.filter((r) => r.timestamp.getTime() >= cutoff);
          const filteredActivityRows = activityRows.filter((r) => r.timestamp.getTime() >= cutoff);

          mockedQuery.mockImplementation(async (sql: string) => {
            if (sql.includes('task_history')) {
              return { rows: filteredTaskRows, command: '', rowCount: filteredTaskRows.length, oid: 0, fields: [] };
            }
            if (sql.includes('shopping_items')) {
              return { rows: filteredShoppingRows, command: '', rowCount: filteredShoppingRows.length, oid: 0, fields: [] };
            }
            if (sql.includes('activity_log')) {
              return { rows: filteredActivityRows, command: '', rowCount: filteredActivityRows.length, oid: 0, fields: [] };
            }
            return { rows: [], command: '', rowCount: 0, oid: 0, fields: [] };
          });

          const req = createMockRequest({ days: String(days) });
          const res = createMockResponse();

          await handler(req, res);

          expect(res._status).toBe(200);
          const body = res._json as { entries: Array<{ timestamp: string }> };
          const now = Date.now();
          const windowStart = now - days * 24 * 60 * 60 * 1000;

          for (const entry of body.entries) {
            const ts = new Date(entry.timestamp).getTime();
            // Allow 1 second tolerance for test execution time
            expect(ts).toBeGreaterThanOrEqual(windowStart - 1000);
            expect(ts).toBeLessThanOrEqual(now + 1000);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: notification-and-activity-fixes, Property 10: Activity log entries include all required fields', () => {
  let handler: (req: Request, res: Response) => Promise<void>;

  beforeAll(() => {
    handler = getRouteHandler();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * **Validates: Requirements 3.12**
   *
   * Each entry SHALL include non-null values for type, title, userId,
   * and timestamp.
   */
  it('every entry in the response has non-null type, title, userId, and timestamp', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(activityRowArb(30), { minLength: 1, maxLength: 30 }),
        async (activityRows) => {
          mockedQuery.mockImplementation(async (sql: string) => {
            if (sql.includes('task_history')) {
              return { rows: [], command: '', rowCount: 0, oid: 0, fields: [] };
            }
            if (sql.includes('shopping_items')) {
              return { rows: [], command: '', rowCount: 0, oid: 0, fields: [] };
            }
            if (sql.includes('activity_log')) {
              return { rows: activityRows, command: '', rowCount: activityRows.length, oid: 0, fields: [] };
            }
            return { rows: [], command: '', rowCount: 0, oid: 0, fields: [] };
          });

          const req = createMockRequest({ days: '30' });
          const res = createMockResponse();

          await handler(req, res);

          expect(res._status).toBe(200);
          const body = res._json as { entries: Array<{ type: string; title: string; userId: string; timestamp: string }> };

          const validTypes = [
            'task_completed', 'item_purchased',
            'task_created', 'task_edited', 'task_deleted',
            'shopping_item_added', 'shopping_item_edited', 'shopping_item_removed',
          ];

          for (const entry of body.entries) {
            expect(entry.type).not.toBeNull();
            expect(entry.type).not.toBeUndefined();
            expect(validTypes).toContain(entry.type);

            expect(entry.title).not.toBeNull();
            expect(entry.title).not.toBeUndefined();
            expect(typeof entry.title).toBe('string');

            expect(entry.userId).not.toBeNull();
            expect(entry.userId).not.toBeUndefined();
            expect(typeof entry.userId).toBe('string');

            expect(entry.timestamp).not.toBeNull();
            expect(entry.timestamp).not.toBeUndefined();
            expect(typeof entry.timestamp).toBe('string');
            // Verify it's a valid ISO date string
            expect(new Date(entry.timestamp).toString()).not.toBe('Invalid Date');
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
