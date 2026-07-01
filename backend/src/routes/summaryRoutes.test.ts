/**
 * Summary routes tests
 * Property-based tests (Property 14) and unit tests for summary API endpoints.
 *
 * // Feature: ha-dashboard-integration, Property 14
 */

import request from 'supertest';
import fc from 'fast-check';
import app from '../index';
import { SummaryNotFoundError } from '../services';

// Mock the services module
jest.mock('../services', () => {
  const actual = jest.requireActual('../services');
  return {
    ...actual,
    summaryService: {
      getTaskSummary: jest.fn(),
      getShoppingSummary: jest.fn(),
      getUserSummary: jest.fn(),
    },
  };
});

// Import after mocking
import { summaryService } from '../services';

const mockSummaryService = summaryService as jest.Mocked<typeof summaryService>;

// ─── Mock data factories ──────────────────────────────────────────────────────

function makeTaskSummaryResponse(overrides: Partial<any> = {}) {
  return {
    totalPending: 3,
    totalOverdue: 1,
    tasks: [
      { id: 'task-1', title: 'Task One', assigneeName: 'Alex', dueDate: '2024-06-01T10:00:00.000Z' },
      { id: 'task-2', title: 'Task Two', assigneeName: null, dueDate: null },
    ],
    perUser: [
      { name: 'Alex', pendingCount: 2, overdueCount: 1 },
      { name: 'Becky', pendingCount: 1, overdueCount: 0 },
    ],
    lastUpdated: new Date().toISOString(),
    ...overrides,
  };
}

function makeShoppingSummaryResponse(overrides: Partial<any> = {}) {
  return {
    totalUnpurchased: 4,
    items: [
      { id: 'item-1', name: 'Milk', category: 'dairy' },
      { id: 'item-2', name: 'Bread', category: 'bakery' },
    ],
    byCategory: {
      dairy: [{ id: 'item-1', name: 'Milk', category: 'dairy' }],
      bakery: [{ id: 'item-2', name: 'Bread', category: 'bakery' }],
    },
    lastUpdated: new Date().toISOString(),
    ...overrides,
  };
}

