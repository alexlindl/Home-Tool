/**
 * Property Tests for NotificationService Lead Hours Parsing & Timing Logic
 *
 * Feature: notification-and-activity-fixes
 *
 * Property 1: Lead hours parsing accepts non-negative integers
 * Property 2: Lead hours parsing falls back to 0 for invalid input
 * Property 3: Zero lead hours fires 'due' on same calendar day
 * Property 4: Positive lead hours uses window logic
 * Property 5: Overdue fires when past due date's calendar day
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

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Get end of calendar day (23:59:59.999) for a given date */
function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/** Create a minimal linked user for testing */
function makeLinkedUser(): User {
  return {
    id: 'user-timing-test',
    name: 'Test User',
    haUsername: 'test_user',
    createdAt: new Date(),
  };
}

/** Create a minimal task with the given dueDate and optional notificationLeadHours */
function makeTask(dueDate: Date, notificationLeadHours?: number): Task {
  return {
    id: 'task-timing-test',
    title: 'Timing Test Task',
    assignedTo: null,
    createdBy: 'creator-1',
    dueDate,
    isRecurring: false,
    rotationEnabled: false,
    rotationUserIds: [],
    rotationCurrentIndex: 0,
    notificationLeadHours,
    status: 'pending',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  };
}

// ─── Arbitraries ────────────────────────────────────────────────────────────────

/**
 * Generate a dueDate and a `now` that is on the SAME calendar day as dueDate
 * and where now >= dueDate.
 */
const sameDayDueAndNowArb: fc.Arbitrary<{ dueDate: Date; now: Date }> = fc
  .record({
    // Generate a date within a reasonable range
    year: fc.integer({ min: 2023, max: 2027 }),
    month: fc.integer({ min: 0, max: 11 }),
    day: fc.integer({ min: 1, max: 28 }), // Use 28 to avoid month overflow
    dueHour: fc.integer({ min: 0, max: 22 }), // Leave room for now to be later
    dueMinute: fc.integer({ min: 0, max: 59 }),
  })
  .chain(({ year, month, day, dueHour, dueMinute }) => {
    const dueDate = new Date(year, month, day, dueHour, dueMinute, 0, 0);
    // Generate now between dueDate and end of that same day
    const dueMs = dueDate.getTime();
    const endMs = endOfDay(dueDate).getTime();
    return fc.integer({ min: dueMs, max: endMs }).map((nowMs) => ({
      dueDate,
      now: new Date(nowMs),
    }));
  });

/**
 * Generate positive lead hours (1..168) and a `now` within the notification window
 * [dueDate - leadTimeMs, dueDate].
 */
const withinWindowArb: fc.Arbitrary<{ dueDate: Date; now: Date; leadHours: number }> = fc
  .record({
    year: fc.integer({ min: 2023, max: 2027 }),
    month: fc.integer({ min: 0, max: 11 }),
    day: fc.integer({ min: 1, max: 28 }),
    hour: fc.integer({ min: 0, max: 23 }),
    minute: fc.integer({ min: 0, max: 59 }),
    leadHours: fc.integer({ min: 1, max: 168 }),
    fraction: fc.double({ min: 0, max: 1, noNaN: true }),
  })
  .map(({ year, month, day, hour, minute, leadHours, fraction }) => {
    const dueDate = new Date(year, month, day, hour, minute, 0, 0);
    const leadMs = leadHours * 60 * 60 * 1000;
    const windowStart = new Date(dueDate.getTime() - leadMs);
    // now is between windowStart and dueDate (inclusive both ends)
    const nowMs = windowStart.getTime() + Math.floor(fraction * leadMs);
    return { dueDate, now: new Date(nowMs), leadHours };
  });

/**
 * Generate positive lead hours and a `now` BEFORE the notification window
 * (i.e., now < dueDate - leadTimeMs).
 */
