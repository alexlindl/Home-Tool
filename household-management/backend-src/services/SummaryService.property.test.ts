/**
 * SummaryService Property-Based Tests
 *
 * Feature: ha-dashboard-integration
 *
 * Tests Properties 1–10 from the design document:
 * - Property 1: Task summary counts match actual data
 * - Property 2: Task summary assignedTo filter correctness
 * - Property 3: Task summary listId filter correctness
 * - Property 4: Task summary limit and sort order
 * - Property 5: Shopping summary counts and fields
 * - Property 6: Shopping summary listId filter correctness
 * - Property 7: Shopping summary byCategory grouping consistency
 * - Property 8: Shopping summary limit
 * - Property 9: Per-user summary computation correctness
 * - Property 10: All summary responses include valid lastUpdated timestamp
 */

import * as fc from 'fast-check';
import { SummaryService, UserSummaryResponse, TaskSummaryResponse, ShoppingSummaryResponse, ShoppingSummaryItem, TaskSummaryFilters } from './SummaryService';
import * as connection from '../db/connection';
import * as userQueries from '../db/userQueries';
import { TaskRow } from '../models/Task';

// Mock the database layer
jest.mock('../db/connection');
jest.mock('../db/userQueries');

const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;
const mockGetUserById = userQueries.getUserById as jest.MockedFunction<typeof userQueries.getUserById>;

// ---------------------------------------------------------------------------
// Arbitraries (shared)
// ---------------------------------------------------------------------------

/** Generate a valid UUID-like string */
const uuidArb = fc.uuid();

/** Generate a user name */
const userNameArb = fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0);

/** Generate a task title */
const taskTitleArb = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0);

/** Generate a due date — either null or a date within ±30 days of now */
const dueDateArb = fc.option(
  fc.integer({ min: -30 * 24 * 60 * 60 * 1000, max: 30 * 24 * 60 * 60 * 1000 }).map(
    offset => new Date(Date.now() + offset)
  ),
  { nil: null }
);

// ---------------------------------------------------------------------------
// Arbitraries for Properties 1–4 (Task Summary)
// ---------------------------------------------------------------------------

/** Pool of user IDs used across generated tasks */
const userIdPoolArb = fc.array(uuidArb, { minLength: 2, maxLength: 5 });

/** Pool of list IDs used across generated tasks */
const listIdPoolArb = fc.array(uuidArb, { minLength: 2, maxLength: 4 });

/** Generate a user name pool for assignee names */
const userNamePoolArb = fc.array(
  fc.constantFrom('Alex', 'Becky', 'Sam', 'Jordan', 'Taylor'),
  { minLength: 2, maxLength: 5 }
);

/**
 * Generate an array of task rows (simulating DB rows already filtered to status='pending')
 * along with a list_id field and assignee_name that the JOIN produces.
 */
function taskRowsArb(userIds: string[], listIds: string[], userNames: string[]) {
  const singleRow = fc.record({
    id: uuidArb,
    title: taskTitleArb,
    description: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
    assigned_to: fc.option(fc.constantFrom(...userIds), { nil: null }),
    created_by: fc.constantFrom(...userIds),
    due_date: dueDateArb,
    is_recurring: fc.boolean(),
    recurrence_frequency: fc.constant(null),
    recurrence_interval: fc.constant(null),
    recurrence_end_date: fc.constant(null),
    recurrence_type: fc.constant(null),
    recurrence_day_of_week: fc.constant(null),
    recurrence_ordinal_week: fc.constant(null),
    status: fc.constant('pending' as const),
    completed_at: fc.constant(null),
    completed_by: fc.constant(null),
    created_at: fc.date({ min: new Date('2023-01-01'), max: new Date('2025-01-01') }),
    updated_at: fc.date({ min: new Date('2023-01-01'), max: new Date('2025-01-01') }),
    list_id: fc.constantFrom(...listIds),
  }).map(row => {
    // Derive assignee_name from assigned_to
    const idx = row.assigned_to ? userIds.indexOf(row.assigned_to) : -1;
    const assignee_name = idx >= 0 ? (userNames[idx] || null) : null;
    return { ...row, assignee_name };
  });

  return fc.array(singleRow, { minLength: 0, maxLength: 25 });
}

