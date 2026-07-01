/**
 * WidgetService Property-Based Tests
 *
 * Feature: ha-dashboard-integration, Property 12: Widget HTML contains correct item data
 * Feature: ha-dashboard-integration, Property 13: Widget buttons reference provided userId
 *
 * Tests that the WidgetService produces correct HTML output for any set of
 * pending tasks or unpurchased shopping items, and that action buttons
 * reference the correct userId.
 *
 * **Validates: Requirements 8.1, 8.2, 8.3**
 */

import * as fc from 'fast-check';
import { WidgetService } from './WidgetService';
import * as connection from '../db/connection';

// Mock the database connection module
jest.mock('../db/connection');

const mockQuery = connection.query as jest.MockedFunction<typeof connection.query>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Replicates the escapeHtml logic from WidgetService to predict what
 * the rendered output should contain for a given raw string.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generates a non-empty task title (may include special HTML characters) */
const taskTitleArb = fc.string({ minLength: 1, maxLength: 80 }).filter((s) => s.trim().length > 0);

/** Generates a non-empty shopping item name */
const itemNameArb = fc.string({ minLength: 1, maxLength: 80 }).filter((s) => s.trim().length > 0);

/** Generates a category string */
const categoryArb = fc.constantFrom('produce', 'dairy', 'bakery', 'meat', 'frozen', 'pantry', 'household');

/** Generates a task row as returned by the DB query */
const taskRowArb = fc.record({
  id: fc.uuid(),
  title: taskTitleArb,
  assignee_name: fc.option(fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0), { nil: null }),
  due_date: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }), { nil: null }),
});

/** Generates a shopping item row as returned by the DB query */
const shoppingRowArb = fc.record({
  id: fc.uuid(),
  name: itemNameArb,
  category: categoryArb,
});

/** Generates a non-empty array of task rows (1..10 items for speed) */
const taskRowsArb = fc.array(taskRowArb, { minLength: 1, maxLength: 10 });

/** Generates a non-empty array of shopping item rows */
const shoppingRowsArb = fc.array(shoppingRowArb, { minLength: 1, maxLength: 10 });

/** Generates a non-empty userId (UUID format) */
const userIdArb = fc.uuid();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WidgetService - Property 12: Widget HTML contains correct item data', () => {
  let widgetService: WidgetService;

  beforeEach(() => {
    widgetService = new WidgetService();
    jest.clearAllMocks();
  });

  // Feature: ha-dashboard-integration, Property 12: Widget HTML contains correct item data
  /**
   * Property 12a: For any set of pending tasks, the rendered task widget HTML
   * contains each task's title (escaped) as text content and each task's ID
   * in an action reference (onclick handler).
   *
   * **Validates: Requirements 8.1**
   */
  it('task widget HTML contains each task title (escaped) and each task ID', async () => {
    await fc.assert(
      fc.asyncProperty(taskRowsArb, userIdArb, async (tasks, userId) => {
        // Mock the query to return our generated tasks
        mockQuery.mockResolvedValueOnce({ rows: tasks, rowCount: tasks.length } as any);

        const html = await widgetService.renderTaskWidget({ userId, theme: 'light' });

        for (const task of tasks) {
          // The title should appear escaped in the HTML
          const escapedTitle = escapeHtml(task.title);
          expect(html).toContain(escapedTitle);

          // The task ID should appear in an onclick handler (completeTask('id'))
          const escapedId = escapeHtml(task.id);
          expect(html).toContain(escapedId);
        }
      }),
      { numRuns: 100 }
    );
  });

  // Feature: ha-dashboard-integration, Property 12: Widget HTML contains correct item data
  /**
   * Property 12b: For any set of unpurchased shopping items, the rendered shopping
   * widget HTML contains each item's name (escaped) as text content and each
   * item's ID in an action reference (onclick handler).
   *
   * **Validates: Requirements 8.2**
   */
  it('shopping widget HTML contains each item name (escaped) and each item ID', async () => {
    await fc.assert(
      fc.asyncProperty(shoppingRowsArb, userIdArb, async (items, userId) => {
        // Mock the query to return our generated shopping items
        mockQuery.mockResolvedValueOnce({ rows: items, rowCount: items.length } as any);

        const html = await widgetService.renderShoppingWidget({ userId, theme: 'light' });

        for (const item of items) {
          // The item name should appear escaped in the HTML
          const escapedName = escapeHtml(item.name);
          expect(html).toContain(escapedName);

          // The item ID should appear in an onclick handler (purchaseItem('id'))
          const escapedId = escapeHtml(item.id);
          expect(html).toContain(escapedId);
        }
      }),
      { numRuns: 100 }
    );
  });

  // Feature: ha-dashboard-integration, Property 12: Widget HTML contains correct item data
  /**
   * Property 12c: In read-only mode (no userId), the task widget HTML still
   * contains each task's title but does NOT contain actual button elements.
   *
   * **Validates: Requirements 8.1**
   */
  it('task widget in read-only mode contains titles but no button elements', async () => {
    await fc.assert(
      fc.asyncProperty(taskRowsArb, async (tasks) => {
        mockQuery.mockResolvedValueOnce({ rows: tasks, rowCount: tasks.length } as any);

        const html = await widgetService.renderTaskWidget({ theme: 'light' });

        for (const task of tasks) {
          const escapedTitle = escapeHtml(task.title);
          expect(html).toContain(escapedTitle);
        }

        // No actual button elements when no userId (CSS class in stylesheet is fine)
        expect(html).not.toContain('<button');
      }),
      { numRuns: 100 }
    );
  });
});

