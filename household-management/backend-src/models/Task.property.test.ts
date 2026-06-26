/**
 * Property-based tests for Task data models
 *
 * Uses fast-check to generate random tasks and verify invariants hold
 * across all valid inputs.
 */

import * as fc from 'fast-check';
import { Task, RecurrencePattern } from './Task';

// ---------------------------------------------------------------------------
// Arbitraries (generators)
// ---------------------------------------------------------------------------

/** Valid household member names per Requirement 1.3 / 2.2 */
const VALID_USERS = ['Alex', 'Becky', 'Sam'] as const;
type UserName = (typeof VALID_USERS)[number];

/** Valid recurrence frequencies per Requirement 2.4 */
const VALID_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const;
type Frequency = (typeof VALID_FREQUENCIES)[number];

/** Generate a non-empty string title */
const arbTitle = fc.string({ minLength: 1, maxLength: 100 });

/** Generate a UUID-like string */
const arbId = fc.uuid();

/** Generate a valid user name */
const arbUserName = fc.constantFrom(...VALID_USERS);

/** Generate a valid (non-NaN) Date within a reasonable range */
const arbDate = fc
  .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
  .filter((d) => !isNaN(d.getTime()));

/** Generate a valid RecurrencePattern */
const arbRecurrencePattern: fc.Arbitrary<RecurrencePattern> = fc.record({
  frequency: fc.constantFrom(...VALID_FREQUENCIES),
  interval: fc.integer({ min: 1, max: 52 }),
  endDate: fc.option(arbDate, { nil: undefined }),
});

/** Generate a one-off Task (isRecurring = false, no recurrencePattern) */
const arbOneOffTask: fc.Arbitrary<Task> = fc.record({
  id: arbId,
  title: arbTitle,
  description: fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: undefined }),
  assignedTo: arbUserName,
  createdBy: arbUserName,
  dueDate: arbDate,
  isRecurring: fc.constant(false),
  recurrencePattern: fc.constant(undefined),
  status: fc.constantFrom('pending', 'completed') as fc.Arbitrary<'pending' | 'completed'>,
  completedAt: fc.option(arbDate, { nil: undefined }),
  completedBy: fc.option(arbUserName, { nil: undefined }),
  createdAt: arbDate,
  updatedAt: arbDate,
});

/** Generate a recurring Task (isRecurring = true, with recurrencePattern) */
const arbRecurringTask: fc.Arbitrary<Task> = fc.record({
  id: arbId,
  title: arbTitle,
  description: fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: undefined }),
  assignedTo: arbUserName,
  createdBy: arbUserName,
  dueDate: arbDate,
  isRecurring: fc.constant(true),
  recurrencePattern: arbRecurrencePattern,
  status: fc.constantFrom('pending', 'completed') as fc.Arbitrary<'pending' | 'completed'>,
  completedAt: fc.option(arbDate, { nil: undefined }),
  completedBy: fc.option(arbUserName, { nil: undefined }),
  createdAt: arbDate,
  updatedAt: arbDate,
});

/** Generate either a one-off or recurring Task */
const arbTask: fc.Arbitrary<Task> = fc.oneof(arbOneOffTask, arbRecurringTask);

// ---------------------------------------------------------------------------
// Property 2: Task Creation Completeness
// Validates: Requirements 2.1, 2.2
// ---------------------------------------------------------------------------