const beforeWindowArb: fc.Arbitrary<{ dueDate: Date; now: Date; leadHours: number }> = fc
  .record({
    year: fc.integer({ min: 2023, max: 2027 }),
    month: fc.integer({ min: 0, max: 11 }),
    day: fc.integer({ min: 1, max: 28 }),
    hour: fc.integer({ min: 0, max: 23 }),
    minute: fc.integer({ min: 0, max: 59 }),
    leadHours: fc.integer({ min: 1, max: 168 }),
    extraMs: fc.integer({ min: 1, max: 86_400_000 }), // 1ms to 24h before window
  })
  .map(({ year, month, day, hour, minute, leadHours, extraMs }) => {
    const dueDate = new Date(year, month, day, hour, minute, 0, 0);
    const leadMs = leadHours * 60 * 60 * 1000;
    const windowStart = new Date(dueDate.getTime() - leadMs);
    const now = new Date(windowStart.getTime() - extraMs);
    return { dueDate, now, leadHours };
  });

/**
 * Generate a dueDate and a `now` that is 1+ full calendar days after dueDate.
 * This means now is past the entire calendar day of dueDate.
 */
const pastDayArb: fc.Arbitrary<{ dueDate: Date; now: Date }> = fc
  .record({
    year: fc.integer({ min: 2023, max: 2026 }),
    month: fc.integer({ min: 0, max: 11 }),
    day: fc.integer({ min: 1, max: 27 }),
    hour: fc.integer({ min: 0, max: 23 }),
    minute: fc.integer({ min: 0, max: 59 }),
    extraDays: fc.integer({ min: 1, max: 365 }),
    nowHour: fc.integer({ min: 0, max: 23 }),
    nowMinute: fc.integer({ min: 0, max: 59 }),
  })
  .map(({ year, month, day, hour, minute, extraDays, nowHour, nowMinute }) => {
    const dueDate = new Date(year, month, day, hour, minute, 0, 0);
    // now is on a different calendar day, at least 1 day later
    const nextDay = new Date(year, month, day + extraDays, nowHour, nowMinute, 0, 0);
    return { dueDate, now: nextDay };
  })
  .filter(({ dueDate, now }) => {
    // Ensure now is actually past the calendar day of dueDate
    const dueDayEnd = endOfDay(dueDate);
    return now.getTime() > dueDayEnd.getTime();
  });

// ─── Tests ──────────────────────────────────────────────────────────────────────

// ─── Property 1 & 2: Lead Hours Parsing ─────────────────────────────────────────

