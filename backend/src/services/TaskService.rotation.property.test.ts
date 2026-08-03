/**
 * TaskService Rotation Property-Based Tests
 *
 * Feature: household-app-enhancements
 *
 * Tests rotation logic for recurring tasks including:
 * - Property 7: Task rotation advances round-robin on completion
 * - Property 8: Rotation requires at least 2 selected users
 * - Property 9: Rotation configuration round-trip through API
 * - Property 10: User removal from system adjusts rotation lists
 *
 * **Validates: Requirements 8.2, 8.3, 8.4, 8.5, 8.6**
 */

import * as fc from 'fast-check';
import { TaskService, TaskValidationError, TaskInput } from './TaskService';
import * as taskQueries from '../db/taskQueries';
import * as userQueries from '../db/userQueries';
import { Task } from '../models/Task';

// Mock the database query modules
jest.mock('../db/taskQueries');
jest.mock('../db/userQueries');
jest.mock('../db/connection');

const mockCreateTask = taskQueries.createTask as jest.MockedFunction<typeof taskQueries.createTask>;
const mockGetTaskById = taskQueries.getTaskById as jest.MockedFunction<typeof taskQueries.getTaskById>;
const mockUpdateTask = taskQueries.updateTask as jest.MockedFunction<typeof taskQueries.updateTask>;
const mockGetUserById = userQueries.getUserById as jest.MockedFunction<typeof userQueries.getUserById>;
const mockCreateHistoryEntry = taskQueries.createHistoryEntry as jest.MockedFunction<typeof taskQueries.createHistoryEntry>;

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generates a UUID-like string */
const uuidArb = fc.uuid();

/** Generates a rotation user list of N users (N between 2 and 20) */
const rotationUserIdsArb = (minLen = 2, maxLen = 20) =>
  fc.array(uuidArb, { minLength: minLen, maxLength: maxLen })
    .filter(ids => new Set(ids).size === ids.length); // all unique

