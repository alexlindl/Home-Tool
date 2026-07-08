/**
 * Preservation Property Tests - Property 2: Orchestration Logic Unchanged
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
 *
 * These tests verify that the orchestration logic around `callHaApi` is correct
 * and must remain unchanged after the bugfix. They test:
 * - Deduplication: same task/type/date/user combo only triggers one API call
 * - Target Resolution: assigned tasks → assigned user (if linked), unassigned → all linked
 * - Lead Time Window: only tasks where windowStart <= now <= dueDate are selected
 * - Backlog Skip: tasks with dueDate = null never trigger notifications
 * - Unlinked User Skip: users with haUsername = null never appear in targets
 *
 * These tests PASS on the unfixed code (baseline orchestration behavior to preserve).
 */

import * as fc from 'fast-check';
import { NotificationService } from './NotificationService';
import { Task } from '../models/Task';
import { User } from '../models/User';

// Mock the database modules
jest.mock('../db/userQueries');
jest.mock('../db/taskQueries');
jest.mock('../db/settingsQueries');

import { getLinkedUsers } from '../db/userQueries';
import { getTasks } from '../db/taskQueries';
import { getAppSetting } from '../db/settingsQueries';

const mockedGetLinkedUsers = getLinkedUsers as jest.MockedFunction<typeof getLinkedUsers>;
const mockedGetTasks = getTasks as jest.MockedFunction<typeof getTasks>;
const mockedGetAppSetting = getAppSetting as jest.MockedFunction<typeof getAppSetting>;

// ─── Arbitraries ────────────────────────────────────────────────────────────────

/** Generate a valid UUID-like string */
const uuidArb: fc.Arbitrary<string> = fc.uuid();

/** Generate a valid HA username (lowercase, underscores, digits) */
const haUsernameArb: fc.Arbitrary<string> = fc
  .array(
    fc.oneof(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
      fc.constant('_'),
      fc.constantFrom(...'0123456789'.split('')),
    ),
    { minLength: 1, maxLength: 15 },
  )
  .map((chars) => {
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    const firstChar = letters[chars[0].charCodeAt(0) % letters.length];
    return firstChar + chars.slice(1).join('');
  });

/** Generate a linked user (has haUsername) */
const linkedUserArb: fc.Arbitrary<User> = fc.record({
  id: uuidArb,
  name: fc.string({ minLength: 1, maxLength: 20 }),
  haUsername: haUsernameArb,
  createdAt: fc.date({ noInvalidDate: true }),
});

/** Generate an unlinked user (haUsername is null) */
const unlinkedUserArb: fc.Arbitrary<User> = fc.record({
  id: uuidArb,
  name: fc.string({ minLength: 1, maxLength: 20 }),
  haUsername: fc.constant(null),
  createdAt: fc.date({ noInvalidDate: true }),
});

/** Generate a notification type */
const notificationTypeArb = fc.constantFrom('due' as const, 'overdue' as const);

/** Generate a date string in YYYY-MM-DD format */
const dateStrArb: fc.Arbitrary<string> = fc
  .date({ min: new Date('2020-01-01T00:00:00.000Z'), max: new Date('2030-12-31T00:00:00.000Z'), noInvalidDate: true })
  .map((d) => d.toISOString().slice(0, 10));

/** Generate a task with a due date */
const taskWithDueDateArb = (assignedTo: string | null): fc.Arbitrary<Task> =>
  fc.record({
    id: uuidArb,
    title: fc.string({ minLength: 1, maxLength: 50 }),
    assignedTo: fc.constant(assignedTo),
    createdBy: uuidArb,
    dueDate: fc.date({ min: new Date('2024-01-01T00:00:00.000Z'), max: new Date('2026-12-31T00:00:00.000Z'), noInvalidDate: true }),
    isRecurring: fc.constant(false),
    status: fc.constant('pending' as const),
    createdAt: fc.date({ noInvalidDate: true }),
    updatedAt: fc.date({ noInvalidDate: true }),
  });