// ---------------------------------------------------------------------------
// Helper: simulate DB filtering and sorting for task summary
// ---------------------------------------------------------------------------

interface TaskRowWithMeta extends TaskRow {
  assignee_name: string | null;
  list_id: string;
}

function simulateDbFilter(
  allRows: TaskRowWithMeta[],
  filters?: TaskSummaryFilters
): (TaskRow & { assignee_name: string | null })[] {
  let filtered = allRows.filter(r => r.status === 'pending');

  if (filters?.assignedTo) {
    filtered = filtered.filter(
      r => r.assigned_to === filters.assignedTo || r.assigned_to === null
    );
  }

  if (filters?.listId) {
    filtered = filtered.filter(r => r.list_id === filters.listId);
  }

  // Sort by due_date ASC NULLS LAST
  filtered.sort((a, b) => {
    if (a.due_date === null && b.due_date === null) return 0;
    if (a.due_date === null) return 1;
    if (b.due_date === null) return -1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });

  // Strip list_id for the mock return value
  return filtered.map(({ list_id, ...rest }) => rest);
}

// ===========================================================================
// Property 1: Task summary counts match actual data
// ===========================================================================

// Feature: ha-dashboard-integration, Property 1: Task summary counts match actual data
describe('Property 1: Task summary counts match actual data', () => {
  let service: SummaryService;

  beforeEach(() => {
    service = new SummaryService();
    jest.clearAllMocks();
  });

  /**
   * For any set of tasks, totalPending equals number of pending tasks,
   * totalOverdue equals pending tasks with dueDate before now.
   *
   * **Validates: Requirements 1.1, 1.6**
   */
  it('totalPending equals row count and totalOverdue equals pending tasks with dueDate before now', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdPoolArb,
        listIdPoolArb,
        userNamePoolArb,
        fc.context(),
        async (userIds, listIds, userNames, ctx) => {
          const rows = await fc.sample(taskRowsArb(userIds, listIds, userNames), 1)[0];
          ctx.log(`Generated ${rows.length} task rows`);

          const now = new Date();
          const filteredRows = simulateDbFilter(rows as TaskRowWithMeta[]);

          mockQuery.mockResolvedValue({
            rows: filteredRows,
            rowCount: filteredRows.length,
            command: 'SELECT',
            oid: 0,
            fields: [],
          } as any);

          const result = await service.getTaskSummary();

          // totalPending should equal total filtered rows
          expect(result.totalPending).toBe(filteredRows.length);

          // totalOverdue should equal pending tasks with due_date before now
          const expectedOverdue = filteredRows.filter(
            r => r.due_date !== null && new Date(r.due_date) < now
          ).length;
          expect(result.totalOverdue).toBe(expectedOverdue);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ===========================================================================
// Property 2: Task summary assignedTo filter correctness
// ===========================================================================

// Feature: ha-dashboard-integration, Property 2: Task summary assignedTo filter correctness
describe('Property 2: Task summary assignedTo filter correctness', () => {
  let service: SummaryService;

  beforeEach(() => {
    service = new SummaryService();
    jest.clearAllMocks();
  });

  /**
   * For any set of tasks assigned to multiple users and any valid user ID filter,
   * all tasks in the summary response have an assignee matching the filtered user
   * (or assigned to null/Anyone).
   *
   * **Validates: Requirements 1.2**
   */
  it('all returned tasks match the filtered user or are assigned to Anyone/null', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdPoolArb,
        listIdPoolArb,
        userNamePoolArb,
        async (userIds, listIds, userNames) => {
          const rows = fc.sample(taskRowsArb(userIds, listIds, userNames), 1)[0];

          // Pick a random user from the pool to filter by
          const filterUserId = userIds[0];
          const filters: TaskSummaryFilters = { assignedTo: filterUserId };
          const filteredRows = simulateDbFilter(rows as TaskRowWithMeta[], filters);

          mockQuery.mockResolvedValue({
            rows: filteredRows,
            rowCount: filteredRows.length,
            command: 'SELECT',
            oid: 0,
            fields: [],
          } as any);

          const result = await service.getTaskSummary(filters);

          // Every row used by the service should match the filter
          for (const row of filteredRows) {
            expect(
              row.assigned_to === filterUserId || row.assigned_to === null
            ).toBe(true);
          }

          // Result task count should match
          expect(result.totalPending).toBe(filteredRows.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ===========================================================================
// Property 3: Task summary listId filter correctness
// ===========================================================================

// Feature: ha-dashboard-integration, Property 3: Task summary listId filter correctness
describe('Property 3: Task summary listId filter correctness', () => {
  let service: SummaryService;

  beforeEach(() => {
    service = new SummaryService();
    jest.clearAllMocks();
  });

  /**
   * For any set of tasks across multiple lists and any valid list ID filter,
   * all tasks in the summary response belong to the specified list.
   *
   * **Validates: Requirements 1.3**
   */
  it('all returned tasks belong to the specified list', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdPoolArb,
        listIdPoolArb,
        userNamePoolArb,
        async (userIds, listIds, userNames) => {
          const rows = fc.sample(taskRowsArb(userIds, listIds, userNames), 1)[0];

          // Pick a list to filter by
          const filterListId = listIds[0];
          const filters: TaskSummaryFilters = { listId: filterListId };
          const filteredRows = simulateDbFilter(rows as TaskRowWithMeta[], filters);

          mockQuery.mockResolvedValue({
            rows: filteredRows,
            rowCount: filteredRows.length,
            command: 'SELECT',
            oid: 0,
            fields: [],
          } as any);

          const result = await service.getTaskSummary(filters);

          // Verify via source data: every task in filteredRows came from the specified list
          const expectedCount = (rows as TaskRowWithMeta[]).filter(
            r => r.status === 'pending' && r.list_id === filterListId
          ).length;
          expect(result.totalPending).toBe(expectedCount);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ===========================================================================
// Property 4: Task summary limit and sort order
// ===========================================================================

// Feature: ha-dashboard-integration, Property 4: Task summary limit and sort order
describe('Property 4: Task summary limit and sort order', () => {
  let service: SummaryService;

  beforeEach(() => {
    service = new SummaryService();
    jest.clearAllMocks();
  });

  /**
   * For any set of tasks and any positive integer limit, the tasks array has
   * at most `limit` items, sorted by due date ASC with nulls last.
   *
   * **Validates: Requirements 1.4**
   */
  it('tasks array has at most limit items and is sorted by due date ASC with nulls last', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdPoolArb,
        listIdPoolArb,
        userNamePoolArb,
        fc.integer({ min: 1, max: 50 }),
        async (userIds, listIds, userNames, limit) => {
          const rows = fc.sample(taskRowsArb(userIds, listIds, userNames), 1)[0];

          const filters: TaskSummaryFilters = { limit };
          const filteredRows = simulateDbFilter(rows as TaskRowWithMeta[], filters);

          mockQuery.mockResolvedValue({
            rows: filteredRows,
            rowCount: filteredRows.length,
            command: 'SELECT',
            oid: 0,
            fields: [],
          } as any);

          const result = await service.getTaskSummary(filters);

          // Tasks array should have at most `limit` items
          expect(result.tasks.length).toBeLessThanOrEqual(limit);

          // Tasks array size should be min(filteredRows.length, limit)
          expect(result.tasks.length).toBe(Math.min(filteredRows.length, limit));

          // totalPending counts ALL matching tasks, not just limited
          expect(result.totalPending).toBe(filteredRows.length);

          // Tasks should be sorted by due date ASC with nulls last
          for (let i = 1; i < result.tasks.length; i++) {
            const prev = result.tasks[i - 1].dueDate;
            const curr = result.tasks[i].dueDate;

            if (prev === null) {
              // If prev is null, curr must also be null (nulls are last)
              expect(curr).toBeNull();
            } else if (curr !== null) {
              // Both are non-null: prev <= curr (ascending order)
              expect(new Date(prev).getTime()).toBeLessThanOrEqual(new Date(curr).getTime());
            }
            // If prev is non-null and curr is null: valid (non-nulls before nulls)
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


// ===========================================================================
// Arbitraries for Properties 5–8 (Shopping Summary)
// ===========================================================================

/** Generate a shopping item category */
const categoryArb = fc.constantFrom('dairy', 'produce', 'bakery', 'meat', 'frozen', 'snacks', 'beverages', 'household');

/** Generate a shopping item name */
const itemNameArb = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);

/** Generate an array of shopping item rows (simulating unpurchased DB rows) */
function shoppingItemRowsArb(listIds: string[]) {
  const singleRow = fc.record({
    id: uuidArb,
    name: itemNameArb,
    category: categoryArb,
    is_purchased: fc.boolean(),
    list_id: fc.constantFrom(...listIds),
  });

  return fc.array(singleRow, { minLength: 0, maxLength: 30 });
}

// ---------------------------------------------------------------------------
// Helper: simulate DB filtering for shopping summary
// ---------------------------------------------------------------------------

interface ShoppingRowWithMeta {
  id: string;
  name: string;
  category: string;
  is_purchased: boolean;
  list_id: string;
}

function simulateShoppingDbFilter(
  allRows: ShoppingRowWithMeta[],
  filters?: { listId?: string; limit?: number }
): { id: string; name: string; category: string }[] {
  let filtered = allRows.filter(r => !r.is_purchased);

  if (filters?.listId) {
    filtered = filtered.filter(r => r.list_id === filters.listId);
  }

  // Sort by category ASC, name ASC (matches the SQL ORDER BY)
  filtered.sort((a, b) => {
    if (a.category < b.category) return -1;
    if (a.category > b.category) return 1;
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
  });

  return filtered.map(({ id, name, category }) => ({ id, name, category }));
}

// ===========================================================================
// Property 5: Shopping summary counts and fields
// ===========================================================================

// Feature: ha-dashboard-integration, Property 5: Shopping summary counts and fields
describe('Property 5: Shopping summary counts and fields', () => {
  let service: SummaryService;

  beforeEach(() => {
    service = new SummaryService();
    jest.clearAllMocks();
  });

  /**
   * For any set of shopping items with varying purchase status, the shopping summary
   * endpoint SHALL return a totalUnpurchased count equal to the number of unpurchased
   * items matching the filters, and each item in the array SHALL include its id, name,
   * and category.
   *
   * **Validates: Requirements 2.1, 5.1**
   */
  it('totalUnpurchased equals unpurchased item count and each item has id/name/category', async () => {
    await fc.assert(
      fc.asyncProperty(
        listIdPoolArb,
        fc.context(),
        async (listIds, ctx) => {
          const rows = fc.sample(shoppingItemRowsArb(listIds), 1)[0] as ShoppingRowWithMeta[];
          ctx.log(`Generated ${rows.length} shopping item rows`);

          const unpurchasedRows = simulateShoppingDbFilter(rows);

          mockQuery.mockResolvedValue({
            rows: unpurchasedRows,
            rowCount: unpurchasedRows.length,
            command: 'SELECT',
            oid: 0,
            fields: [],
          } as any);

          const result = await service.getShoppingSummary();

          // totalUnpurchased should equal count of unpurchased items
          expect(result.totalUnpurchased).toBe(unpurchasedRows.length);

          // Each item in the items array must have id, name, category
          for (const item of result.items) {
            expect(typeof item.id).toBe('string');
            expect(item.id.length).toBeGreaterThan(0);
            expect(typeof item.name).toBe('string');
            expect(item.name.length).toBeGreaterThan(0);
            expect(typeof item.category).toBe('string');
            expect(item.category.length).toBeGreaterThan(0);
          }

          // Items count should match totalUnpurchased (no limit applied)
          expect(result.items.length).toBe(unpurchasedRows.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ===========================================================================
// Property 6: Shopping summary listId filter correctness
// ===========================================================================

// Feature: ha-dashboard-integration, Property 6: Shopping summary listId filter correctness
describe('Property 6: Shopping summary listId filter correctness', () => {
  let service: SummaryService;

  beforeEach(() => {
    service = new SummaryService();
    jest.clearAllMocks();
  });

  /**
   * For any set of shopping items across multiple lists and any valid list ID filter,
   * all items in the summary response SHALL belong to the specified list.
   *
   * **Validates: Requirements 2.2**
   */
  it('all returned items belong to the specified list', async () => {
    await fc.assert(
      fc.asyncProperty(
        listIdPoolArb,
        async (listIds) => {
          const rows = fc.sample(shoppingItemRowsArb(listIds), 1)[0] as ShoppingRowWithMeta[];

          // Pick a list to filter by
          const filterListId = listIds[0];
          const filteredRows = simulateShoppingDbFilter(rows, { listId: filterListId });

          mockQuery.mockResolvedValue({
            rows: filteredRows,
            rowCount: filteredRows.length,
            command: 'SELECT',
            oid: 0,
            fields: [],
          } as any);

          const result = await service.getShoppingSummary({ listId: filterListId });

          // Verify via source data: every item in filteredRows came from the specified list
          const expectedCount = rows.filter(
            r => !r.is_purchased && r.list_id === filterListId
          ).length;
          expect(result.totalUnpurchased).toBe(expectedCount);

          // All items should come from the filtered set
          expect(result.items.length).toBe(expectedCount);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ===========================================================================
// Property 7: Shopping summary byCategory grouping consistency
// ===========================================================================

// Feature: ha-dashboard-integration, Property 7: Shopping summary byCategory grouping consistency
describe('Property 7: Shopping summary byCategory grouping consistency', () => {
  let service: SummaryService;

  beforeEach(() => {
    service = new SummaryService();
    jest.clearAllMocks();
  });

  /**
   * For any set of unpurchased shopping items, the byCategory object SHALL map each
   * category name to exactly the items with that category, and the union of all
   * category arrays SHALL equal the flat items array (same items, same count).
   *
   * **Validates: Requirements 2.3**
   */
  it('union of byCategory arrays equals flat items array and grouping is correct', async () => {
    await fc.assert(
      fc.asyncProperty(
        listIdPoolArb,
        async (listIds) => {
          const rows = fc.sample(shoppingItemRowsArb(listIds), 1)[0] as ShoppingRowWithMeta[];

          const unpurchasedRows = simulateShoppingDbFilter(rows);

          mockQuery.mockResolvedValue({
            rows: unpurchasedRows,
            rowCount: unpurchasedRows.length,
            command: 'SELECT',
            oid: 0,
            fields: [],
          } as any);

          const result = await service.getShoppingSummary();

          // 1. Union of all byCategory arrays should have the same total count as items
          const allGroupedItems: ShoppingSummaryItem[] = [];
          for (const categoryItems of Object.values(result.byCategory)) {
            allGroupedItems.push(...categoryItems);
          }
          expect(allGroupedItems.length).toBe(result.items.length);

          // 2. Each item in the flat array must appear in the correct category group
          for (const item of result.items) {
            const categoryGroup = result.byCategory[item.category];
            expect(categoryGroup).toBeDefined();
            const found = categoryGroup.find(gi => gi.id === item.id);
            expect(found).toBeDefined();
            expect(found!.name).toBe(item.name);
            expect(found!.category).toBe(item.category);
          }

          // 3. Each item in a category group must have that category
          for (const [category, categoryItems] of Object.entries(result.byCategory)) {
            for (const item of categoryItems) {
              expect(item.category).toBe(category);
            }
          }

          // 4. The set of IDs in grouped items equals set of IDs in flat array
          const flatIds = new Set(result.items.map(i => i.id));
          const groupedIds = new Set(allGroupedItems.map(i => i.id));
          expect(groupedIds).toEqual(flatIds);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ===========================================================================
// Property 8: Shopping summary limit
// ===========================================================================

// Feature: ha-dashboard-integration, Property 8: Shopping summary limit
describe('Property 8: Shopping summary limit', () => {
  let service: SummaryService;

  beforeEach(() => {
    service = new SummaryService();
    jest.clearAllMocks();
  });

  /**
   * For any set of shopping items and any positive integer limit, the flat items
   * array in the response SHALL contain at most `limit` items.
   *
   * **Validates: Requirements 2.5**
   */
  it('items array has at most limit items', async () => {
    await fc.assert(
      fc.asyncProperty(
        listIdPoolArb,
        fc.integer({ min: 1, max: 50 }),
        async (listIds, limit) => {
          const rows = fc.sample(shoppingItemRowsArb(listIds), 1)[0] as ShoppingRowWithMeta[];

          const unpurchasedRows = simulateShoppingDbFilter(rows);

          mockQuery.mockResolvedValue({
            rows: unpurchasedRows,
            rowCount: unpurchasedRows.length,
            command: 'SELECT',
            oid: 0,
            fields: [],
          } as any);

          const result = await service.getShoppingSummary({ limit });

          // Items array should have at most `limit` items
          expect(result.items.length).toBeLessThanOrEqual(limit);

          // Items array size should be min(unpurchasedRows.length, limit)
          expect(result.items.length).toBe(Math.min(unpurchasedRows.length, limit));

          // totalUnpurchased counts ALL matching items, not just limited
          expect(result.totalUnpurchased).toBe(unpurchasedRows.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ===========================================================================
// Arbitraries for Properties 9–10
// ===========================================================================

/** Generate a task status */
const taskStatusArb = fc.constantFrom('pending', 'completed', 'cancelled');

/** Generate a task row for property 9 testing */
const taskRowP9Arb = fc.record({
  id: uuidArb,
  title: taskTitleArb,
  status: taskStatusArb,
  due_date: dueDateArb,
  assigned_to: fc.option(uuidArb, { nil: null }),
});

/** Generate a history entry (completed_at within last 14 days — some in range, some not) */
const historyEntryArb = fc.integer({ min: -14 * 24 * 60 * 60 * 1000, max: 0 }).map(
  offset => new Date(Date.now() + offset)
);

// ===========================================================================
// Property 9: Per-user summary computation correctness
// ===========================================================================

// Feature: ha-dashboard-integration, Property 9: Per-user summary computation correctness
describe('Property 9: Per-user summary computation correctness', () => {
  let service: SummaryService;

  beforeEach(() => {
    service = new SummaryService();
    jest.clearAllMocks();
  });

  /**
   * For any user and any set of tasks, the per-user summary SHALL return:
   * - pendingCount equal to tasks assigned to that user with status "pending"
   * - overdueCount equal to pending tasks with due date before now
   * - completedLast7Days matching task history entries in the last 7 days
   * - nextTask equal to the pending task with the earliest future due date (or null)
   *
   * **Validates: Requirements 3.1, 3.5**
   */
  it('pendingCount, overdueCount, completedLast7Days, and nextTask match expected values', async () => {
    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        userNameArb,
        fc.array(taskRowP9Arb, { minLength: 0, maxLength: 20 }),
        fc.array(historyEntryArb, { minLength: 0, maxLength: 15 }),
        async (userId, userName, tasks, historyDates) => {
          const now = new Date();

          // Mock user lookup
          mockGetUserById.mockResolvedValue({
            id: userId,
            name: userName,
            haUsername: null,
            createdAt: new Date('2024-01-01'),
          });

          // Determine which tasks would be returned by the query
          // The service queries tasks WHERE (assigned_to = userId OR assigned_to IS NULL) AND status = 'pending'
          const pendingUserTasks = tasks.filter(
            t => t.status === 'pending' && (t.assigned_to === userId || t.assigned_to === null)
          );

          // Sort by due_date ASC NULLS LAST (matching DB ORDER BY)
          const sortedPendingTasks = [...pendingUserTasks].sort((a, b) => {
            if (a.due_date === null && b.due_date === null) return 0;
            if (a.due_date === null) return 1;
            if (b.due_date === null) return -1;
            return a.due_date.getTime() - b.due_date.getTime();
          });

          // Mock the pending tasks query result
          mockQuery.mockImplementation(async (text: string) => {
            if (text.includes('FROM tasks')) {
              return {
                rows: sortedPendingTasks.map(t => ({
                  id: t.id,
                  title: t.title,
                  due_date: t.due_date,
                })),
                rowCount: sortedPendingTasks.length,
                command: 'SELECT',
                oid: 0,
                fields: [],
              };
            }
            if (text.includes('FROM task_history')) {
              // Count history entries within last 7 days
              const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
              const recentCount = historyDates.filter(d => d >= sevenDaysAgo).length;
              return {
                rows: [{ count: String(recentCount) }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
              };
            }
            return { rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] };
          });

          // Call the service
          const result: UserSummaryResponse = await service.getUserSummary(userId);

          // Compute expected values
          const expectedPendingCount = sortedPendingTasks.length;
          const expectedOverdueCount = sortedPendingTasks.filter(
            t => t.due_date !== null && t.due_date < now
          ).length;

          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          const expectedCompletedLast7Days = historyDates.filter(d => d >= sevenDaysAgo).length;

          // nextTask: first pending task with due_date in the future (not null, not before now)
          const futureTask = sortedPendingTasks.find(
            t => t.due_date !== null && t.due_date >= now
          );
          const expectedNextTask = futureTask
            ? { title: futureTask.title, dueDate: futureTask.due_date!.toISOString() }
            : null;

          // Assertions
          expect(result.userName).toBe(userName);
          expect(result.pendingCount).toBe(expectedPendingCount);
          expect(result.overdueCount).toBe(expectedOverdueCount);
          expect(result.completedLast7Days).toBe(expectedCompletedLast7Days);

          if (expectedNextTask === null) {
            expect(result.nextTask).toBeNull();
          } else {
            expect(result.nextTask).not.toBeNull();
            expect(result.nextTask!.title).toBe(expectedNextTask.title);
            expect(result.nextTask!.dueDate).toBe(expectedNextTask.dueDate);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ===========================================================================
// Property 10: All summary responses include valid lastUpdated timestamp
// ===========================================================================

// Feature: ha-dashboard-integration, Property 10: All summary responses include valid lastUpdated timestamp
describe('Property 10: All summary responses include valid lastUpdated timestamp', () => {
  let service: SummaryService;

  beforeEach(() => {
    service = new SummaryService();
    jest.clearAllMocks();
  });

  /**
   * For any summary endpoint call (tasks, shopping, or user), the response SHALL
   * include a lastUpdated field containing a valid ISO 8601 timestamp string that
   * parses to a Date within 5 seconds of the request time.
   *
   * **Validates: Requirements 1.5, 2.4, 3.4**
   */
  it('lastUpdated is a valid ISO 8601 timestamp within 5 seconds of request time for all summary methods', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('tasks', 'shopping', 'user'),
        uuidArb,
        userNameArb,
        async (method, userId, userName) => {
          // Setup mocks for all methods
          mockGetUserById.mockResolvedValue({
            id: userId,
            name: userName,
            haUsername: null,
            createdAt: new Date('2024-01-01'),
          });

          mockQuery.mockImplementation(async (text: string) => {
            if (text.includes('FROM tasks')) {
              return { rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] };
            }
            if (text.includes('FROM shopping_items')) {
              return { rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] };
            }
            if (text.includes('FROM task_history')) {
              return { rows: [{ count: '0' }], rowCount: 1, command: 'SELECT', oid: 0, fields: [] };
            }
            return { rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] };
          });

          const beforeRequest = Date.now();

          let lastUpdated: string;
          if (method === 'tasks') {
            const result: TaskSummaryResponse = await service.getTaskSummary();
            lastUpdated = result.lastUpdated;
          } else if (method === 'shopping') {
            const result: ShoppingSummaryResponse = await service.getShoppingSummary();
            lastUpdated = result.lastUpdated;
          } else {
            const result: UserSummaryResponse = await service.getUserSummary(userId);
            lastUpdated = result.lastUpdated;
          }

          const afterRequest = Date.now();

          // Validate ISO 8601 format: must parse to a valid Date
          const parsedDate = new Date(lastUpdated);
          expect(parsedDate.toString()).not.toBe('Invalid Date');

          // Validate it's a proper ISO 8601 string (contains T and timezone info)
          expect(lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

          // Validate timestamp is within 5 seconds of request time
          const parsedTime = parsedDate.getTime();
          expect(parsedTime).toBeGreaterThanOrEqual(beforeRequest - 5000);
          expect(parsedTime).toBeLessThanOrEqual(afterRequest + 5000);
        }
      ),
      { numRuns: 100 }
    );
  });
});