describe('WidgetService - Property 13: Widget buttons reference provided userId', () => {
  let widgetService: WidgetService;

  beforeEach(() => {
    widgetService = new WidgetService();
    jest.clearAllMocks();
  });

  // Feature: ha-dashboard-integration, Property 13: Widget buttons reference provided userId
  /**
   * Property 13a: For any non-empty userId, the task widget HTML includes an
   * inline script whose body contains that exact userId string (escaped).
   *
   * **Validates: Requirements 8.3**
   */
  it('task widget action script contains the provided userId', async () => {
    await fc.assert(
      fc.asyncProperty(taskRowsArb, userIdArb, async (tasks, userId) => {
        mockQuery.mockResolvedValueOnce({ rows: tasks, rowCount: tasks.length } as any);

        const html = await widgetService.renderTaskWidget({ userId, theme: 'light' });

        // The userId (escaped) should appear in the inline script for the fetch body
        const escapedUserId = escapeHtml(userId);
        expect(html).toContain(escapedUserId);

        // Specifically, it should be within a JSON body reference
        expect(html).toContain(`userId: '${escapedUserId}'`);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: ha-dashboard-integration, Property 13: Widget buttons reference provided userId
  /**
   * Property 13b: For any non-empty userId, the shopping widget HTML includes an
   * inline script whose body contains that exact userId string (escaped).
   *
   * **Validates: Requirements 8.3**
   */
  it('shopping widget action script contains the provided userId', async () => {
    await fc.assert(
      fc.asyncProperty(shoppingRowsArb, userIdArb, async (items, userId) => {
        mockQuery.mockResolvedValueOnce({ rows: items, rowCount: items.length } as any);

        const html = await widgetService.renderShoppingWidget({ userId, theme: 'light' });

        // The userId (escaped) should appear in the inline script for the fetch body
        const escapedUserId = escapeHtml(userId);
        expect(html).toContain(escapedUserId);

        // For shopping, it should reference purchasedBy with the userId
        expect(html).toContain(`purchasedBy: '${escapedUserId}'`);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: ha-dashboard-integration, Property 13: Widget buttons reference provided userId
  /**
   * Property 13c: When no userId is provided, no inline script is present
   * in the widget HTML (read-only mode has no action buttons).
   *
   * **Validates: Requirements 8.3**
   */
  it('widget without userId has no inline script', async () => {
    await fc.assert(
      fc.asyncProperty(taskRowsArb, async (tasks) => {
        mockQuery.mockResolvedValueOnce({ rows: tasks, rowCount: tasks.length } as any);

        const html = await widgetService.renderTaskWidget({ theme: 'light' });

        // No script tag when no userId
        expect(html).not.toContain('<script>');
      }),
      { numRuns: 100 }
    );
  });
});
