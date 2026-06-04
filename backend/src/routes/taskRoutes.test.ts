/**
 * Task routes unit tests
 * Tests the task API endpoints (CRUD operations)
 */

import request from 'supertest';
import app from '../index';
import * as taskQueries from '../db/taskQueries';
import * as userQueries from '../db/userQueries';

// Mock the database queries
jest.mock('../db/taskQueries');
jest.mock('../db/userQueries');

const mockTask = {
  id: 'task-uuid-123',
  title: 'Vacuum Living Room',
  description: 'Vacuum all rooms',
  assignedTo: 'user-uuid-1',
  createdBy: 'user-uuid-2',
  dueDate: new Date('2024-06-01T10:00:00.000Z'),
  isRecurring: false,
  recurrencePattern: undefined,
  status: 'pending' as const,
  completedAt: undefined,
  completedBy: undefined,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
};

const mockUser = {
  id: 'user-uuid-1',
  name: 'Alex' as const,
  createdAt: new Date('2024-01-01'),
};

const mockCreator = {
  id: 'user-uuid-2',
  name: 'Becky' as const,
  createdAt: new Date('2024-01-01'),
};

describe('Task API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── POST /api/tasks ────────────────────────────────────────────────────────

  describe('POST /api/tasks', () => {
    const validBody = {
      title: 'Vacuum Living Room',
      description: 'Vacuum all rooms',
      assignedTo: 'user-uuid-1',
      createdBy: 'user-uuid-2',
      dueDate: '2024-06-01T10:00:00.000Z',
      isRecurring: false,
    };

    it('should create a task and return 201', async () => {
      (userQueries.getUserById as jest.Mock)
        .mockResolvedValueOnce(mockUser)   // assignedTo lookup
        .mockResolvedValueOnce(mockCreator); // createdBy lookup
      (taskQueries.createTask as jest.Mock).mockResolvedValue(mockTask);
      (taskQueries.getTaskTemplates as jest.Mock).mockResolvedValue([]);
      (taskQueries.createTaskTemplate as jest.Mock).mockResolvedValue({
        id: 'tmpl-1',
        title: 'Vacuum Living Room',
        isPrePopulated: false,
        usageCount: 0,
        createdAt: new Date(),
      });

      const response = await request(app)
        .post('/api/tasks')
        .send(validBody)
        .expect(201);

      expect(response.body).toHaveProperty('task');
      expect(response.body.task).toHaveProperty('id', 'task-uuid-123');
      expect(response.body.task).toHaveProperty('title', 'Vacuum Living Room');
    });

    it('should create a recurring task and return 201', async () => {
      const recurringTask = {
        ...mockTask,
        isRecurring: true,
        recurrencePattern: { frequency: 'weekly', interval: 1 },
      };

      (userQueries.getUserById as jest.Mock)
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(mockCreator);
      (taskQueries.createTask as jest.Mock).mockResolvedValue(recurringTask);
      (taskQueries.getTaskTemplates as jest.Mock).mockResolvedValue([]);
      (taskQueries.createTaskTemplate as jest.Mock).mockResolvedValue({
        id: 'tmpl-1',
        title: 'Vacuum Living Room',
        isPrePopulated: false,
        usageCount: 0,
        createdAt: new Date(),
      });

      const response = await request(app)
        .post('/api/tasks')
        .send({
          ...validBody,
          isRecurring: true,
          recurrenceFrequency: 'weekly',
          recurrenceInterval: 1,
        })
        .expect(201);

      expect(response.body).toHaveProperty('task');
      expect(response.body.task).toHaveProperty('isRecurring', true);
    });

    it('should return 400 when title is missing', async () => {
      const { title: _title, ...bodyWithoutTitle } = validBody;

      const response = await request(app)
        .post('/api/tasks')
        .send(bodyWithoutTitle)
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('title');
    });

    it('should return 400 when assignedTo is missing', async () => {
      const { assignedTo: _assignedTo, ...bodyWithoutAssignedTo } = validBody;

      const response = await request(app)
        .post('/api/tasks')
        .send(bodyWithoutAssignedTo)
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('assignedTo');
    });

    it('should return 400 when createdBy is missing', async () => {
      const { createdBy: _createdBy, ...bodyWithoutCreatedBy } = validBody;

      const response = await request(app)
        .post('/api/tasks')
        .send(bodyWithoutCreatedBy)
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('createdBy');
    });

    it('should return 400 when dueDate is missing', async () => {
      const { dueDate: _dueDate, ...bodyWithoutDueDate } = validBody;

      const response = await request(app)
        .post('/api/tasks')
        .send(bodyWithoutDueDate)
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('dueDate');
    });

    it('should return 400 when isRecurring is missing', async () => {
      const { isRecurring: _isRecurring, ...bodyWithoutIsRecurring } = validBody;

      const response = await request(app)
        .post('/api/tasks')
        .send(bodyWithoutIsRecurring)
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('isRecurring');
    });

    it('should return 400 for invalid dueDate format', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .send({ ...validBody, dueDate: 'not-a-date' })
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('dueDate');
    });

    it('should return 400 when assigned user does not exist', async () => {
      (userQueries.getUserById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/tasks')
        .send(validBody)
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
    });

    it('should return 400 for recurring task missing recurrenceFrequency', async () => {
      (userQueries.getUserById as jest.Mock)
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(mockCreator);

      const response = await request(app)
        .post('/api/tasks')
        .send({
          ...validBody,
          isRecurring: true,
          recurrenceInterval: 1,
          // recurrenceFrequency intentionally omitted
        })
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
    });

    it('should handle database errors gracefully', async () => {
      (userQueries.getUserById as jest.Mock)
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(mockCreator);
      (taskQueries.createTask as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );
      (taskQueries.getTaskTemplates as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .post('/api/tasks')
        .send(validBody)
        .expect(500);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('message', 'Failed to create task');
    });
  });

  // ─── GET /api/tasks ─────────────────────────────────────────────────────────

  describe('GET /api/tasks', () => {
    it('should return all tasks with 200', async () => {
      (taskQueries.getTasks as jest.Mock).mockResolvedValue([mockTask]);

      const response = await request(app)
        .get('/api/tasks')
        .expect(200);

      expect(response.body).toHaveProperty('tasks');
      expect(response.body.tasks).toHaveLength(1);
      expect(response.body.tasks[0]).toHaveProperty('id', 'task-uuid-123');
    });

    it('should return empty array when no tasks exist', async () => {
      (taskQueries.getTasks as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/tasks')
        .expect(200);

      expect(response.body).toHaveProperty('tasks');
      expect(response.body.tasks).toHaveLength(0);
    });

    it('should filter tasks by assignedTo', async () => {
      (taskQueries.getTasks as jest.Mock).mockResolvedValue([mockTask]);

      const response = await request(app)
        .get('/api/tasks?assignedTo=user-uuid-1')
        .expect(200);

      expect(response.body).toHaveProperty('tasks');
      expect(taskQueries.getTasks).toHaveBeenCalledWith(
        expect.objectContaining({ assignedTo: 'user-uuid-1' })
      );
    });

    it('should filter tasks by status', async () => {
      (taskQueries.getTasks as jest.Mock).mockResolvedValue([mockTask]);

      const response = await request(app)
        .get('/api/tasks?status=pending')
        .expect(200);

      expect(response.body).toHaveProperty('tasks');
      expect(taskQueries.getTasks).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending' })
      );
    });

    it('should filter tasks by dueDateFrom and dueDateTo', async () => {
      (taskQueries.getTasks as jest.Mock).mockResolvedValue([mockTask]);

      const response = await request(app)
        .get('/api/tasks?dueDateFrom=2024-01-01T00:00:00.000Z&dueDateTo=2024-12-31T23:59:59.000Z')
        .expect(200);

      expect(response.body).toHaveProperty('tasks');
      expect(taskQueries.getTasks).toHaveBeenCalledWith(
        expect.objectContaining({
          dueDateFrom: expect.any(Date),
          dueDateTo: expect.any(Date),
        })
      );
    });

    it('should return 400 for invalid status filter', async () => {
      const response = await request(app)
        .get('/api/tasks?status=invalid')
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('status');
    });

    it('should return 400 for invalid dueDateFrom format', async () => {
      const response = await request(app)
        .get('/api/tasks?dueDateFrom=not-a-date')
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('dueDateFrom');
    });

    it('should return 400 for invalid dueDateTo format', async () => {
      const response = await request(app)
        .get('/api/tasks?dueDateTo=not-a-date')
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('dueDateTo');
    });

    it('should handle database errors gracefully', async () => {
      (taskQueries.getTasks as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .get('/api/tasks')
        .expect(500);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('message', 'Failed to fetch tasks');
    });
  });

  // ─── GET /api/tasks/:id ──────────────────────────────────────────────────────

  describe('GET /api/tasks/:id', () => {
    it('should return a task by ID with 200', async () => {
      (taskQueries.getTaskById as jest.Mock).mockResolvedValue(mockTask);

      const response = await request(app)
        .get('/api/tasks/task-uuid-123')
        .expect(200);

      expect(response.body).toHaveProperty('task');
      expect(response.body.task).toHaveProperty('id', 'task-uuid-123');
      expect(response.body.task).toHaveProperty('title', 'Vacuum Living Room');
    });

    it('should return 404 when task is not found', async () => {
      (taskQueries.getTaskById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/tasks/nonexistent-id')
        .expect(404);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('not found');
    });

    it('should handle database errors gracefully', async () => {
      (taskQueries.getTaskById as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .get('/api/tasks/task-uuid-123')
        .expect(500);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('message', 'Failed to fetch task');
    });
  });

  // ─── PUT /api/tasks/:id ──────────────────────────────────────────────────────

  describe('PUT /api/tasks/:id', () => {
    it('should update a task and return 200', async () => {
      const updatedTask = { ...mockTask, title: 'Updated Title' };
      (taskQueries.getTaskById as jest.Mock).mockResolvedValue(mockTask);
      (taskQueries.updateTask as jest.Mock).mockResolvedValue(updatedTask);

      const response = await request(app)
        .put('/api/tasks/task-uuid-123')
        .send({ title: 'Updated Title' })
        .expect(200);

      expect(response.body).toHaveProperty('task');
      expect(response.body.task).toHaveProperty('title', 'Updated Title');
    });

    it('should update dueDate when provided as ISO string', async () => {
      const newDueDate = '2024-07-01T10:00:00.000Z';
      const updatedTask = { ...mockTask, dueDate: new Date(newDueDate) };
      (taskQueries.getTaskById as jest.Mock).mockResolvedValue(mockTask);
      (taskQueries.updateTask as jest.Mock).mockResolvedValue(updatedTask);

      const response = await request(app)
        .put('/api/tasks/task-uuid-123')
        .send({ dueDate: newDueDate })
        .expect(200);

      expect(response.body).toHaveProperty('task');
    });

    it('should return 404 when task is not found', async () => {
      (taskQueries.getTaskById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .put('/api/tasks/nonexistent-id')
        .send({ title: 'Updated Title' })
        .expect(404);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('not found');
    });

    it('should return 400 for invalid dueDate format', async () => {
      const response = await request(app)
        .put('/api/tasks/task-uuid-123')
        .send({ dueDate: 'not-a-date' })
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('dueDate');
    });

    it('should return 400 for invalid status value', async () => {
      const response = await request(app)
        .put('/api/tasks/task-uuid-123')
        .send({ status: 'invalid-status' })
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('status');
    });

    it('should return 400 for invalid recurrenceFrequency', async () => {
      const response = await request(app)
        .put('/api/tasks/task-uuid-123')
        .send({ recurrenceFrequency: 'yearly' })
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('recurrenceFrequency');
    });

    it('should return 400 when reassigning to non-existent user', async () => {
      // Mock the service directly to throw TaskValidationError
      jest.spyOn(require('../services/TaskService').taskService, 'updateTask')
        .mockRejectedValueOnce(
          new (require('../services/TaskService').TaskValidationError)(
            'Assigned user with ID nonexistent-user-id not found'
          )
        );

      const response = await request(app)
        .put('/api/tasks/task-uuid-123')
        .send({ assignedTo: 'nonexistent-user-id' })
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
    });

    it('should handle database errors gracefully', async () => {
      (taskQueries.getTaskById as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .put('/api/tasks/task-uuid-123')
        .send({ title: 'Updated Title' })
        .expect(500);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('message', 'Failed to update task');
    });
  });

  // ─── POST /api/tasks/:id/complete ───────────────────────────────────────────

  describe('POST /api/tasks/:id/complete', () => {
    it('should complete a task and return 200', async () => {
      (taskQueries.getTaskById as jest.Mock).mockResolvedValue(mockTask);
      (userQueries.getUserById as jest.Mock).mockResolvedValue(mockUser);
      (taskQueries.updateTask as jest.Mock).mockResolvedValue({
        ...mockTask,
        status: 'completed',
        completedAt: new Date(),
        completedBy: 'user-uuid-1',
      });
      (taskQueries.createHistoryEntry as jest.Mock).mockResolvedValue({
        id: 'history-uuid-1',
        taskId: 'task-uuid-123',
        taskTitle: 'Vacuum Living Room',
        assignedTo: 'user-uuid-1',
        completedBy: 'user-uuid-1',
        completedAt: new Date(),
        wasRecurring: false,
      });

      const response = await request(app)
        .post('/api/tasks/task-uuid-123/complete')
        .send({ userId: 'user-uuid-1' })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Task completed successfully');
    });

    it('should return 400 when userId is missing', async () => {
      const response = await request(app)
        .post('/api/tasks/task-uuid-123/complete')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('userId');
    });

    it('should return 404 when task is not found', async () => {
      (taskQueries.getTaskById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/tasks/nonexistent-id/complete')
        .send({ userId: 'user-uuid-1' })
        .expect(404);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('not found');
    });

    it('should return 400 when completing user does not exist', async () => {
      (taskQueries.getTaskById as jest.Mock).mockResolvedValueOnce(mockTask);
      (userQueries.getUserById as jest.Mock).mockReset();
      (userQueries.getUserById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/tasks/task-uuid-123/complete')
        .send({ userId: 'nonexistent-user-id' })
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
    });

    it('should handle database errors gracefully', async () => {
      (taskQueries.getTaskById as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .post('/api/tasks/task-uuid-123/complete')
        .send({ userId: 'user-uuid-1' })
        .expect(500);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('message', 'Failed to complete task');
    });
  });

  // ─── GET /api/tasks/history ──────────────────────────────────────────────────

  describe('GET /api/tasks/history', () => {
    const mockHistory = [
      {
        id: 'history-uuid-1',
        taskId: 'task-uuid-123',
        taskTitle: 'Vacuum Living Room',
        assignedTo: 'user-uuid-1',
        completedBy: 'user-uuid-1',
        completedAt: new Date('2024-05-01T10:00:00.000Z'),
        wasRecurring: false,
      },
    ];

    it('should return task history with 200 (default 30 days)', async () => {
      (taskQueries.getTaskHistory as jest.Mock).mockResolvedValue(mockHistory);

      const response = await request(app)
        .get('/api/tasks/history')
        .expect(200);

      expect(response.body).toHaveProperty('history');
      expect(response.body.history).toHaveLength(1);
      expect(taskQueries.getTaskHistory).toHaveBeenCalledWith(30);
    });

    it('should accept a custom days parameter', async () => {
      (taskQueries.getTaskHistory as jest.Mock).mockResolvedValue(mockHistory);

      const response = await request(app)
        .get('/api/tasks/history?days=7')
        .expect(200);

      expect(response.body).toHaveProperty('history');
      expect(taskQueries.getTaskHistory).toHaveBeenCalledWith(7);
    });

    it('should return empty array when no history exists', async () => {
      (taskQueries.getTaskHistory as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/tasks/history')
        .expect(200);

      expect(response.body).toHaveProperty('history');
      expect(response.body.history).toHaveLength(0);
    });

    it('should return 400 for non-integer days parameter', async () => {
      const response = await request(app)
        .get('/api/tasks/history?days=abc')
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('days');
    });

    it('should return 400 for zero days parameter', async () => {
      const response = await request(app)
        .get('/api/tasks/history?days=0')
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('days');
    });

    it('should return 400 for negative days parameter', async () => {
      const response = await request(app)
        .get('/api/tasks/history?days=-5')
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('days');
    });

    it('should handle database errors gracefully', async () => {
      (taskQueries.getTaskHistory as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .get('/api/tasks/history')
        .expect(500);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('message', 'Failed to fetch task history');
    });
  });

  // ─── GET /api/tasks/templates ────────────────────────────────────────────────

  describe('GET /api/tasks/templates', () => {
    const mockTemplates = [
      {
        id: 'tmpl-uuid-1',
        title: 'Vacuum',
        description: 'Vacuum all rooms',
        isPrePopulated: true,
        usageCount: 5,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      },
      {
        id: 'tmpl-uuid-2',
        title: 'Custom Chore',
        description: undefined,
        isPrePopulated: false,
        usageCount: 1,
        createdAt: new Date('2024-02-01T00:00:00.000Z'),
      },
    ];

    it('should return all templates with 200 when no filter provided', async () => {
      (taskQueries.getTaskTemplates as jest.Mock).mockResolvedValue(mockTemplates);

      const response = await request(app)
        .get('/api/tasks/templates')
        .expect(200);

      expect(response.body).toHaveProperty('templates');
      expect(response.body.templates).toHaveLength(2);
      expect(taskQueries.getTaskTemplates).toHaveBeenCalledWith(undefined);
    });

    it('should return only pre-populated templates when isPrePopulated=true', async () => {
      const prePopulated = mockTemplates.filter((t) => t.isPrePopulated);
      (taskQueries.getTaskTemplates as jest.Mock).mockResolvedValue(prePopulated);

      const response = await request(app)
        .get('/api/tasks/templates?isPrePopulated=true')
        .expect(200);

      expect(response.body).toHaveProperty('templates');
      expect(response.body.templates).toHaveLength(1);
      expect(response.body.templates[0]).toHaveProperty('isPrePopulated', true);
      expect(taskQueries.getTaskTemplates).toHaveBeenCalledWith({ isPrePopulated: true });
    });

    it('should return only custom templates when isPrePopulated=false', async () => {
      const custom = mockTemplates.filter((t) => !t.isPrePopulated);
      (taskQueries.getTaskTemplates as jest.Mock).mockResolvedValue(custom);

      const response = await request(app)
        .get('/api/tasks/templates?isPrePopulated=false')
        .expect(200);

      expect(response.body).toHaveProperty('templates');
      expect(response.body.templates).toHaveLength(1);
      expect(response.body.templates[0]).toHaveProperty('isPrePopulated', false);
      expect(taskQueries.getTaskTemplates).toHaveBeenCalledWith({ isPrePopulated: false });
    });

    it('should return empty array when no templates exist', async () => {
      (taskQueries.getTaskTemplates as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/tasks/templates')
        .expect(200);

      expect(response.body).toHaveProperty('templates');
      expect(response.body.templates).toHaveLength(0);
    });

    it('should return 400 for invalid isPrePopulated value', async () => {
      const response = await request(app)
        .get('/api/tasks/templates?isPrePopulated=yes')
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('isPrePopulated');
    });

    it('should handle database errors gracefully', async () => {
      (taskQueries.getTaskTemplates as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .get('/api/tasks/templates')
        .expect(500);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('message', 'Failed to fetch task templates');
    });
  });

  // ─── DELETE /api/tasks/:id ───────────────────────────────────────────────────

  describe('DELETE /api/tasks/:id', () => {
    it('should delete a task and return 200', async () => {
      (taskQueries.getTaskById as jest.Mock).mockResolvedValue(mockTask);
      (taskQueries.deleteTask as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/tasks/task-uuid-123')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Task deleted successfully');
    });

    it('should return 404 when task is not found', async () => {
      (taskQueries.getTaskById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/tasks/nonexistent-id')
        .expect(404);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('not found');
    });

    it('should handle database errors gracefully', async () => {
      (taskQueries.getTaskById as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .delete('/api/tasks/task-uuid-123')
        .expect(500);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('message', 'Failed to delete task');
    });
  });
});
