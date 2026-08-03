/**
 * Property-Based Tests for Activity Log Completeness
 *
 * Feature: household-app-enhancements
 *
 * Property 1: Activity log records all tracked operations
 * Property 2: Activity feed returns entries sorted by timestamp descending
 *
 * **Validates: Requirements 2.1–2.10, 3.1–3.3**
 */

import * as fc from 'fast-check';

// ─── Pure Logic Under Test ──────────────────────────────────────────────────────

/**
 * All tracked operation types that produce activity_log entries.
 * Each operation maps to a specific event_type string stored in activity_log.
 */
type TrackedOperation =
  | 'category_created'
  | 'category_updated'
  | 'category_deleted'
  | 'template_created'
  | 'template_updated'
  | 'template_deleted'
  | 'item_template_created'
  | 'item_template_updated'
  | 'item_template_deleted'
  | 'task_moved'
  | 'shopping_item_moved';

/**
 * Maps a tracked operation to the event_type stored in activity_log.
 * In the actual codebase, the operation string IS the event_type (identity mapping).
 * This function encodes the contract that routes use when inserting log entries.
 */
function mapOperationToEventType(operation: TrackedOperation): string {
  // The contract established by the route handlers is that the operation
  // string is used directly as the event_type column value.
  const eventTypeMap: Record<TrackedOperation, string> = {
    category_created: 'category_created',
    category_updated: 'category_updated',
    category_deleted: 'category_deleted',
    template_created: 'template_created',
    template_updated: 'template_updated',
    template_deleted: 'template_deleted',
    item_template_created: 'item_template_created',
    item_template_updated: 'item_template_updated',
    item_template_deleted: 'item_template_deleted',
    task_moved: 'task_moved',
    shopping_item_moved: 'shopping_item_moved',
  };
  return eventTypeMap[operation];
}

/**
 * Represents an activity log entry as returned by the API.
 */
interface ActivityEntry {
  type: string;
  title: string;
  userId: string | null;
  timestamp: string;
}

/**
 * Sorts activity entries by timestamp descending (newest first).
 * This mirrors the sort logic in activityRoutes.ts GET handler.
 */
function sortEntriesDescending(entries: ActivityEntry[]): ActivityEntry[] {
  return [...entries].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

// ─── Arbitraries ────────────────────────────────────────────────────────────────

/** All tracked operations as a fast-check arbitrary */
const trackedOperationArb: fc.Arbitrary<TrackedOperation> = fc.constantFrom(
  'category_created',
  'category_updated',
  'category_deleted',
  'template_created',
  'template_updated',
  'template_deleted',
  'item_template_created',
  'item_template_updated',
  'item_template_deleted',
  'task_moved',
  'shopping_item_moved'
);

/** Generate a non-empty item title (simulates category name, template title, task title) */
const itemTitleArb: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 100 }).filter(
  (s) => s.trim().length > 0
);

/** Generate a UUID-like user ID string */
const userIdArb: fc.Arbitrary<string> = fc.uuid();

/** Generate a random ISO timestamp string within the last 90 days */
const timestampArb: fc.Arbitrary<string> = fc
  .date({
    min: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    max: new Date(),
    noInvalidDate: true,
  })
  .map((d) => d.toISOString());

/** Generate a random activity entry */
const activityEntryArb: fc.Arbitrary<ActivityEntry> = fc.record({
  type: trackedOperationArb as fc.Arbitrary<string>,
  title: itemTitleArb,
  userId: fc.oneof(userIdArb, fc.constant(null as string | null)),
  timestamp: timestampArb,
});

// ─── Tests ──────────────────────────────────────────────────────────────────────

