/**
 * Task database queries tests
 */

import { query } from './connection';
import {
  createTask,
  updateTask,
  deleteTask,
  getTaskById,
  getTasks,
  getTaskHistory,
  createHistoryEntry,
  CreateTaskInput,
  UpdateTaskInput,
  TaskFilters,
  createTaskTemplate,
  getTaskTemplateById,
  getTaskTemplates,
  incrementTemplateUsage,
  updateTaskTemplate,
  deleteTaskTemplate,
  CreateTaskTemplateInput,
  TaskTemplateFilters,
} from './taskQueries';

// Mock the database connection
jest.mock('./connection');
const mockQuery = query as jest.MockedFunction<typeof query>;

describe('Task Database Queries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createTask', () => {
    it('should create a one-off task', async () => {
      const input: CreateTaskInput = {
        title: 'Vacuum living room',
        description: 'Use the Dyson',
        assignedTo: 'user-1',
        createdBy: 'user-2',
        dueDate: new Date('2024-01-15T10:00:00Z'),
        isRecurring: false,
      };

      const mockRow = {
        id: 'task-1',
        title: input.title,
        description: input.description,
        assigned_to: input.assignedTo,
        created_by: input.createdBy,
        due_date: input.dueDate,
        is_recurring: false,
        recurrence_frequency: null,
        recurrence_interval: null,
        recurrence_end_date: null,
        status: 'pending',
        completed_at: null,
        completed_by: null,
        created_at: new Date('2024-01-10T10:00:00Z'),
        updated_at: new Date('2024-01-10T10:00:00Z'),
      };

      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 } as any);

      const result = await createTask(input);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO tasks'),
        [
          input.title,
          input.description,
          input.assignedTo,
          input.createdBy,
          input.dueDate,
          false,
          null,
          null,
          null,
        ]
      );

      expect(result).toMatchObject({
        id: 'task-1',
        title: input.title,
        description: input.description,
        assignedTo: input.assignedTo,
        createdBy: input.createdBy,
        dueDate: input.dueDate,
        isRecurring: false,
        status: 'pending',
      });
    });

    it('should create a recurring task with pattern', async () => {
      const input: CreateTaskInput = {
        title: 'Take out trash',
        assignedTo: 'user-1',
        createdBy: 'user-1',
        dueDate: new Date('2024-01-15T10:00:00Z'),
        isRecurring: true,
        recurrenceFrequency: 'weekly',
        recurrenceInterval: 1,
      };

      const mockRow = {
        id: 'task-2',
        title: input.title,
        description: null,
        assigned_to: input.assignedTo,
        created_by: input.createdBy,
        due_date: input.dueDate,
        is_recurring: true,
        recurrence_frequency: 'weekly',
        recurrence_interval: 1,
        recurrence_end_date: null,
        status: 'pending',
        completed_at: null,
        completed_by: null,
        created_at: new Date('2024-01-10T10:00:00Z'),
        updated_at: new Date('2024-01-10T10:00:00Z'),
      };

      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 } as any);

      const result = await createTask(input);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO tasks'),
        [
          input.title,
          null,
          input.assignedTo,
          input.createdBy,
          input.dueDate,
          true,
          'weekly',
          1,
          null,
        ]
      );

      expect(result.isRecurring).toBe(true);
      expect(result.recurrencePattern).toEqual({
        frequency: 'weekly',
        interval: 1,
      });
    });
  });

  describe('updateTask', () => {
    it('should update task fields', async () => {
      const taskId = 'task-1';
      const input: UpdateTaskInput = {
        title: 'Updated title',
        status: 'completed',
        completedAt: new Date('2024-01-15T12:00:00Z'),
        completedBy: 'user-1',
      };

      const mockRow = {
        id: taskId,
        title: input.title,
        description: null,
        assigned_to: 'user-1',
        created_by: 'user-2',
        due_date: new Date('2024-01-15T10:00:00Z'),
        is_recurring: false,
        recurrence_frequency: null,
        recurrence_interval: null,
        recurrence_end_date: null,
        status: 'completed',
        completed_at: input.completedAt,
        completed_by: input.completedBy,
        created_at: new Date('2024-01-10T10:00:00Z'),
        updated_at: new Date('2024-01-15T12:00:00Z'),
      };

      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 } as any);

      const result = await updateTask(taskId, input);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE tasks SET'),
        expect.arrayContaining([input.title, input.status, input.completedAt, input.completedBy, taskId])
      );

      expect(result).toMatchObject({
        id: taskId,
        title: input.title,
        status: 'completed',
        completedAt: input.completedAt,
        completedBy: input.completedBy,
      });
    });

    it('should return null if task not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await updateTask('non-existent', { title: 'New title' });

      expect(result).toBeNull();
    });

    it('should handle partial updates', async () => {
      const taskId = 'task-1';
      const input: UpdateTaskInput = {
        assignedTo: 'user-3',
      };

      const mockRow = {
        id: taskId,
        title: 'Original title',
        description: null,
        assigned_to: 'user-3',
        created_by: 'user-2',
        due_date: new Date('2024-01-15T10:00:00Z'),
        is_recurring: false,
        recurrence_frequency: null,
        recurrence_interval: null,
        recurrence_end_date: null,
        status: 'pending',
        completed_at: null,
        completed_by: null,
        created_at: new Date('2024-01-10T10:00:00Z'),
        updated_at: new Date('2024-01-15T12:00:00Z'),
      };

      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 } as any);

      const result = await updateTask(taskId, input);

      expect(result?.assignedTo).toBe('user-3');
    });
  });

  describe('deleteTask', () => {
    it('should delete a task and return true', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      const result = await deleteTask('task-1');

      expect(mockQuery).toHaveBeenCalledWith('DELETE FROM tasks WHERE id = $1', ['task-1']);
      expect(result).toBe(true);
    });

    it('should return false if task not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await deleteTask('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('getTaskById', () => {
    it('should retrieve a task by ID', async () => {
      const mockRow = {
        id: 'task-1',
        title: 'Test task',
        description: 'Description',
        assigned_to: 'user-1',
        created_by: 'user-2',
        due_date: new Date('2024-01-15T10:00:00Z'),
        is_recurring: false,
        recurrence_frequency: null,
        recurrence_interval: null,
        recurrence_end_date: null,
        status: 'pending',
        completed_at: null,
        completed_by: null,
        created_at: new Date('2024-01-10T10:00:00Z'),
        updated_at: new Date('2024-01-10T10:00:00Z'),
      };

      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 } as any);

      const result = await getTaskById('task-1');

      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM tasks WHERE id = $1', ['task-1']);
      expect(result).toMatchObject({
        id: 'task-1',
        title: 'Test task',
        assignedTo: 'user-1',
      });
    });

    it('should return null if task not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await getTaskById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getTasks', () => {
    const mockTasks = [
      {
        id: 'task-1',
        title: 'Task 1',
        description: null,
        assigned_to: 'user-1',
        created_by: 'user-2',
        due_date: new Date('2024-01-15T10:00:00Z'),
        is_recurring: false,
        recurrence_frequency: null,
        recurrence_interval: null,
        recurrence_end_date: null,
        status: 'pending',
        completed_at: null,
        completed_by: null,
        created_at: new Date('2024-01-10T10:00:00Z'),
        updated_at: new Date('2024-01-10T10:00:00Z'),
      },
      {
        id: 'task-2',
        title: 'Task 2',
        description: null,
        assigned_to: 'user-1',
        created_by: 'user-1',
        due_date: new Date('2024-01-16T10:00:00Z'),
        is_recurring: true,
        recurrence_frequency: 'weekly',
        recurrence_interval: 1,
        recurrence_end_date: null,
        status: 'pending',
        completed_at: null,
        completed_by: null,
        created_at: new Date('2024-01-10T10:00:00Z'),
        updated_at: new Date('2024-01-10T10:00:00Z'),
      },
    ];

    it('should get all tasks without filters', async () => {
      mockQuery.mockResolvedValue({ rows: mockTasks, rowCount: 2 } as any);

      const result = await getTasks();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM tasks'),
        []
      );
      expect(result).toHaveLength(2);
    });

    it('should filter tasks by assigned user', async () => {
      mockQuery.mockResolvedValue({ rows: [mockTasks[0]], rowCount: 1 } as any);

      const filters: TaskFilters = { assignedTo: 'user-1' };
      const result = await getTasks(filters);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE assigned_to = $1'),
        ['user-1']
      );
      expect(result).toHaveLength(1);
    });

    it('should filter tasks by status', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const filters: TaskFilters = { status: 'completed' };
      await getTasks(filters);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = $1'),
        ['completed']
      );
    });

    it('should filter tasks by date range', async () => {
      mockQuery.mockResolvedValue({ rows: mockTasks, rowCount: 2 } as any);

      const filters: TaskFilters = {
        dueDateFrom: new Date('2024-01-15T00:00:00Z'),
        dueDateTo: new Date('2024-01-20T00:00:00Z'),
      };
      await getTasks(filters);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE due_date >= $1 AND due_date <= $2'),
        [filters.dueDateFrom, filters.dueDateTo]
      );
    });

    it('should combine multiple filters', async () => {
      mockQuery.mockResolvedValue({ rows: [mockTasks[0]], rowCount: 1 } as any);

      const filters: TaskFilters = {
        assignedTo: 'user-1',
        status: 'pending',
        dueDateFrom: new Date('2024-01-15T00:00:00Z'),
      };
      await getTasks(filters);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE assigned_to = $1 AND status = $2 AND due_date >= $3'),
        ['user-1', 'pending', filters.dueDateFrom]
      );
    });
  });

  describe('getTaskHistory', () => {
    const mockHistory = [
      {
        id: 'history-1',
        task_id: 'task-1',
        title: 'Completed task 1',
        assigned_to: 'user-1',
        completed_by: 'user-1',
        completed_at: new Date('2024-01-15T12:00:00Z'),
        was_recurring: false,
      },
      {
        id: 'history-2',
        task_id: 'task-2',
        title: 'Completed task 2',
        assigned_to: 'user-2',
        completed_by: 'user-2',
        completed_at: new Date('2024-01-14T12:00:00Z'),
        was_recurring: true,
      },
    ];

    it('should get task history for default 30 days', async () => {
      mockQuery.mockResolvedValue({ rows: mockHistory, rowCount: 2 } as any);

      const result = await getTaskHistory();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("INTERVAL '30 days'")
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'history-1',
        taskId: 'task-1',
        title: 'Completed task 1',
        assignedTo: 'user-1',
        completedBy: 'user-1',
        wasRecurring: false,
      });
    });

    it('should get task history for custom number of days', async () => {
      mockQuery.mockResolvedValue({ rows: [mockHistory[0]], rowCount: 1 } as any);

      const result = await getTaskHistory(7);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("INTERVAL '7 days'")
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('createHistoryEntry', () => {
    it('should create a task history entry', async () => {
      const mockRow = {
        id: 'history-1',
        task_id: 'task-1',
        title: 'Vacuum living room',
        assigned_to: 'user-1',
        completed_by: 'user-1',
        completed_at: new Date('2024-01-15T12:00:00Z'),
        was_recurring: false,
      };

      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 } as any);

      const result = await createHistoryEntry(
        'task-1',
        'Vacuum living room',
        'user-1',
        'user-1',
        new Date('2024-01-15T12:00:00Z'),
        false
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO task_history'),
        ['task-1', 'Vacuum living room', 'user-1', 'user-1', expect.any(Date), false]
      );

      expect(result).toMatchObject({
        id: 'history-1',
        taskId: 'task-1',
        title: 'Vacuum living room',
        assignedTo: 'user-1',
        completedBy: 'user-1',
        wasRecurring: false,
      });
    });

    it('should create history entry for recurring task', async () => {
      const mockRow = {
        id: 'history-2',
        task_id: 'task-2',
        title: 'Take out trash',
        assigned_to: 'user-2',
        completed_by: 'user-2',
        completed_at: new Date('2024-01-15T12:00:00Z'),
        was_recurring: true,
      };

      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 } as any);

      const result = await createHistoryEntry(
        'task-2',
        'Take out trash',
        'user-2',
        'user-2',
        new Date('2024-01-15T12:00:00Z'),
        true
      );

      expect(result.wasRecurring).toBe(true);
    });
  });
});

