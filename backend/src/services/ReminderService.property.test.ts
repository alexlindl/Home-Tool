/**
 * Property-Based Tests for ReminderService Deduplication Logic
 *
 * Feature: notification-and-activity-fixes, Property 6: Dedup prevents duplicate notifications
 *
 * **Validates: Requirements 2.6**
 *
 * Property 6: For any task, user, notification type, and calendar date,
 * calling sendReminder multiple times with the same parameters SHALL result
 * in exactly one notification being recorded. The dedup key `${taskId}:${type}`
 * prevents re-delivery via WebSocket.
 */

import * as fc from 'fast-check';
import { ReminderService, ReminderType } from './ReminderService';
import { Task } from '../models/Task';

// Mock WebSocket server to capture emissions
jest.mock('../websocket/socketServer');
jest.mock('../db/taskQueries');
jest.mock('../db/settingsQueries');
jest.mock('./NotificationService', () => ({
  notificationService: {
    checkAndSendNotifications: jest.fn().mockResolvedValue(undefined),
  },
}));

import { getIO } from '../websocket/socketServer';

const mockedGetIO = getIO as jest.MockedFunction<typeof getIO>;

// ─── Arbitraries ────────────────────────────────────────────────────────────────

/** Generate a valid UUID-like string for task/user IDs */
const uuidArb: fc.Arbitrary<string> = fc.uuid();

/** Generate a non-empty task title */
const titleArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => s.trim().length > 0);

/** Generate a reminder type */
const reminderTypeArb: fc.Arbitrary<ReminderType> = fc.constantFrom('upcoming' as const, 'overdue' as const);

/** Generate a number of repeat calls (2 to 10) */
const repeatCountArb: fc.Arbitrary<number> = fc.integer({ min: 2, max: 10 });

/** Generate a task with a due date for use in sendReminder */
const taskArb: fc.Arbitrary<Task> = fc.record({
  id: uuidArb,
  title: titleArb,
  description: fc.option(fc.string({ minLength: 0, maxLength: 30 }), { nil: undefined }),
  assignedTo: fc.option(uuidArb, { nil: null }),
  createdBy: uuidArb,
  dueDate: fc.date({
    min: new Date('2020-01-01T00:00:00.000Z'),
    max: new Date('2030-12-31T00:00:00.000Z'),
    noInvalidDate: true,
  }),
  isRecurring: fc.constant(false),
  status: fc.constant('pending' as const),
  createdAt: fc.date({ noInvalidDate: true }),
  updatedAt: fc.date({ noInvalidDate: true }),
});

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('Property 6: Dedup prevents duplicate notifications', () => {
  let mockEmit: jest.Mock;

  beforeEach(() => {
    mockEmit = jest.fn();
    mockedGetIO.mockReturnValue({ emit: mockEmit } as unknown as ReturnType<typeof getIO>);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * **Validates: Requirements 2.6**
   *
   * For any task and reminder type, calling sendReminder N times (N >= 2)
   * with the same parameters results in exactly one WebSocket emission.
   */
  it('calling sendReminder N times with same task and type emits exactly once', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskArb,
        reminderTypeArb,
        repeatCountArb,
        async (task, type, repeatCount) => {
          const service = new ReminderService();
          mockEmit.mockClear();

          // Call sendReminder N times with the same task and type
          for (let i = 0; i < repeatCount; i++) {
            await service.sendReminder(task, type);
          }

          // Exactly one emission regardless of how many calls
          expect(mockEmit).toHaveBeenCalledTimes(1);
          expect(mockEmit).toHaveBeenCalledWith('reminder:notify', expect.objectContaining({
            taskId: task.id,
            type,
          }));
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 2.6**
   *
   * The dedup key is `${taskId}:${type}`. Different task IDs or different types
   * should NOT be deduplicated against each other (no false dedup).
   */
  it('different task IDs with same type produce separate emissions', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskArb,
        taskArb,
        reminderTypeArb,
        async (task1, task2, type) => {
          // Ensure distinct task IDs
          if (task1.id === task2.id) return;

          const service = new ReminderService();
          mockEmit.mockClear();

          await service.sendReminder(task1, type);
          await service.sendReminder(task2, type);

          // Two distinct tasks → two emissions
          expect(mockEmit).toHaveBeenCalledTimes(2);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 2.6**
   *
   * Same task with different types produces separate emissions (the type is part
   * of the dedup key).
   */
  it('same task with different types produces separate emissions', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskArb,
        repeatCountArb,
        async (task, repeatCount) => {
          const service = new ReminderService();
          mockEmit.mockClear();

          // Send 'upcoming' N times, then 'overdue' N times
          for (let i = 0; i < repeatCount; i++) {
            await service.sendReminder(task, 'upcoming');
          }
          for (let i = 0; i < repeatCount; i++) {
            await service.sendReminder(task, 'overdue');
          }

          // Exactly 2 emissions: one for 'upcoming', one for 'overdue'
          expect(mockEmit).toHaveBeenCalledTimes(2);
          expect(mockEmit).toHaveBeenCalledWith('reminder:notify', expect.objectContaining({
            taskId: task.id,
            type: 'upcoming',
          }));
          expect(mockEmit).toHaveBeenCalledWith('reminder:notify', expect.objectContaining({
            taskId: task.id,
            type: 'overdue',
          }));
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 2.6**
   *
   * After clearSentReminders is called, the same task/type combo can emit again.
   * This verifies the dedup mechanism resets correctly (e.g., for daily reset).
   */
  it('clearSentReminders allows re-emission of previously deduped reminders', async () => {
    await fc.assert(
      fc.asyncProperty(
        taskArb,
        reminderTypeArb,
        async (task, type) => {
          const service = new ReminderService();
          mockEmit.mockClear();

          // First emission
          await service.sendReminder(task, type);
          expect(mockEmit).toHaveBeenCalledTimes(1);

          // Second call is deduped
          await service.sendReminder(task, type);
          expect(mockEmit).toHaveBeenCalledTimes(1);

          // Reset dedup state
          service.clearSentReminders();

          // Now the same combo emits again
          await service.sendReminder(task, type);
          expect(mockEmit).toHaveBeenCalledTimes(2);
        },
      ),
      { numRuns: 100 },
    );
  });
});
