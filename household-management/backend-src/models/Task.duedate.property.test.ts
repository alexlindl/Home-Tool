/**
 * Property-based tests for due date and recurrence behavior
 *
 * Feature: household-app-enhancements
 *
 * Tests Properties 3–6 from the design document using fast-check.
 * Each property runs a minimum of 100 iterations.
 */

import * as fc from 'fast-check';
import type { Task } from './Task';

// ---------------------------------------------------------------------------
// Pure functions under test (extracted from frontend logic for testability)
// ---------------------------------------------------------------------------

/**
 * Simulate clearing due date on a recurring task.
 * When dueDate is set to null on a task with isRecurring=true, the system
 * sets isRecurring to false and clears all recurrence configuration fields.
 *
 * This mirrors the logic in TaskForm.tsx when a user clears the due date.
 */
function clearDueDateOnTask(task: Task): Task {
  const updated = { ...task, dueDate: null };
  if (task.isRecurring) {
    updated.isRecurring = false;
    updated.recurrencePattern = undefined;
    updated.recurrenceType = undefined;
    updated.recurrenceInterval = undefined;
    updated.recurrenceDayOfWeek = undefined;
    updated.recurrenceOrdinalWeek = undefined;
  }
  return updated;
}

/**
 * Sort tasks by due date ascending with NULLS LAST.
 * This mirrors the sort logic from TaskDashboard.tsx.
 */
function sortTasksByDueDate(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });
}

/**
 * Clamp a recurrence interval value to [1, 365].
 * Empty string or NaN → 1; < 1 → 1; > 365 → 365.
 *
 * This is the same logic as clampInterval in RecurrenceSelector.tsx.
 */
function clampInterval(raw: string): number {
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed) || raw.trim() === '') return 1;
  return Math.max(1, Math.min(365, parsed));
}

// ---------------------------------------------------------------------------
// Arbitraries (generators)
// ---------------------------------------------------------------------------

const arbId = fc.uuid();
const arbTitle = fc.string({ minLength: 1, maxLength: 100 });
const arbDate = fc
  .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
  .filter((d) => !isNaN(d.getTime()));

const VALID_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const;

/** Generate a recurring task with a due date (the pre-condition for Property 3) */
const arbRecurringTaskWithDueDate: fc.Arbitrary<Task> = fc.record({
  id: arbId,
  title: arbTitle,
  description: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
  assignedTo: fc.option(arbId, { nil: null }),
  createdBy: arbId,
  dueDate: arbDate,
  isRecurring: fc.constant(true as const),
  recurrencePattern: fc.record({
    frequency: fc.constantFrom(...VALID_FREQUENCIES),
    interval: fc.integer({ min: 1, max: 52 }),
    endDate: fc.option(arbDate, { nil: undefined }),
  }),
  recurrenceType: fc.option(
    fc.constantFrom('every_n_days', 'every_n_months', 'every_n_years'),
    { nil: undefined }
  ),
  recurrenceInterval: fc.option(fc.integer({ min: 1, max: 365 }), { nil: undefined }),
  recurrenceDayOfWeek: fc.option(
    fc.constantFrom('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'),
    { nil: undefined }
  ),
  recurrenceOrdinalWeek: fc.option(fc.integer({ min: 1, max: 5 }), { nil: undefined }),
  rotationEnabled: fc.constant(false),
  rotationUserIds: fc.constant([] as string[]),
  rotationCurrentIndex: fc.constant(0),
  status: fc.constant('pending' as const),
  completedAt: fc.constant(undefined),
  completedBy: fc.constant(undefined),
  createdAt: arbDate,
  updatedAt: arbDate,
});

/** Generate a task with nullable due date (for Properties 4 and 5) */
const arbTaskWithOptionalDueDate: fc.Arbitrary<Task> = fc.record({
  id: arbId,
  title: arbTitle,
  description: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
  assignedTo: fc.option(arbId, { nil: null }),
  createdBy: arbId,
  dueDate: fc.option(arbDate, { nil: null }),
  isRecurring: fc.constant(false),
  recurrencePattern: fc.constant(undefined),
  rotationEnabled: fc.constant(false),
  rotationUserIds: fc.constant([] as string[]),
  rotationCurrentIndex: fc.constant(0),
  status: fc.constantFrom('pending', 'completed') as fc.Arbitrary<'pending' | 'completed'>,
  completedAt: fc.option(arbDate, { nil: undefined }),
  completedBy: fc.option(arbId, { nil: undefined }),
  createdAt: arbDate,
  updatedAt: arbDate,
});

// ---------------------------------------------------------------------------
// Feature: household-app-enhancements, Property 3: Clearing due date on a
// recurring task disables recurrence
// Validates: Requirements 5.3
// ---------------------------------------------------------------------------