describe('Task Template Database Queries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createTaskTemplate', () => {
    it('should create a pre-populated task template', async () => {
      const input: CreateTaskTemplateInput = {
        title: 'Vacuum',
        description: 'Vacuum all rooms',
        isPrePopulated: true,
      };

      const mockRow = {
        id: 'template-1',
        title: input.title,
        description: input.description,
        is_prepopulated: true,
        created_by: null,
        usage_count: 0,
        created_at: new Date('2024-01-10T10:00:00Z'),
      };

      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 } as any);

      const result = await createTaskTemplate(input);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO task_templates'),
        [input.title, input.description, true, null]
      );

      expect(result).toMatchObject({
        id: 'template-1',
        title: input.title,
        description: input.description,
        isPrePopulated: true,
        usageCount: 0,
      });
    });

    it('should create a custom task template with creator', async () => {
      const input: CreateTaskTemplateInput = {
        title: 'Water plants',
        isPrePopulated: false,
        createdBy: 'user-1',
      };

      const mockRow = {
        id: 'template-2',
        title: input.title,
        description: null,
        is_prepopulated: false,
        created_by: 'user-1',
        usage_count: 0,
        created_at: new Date('2024-01-10T10:00:00Z'),
      };

      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 } as any);

      const result = await createTaskTemplate(input);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO task_templates'),
        [input.title, null, false, 'user-1']
      );

      expect(result).toMatchObject({
        id: 'template-2',
        title: input.title,
        isPrePopulated: false,
        createdBy: 'user-1',
        usageCount: 0,
      });
    });
  });

  describe('getTaskTemplateById', () => {
    it('should retrieve a task template by ID', async () => {
      const mockRow = {
        id: 'template-1',
        title: 'Dishes',
        description: 'Wash all dishes',
        is_prepopulated: true,
        created_by: null,
        usage_count: 5,
        created_at: new Date('2024-01-10T10:00:00Z'),
      };

      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 } as any);

      const result = await getTaskTemplateById('template-1');

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM task_templates WHERE id = $1',
        ['template-1']
      );
      expect(result).toMatchObject({
        id: 'template-1',
        title: 'Dishes',
        description: 'Wash all dishes',
        isPrePopulated: true,
        usageCount: 5,
      });
    });

    it('should return null if template not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await getTaskTemplateById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getTaskTemplates', () => {
    const mockTemplates = [
      {
        id: 'template-1',
        title: 'Vacuum',
        description: 'Vacuum all rooms',
        is_prepopulated: true,
        created_by: null,
        usage_count: 10,
        created_at: new Date('2024-01-10T10:00:00Z'),
      },
      {
        id: 'template-2',
        title: 'Dishes',
        description: null,
        is_prepopulated: true,
        created_by: null,
        usage_count: 8,
        created_at: new Date('2024-01-10T10:00:00Z'),
      },
      {
        id: 'template-3',
        title: 'Water plants',
        description: null,
        is_prepopulated: false,
        created_by: 'user-1',
        usage_count: 3,
        created_at: new Date('2024-01-11T10:00:00Z'),
      },
    ];

    it('should get all task templates without filters', async () => {
      mockQuery.mockResolvedValue({ rows: mockTemplates, rowCount: 3 } as any);

      const result = await getTaskTemplates();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM task_templates'),
        []
      );
      expect(result).toHaveLength(3);
    });

    it('should filter templates by pre-populated status', async () => {
      const prePopulatedTemplates = mockTemplates.filter(t => t.is_prepopulated);
      mockQuery.mockResolvedValue({ rows: prePopulatedTemplates, rowCount: 2 } as any);

      const filters: TaskTemplateFilters = { isPrePopulated: true };
      const result = await getTaskTemplates(filters);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE is_prepopulated = $1'),
        [true]
      );
      expect(result).toHaveLength(2);
    });

    it('should filter templates by custom (non-prepopulated) status', async () => {
      const customTemplates = mockTemplates.filter(t => !t.is_prepopulated);
      mockQuery.mockResolvedValue({ rows: customTemplates, rowCount: 1 } as any);

      const filters: TaskTemplateFilters = { isPrePopulated: false };
      const result = await getTaskTemplates(filters);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE is_prepopulated = $1'),
        [false]
      );
      expect(result).toHaveLength(1);
    });

    it('should filter templates by creator', async () => {
      const userTemplates = mockTemplates.filter(t => t.created_by === 'user-1');
      mockQuery.mockResolvedValue({ rows: userTemplates, rowCount: 1 } as any);

      const filters: TaskTemplateFilters = { createdBy: 'user-1' };
      const result = await getTaskTemplates(filters);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE created_by = $1'),
        ['user-1']
      );
      expect(result).toHaveLength(1);
    });

    it('should combine multiple filters', async () => {
      mockQuery.mockResolvedValue({ rows: [mockTemplates[2]], rowCount: 1 } as any);

      const filters: TaskTemplateFilters = {
        isPrePopulated: false,
        createdBy: 'user-1',
      };
      const result = await getTaskTemplates(filters);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE is_prepopulated = $1 AND created_by = $2'),
        [false, 'user-1']
      );
      expect(result).toHaveLength(1);
    });

    it('should order templates by usage count descending, then title ascending', async () => {
      mockQuery.mockResolvedValue({ rows: mockTemplates, rowCount: 3 } as any);

      await getTaskTemplates();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY usage_count DESC, title ASC'),
        []
      );
    });
  });

  describe('incrementTemplateUsage', () => {
    it('should increment usage count for a template', async () => {
      const mockRow = {
        id: 'template-1',
        title: 'Vacuum',
        description: 'Vacuum all rooms',
        is_prepopulated: true,
        created_by: null,
        usage_count: 11,
        created_at: new Date('2024-01-10T10:00:00Z'),
      };

      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 } as any);

      const result = await incrementTemplateUsage('template-1');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE task_templates'),
        ['template-1']
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('usage_count = usage_count + 1'),
        ['template-1']
      );
      expect(result).toMatchObject({
        id: 'template-1',
        usageCount: 11,
      });
    });

    it('should return null if template not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await incrementTemplateUsage('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updateTaskTemplate', () => {
    it('should update template title', async () => {
      const mockRow = {
        id: 'template-1',
        title: 'Updated Vacuum',
        description: 'Vacuum all rooms',
        is_prepopulated: true,
        created_by: null,
        usage_count: 10,
        created_at: new Date('2024-01-10T10:00:00Z'),
      };

      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 } as any);

      const result = await updateTaskTemplate('template-1', 'Updated Vacuum');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE task_templates SET'),
        ['Updated Vacuum', 'template-1']
      );
      expect(result).toMatchObject({
        id: 'template-1',
        title: 'Updated Vacuum',
      });
    });

    it('should update template description', async () => {
      const mockRow = {
        id: 'template-1',
        title: 'Vacuum',
        description: 'Updated description',
        is_prepopulated: true,
        created_by: null,
        usage_count: 10,
        created_at: new Date('2024-01-10T10:00:00Z'),
      };

      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 } as any);

      const result = await updateTaskTemplate('template-1', undefined, 'Updated description');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE task_templates SET'),
        ['Updated description', 'template-1']
      );
      expect(result).toMatchObject({
        description: 'Updated description',
      });
    });

    it('should update both title and description', async () => {
      const mockRow = {
        id: 'template-1',
        title: 'New Title',
        description: 'New Description',
        is_prepopulated: true,
        created_by: null,
        usage_count: 10,
        created_at: new Date('2024-01-10T10:00:00Z'),
      };

      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 } as any);

      const result = await updateTaskTemplate('template-1', 'New Title', 'New Description');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE task_templates SET'),
        ['New Title', 'New Description', 'template-1']
      );
      expect(result).toMatchObject({
        title: 'New Title',
        description: 'New Description',
      });
    });

    it('should return null if template not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await updateTaskTemplate('non-existent', 'New Title');

      expect(result).toBeNull();
    });
  });

  describe('deleteTaskTemplate', () => {
    it('should delete a task template and return true', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      const result = await deleteTaskTemplate('template-1');

      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM task_templates WHERE id = $1',
        ['template-1']
      );
      expect(result).toBe(true);
    });

    it('should return false if template not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await deleteTaskTemplate('non-existent');

      expect(result).toBe(false);
    });
  });
});