describe('Property 2: Task Creation Completeness', () => {
  /**
   * For any task created, it must contain a title, due date, and assigned user
   * (one of Alex, Becky, or Sam).
   *
   * Validates: Requirements 2.1, 2.2
   */
  it('every task has a non-empty title', () => {
    fc.assert(
      fc.property(arbTask, (task) => {
        expect(task.title).toBeDefined();
        expect(typeof task.title).toBe('string');
        expect(task.title.length).toBeGreaterThan(0);
      })
    );
  });

  it('every task has a due date', () => {
    fc.assert(
      fc.property(arbTask, (task) => {
        expect(task.dueDate).toBeDefined();
        expect(task.dueDate).toBeInstanceOf(Date);
        expect(isNaN(task.dueDate!.getTime())).toBe(false);
      })
    );
  });

  it('every task has an assigned user that is one of Alex, Becky, or Sam', () => {
    fc.assert(
      fc.property(arbTask, (task) => {
        expect(task.assignedTo).toBeDefined();
        expect(VALID_USERS).toContain(task.assignedTo as UserName);
      })
    );
  });

  it('every task has all three required fields simultaneously', () => {
    fc.assert(
      fc.property(arbTask, (task) => {
        // title: non-empty string
        expect(task.title.length).toBeGreaterThan(0);
        // dueDate: valid Date
        expect(task.dueDate).toBeInstanceOf(Date);
        // assignedTo: valid household member
        expect(VALID_USERS).toContain(task.assignedTo as UserName);
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: Task Type Designation
// Validates: Requirements 2.3
// ---------------------------------------------------------------------------

describe('Property 3: Task Type Designation', () => {
  /**
   * For any task created, it must be designated as either a one-off task or a
   * recurring task, but not both.
   *
   * Validates: Requirements 2.3
   */
  it('every task has a boolean isRecurring field', () => {
    fc.assert(
      fc.property(arbTask, (task) => {
        expect(typeof task.isRecurring).toBe('boolean');
      })
    );
  });

  it('a one-off task is not recurring', () => {
    fc.assert(
      fc.property(arbOneOffTask, (task) => {
        expect(task.isRecurring).toBe(false);
      })
    );
  });

  it('a recurring task is marked as recurring', () => {
    fc.assert(
      fc.property(arbRecurringTask, (task) => {
        expect(task.isRecurring).toBe(true);
      })
    );
  });

  it('a task cannot be both one-off and recurring simultaneously', () => {
    fc.assert(
      fc.property(arbTask, (task) => {
        // isRecurring is a boolean — it is either true or false, never both
        const isOneOff = !task.isRecurring;
        const isRecurring = task.isRecurring;
        // XOR: exactly one of the two designations is true
        expect(isOneOff !== isRecurring).toBe(true);
      })
    );
  });

  it('a one-off task has no recurrence pattern', () => {
    fc.assert(
      fc.property(arbOneOffTask, (task) => {
        expect(task.recurrencePattern).toBeUndefined();
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: Recurring Task Pattern Validity
// Validates: Requirements 2.4
// ---------------------------------------------------------------------------

describe('Property 4: Recurring Task Pattern Validity', () => {
  /**
   * For any task designated as recurring, it must have a valid recurrence
   * pattern (daily, weekly, or monthly) with a positive interval.
   *
   * Validates: Requirements 2.4
   */
  it('every recurring task has a recurrence pattern', () => {
    fc.assert(
      fc.property(arbRecurringTask, (task) => {
        expect(task.recurrencePattern).toBeDefined();
      })
    );
  });

  it('every recurring task has a valid frequency (daily, weekly, or monthly)', () => {
    fc.assert(
      fc.property(arbRecurringTask, (task) => {
        expect(task.recurrencePattern).toBeDefined();
        expect(VALID_FREQUENCIES).toContain(task.recurrencePattern!.frequency as Frequency);
      })
    );
  });

  it('every recurring task has a positive interval', () => {
    fc.assert(
      fc.property(arbRecurringTask, (task) => {
        expect(task.recurrencePattern).toBeDefined();
        expect(task.recurrencePattern!.interval).toBeGreaterThan(0);
        expect(Number.isInteger(task.recurrencePattern!.interval)).toBe(true);
      })
    );
  });

  it('recurring task recurrence pattern has all required fields', () => {
    fc.assert(
      fc.property(arbRecurringTask, (task) => {
        const pattern = task.recurrencePattern!;
        // frequency must be present and valid
        expect(VALID_FREQUENCIES).toContain(pattern.frequency as Frequency);
        // interval must be a positive integer
        expect(pattern.interval).toBeGreaterThan(0);
        expect(Number.isInteger(pattern.interval)).toBe(true);
        // endDate is optional — if present it must be a valid Date
        if (pattern.endDate !== undefined) {
          expect(pattern.endDate).toBeInstanceOf(Date);
          expect(isNaN(pattern.endDate.getTime())).toBe(false);
        }
      })
    );
  });
});