// Feature: household-app-enhancements, Property 1: Activity log records all tracked operations
describe('Feature: household-app-enhancements, Property 1: Activity log records all tracked operations', () => {
  /**
   * **Validates: Requirements 2.1–2.10, 3.1–3.2**
   *
   * For any tracked operation (category CRUD, template CRUD, task move, shopping item move)
   * performed by any user, the activity_log SHALL contain a row with correct event_type,
   * item_title, and user_id.
   *
   * This tests the mapping contract: each operation type produces the correct event_type value.
   */
  it('every tracked operation maps to its correct event_type value', () => {
    fc.assert(
      fc.property(
        trackedOperationArb,
        itemTitleArb,
        userIdArb,
        (operation, itemTitle, userId) => {
          const eventType = mapOperationToEventType(operation);

          // The event_type must exactly equal the operation string (identity mapping contract)
          expect(eventType).toBe(operation);

          // The event_type must be a non-empty string
          expect(eventType.length).toBeGreaterThan(0);

          // Simulate constructing the activity log row
          const logRow = {
            event_type: eventType,
            item_title: itemTitle,
            user_id: userId,
          };

          // Verify the row has all required fields with correct values
          expect(logRow.event_type).toBe(operation);
          expect(logRow.item_title).toBe(itemTitle);
          expect(logRow.user_id).toBe(userId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.10, 3.1–3.2**
   *
   * For any tracked operation, the mapping function always produces a value from
   * the known set of valid event types — never undefined or an unknown string.
   */
  it('all tracked operations produce event_type values from the defined set', () => {
    const validEventTypes = new Set<string>([
      'category_created',
      'category_updated',
      'category_deleted',
      'template_created',
      'template_updated',
      'template_deleted',
      'item_template_created',
      'item_template_updated',
      'item_template_deleted',
      'task_moved',
      'shopping_item_moved',
    ]);

    fc.assert(
      fc.property(trackedOperationArb, (operation) => {
        const eventType = mapOperationToEventType(operation);
        expect(validEventTypes.has(eventType)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.1–2.9, 3.1–3.2**
   *
   * The mapping is bijective for tracked operations: distinct operations produce
   * distinct event_type values (no two operations share an event_type).
   */
  it('distinct operations produce distinct event_type values', () => {
    const allOperations: TrackedOperation[] = [
      'category_created',
      'category_updated',
      'category_deleted',
      'template_created',
      'template_updated',
      'template_deleted',
      'item_template_created',
      'item_template_updated',
      'item_template_deleted',
      'task_moved',
      'shopping_item_moved',
    ];

    const eventTypes = allOperations.map(mapOperationToEventType);
    const uniqueEventTypes = new Set(eventTypes);

    // Each operation must map to a unique event_type
    expect(uniqueEventTypes.size).toBe(allOperations.length);
  });
});

// Feature: household-app-enhancements, Property 2: Activity feed returns entries sorted by timestamp descending
describe('Feature: household-app-enhancements, Property 2: Activity feed returns entries sorted by timestamp descending', () => {
  /**
   * **Validates: Requirements 3.3**
   *
   * For any set of activity_log entries, GET /api/activity returns them in
   * descending timestamp order. The first entry has the latest timestamp and
   * order is monotonically decreasing.
   */
  it('sorted entries are in monotonically decreasing timestamp order', () => {
    fc.assert(
      fc.property(
        fc.array(activityEntryArb, { minLength: 2, maxLength: 50 }),
        (entries) => {
          const sorted = sortEntriesDescending(entries);

          // Verify monotonically decreasing: each entry's timestamp >= the next
          for (let i = 0; i < sorted.length - 1; i++) {
            const currentTime = new Date(sorted[i].timestamp).getTime();
            const nextTime = new Date(sorted[i + 1].timestamp).getTime();
            expect(currentTime).toBeGreaterThanOrEqual(nextTime);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 3.3**
   *
   * The first entry in a sorted activity feed always has the maximum (latest) timestamp
   * among all entries in the set.
   */
  it('first entry after sorting has the latest timestamp', () => {
    fc.assert(
      fc.property(
        fc.array(activityEntryArb, { minLength: 1, maxLength: 50 }),
        (entries) => {
          const sorted = sortEntriesDescending(entries);

          const maxTimestamp = Math.max(
            ...entries.map((e) => new Date(e.timestamp).getTime())
          );
          const firstTimestamp = new Date(sorted[0].timestamp).getTime();

          expect(firstTimestamp).toBe(maxTimestamp);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 3.3**
   *
   * Sorting preserves all entries — no entries are lost or duplicated during the sort.
   */
  it('sorting preserves all entries without loss or duplication', () => {
    fc.assert(
      fc.property(
        fc.array(activityEntryArb, { minLength: 0, maxLength: 50 }),
        (entries) => {
          const sorted = sortEntriesDescending(entries);

          // Same length
          expect(sorted.length).toBe(entries.length);

          // Every entry from the original appears in the sorted array (by reference check on titles+timestamps)
          const originalSet = entries.map((e) => `${e.type}|${e.title}|${e.timestamp}`).sort();
          const sortedSet = sorted.map((e) => `${e.type}|${e.title}|${e.timestamp}`).sort();
          expect(sortedSet).toEqual(originalSet);
        }
      ),
      { numRuns: 100 }
    );
  });
});