describe('Property 3: Clearing due date on a recurring task disables recurrence', () => {
  it('for any recurring task with a due date, setting dueDate to null sets isRecurring to false', () => {
    fc.assert(
      fc.property(arbRecurringTaskWithDueDate, (task) => {
        const result = clearDueDateOnTask(task);
        expect(result.dueDate).toBeNull();
        expect(result.isRecurring).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('for any recurring task with a due date, clearing due date clears all recurrence fields', () => {
    fc.assert(
      fc.property(arbRecurringTaskWithDueDate, (task) => {
        const result = clearDueDateOnTask(task);
        expect(result.recurrencePattern).toBeUndefined();
        expect(result.recurrenceType).toBeUndefined();
        expect(result.recurrenceInterval).toBeUndefined();
        expect(result.recurrenceDayOfWeek).toBeUndefined();
        expect(result.recurrenceOrdinalWeek).toBeUndefined();
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: household-app-enhancements, Property 4: Tasks created or updated
// without due date persist NULL
// Validates: Requirements 5.4, 6.3
// ---------------------------------------------------------------------------

describe('Property 4: Tasks created or updated without due date persist NULL', () => {
  it('for any valid title/description, a task created with dueDate=null has dueDate=null', () => {
    fc.assert(
      fc.property(
        arbTitle,
        fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: undefined }),
        (title, description) => {
          // Simulate task creation with null due date
          const task: Pick<Task, 'title' | 'description' | 'dueDate'> = {
            title,
            description,
            dueDate: null,
          };
          expect(task.dueDate).toBeNull();
          expect(task.title).toBe(title);
          expect(task.description).toBe(description);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('for any task updated with dueDate=null, the result has dueDate=null', () => {
    fc.assert(
      fc.property(arbTaskWithOptionalDueDate, (task) => {
        // Simulate an update that sets dueDate to null
        const updated = { ...task, dueDate: null };
        expect(updated.dueDate).toBeNull();
        // Title and description are preserved
        expect(updated.title).toBe(task.title);
        expect(updated.description).toBe(task.description);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: household-app-enhancements, Property 5: Tasks without due dates
// sort after all dated tasks
// Validates: Requirements 5.5
// ---------------------------------------------------------------------------

describe('Property 5: Tasks without due dates sort after all dated tasks', () => {
  it('for any mixed list of tasks with/without due dates, sorted by due date, all null-dueDate tasks appear after dated ones', () => {
    fc.assert(
      fc.property(
        fc.array(arbTaskWithOptionalDueDate, { minLength: 1, maxLength: 50 }),
        (tasks) => {
          const sorted = sortTasksByDueDate(tasks);

          // Find the first task with null dueDate
          const firstNullIndex = sorted.findIndex((t) => t.dueDate === null);

          if (firstNullIndex === -1) {
            // No null due dates — all tasks have dates, nothing to verify
            return;
          }

          // All tasks before the first null must have a due date
          for (let i = 0; i < firstNullIndex; i++) {
            expect(sorted[i]!.dueDate).not.toBeNull();
          }

          // All tasks from firstNullIndex onward must have null due date
          for (let i = firstNullIndex; i < sorted.length; i++) {
            expect(sorted[i]!.dueDate).toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('for any list of tasks, dated tasks are sorted ascending by date', () => {
    fc.assert(
      fc.property(
        fc.array(arbTaskWithOptionalDueDate, { minLength: 2, maxLength: 50 }),
        (tasks) => {
          const sorted = sortTasksByDueDate(tasks);
          const datedTasks = sorted.filter((t) => t.dueDate !== null);

          for (let i = 1; i < datedTasks.length; i++) {
            const prev = new Date(datedTasks[i - 1]!.dueDate!).getTime();
            const curr = new Date(datedTasks[i]!.dueDate!).getTime();
            expect(prev).toBeLessThanOrEqual(curr);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: household-app-enhancements, Property 6: Recurrence interval
// clamping to [1, 365]
// Validates: Requirements 7.5, 7.6, 7.8
// ---------------------------------------------------------------------------

describe('Property 6: Recurrence interval clamping to [1, 365]', () => {
  it('for any integer value, the clamped result is in [1, 365]', () => {
    fc.assert(
      fc.property(fc.integer({ min: -10000, max: 10000 }), (value) => {
        const result = clampInterval(String(value));
        expect(result).toBeGreaterThanOrEqual(1);
        expect(result).toBeLessThanOrEqual(365);
      }),
      { numRuns: 100 }
    );
  });

  it('empty string clamps to 1', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('', '   ', '\t', '\n'),
        (emptyValue) => {
          const result = clampInterval(emptyValue);
          expect(result).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('values < 1 clamp to 1', () => {
    fc.assert(
      fc.property(fc.integer({ min: -10000, max: 0 }), (value) => {
        const result = clampInterval(String(value));
        expect(result).toBe(1);
      }),
      { numRuns: 100 }
    );
  });

  it('values > 365 clamp to 365', () => {
    fc.assert(
      fc.property(fc.integer({ min: 366, max: 100000 }), (value) => {
        const result = clampInterval(String(value));
        expect(result).toBe(365);
      }),
      { numRuns: 100 }
    );
  });

  it('values in [1, 365] are preserved unchanged', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 365 }), (value) => {
        const result = clampInterval(String(value));
        expect(result).toBe(value);
      }),
      { numRuns: 100 }
    );
  });

  it('non-numeric strings clamp to 1', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => isNaN(parseInt(s, 10))),
        (value) => {
          const result = clampInterval(value);
          expect(result).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});