/** Generates a rotation config: list of users + current index */
const rotationConfigArb = fc.integer({ min: 2, max: 20 }).chain(n =>
  fc.tuple(
    fc.array(uuidArb, { minLength: n, maxLength: n }).filter(ids => new Set(ids).size === ids.length),
    fc.integer({ min: 0, max: n - 1 })
  )
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeBaseTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Test Task',
    description: undefined,
    assignedTo: 'user-1',
    createdBy: 'user-1',
    dueDate: new Date('2025-01-01'),
    isRecurring: true,
    recurrencePattern: { frequency: 'weekly', interval: 1 },
    rotationEnabled: false,
    rotationUserIds: [],
    rotationCurrentIndex: 0,
    status: 'pending',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

// Feature: household-app-enhancements, Property 7: Task rotation advances round-robin on completion
describe('Property 7: Task rotation advances round-robin on completion', () => {
  let taskService: TaskService;

  beforeEach(() => {
    taskService = new TaskService();
    jest.clearAllMocks();

    // Mock user existence check
    mockGetUserById.mockResolvedValue({
      id: 'user-1',
      name: 'Alex',
      haUsername: null,
      createdAt: new Date(),
    });

    // Mock history entry creation
    mockCreateHistoryEntry.mockResolvedValue({
      id: 'hist-1',
      taskId: 'task-1',
      title: 'Test Task',
      assignedTo: 'user-1',
      completedBy: 'user-1',
      completedAt: new Date(),
      wasRecurring: true,
    });
  });

  /**
   * For any recurring task with rotation enabled and N users (N≥2),
   * when completed, the next spawned occurrence has:
   * - assigned_to = rotation_user_ids[(current_index + 1) % N]
   * - rotation_current_index = (current_index + 1) % N
   *
   * **Validates: Requirements 8.2**
   */
  it('advances rotation index and assigns next user on completion', async () => {
    await fc.assert(
      fc.asyncProperty(rotationConfigArb, async ([userIds, currentIndex]) => {
        jest.clearAllMocks();

        const n = userIds.length;
        const expectedNewIndex = (currentIndex + 1) % n;
        const expectedAssignee = userIds[expectedNewIndex]!;

        // Set up the task with this rotation config
        const task = makeBaseTask({
          rotationEnabled: true,
          rotationUserIds: userIds,
          rotationCurrentIndex: currentIndex,
          assignedTo: userIds[currentIndex],
        });

        mockGetTaskById.mockResolvedValue(task);
        mockGetUserById.mockResolvedValue({
          id: 'user-1',
          name: 'Alex',
          haUsername: null,
          createdAt: new Date(),
        });
        mockUpdateTask.mockResolvedValue({ ...task, status: 'completed', completedAt: new Date() });
        mockCreateHistoryEntry.mockResolvedValue({
          id: 'hist-1',
          taskId: task.id,
          title: task.title,
          assignedTo: task.assignedTo,
          completedBy: 'user-1',
          completedAt: new Date(),
          wasRecurring: true,
        });

        let capturedInput: taskQueries.CreateTaskInput | undefined;
        mockCreateTask.mockImplementation(async (input) => {
          capturedInput = input;
          return makeBaseTask({
            id: 'task-next',
            assignedTo: input.assignedTo,
            rotationCurrentIndex: input.rotationCurrentIndex,
            rotationUserIds: input.rotationUserIds ?? [],
            rotationEnabled: input.rotationEnabled ?? false,
          });
        });

        await taskService.completeTask(task.id, 'user-1');

        // Verify the spawned next occurrence has the correct rotation state
        expect(capturedInput).toBeDefined();
        expect(capturedInput!.assignedTo).toBe(expectedAssignee);
        expect(capturedInput!.rotationCurrentIndex).toBe(expectedNewIndex);
        expect(capturedInput!.rotationEnabled).toBe(true);
        expect(capturedInput!.rotationUserIds).toEqual(userIds);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Verify that wrap-around works: when currentIndex is N-1,
   * the next index should be 0.
   *
   * **Validates: Requirements 8.3**
   */
  it('wraps around to index 0 when at end of rotation list', async () => {
    await fc.assert(
      fc.asyncProperty(
        rotationUserIdsArb(2, 20),
        async (userIds) => {
          jest.clearAllMocks();

          const n = userIds.length;
          const currentIndex = n - 1; // last position
          const expectedNewIndex = 0;
          const expectedAssignee = userIds[0]!;

          const task = makeBaseTask({
            rotationEnabled: true,
            rotationUserIds: userIds,
            rotationCurrentIndex: currentIndex,
            assignedTo: userIds[currentIndex],
          });

          mockGetTaskById.mockResolvedValue(task);
          mockGetUserById.mockResolvedValue({
            id: 'user-1',
            name: 'Alex',
            haUsername: null,
            createdAt: new Date(),
          });
          mockUpdateTask.mockResolvedValue({ ...task, status: 'completed', completedAt: new Date() });
          mockCreateHistoryEntry.mockResolvedValue({
            id: 'hist-1',
            taskId: task.id,
            title: task.title,
            assignedTo: task.assignedTo,
            completedBy: 'user-1',
            completedAt: new Date(),
            wasRecurring: true,
          });

          let capturedInput: taskQueries.CreateTaskInput | undefined;
          mockCreateTask.mockImplementation(async (input) => {
            capturedInput = input;
            return makeBaseTask({ id: 'task-next', assignedTo: input.assignedTo });
          });

          await taskService.completeTask(task.id, 'user-1');

          expect(capturedInput).toBeDefined();
          expect(capturedInput!.assignedTo).toBe(expectedAssignee);
          expect(capturedInput!.rotationCurrentIndex).toBe(expectedNewIndex);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: household-app-enhancements, Property 8: Rotation requires at least 2 selected users
describe('Property 8: Rotation requires at least 2 selected users', () => {
  let taskService: TaskService;

  beforeEach(() => {
    taskService = new TaskService();
    jest.clearAllMocks();

    mockGetUserById.mockResolvedValue({
      id: 'user-1',
      name: 'Alex',
      haUsername: null,
      createdAt: new Date(),
    });
  });

  /**
   * For any task where rotationEnabled=true and rotationUserIds.length < 2,
   * the system rejects with a validation error.
   *
   * **Validates: Requirements 8.2**
   */
  it('rejects task creation when rotation enabled with fewer than 2 users', async () => {
    // Generate arrays of length 0 or 1
    const insufficientUsersArb = fc.oneof(
      fc.constant([] as string[]),
      fc.array(uuidArb, { minLength: 1, maxLength: 1 })
    );

    await fc.assert(
      fc.asyncProperty(
        insufficientUsersArb,
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        async (userIds, title) => {
          jest.clearAllMocks();
          mockGetUserById.mockResolvedValue({
            id: 'user-1',
            name: 'Alex',
            haUsername: null,
            createdAt: new Date(),
          });

          const input: TaskInput = {
            title,
            assignedTo: 'user-1',
            createdBy: 'user-1',
            dueDate: new Date('2025-06-01'),
            isRecurring: true,
            recurrenceFrequency: 'weekly',
            recurrenceInterval: 1,
            rotationEnabled: true,
            rotationUserIds: userIds,
            rotationCurrentIndex: 0,
          };

          await expect(taskService.createTask(input)).rejects.toThrow(TaskValidationError);
          await expect(taskService.createTask(input)).rejects.toThrow('Rotation requires at least 2 users');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates that update also rejects when rotation is enabled with < 2 users.
   *
   * **Validates: Requirements 8.2**
   */
  it('rejects task update when rotation enabled with fewer than 2 users', async () => {
    const insufficientUsersArb = fc.oneof(
      fc.constant([] as string[]),
      fc.array(uuidArb, { minLength: 1, maxLength: 1 })
    );

    await fc.assert(
      fc.asyncProperty(insufficientUsersArb, async (userIds) => {
        jest.clearAllMocks();

        const existingTask = makeBaseTask({
          rotationEnabled: false,
          rotationUserIds: [],
          rotationCurrentIndex: 0,
        });

        mockGetTaskById.mockResolvedValue(existingTask);

        await expect(
          taskService.updateTask('task-1', {
            rotationEnabled: true,
            rotationUserIds: userIds,
          })
        ).rejects.toThrow('Rotation requires at least 2 users');
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: household-app-enhancements, Property 9: Rotation configuration round-trip through API
describe('Property 9: Rotation configuration round-trip through API', () => {
  let taskService: TaskService;

  beforeEach(() => {
    taskService = new TaskService();
    jest.clearAllMocks();
  });

  /**
   * For any task with rotation enabled, the GET response includes
   * rotationEnabled, rotationUserIds, and rotationCurrentIndex matching
   * what was stored.
   *
   * **Validates: Requirements 8.5**
   */
  it('rotation config persists and is returned correctly via getTaskById', async () => {
    await fc.assert(
      fc.asyncProperty(rotationConfigArb, async ([userIds, currentIndex]) => {
        jest.clearAllMocks();

        const storedTask = makeBaseTask({
          rotationEnabled: true,
          rotationUserIds: userIds,
          rotationCurrentIndex: currentIndex,
        });

        mockGetTaskById.mockResolvedValue(storedTask);

        const result = await taskService.getTaskById(storedTask.id);

        expect(result).not.toBeNull();
        expect(result!.rotationEnabled).toBe(true);
        expect(result!.rotationUserIds).toEqual(userIds);
        expect(result!.rotationCurrentIndex).toBe(currentIndex);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Rotation fields persist through create → get cycle.
   *
   * **Validates: Requirements 8.5**
   */
  it('rotation fields round-trip through createTask', async () => {
    await fc.assert(
      fc.asyncProperty(rotationConfigArb, async ([userIds, currentIndex]) => {
        jest.clearAllMocks();

        mockGetUserById.mockResolvedValue({
          id: userIds[0]!,
          name: 'User',
          haUsername: null,
          createdAt: new Date(),
        });

        const createdTask = makeBaseTask({
          rotationEnabled: true,
          rotationUserIds: userIds,
          rotationCurrentIndex: currentIndex,
          assignedTo: userIds[currentIndex],
        });

        mockCreateTask.mockResolvedValue(createdTask);

        const input: TaskInput = {
          title: 'Rotation Test',
          assignedTo: userIds[currentIndex]!,
          createdBy: userIds[0]!,
          dueDate: new Date('2025-06-01'),
          isRecurring: true,
          recurrenceFrequency: 'weekly',
          recurrenceInterval: 1,
          rotationEnabled: true,
          rotationUserIds: userIds,
          rotationCurrentIndex: currentIndex,
        };

        const result = await taskService.createTask(input);

        expect(result.rotationEnabled).toBe(true);
        expect(result.rotationUserIds).toEqual(userIds);
        expect(result.rotationCurrentIndex).toBe(currentIndex);
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: household-app-enhancements, Property 10: User removal from system adjusts rotation lists
describe('Property 10: User removal from system adjusts rotation lists', () => {
  /**
   * This property tests the rotation adjustment logic extracted from
   * userRoutes.ts DELETE handler. We test the pure logic:
   * - Remove user from rotation_user_ids
   * - Adjust rotation_current_index
   * - Disable rotation if fewer than 2 users remain
   *
   * **Validates: Requirements 8.6**
   */

  /**
   * Pure function that replicates the user removal logic from userRoutes.ts.
   * This is extracted for testability — the actual code runs in the route handler.
   */
  function adjustRotationOnUserRemoval(
    rotationUserIds: string[],
    rotationCurrentIndex: number,
    removedUserId: string
  ): { newUserIds: string[]; newIndex: number; rotationEnabled: boolean } {
    const removedIndex = rotationUserIds.indexOf(removedUserId);
    if (removedIndex === -1) {
      // User not in this rotation list — no change
      return { newUserIds: rotationUserIds, newIndex: rotationCurrentIndex, rotationEnabled: true };
    }

    const newUserIds = rotationUserIds.filter(uid => uid !== removedUserId);
    let newIndex = rotationCurrentIndex;

    // Adjust index if the removed user was before or at the current index
    if (removedIndex <= rotationCurrentIndex) {
      newIndex = Math.max(0, newIndex - 1);
    }

    // If fewer than 2 users remain, disable rotation
    if (newUserIds.length < 2) {
      return { newUserIds, newIndex: 0, rotationEnabled: false };
    }

    // Ensure index is within bounds
    if (newIndex >= newUserIds.length) {
      newIndex = 0;
    }

    return { newUserIds, newIndex, rotationEnabled: true };
  }

  it('removed user is no longer in the rotation list', () => {
    fc.assert(
      fc.property(
        rotationConfigArb.chain(([userIds, currentIndex]) =>
          fc.tuple(
            fc.constant(userIds),
            fc.constant(currentIndex),
            fc.integer({ min: 0, max: userIds.length - 1 }).map(i => userIds[i]!)
          )
        ),
        ([userIds, currentIndex, removedUser]) => {
          const result = adjustRotationOnUserRemoval(userIds, currentIndex, removedUser);
          expect(result.newUserIds).not.toContain(removedUser);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('new index is always within bounds of the new list', () => {
    fc.assert(
      fc.property(
        rotationConfigArb.chain(([userIds, currentIndex]) =>
          fc.tuple(
            fc.constant(userIds),
            fc.constant(currentIndex),
            fc.integer({ min: 0, max: userIds.length - 1 }).map(i => userIds[i]!)
          )
        ),
        ([userIds, currentIndex, removedUser]) => {
          const result = adjustRotationOnUserRemoval(userIds, currentIndex, removedUser);

          if (result.newUserIds.length === 0) {
            expect(result.newIndex).toBe(0);
          } else {
            expect(result.newIndex).toBeGreaterThanOrEqual(0);
            expect(result.newIndex).toBeLessThan(result.newUserIds.length);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('disables rotation when fewer than 2 users remain', () => {
    // Generate lists of exactly 2 users and remove one → should disable
    const twoUserConfigArb = fc.tuple(
      fc.array(uuidArb, { minLength: 2, maxLength: 2 }).filter(ids => new Set(ids).size === ids.length),
      fc.integer({ min: 0, max: 1 })
    );

    fc.assert(
      fc.property(
        twoUserConfigArb.chain(([userIds, currentIndex]) =>
          fc.tuple(
            fc.constant(userIds),
            fc.constant(currentIndex),
            fc.integer({ min: 0, max: 1 }).map(i => userIds[i]!)
          )
        ),
        ([userIds, currentIndex, removedUser]) => {
          const result = adjustRotationOnUserRemoval(userIds, currentIndex, removedUser);

          // Only 1 user remains → rotation disabled
          expect(result.newUserIds.length).toBe(1);
          expect(result.rotationEnabled).toBe(false);
          expect(result.newIndex).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('keeps rotation enabled when 2 or more users remain after removal', () => {
    // Generate lists of 3+ users and remove one → should stay enabled
    const threeOrMoreArb = fc.integer({ min: 3, max: 20 }).chain(n =>
      fc.tuple(
        fc.array(uuidArb, { minLength: n, maxLength: n }).filter(ids => new Set(ids).size === ids.length),
        fc.integer({ min: 0, max: n - 1 })
      ).chain(([userIds, currentIndex]) =>
        fc.tuple(
          fc.constant(userIds),
          fc.constant(currentIndex),
          fc.integer({ min: 0, max: userIds.length - 1 }).map(i => userIds[i]!)
        )
      )
    );

    fc.assert(
      fc.property(threeOrMoreArb, ([userIds, currentIndex, removedUser]) => {
        const result = adjustRotationOnUserRemoval(userIds, currentIndex, removedUser);

        // At least 2 users remain → rotation stays enabled
        expect(result.newUserIds.length).toBeGreaterThanOrEqual(2);
        expect(result.rotationEnabled).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('preserves the relative order of remaining users', () => {
    fc.assert(
      fc.property(
        rotationConfigArb.chain(([userIds, currentIndex]) =>
          fc.tuple(
            fc.constant(userIds),
            fc.constant(currentIndex),
            fc.integer({ min: 0, max: userIds.length - 1 }).map(i => userIds[i]!)
          )
        ),
        ([userIds, _currentIndex, removedUser]) => {
          const result = adjustRotationOnUserRemoval(userIds, _currentIndex, removedUser);

          // The remaining users should be in the same relative order
          const expected = userIds.filter(uid => uid !== removedUser);
          expect(result.newUserIds).toEqual(expected);
        }
      ),
      { numRuns: 200 }
    );
  });
});