function makeUserSummaryResponse(overrides: Partial<any> = {}) {
  return {
    userName: 'Alex',
    pendingCount: 5,
    overdueCount: 2,
    completedLast7Days: 7,
    nextTask: { title: 'Take out trash', dueDate: '2024-06-02T08:00:00.000Z' },
    lastUpdated: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Property-Based Tests (Property 14) ──────────────────────────────────────

// Feature: ha-dashboard-integration, Property 14
// **Validates: Requirements 10.2, 10.3**
describe('Property 14: Summary endpoints return correct HTTP headers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSummaryService.getTaskSummary.mockResolvedValue(makeTaskSummaryResponse());
    mockSummaryService.getShoppingSummary.mockResolvedValue(makeShoppingSummaryResponse());
    mockSummaryService.getUserSummary.mockResolvedValue(makeUserSummaryResponse());
  });

  it('GET /api/summary/tasks always returns Cache-Control: max-age=30 and Content-Type: application/json; charset=utf-8', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          assignedTo: fc.option(fc.uuid(), { nil: undefined }),
          listId: fc.option(fc.uuid(), { nil: undefined }),
          limit: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }),
        }),
        async (params) => {
          const query: Record<string, string> = {};
          if (params.assignedTo !== undefined) query.assignedTo = params.assignedTo;
          if (params.listId !== undefined) query.listId = params.listId;
          if (params.limit !== undefined) query.limit = String(params.limit);

          const queryString = new URLSearchParams(query).toString();
          const url = queryString ? `/api/summary/tasks?${queryString}` : '/api/summary/tasks';

          const response = await request(app).get(url);

          expect(response.status).toBe(200);
          expect(response.headers['cache-control']).toBe('max-age=30');
          expect(response.headers['content-type']).toMatch(/application\/json; charset=utf-8/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('GET /api/summary/shopping always returns Cache-Control: max-age=30 and Content-Type: application/json; charset=utf-8', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          listId: fc.option(fc.uuid(), { nil: undefined }),
          limit: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }),
        }),
        async (params) => {
          const query: Record<string, string> = {};
          if (params.listId !== undefined) query.listId = params.listId;
          if (params.limit !== undefined) query.limit = String(params.limit);

          const queryString = new URLSearchParams(query).toString();
          const url = queryString ? `/api/summary/shopping?${queryString}` : '/api/summary/shopping';

          const response = await request(app).get(url);

          expect(response.status).toBe(200);
          expect(response.headers['cache-control']).toBe('max-age=30');
          expect(response.headers['content-type']).toMatch(/application\/json; charset=utf-8/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('GET /api/summary/user/:userId always returns Cache-Control: max-age=30 and Content-Type: application/json; charset=utf-8', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        async (userId) => {
          const response = await request(app).get(`/api/summary/user/${userId}`);

          expect(response.status).toBe(200);
          expect(response.headers['cache-control']).toBe('max-age=30');
          expect(response.headers['content-type']).toMatch(/application\/json; charset=utf-8/);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Unit Tests (Task 2.3) ───────────────────────────────────────────────────

describe('Summary API Routes - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── GET /api/summary/tasks ─────────────────────────────────────────────────

  describe('GET /api/summary/tasks', () => {
    it('should return valid task summary response shape (200)', async () => {
      const mockResponse = makeTaskSummaryResponse();
      mockSummaryService.getTaskSummary.mockResolvedValue(mockResponse);

      const response = await request(app)
        .get('/api/summary/tasks')
        .expect(200);

      expect(response.body).toHaveProperty('totalPending');
      expect(response.body).toHaveProperty('totalOverdue');
      expect(response.body).toHaveProperty('tasks');
      expect(response.body).toHaveProperty('perUser');
      expect(response.body).toHaveProperty('lastUpdated');
      expect(typeof response.body.totalPending).toBe('number');
      expect(typeof response.body.totalOverdue).toBe('number');
      expect(Array.isArray(response.body.tasks)).toBe(true);
      expect(Array.isArray(response.body.perUser)).toBe(true);
    });

    it('should return 400 for non-integer limit param', async () => {
      const response = await request(app)
        .get('/api/summary/tasks?limit=abc')
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toBe('limit must be a positive integer');
    });

    it('should return 400 for negative limit param', async () => {
      const response = await request(app)
        .get('/api/summary/tasks?limit=-5')
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toBe('limit must be a positive integer');
    });

    it('should return 400 for zero limit param', async () => {
      const response = await request(app)
        .get('/api/summary/tasks?limit=0')
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toBe('limit must be a positive integer');
    });

    it('should return 400 for decimal limit param', async () => {
      const response = await request(app)
        .get('/api/summary/tasks?limit=2.5')
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toBe('limit must be a positive integer');
    });

    it('empty filter results return zero counts (not an error)', async () => {
      mockSummaryService.getTaskSummary.mockResolvedValue(
        makeTaskSummaryResponse({ totalPending: 0, totalOverdue: 0, tasks: [], perUser: [] })
      );

      const response = await request(app)
        .get('/api/summary/tasks?assignedTo=nonexistent-user-id')
        .expect(200);

      expect(response.body.totalPending).toBe(0);
      expect(response.body.totalOverdue).toBe(0);
      expect(response.body.tasks).toHaveLength(0);
    });

    it('should pass filters to SummaryService', async () => {
      mockSummaryService.getTaskSummary.mockResolvedValue(makeTaskSummaryResponse());

      await request(app)
        .get('/api/summary/tasks?assignedTo=user-1&listId=list-1&limit=10')
        .expect(200);

      expect(mockSummaryService.getTaskSummary).toHaveBeenCalledWith({
        assignedTo: 'user-1',
        listId: 'list-1',
        limit: 10,
      });
    });

    it('response headers include Cache-Control and Content-Type', async () => {
      mockSummaryService.getTaskSummary.mockResolvedValue(makeTaskSummaryResponse());

      const response = await request(app)
        .get('/api/summary/tasks')
        .expect(200);

      expect(response.headers['cache-control']).toBe('max-age=30');
      expect(response.headers['content-type']).toMatch(/application\/json; charset=utf-8/);
    });
  });

  // ─── GET /api/summary/shopping ──────────────────────────────────────────────

  describe('GET /api/summary/shopping', () => {
    it('should return valid shopping summary response shape (200)', async () => {
      const mockResponse = makeShoppingSummaryResponse();
      mockSummaryService.getShoppingSummary.mockResolvedValue(mockResponse);

      const response = await request(app)
        .get('/api/summary/shopping')
        .expect(200);

      expect(response.body).toHaveProperty('totalUnpurchased');
      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('byCategory');
      expect(response.body).toHaveProperty('lastUpdated');
      expect(typeof response.body.totalUnpurchased).toBe('number');
      expect(Array.isArray(response.body.items)).toBe(true);
      expect(typeof response.body.byCategory).toBe('object');
    });

    it('should return 400 for non-integer limit param', async () => {
      const response = await request(app)
        .get('/api/summary/shopping?limit=abc')
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toBe('limit must be a positive integer');
    });

    it('should return 400 for negative limit param', async () => {
      const response = await request(app)
        .get('/api/summary/shopping?limit=-3')
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toBe('limit must be a positive integer');
    });

    it('empty filter results return zero counts (not an error)', async () => {
      mockSummaryService.getShoppingSummary.mockResolvedValue(
        makeShoppingSummaryResponse({ totalUnpurchased: 0, items: [], byCategory: {} })
      );

      const response = await request(app)
        .get('/api/summary/shopping?listId=nonexistent-list')
        .expect(200);

      expect(response.body.totalUnpurchased).toBe(0);
      expect(response.body.items).toHaveLength(0);
    });

    it('response headers include Cache-Control and Content-Type', async () => {
      mockSummaryService.getShoppingSummary.mockResolvedValue(makeShoppingSummaryResponse());

      const response = await request(app)
        .get('/api/summary/shopping')
        .expect(200);

      expect(response.headers['cache-control']).toBe('max-age=30');
      expect(response.headers['content-type']).toMatch(/application\/json; charset=utf-8/);
    });
  });

  // ─── GET /api/summary/user/:userId ──────────────────────────────────────────

  describe('GET /api/summary/user/:userId', () => {
    it('should return valid user summary response shape (200)', async () => {
      const mockResponse = makeUserSummaryResponse();
      mockSummaryService.getUserSummary.mockResolvedValue(mockResponse);

      const response = await request(app)
        .get('/api/summary/user/user-uuid-1')
        .expect(200);

      expect(response.body).toHaveProperty('userName');
      expect(response.body).toHaveProperty('pendingCount');
      expect(response.body).toHaveProperty('overdueCount');
      expect(response.body).toHaveProperty('completedLast7Days');
      expect(response.body).toHaveProperty('nextTask');
      expect(response.body).toHaveProperty('lastUpdated');
      expect(typeof response.body.userName).toBe('string');
      expect(typeof response.body.pendingCount).toBe('number');
      expect(typeof response.body.overdueCount).toBe('number');
      expect(typeof response.body.completedLast7Days).toBe('number');
    });

    it('should return 404 for invalid user ID', async () => {
      mockSummaryService.getUserSummary.mockRejectedValue(
        new SummaryNotFoundError('User not found')
      );

      const response = await request(app)
        .get('/api/summary/user/nonexistent-user-id')
        .expect(404);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toBe('User not found');
    });

    it('response headers include Cache-Control and Content-Type', async () => {
      mockSummaryService.getUserSummary.mockResolvedValue(makeUserSummaryResponse());

      const response = await request(app)
        .get('/api/summary/user/user-uuid-1')
        .expect(200);

      expect(response.headers['cache-control']).toBe('max-age=30');
      expect(response.headers['content-type']).toMatch(/application\/json; charset=utf-8/);
    });

    it('should handle internal server errors gracefully', async () => {
      mockSummaryService.getUserSummary.mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .get('/api/summary/user/user-uuid-1')
        .expect(500);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toBe('Internal server error');
    });
  });
});