/** Generate a backlog task (dueDate = null) */
const backlogTaskArb: fc.Arbitrary<Task> = fc.record({
  id: uuidArb,
  title: fc.string({ minLength: 1, maxLength: 50 }),
  assignedTo: fc.oneof(uuidArb, fc.constant(null)),
  createdBy: uuidArb,
  dueDate: fc.constant(null),
  isRecurring: fc.constant(false),
  status: fc.constant('pending' as const),
  createdAt: fc.date({ noInvalidDate: true }),
  updatedAt: fc.date({ noInvalidDate: true }),
});

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('Preservation: Orchestration Logic Unchanged', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    // Mock fetch to always succeed (we're testing orchestration, not API calls)
    global.fetch = jest.fn(async () => {
      return new Response(JSON.stringify({}), { status: 200 });
    }) as unknown as typeof global.fetch;

    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // ─── Deduplication ──────────────────────────────────────────────────────────

  /**
   * **Validates: Requirements 3.4**
   *
   * Property: For all task/type/date/user combos, calling sendNotification twice
   * results in only one API call (dedup key prevents duplicate sends).
   */
  describe('Deduplication', () => {
    it('calling sendNotification twice for same task/type/date/user results in one API call', async () => {
      await fc.assert(
        fc.asyncProperty(
          linkedUserArb,
          taskWithDueDateArb(null).map((t) => ({ ...t, assignedTo: null })),
          notificationTypeArb,
          dateStrArb,
          async (user, task, type, dateStr) => {
            const service = new NotificationService();
            const fetchMock = global.fetch as jest.Mock;
            fetchMock.mockClear();

            const today = new Date(dateStr + 'T00:00:00.000Z');

            // First call - should invoke fetch
            await service.sendNotification(user, task, type, today);
            const firstCallCount = fetchMock.mock.calls.length;

            // Second call - should be deduplicated (no additional fetch)
            await service.sendNotification(user, task, type, today);
            const secondCallCount = fetchMock.mock.calls.length;

            // Exactly one notification was made (2 fetch calls: persistent + mobile), not duplicated
            expect(firstCallCount).toBe(2);
            expect(secondCallCount).toBe(2);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('different date strings produce separate notifications (no false dedup)', async () => {
      await fc.assert(
        fc.asyncProperty(
          linkedUserArb,
          taskWithDueDateArb(null),
          notificationTypeArb,
          async (user, task, type) => {
            const service = new NotificationService();
            const fetchMock = global.fetch as jest.Mock;
            fetchMock.mockClear();

            const today1 = new Date('2024-06-15T00:00:00.000Z');
            const today2 = new Date('2024-06-16T00:00:00.000Z');

            await service.sendNotification(user, task, type, today1);
            await service.sendNotification(user, task, type, today2);

            // Two different dates → two notifications × 2 fetch calls each = 4
            expect(fetchMock.mock.calls.length).toBe(4);
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  // ─── Target Resolution ────────────────────────────────────────────────────────

  /**
   * **Validates: Requirements 3.5, 3.6**
   *
   * Property: For all combinations of assigned/unassigned tasks with linked/unlinked
   * users, resolveTargets returns the correct subset.
   */
  describe('Target Resolution', () => {
    it('assigned task with linked user → only that user receives notification', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(linkedUserArb, { minLength: 2, maxLength: 5 }),
          fc.nat({ max: 10 }),
          async (linkedUsers, _seed) => {
            // Ensure unique user IDs
            const uniqueUsers = linkedUsers.filter(
              (u, i, arr) => arr.findIndex((x) => x.id === u.id) === i,
            );
            if (uniqueUsers.length < 2) return; // Need at least 2 users

            const targetUser = uniqueUsers[0];
            const service = new NotificationService();
            const fetchMock = global.fetch as jest.Mock;
            fetchMock.mockClear();

            // Create a task assigned to the first user
            const dueDate = new Date(Date.now() + 3600_000); // 1 hour from now
            const task: Task = {
              id: 'task-assigned-1',
              title: 'Test Task',
              assignedTo: targetUser.id,
              createdBy: uniqueUsers[1].id,
              dueDate,
              isRecurring: false,
              status: 'pending',
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            // Set up mocks for checkAndSendNotifications
            mockedGetLinkedUsers.mockResolvedValue(uniqueUsers);
            mockedGetTasks.mockResolvedValue([task]);
            mockedGetAppSetting.mockResolvedValue('24');

            await service.checkAndSendNotifications();

            // Only one user notified (2 fetch calls: persistent + mobile)
            expect(fetchMock.mock.calls.length).toBe(2);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('assigned task with NON-linked user → no notification sent', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(linkedUserArb, { minLength: 1, maxLength: 3 }),
          uuidArb,
          async (linkedUsers, nonLinkedUserId) => {
            // Ensure nonLinkedUserId is not one of the linked users
            const uniqueLinked = linkedUsers.filter(
              (u, i, arr) => arr.findIndex((x) => x.id === u.id) === i,
            );
            if (uniqueLinked.some((u) => u.id === nonLinkedUserId)) return;

            const service = new NotificationService();
            const fetchMock = global.fetch as jest.Mock;
            fetchMock.mockClear();

            const dueDate = new Date(Date.now() + 3600_000);
            const task: Task = {
              id: 'task-nonlinked-1',
              title: 'Test Task',
              assignedTo: nonLinkedUserId,
              createdBy: 'creator-1',
              dueDate,
              isRecurring: false,
              status: 'pending',
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            mockedGetLinkedUsers.mockResolvedValue(uniqueLinked);
            mockedGetTasks.mockResolvedValue([task]);
            mockedGetAppSetting.mockResolvedValue('24');

            await service.checkAndSendNotifications();

            // No fetch calls (non-linked user is not in targets)
            expect(fetchMock.mock.calls.length).toBe(0);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('unassigned task → all linked users receive notifications', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(linkedUserArb, { minLength: 1, maxLength: 4 }),
          async (linkedUsers) => {
            // Ensure unique user IDs
            const uniqueUsers = linkedUsers.filter(
              (u, i, arr) => arr.findIndex((x) => x.id === u.id) === i,
            );
            if (uniqueUsers.length === 0) return;

            const service = new NotificationService();
            const fetchMock = global.fetch as jest.Mock;
            fetchMock.mockClear();

            const dueDate = new Date(Date.now() + 3600_000);
            const task: Task = {
              id: 'task-unassigned-1',
              title: 'Unassigned Task',
              assignedTo: null, // Unassigned
              createdBy: 'creator-1',
              dueDate,
              isRecurring: false,
              status: 'pending',
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            mockedGetLinkedUsers.mockResolvedValue(uniqueUsers);
            mockedGetTasks.mockResolvedValue([task]);
            mockedGetAppSetting.mockResolvedValue('24');

            await service.checkAndSendNotifications();

            // Each linked user gets 2 fetch calls (persistent + mobile)
            expect(fetchMock.mock.calls.length).toBe(uniqueUsers.length * 2);
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  // ─── Lead Time Window ─────────────────────────────────────────────────────────

  /**
   * **Validates: Requirements 3.1, 3.2**
   *
   * Property: For all timestamps and due dates, checkAndSendNotifications selects only
   * tasks where windowStart <= now <= dueDate (or now > dueDate for overdue).
   */
  describe('Lead Time Window', () => {
    it('task within lead time window triggers notification', async () => {
      await fc.assert(
        fc.asyncProperty(
          linkedUserArb,
          fc.integer({ min: 1, max: 72 }), // lead hours (1-72)
          fc.double({ min: 0.01, max: 0.99, noNaN: true }), // fraction within window
          async (user, leadHours, fraction) => {
            const service = new NotificationService();
            const fetchMock = global.fetch as jest.Mock;
            fetchMock.mockClear();

            // Set "now" somewhere within the lead time window
            const dueDate = new Date('2025-03-15T12:00:00.000Z');
            const leadMs = leadHours * 60 * 60 * 1000;
            const windowStart = new Date(dueDate.getTime() - leadMs);
            const now = new Date(windowStart.getTime() + fraction * leadMs);

            // Use jest fake timers to control Date.now()
            jest.useFakeTimers();
            jest.setSystemTime(now);

            const task: Task = {
              id: 'task-window-1',
              title: 'Window Test Task',
              assignedTo: null,
              createdBy: 'creator-1',
              dueDate,
              isRecurring: false,
              notificationLeadHours: leadHours,
              status: 'pending',
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            mockedGetLinkedUsers.mockResolvedValue([user]);
            mockedGetTasks.mockResolvedValue([task]);
            mockedGetAppSetting.mockResolvedValue('24');

            await service.checkAndSendNotifications();

            // Task is within window → notification should be sent (2 fetch calls: persistent + mobile)
            expect(fetchMock.mock.calls.length).toBe(2);

            jest.useRealTimers();
          },
        ),
        { numRuns: 50 },
      );
    });

    it('task outside lead time window (too early) does NOT trigger notification', async () => {
      await fc.assert(
        fc.asyncProperty(
          linkedUserArb,
          fc.integer({ min: 1, max: 48 }), // lead hours
          fc.integer({ min: 1, max: 24 }), // extra hours before window
          async (user, leadHours, extraHours) => {
            const service = new NotificationService();
            const fetchMock = global.fetch as jest.Mock;
            fetchMock.mockClear();

            // Set "now" to BEFORE the window start
            const dueDate = new Date('2025-03-15T12:00:00.000Z');
            const leadMs = leadHours * 60 * 60 * 1000;
            const extraMs = extraHours * 60 * 60 * 1000;
            const windowStart = new Date(dueDate.getTime() - leadMs);
            const now = new Date(windowStart.getTime() - extraMs); // Before window

            jest.useFakeTimers();
            jest.setSystemTime(now);

            const task: Task = {
              id: 'task-early-1',
              title: 'Early Task',
              assignedTo: null,
              createdBy: 'creator-1',
              dueDate,
              isRecurring: false,
              notificationLeadHours: leadHours,
              status: 'pending',
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            mockedGetLinkedUsers.mockResolvedValue([user]);
            mockedGetTasks.mockResolvedValue([task]);
            mockedGetAppSetting.mockResolvedValue('24');

            await service.checkAndSendNotifications();

            // Task is before window → no notification
            expect(fetchMock.mock.calls.length).toBe(0);

            jest.useRealTimers();
          },
        ),
        { numRuns: 50 },
      );
    });

    it('per-task notificationLeadHours overrides global default', async () => {
      await fc.assert(
        fc.asyncProperty(
          linkedUserArb,
          fc.integer({ min: 2, max: 48 }), // per-task lead hours (larger)
          async (user, perTaskLeadHours) => {
            const service = new NotificationService();
            const fetchMock = global.fetch as jest.Mock;
            fetchMock.mockClear();

            // Global default is 1 hour, per-task override is larger
            const globalDefault = 1;
            const dueDate = new Date('2025-03-15T12:00:00.000Z');
            // Place "now" inside per-task window but OUTSIDE global 1h window
            const perTaskLeadMs = perTaskLeadHours * 60 * 60 * 1000;
            const globalLeadMs = globalDefault * 60 * 60 * 1000;
            // Pick a time that's within per-task window but outside global window
            const now = new Date(dueDate.getTime() - globalLeadMs - 60_000); // 1 min before global window

            // Only proceed if now is within the per-task window
            const perTaskWindowStart = new Date(dueDate.getTime() - perTaskLeadMs);
            if (now < perTaskWindowStart) return; // skip if not in per-task window

            jest.useFakeTimers();
            jest.setSystemTime(now);

            const task: Task = {
              id: 'task-override-1',
              title: 'Override Task',
              assignedTo: null,
              createdBy: 'creator-1',
              dueDate,
              isRecurring: false,
              notificationLeadHours: perTaskLeadHours,
              status: 'pending',
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            mockedGetLinkedUsers.mockResolvedValue([user]);
            mockedGetTasks.mockResolvedValue([task]);
            mockedGetAppSetting.mockResolvedValue(String(globalDefault));

            await service.checkAndSendNotifications();

            // Per-task override means notification IS sent (2 fetch calls: persistent + mobile)
            expect(fetchMock.mock.calls.length).toBe(2);

            jest.useRealTimers();
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  // ─── Backlog Skip ─────────────────────────────────────────────────────────────

  /**
   * **Validates: Requirements 3.3**
   *
   * Property: For all tasks with dueDate = null, no notification is sent
   * regardless of other fields.
   */
  describe('Backlog Skip', () => {
    it('tasks with dueDate = null never trigger notifications', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(linkedUserArb, { minLength: 1, maxLength: 3 }),
          fc.array(backlogTaskArb, { minLength: 1, maxLength: 5 }),
          async (linkedUsers, backlogTasks) => {
            const uniqueUsers = linkedUsers.filter(
              (u, i, arr) => arr.findIndex((x) => x.id === u.id) === i,
            );
            if (uniqueUsers.length === 0) return;

            const service = new NotificationService();
            const fetchMock = global.fetch as jest.Mock;
            fetchMock.mockClear();

            mockedGetLinkedUsers.mockResolvedValue(uniqueUsers);
            mockedGetTasks.mockResolvedValue(backlogTasks);
            mockedGetAppSetting.mockResolvedValue('24');

            await service.checkAndSendNotifications();

            // No notifications sent for any backlog task
            expect(fetchMock.mock.calls.length).toBe(0);
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  // ─── Unlinked User Skip ───────────────────────────────────────────────────────

  /**
   * **Validates: Requirements 3.5**
   *
   * Property: For all users with haUsername = null, they never appear in targets
   * and never receive notifications.
   */
  describe('Unlinked User Skip', () => {
    it('users with haUsername = null never receive notifications', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(unlinkedUserArb, { minLength: 1, maxLength: 3 }),
          async (_unlinkedUsers) => {

            const service = new NotificationService();
            const fetchMock = global.fetch as jest.Mock;
            fetchMock.mockClear();

            // getLinkedUsers returns empty when no users are linked
            // (the DB query filters by ha_username IS NOT NULL)
            mockedGetLinkedUsers.mockResolvedValue([]);

            const dueDate = new Date(Date.now() + 3600_000);
            const task: Task = {
              id: 'task-unlinked-1',
              title: 'Test Task',
              assignedTo: null,
              createdBy: 'creator-1',
              dueDate,
              isRecurring: false,
              status: 'pending',
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            mockedGetTasks.mockResolvedValue([task]);
            mockedGetAppSetting.mockResolvedValue('24');

            await service.checkAndSendNotifications();

            // No linked users → no fetch calls
            expect(fetchMock.mock.calls.length).toBe(0);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('when getLinkedUsers returns empty array, no processing occurs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(backlogTaskArb.map((t) => ({ ...t, dueDate: new Date(Date.now() + 3600_000) })), {
            minLength: 1,
            maxLength: 5,
          }),
          async (_tasks) => {
            const service = new NotificationService();
            const fetchMock = global.fetch as jest.Mock;
            fetchMock.mockClear();

            mockedGetLinkedUsers.mockResolvedValue([]);

            await service.checkAndSendNotifications();

            // Early return: no linked users means getTasks is never called
            expect(mockedGetTasks).not.toHaveBeenCalled();
            expect(fetchMock.mock.calls.length).toBe(0);
          },
        ),
        { numRuns: 30 },
      );
    });
  });
});