describe('Feature: notification-and-activity-fixes, Property 1: Lead hours parsing accepts non-negative integers', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = jest.fn(async () => {
      return new Response(JSON.stringify({}), { status: 200 });
    }) as unknown as typeof global.fetch;
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  /**
   * **Validates: Requirements 1.2, 1.3**
   *
   * Property 1: For any string representation of a non-negative integer (0, 1, 2, ..., N),
   * the getGlobalLeadHours function SHALL return that integer as the effective lead hours value.
   *
   * Strategy: Generate a non-negative integer n in [0..1000], stringify it, mock getAppSetting
   * to return that string. Set up a task with a controlled due date and verify the service uses
   * the correct lead hours value by observing notification behavior:
   * - For n = 0: zero-lead-hours logic fires 'due' when now >= dueDate on the same day.
   * - For n > 0: window logic fires 'due' when now is exactly at windowStart (dueDate - n*hours).
   */
  it('non-negative integer strings are parsed as their numeric value', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 1000 }),
        async (n: number) => {
          const service = new NotificationService();
          const fetchMock = global.fetch as jest.Mock;
          fetchMock.mockClear();

          const dueDate = new Date('2025-06-15T12:00:00.000Z');

          let now: Date;
          if (n === 0) {
            // For 0 lead hours: now must be >= dueDate and on the same calendar day
            now = new Date(dueDate.getTime());
          } else {
            // For positive lead hours: now = dueDate - n*hours (at window start, within window)
            const leadMs = n * 60 * 60 * 1000;
            now = new Date(dueDate.getTime() - leadMs);
          }

          jest.useFakeTimers();
          jest.setSystemTime(now);

          const user = makeLinkedUser();
          const task = makeTask(dueDate); // No per-task override, uses global

          mockedGetLinkedUsers.mockResolvedValue([user]);
          mockedGetTasks.mockResolvedValue([task]);
          mockedGetAppSetting.mockResolvedValue(String(n));

          await service.checkAndSendNotifications();

          // With correct parsing of n, the task should fire 'due' notification
          // (2 fetch calls: persistent + mobile)
          expect(fetchMock.mock.calls.length).toBe(2);

          // Verify it's a 'due' notification (title = 'Task Reminder')
          const persistentCall = fetchMock.mock.calls.find(
            (call: unknown[]) => (call[0] as string).includes('persistent_notification'),
          );
          if (persistentCall) {
            const body = JSON.parse(persistentCall[1].body as string);
            expect(body.title).toBe('Task Reminder');
          }

          jest.useRealTimers();
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: notification-and-activity-fixes, Property 2: Lead hours parsing falls back to 0 for invalid input', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = jest.fn(async () => {
      return new Response(JSON.stringify({}), { status: 200 });
    }) as unknown as typeof global.fetch;
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  /**
   * **Validates: Requirements 1.4, 1.5**
   *
   * Property 2: For any input that is null, undefined, an empty string, or a non-numeric
   * string, the function SHALL return 0. For any negative integer string, it SHALL also return 0.
   *
   * Strategy: Generate invalid inputs and verify that the service behaves as if lead hours = 0.
   * With lead hours = 0 and now 1 hour after dueDate (same calendar day), the zero-lead-hours
   * logic fires 'due'. If parsing incorrectly returned a positive value, it would fire 'overdue'
   * (since now > dueDate with positive lead hours means overdue).
   */
  it('null input falls back to 0 lead hours (fires due, not overdue)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          const service = new NotificationService();
          const fetchMock = global.fetch as jest.Mock;
          fetchMock.mockClear();

          // Due at noon; now is 1 hour after noon on the same day
          const dueDate = new Date('2025-06-15T12:00:00.000Z');
          const now = new Date('2025-06-15T13:00:00.000Z');

          jest.useFakeTimers();
          jest.setSystemTime(now);

          const user = makeLinkedUser();
          const task = makeTask(dueDate); // No per-task override

          mockedGetLinkedUsers.mockResolvedValue([user]);
          mockedGetTasks.mockResolvedValue([task]);
          mockedGetAppSetting.mockResolvedValue(null);

          await service.checkAndSendNotifications();

          // With fallback to 0, zero-lead-hours logic fires 'due' (same calendar day)
          expect(fetchMock.mock.calls.length).toBe(2);

          // Verify it's 'due' (Task Reminder), not 'overdue' (Task Overdue)
          const persistentCall = fetchMock.mock.calls.find(
            (call: unknown[]) => (call[0] as string).includes('persistent_notification'),
          );
          if (persistentCall) {
            const body = JSON.parse(persistentCall[1].body as string);
            expect(body.title).toBe('Task Reminder');
          }

          jest.useRealTimers();
        },
      ),
      { numRuns: 10 },
    );
  });

  it('empty string falls back to 0 lead hours', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(''),
        async () => {
          const service = new NotificationService();
          const fetchMock = global.fetch as jest.Mock;
          fetchMock.mockClear();

          const dueDate = new Date('2025-06-15T12:00:00.000Z');
          const now = new Date('2025-06-15T13:00:00.000Z');

          jest.useFakeTimers();
          jest.setSystemTime(now);

          const user = makeLinkedUser();
          const task = makeTask(dueDate);

          mockedGetLinkedUsers.mockResolvedValue([user]);
          mockedGetTasks.mockResolvedValue([task]);
          mockedGetAppSetting.mockResolvedValue('');

          await service.checkAndSendNotifications();

          expect(fetchMock.mock.calls.length).toBe(2);

          const persistentCall = fetchMock.mock.calls.find(
            (call: unknown[]) => (call[0] as string).includes('persistent_notification'),
          );
          if (persistentCall) {
            const body = JSON.parse(persistentCall[1].body as string);
            expect(body.title).toBe('Task Reminder');
          }

          jest.useRealTimers();
        },
      ),
      { numRuns: 10 },
    );
  });

  it('non-numeric strings fall back to 0 lead hours', async () => {
    // Generate strings that parseInt(s, 10) cannot parse (returns NaN)
    const nonNumericStringArb = fc.oneof(
      fc.string({ minLength: 1, maxLength: 20 }).filter((s) => isNaN(parseInt(s, 10))),
      fc.constantFrom('abc', 'hello', 'NaN', 'Infinity', '--1', '++2', 'one', 'true', 'false', '   ', '\t'),
    );

    await fc.assert(
      fc.asyncProperty(
        nonNumericStringArb,
        async (invalidStr: string) => {
          const service = new NotificationService();
          const fetchMock = global.fetch as jest.Mock;
          fetchMock.mockClear();

          const dueDate = new Date('2025-06-15T12:00:00.000Z');
          const now = new Date('2025-06-15T13:00:00.000Z');

          jest.useFakeTimers();
          jest.setSystemTime(now);

          const user = makeLinkedUser();
          const task = makeTask(dueDate);

          mockedGetLinkedUsers.mockResolvedValue([user]);
          mockedGetTasks.mockResolvedValue([task]);
          mockedGetAppSetting.mockResolvedValue(invalidStr);

          await service.checkAndSendNotifications();

          // With fallback to 0, zero-lead-hours logic fires 'due' (same calendar day)
          expect(fetchMock.mock.calls.length).toBe(2);

          const persistentCall = fetchMock.mock.calls.find(
            (call: unknown[]) => (call[0] as string).includes('persistent_notification'),
          );
          if (persistentCall) {
            const body = JSON.parse(persistentCall[1].body as string);
            expect(body.title).toBe('Task Reminder');
          }

          jest.useRealTimers();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('negative integer strings fall back to 0 lead hours', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: -1000, max: -1 }),
        async (negativeInt: number) => {
          const service = new NotificationService();
          const fetchMock = global.fetch as jest.Mock;
          fetchMock.mockClear();

          const dueDate = new Date('2025-06-15T12:00:00.000Z');
          const now = new Date('2025-06-15T13:00:00.000Z');

          jest.useFakeTimers();
          jest.setSystemTime(now);

          const user = makeLinkedUser();
          const task = makeTask(dueDate);

          mockedGetLinkedUsers.mockResolvedValue([user]);
          mockedGetTasks.mockResolvedValue([task]);
          mockedGetAppSetting.mockResolvedValue(String(negativeInt));

          await service.checkAndSendNotifications();

          // With fallback to 0, zero-lead-hours logic fires 'due' (same calendar day)
          expect(fetchMock.mock.calls.length).toBe(2);

          const persistentCall = fetchMock.mock.calls.find(
            (call: unknown[]) => (call[0] as string).includes('persistent_notification'),
          );
          if (persistentCall) {
            const body = JSON.parse(persistentCall[1].body as string);
            expect(body.title).toBe('Task Reminder');
          }

          jest.useRealTimers();
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 3, 4, 5: Timing Logic ────────────────────────────────────────────

describe('Feature: notification-and-activity-fixes, Property 3: Zero lead hours fires due on same calendar day', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = jest.fn(async () => {
      return new Response(JSON.stringify({}), { status: 200 });
    }) as unknown as typeof global.fetch;
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  /**
   * **Validates: Requirements 2.1, 2.2**
   *
   * Property 3: For any task with effectiveLeadHours=0 and for any timestamp `now`
   * where `now >= dueDate` and `now` is within the same calendar day as `dueDate`,
   * the timing logic SHALL classify the task as 'due'.
   */
  it('classifies as "due" when now >= dueDate and same calendar day with 0 lead hours', async () => {
    await fc.assert(
      fc.asyncProperty(sameDayDueAndNowArb, async ({ dueDate, now }) => {
        const service = new NotificationService();
        const fetchMock = global.fetch as jest.Mock;
        fetchMock.mockClear();

        jest.useFakeTimers();
        jest.setSystemTime(now);

        const task = makeTask(dueDate, 0); // effectiveLeadHours = 0 via per-task override
        const user = makeLinkedUser();

        mockedGetLinkedUsers.mockResolvedValue([user]);
        mockedGetTasks.mockResolvedValue([task]);
        mockedGetAppSetting.mockResolvedValue('0');

        await service.checkAndSendNotifications();

        // Notification should fire (2 fetch calls: persistent + mobile)
        expect(fetchMock.mock.calls.length).toBe(2);

        // Verify it was a 'due' notification by checking the message content
        const persistentCall = fetchMock.mock.calls.find(
          (call: unknown[]) => (call[0] as string).includes('persistent_notification'),
        );
        if (persistentCall) {
          const body = JSON.parse(persistentCall[1].body as string);
          expect(body.title).toBe('Task Reminder'); // 'due' type produces "Task Reminder"
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Additional check: zero lead hours via global setting (no per-task override)
   */
  it('uses global 0 lead hours when no per-task override is set', async () => {
    await fc.assert(
      fc.asyncProperty(sameDayDueAndNowArb, async ({ dueDate, now }) => {
        const service = new NotificationService();
        const fetchMock = global.fetch as jest.Mock;
        fetchMock.mockClear();

        jest.useFakeTimers();
        jest.setSystemTime(now);

        // No per-task override — global default of '0' is used
        const task = makeTask(dueDate);
        const user = makeLinkedUser();

        mockedGetLinkedUsers.mockResolvedValue([user]);
        mockedGetTasks.mockResolvedValue([task]);
        mockedGetAppSetting.mockResolvedValue('0');

        await service.checkAndSendNotifications();

        // Notification should fire as 'due'
        expect(fetchMock.mock.calls.length).toBe(2);
      }),
      { numRuns: 100 },
    );
  });
});

describe('Feature: notification-and-activity-fixes, Property 4: Positive lead hours uses window logic', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = jest.fn(async () => {
      return new Response(JSON.stringify({}), { status: 200 });
    }) as unknown as typeof global.fetch;
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  /**
   * **Validates: Requirements 2.3, 2.5**
   *
   * Property 4a: For any task with effectiveLeadHours > 0 and for any `now`
   * where `now >= (dueDate - leadTimeMs)` and `now <= dueDate`, the timing logic
   * SHALL classify the task as 'due'.
   */
  it('classifies as "due" when now is within the lead time window', async () => {
    await fc.assert(
      fc.asyncProperty(withinWindowArb, async ({ dueDate, now, leadHours }) => {
        const service = new NotificationService();
        const fetchMock = global.fetch as jest.Mock;
        fetchMock.mockClear();

        jest.useFakeTimers();
        jest.setSystemTime(now);

        const task = makeTask(dueDate, leadHours);
        const user = makeLinkedUser();

        mockedGetLinkedUsers.mockResolvedValue([user]);
        mockedGetTasks.mockResolvedValue([task]);
        mockedGetAppSetting.mockResolvedValue(String(leadHours));

        await service.checkAndSendNotifications();

        // Should fire 'due' notification (2 fetch calls)
        expect(fetchMock.mock.calls.length).toBe(2);

        // Verify it's a 'due' (not 'overdue') notification
        const persistentCall = fetchMock.mock.calls.find(
          (call: unknown[]) => (call[0] as string).includes('persistent_notification'),
        );
        if (persistentCall) {
          const body = JSON.parse(persistentCall[1].body as string);
          expect(body.title).toBe('Task Reminder'); // 'due' type
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 2.3, 2.5**
   *
   * Property 4b: For any `now` outside the lead time window and not past dueDate,
   * no notification fires.
   */
  it('does NOT fire when now is before the lead time window', async () => {
    await fc.assert(
      fc.asyncProperty(beforeWindowArb, async ({ dueDate, now, leadHours }) => {
        const service = new NotificationService();
        const fetchMock = global.fetch as jest.Mock;
        fetchMock.mockClear();

        jest.useFakeTimers();
        jest.setSystemTime(now);

        const task = makeTask(dueDate, leadHours);
        const user = makeLinkedUser();

        mockedGetLinkedUsers.mockResolvedValue([user]);
        mockedGetTasks.mockResolvedValue([task]);
        mockedGetAppSetting.mockResolvedValue(String(leadHours));

        await service.checkAndSendNotifications();

        // No notification should fire
        expect(fetchMock.mock.calls.length).toBe(0);
      }),
      { numRuns: 100 },
    );
  });
});

describe('Feature: notification-and-activity-fixes, Property 5: Overdue fires when past due dates calendar day', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = jest.fn(async () => {
      return new Response(JSON.stringify({}), { status: 200 });
    }) as unknown as typeof global.fetch;
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  /**
   * **Validates: Requirements 2.2, 2.7**
   *
   * Property 5: For any task and any `now` that is past the calendar day of dueDate,
   * the timing logic SHALL classify as 'overdue'.
   */
  it('classifies as "overdue" when now is past the calendar day of dueDate (zero lead hours)', async () => {
    await fc.assert(
      fc.asyncProperty(pastDayArb, async ({ dueDate, now }) => {
        const service = new NotificationService();
        const fetchMock = global.fetch as jest.Mock;
        fetchMock.mockClear();

        jest.useFakeTimers();
        jest.setSystemTime(now);

        const task = makeTask(dueDate, 0); // Zero lead hours
        const user = makeLinkedUser();

        mockedGetLinkedUsers.mockResolvedValue([user]);
        mockedGetTasks.mockResolvedValue([task]);
        mockedGetAppSetting.mockResolvedValue('0');

        await service.checkAndSendNotifications();

        // Notification should fire (2 fetch calls)
        expect(fetchMock.mock.calls.length).toBe(2);

        // Verify it's an 'overdue' notification
        const persistentCall = fetchMock.mock.calls.find(
          (call: unknown[]) => (call[0] as string).includes('persistent_notification'),
        );
        if (persistentCall) {
          const body = JSON.parse(persistentCall[1].body as string);
          expect(body.title).toBe('Task Overdue'); // 'overdue' type
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 2.2, 2.7**
   *
   * Property 5 (with positive lead hours): regardless of effectiveLeadHours,
   * when now is past the calendar day of dueDate, it's 'overdue'.
   */
  it('classifies as "overdue" when now is past dueDate with positive lead hours', async () => {
    await fc.assert(
      fc.asyncProperty(
        pastDayArb,
        fc.integer({ min: 1, max: 168 }),
        async ({ dueDate, now }, leadHours) => {
          const service = new NotificationService();
          const fetchMock = global.fetch as jest.Mock;
          fetchMock.mockClear();

          jest.useFakeTimers();
          jest.setSystemTime(now);

          const task = makeTask(dueDate, leadHours);
          const user = makeLinkedUser();

          mockedGetLinkedUsers.mockResolvedValue([user]);
          mockedGetTasks.mockResolvedValue([task]);
          mockedGetAppSetting.mockResolvedValue(String(leadHours));

          await service.checkAndSendNotifications();

          // Notification should fire (2 fetch calls)
          expect(fetchMock.mock.calls.length).toBe(2);

          // Verify it's an 'overdue' notification
          const persistentCall = fetchMock.mock.calls.find(
            (call: unknown[]) => (call[0] as string).includes('persistent_notification'),
          );
          if (persistentCall) {
            const body = JSON.parse(persistentCall[1].body as string);
            expect(body.title).toBe('Task Overdue'); // 'overdue' type
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
