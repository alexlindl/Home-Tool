/**
 * SummaryService unit tests
 * Tests edge cases for task summary, shopping summary, and user summary
 *
 * Requirements: 1.7, 2.6, 3.3
 */

import { SummaryService, SummaryNotFoundError } from './SummaryService';
import { query } from '../db/connection';
import { getUserById } from '../db/userQueries';

// Mock the database modules
jest.mock('../db/connection');
jest.mock('../db/userQueries');

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockGetUserById = getUserById as jest.MockedFunction<typeof getUserById>;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SummaryService', () => {
  let summaryService: SummaryService;

  beforeEach(() => {
    summaryService = new SummaryService();
    jest.clearAllMocks();
  });

  // ── getTaskSummary ─────────────────────────────────────────────────────────

  describe('getTaskSummary', () => {
    it('should return zero counts and empty arrays when database is empty', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await summaryService.getTaskSummary();

      expect(result.totalPending).toBe(0);
      expect(result.totalOverdue).toBe(0);
      expect(result.tasks).toEqual([]);
      expect(result.perUser).toEqual([]);
      expect(result.lastUpdated).toBeDefined();
      expect(new Date(result.lastUpdated).toISOString()).toBe(result.lastUpdated);
    });

    it('should count all tasks as overdue when all have past due dates', async () => {
      const pastDate = new Date('2020-01-01T00:00:00Z');
      const rows = [
        { id: 'task-1', title: 'Task 1', assigned_to: 'user-1', assignee_name: 'Alex', due_date: pastDate },
        { id: 'task-2', title: 'Task 2', assigned_to: 'user-1', assignee_name: 'Alex', due_date: pastDate },
        { id: 'task-3', title: 'Task 3', assigned_to: 'user-2', assignee_name: 'Becky', due_date: pastDate },
      ];

      mockQuery.mockResolvedValue({ rows, rowCount: rows.length } as any);

      const result = await summaryService.getTaskSummary();

      expect(result.totalPending).toBe(3);
      expect(result.totalOverdue).toBe(3);
      // totalOverdue equals totalPending when all tasks are overdue
      expect(result.totalOverdue).toBe(result.totalPending);
    });

    it('should include lastUpdated as a valid ISO 8601 timestamp', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const before = new Date();
      const result = await summaryService.getTaskSummary();
      const after = new Date();

      const lastUpdated = new Date(result.lastUpdated);
      expect(lastUpdated.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(lastUpdated.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should apply limit to the tasks array but not to counts', async () => {
      const futureDate = new Date(Date.now() + 86400000); // tomorrow
      const rows = [
        { id: 'task-1', title: 'Task 1', assigned_to: 'user-1', assignee_name: 'Alex', due_date: futureDate },
        { id: 'task-2', title: 'Task 2', assigned_to: 'user-1', assignee_name: 'Alex', due_date: futureDate },
        { id: 'task-3', title: 'Task 3', assigned_to: 'user-2', assignee_name: 'Becky', due_date: futureDate },
      ];

      mockQuery.mockResolvedValue({ rows, rowCount: rows.length } as any);

      const result = await summaryService.getTaskSummary({ limit: 2 });

      // Limit applies to tasks array
      expect(result.tasks).toHaveLength(2);
      // Counts are computed from all matching rows, not limited
      expect(result.totalPending).toBe(3);
    });
  });

  // ── getShoppingSummary ─────────────────────────────────────────────────────

  describe('getShoppingSummary', () => {
    it('should return zero count, empty items and empty byCategory when no items exist', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await summaryService.getShoppingSummary();

      expect(result.totalUnpurchased).toBe(0);
      expect(result.items).toEqual([]);
      expect(result.byCategory).toEqual({});
      expect(result.lastUpdated).toBeDefined();
    });

    it('should have empty byCategory object when no items match filters', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await summaryService.getShoppingSummary({ listId: 'non-existent-list' });

      expect(result.byCategory).toEqual({});
      expect(Object.keys(result.byCategory)).toHaveLength(0);
    });

    it('should group items by category correctly', async () => {
      const rows = [
        { id: 'item-1', name: 'Milk', category: 'dairy' },
        { id: 'item-2', name: 'Cheese', category: 'dairy' },
        { id: 'item-3', name: 'Apples', category: 'produce' },
      ];

      mockQuery.mockResolvedValue({ rows, rowCount: rows.length } as any);

      const result = await summaryService.getShoppingSummary();

      expect(result.totalUnpurchased).toBe(3);
      expect(result.items).toHaveLength(3);
      expect(result.byCategory['dairy']).toHaveLength(2);
      expect(result.byCategory['produce']).toHaveLength(1);
    });

    it('should include lastUpdated as a valid ISO 8601 timestamp', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const before = new Date();
      const result = await summaryService.getShoppingSummary();
      const after = new Date();

      const lastUpdated = new Date(result.lastUpdated);
      expect(lastUpdated.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(lastUpdated.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  // ── getUserSummary ─────────────────────────────────────────────────────────

  describe('getUserSummary', () => {
    it('should return zero counts and null nextTask for user with no tasks', async () => {
      mockGetUserById.mockResolvedValue({ id: 'user-1', name: 'Alex', haUsername: null, createdAt: new Date() });
      // First query: pending tasks for user — empty
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
      // Second query: completed count in last 7 days — zero
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 } as any);

      const result = await summaryService.getUserSummary('user-1');

      expect(result.userName).toBe('Alex');
      expect(result.pendingCount).toBe(0);
      expect(result.overdueCount).toBe(0);
      expect(result.completedLast7Days).toBe(0);
      expect(result.nextTask).toBeNull();
      expect(result.lastUpdated).toBeDefined();
    });

    it('should throw SummaryNotFoundError (404) for invalid user ID', async () => {
      mockGetUserById.mockResolvedValue(null);

      await expect(
        summaryService.getUserSummary('non-existent-user')
      ).rejects.toThrow(SummaryNotFoundError);

      await expect(
        summaryService.getUserSummary('non-existent-user')
      ).rejects.toThrow('User not found');

      // Verify the error has statusCode 404
      try {
        await summaryService.getUserSummary('non-existent-user');
      } catch (error) {
        expect(error).toBeInstanceOf(SummaryNotFoundError);
        expect((error as SummaryNotFoundError).statusCode).toBe(404);
      }
    });

    it('should correctly compute overdue and nextTask from pending tasks', async () => {
      const pastDate = new Date('2020-01-01T00:00:00Z');
      const futureDate = new Date(Date.now() + 86400000 * 7); // 7 days from now

      mockGetUserById.mockResolvedValue({ id: 'user-1', name: 'Alex', haUsername: null, createdAt: new Date() });
      // Pending tasks: 1 overdue, 1 future
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 'task-1', title: 'Overdue Task', due_date: pastDate },
          { id: 'task-2', title: 'Future Task', due_date: futureDate },
        ],
        rowCount: 2,
      } as any);
      // Completed count
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '3' }], rowCount: 1 } as any);

      const result = await summaryService.getUserSummary('user-1');

      expect(result.pendingCount).toBe(2);
      expect(result.overdueCount).toBe(1);
      expect(result.completedLast7Days).toBe(3);
      expect(result.nextTask).not.toBeNull();
      expect(result.nextTask!.title).toBe('Future Task');
      expect(result.nextTask!.dueDate).toBe(futureDate.toISOString());
    });

    it('should return null nextTask when all pending tasks are overdue', async () => {
      const pastDate1 = new Date('2020-01-01T00:00:00Z');
      const pastDate2 = new Date('2020-02-01T00:00:00Z');

      mockGetUserById.mockResolvedValue({ id: 'user-1', name: 'Alex', haUsername: null, createdAt: new Date() });
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 'task-1', title: 'Old Task 1', due_date: pastDate1 },
          { id: 'task-2', title: 'Old Task 2', due_date: pastDate2 },
        ],
        rowCount: 2,
      } as any);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 } as any);

      const result = await summaryService.getUserSummary('user-1');

      expect(result.pendingCount).toBe(2);
      expect(result.overdueCount).toBe(2);
      expect(result.nextTask).toBeNull();
    });

    it('should include lastUpdated as a valid ISO 8601 timestamp', async () => {
      mockGetUserById.mockResolvedValue({ id: 'user-1', name: 'Alex', haUsername: null, createdAt: new Date() });
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1 } as any);

      const before = new Date();
      const result = await summaryService.getUserSummary('user-1');
      const after = new Date();

      const lastUpdated = new Date(result.lastUpdated);
      expect(lastUpdated.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(lastUpdated.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });
});
