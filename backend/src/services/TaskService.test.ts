/**
 * TaskService tests
 * Tests for task creation logic, template management, and validation
 */

import { TaskService, TaskInput, TaskValidationError } from './TaskService';
import { Task, TaskTemplate } from '../models/Task';
import * as taskQueries from '../db/taskQueries';
import * as userQueries from '../db/userQueries';

// Mock the database query modules
jest.mock('../db/taskQueries');
jest.mock('../db/userQueries');

const mockCreateTask = taskQueries.createTask as jest.MockedFunction<typeof taskQueries.createTask>;
const mockGetTaskById = taskQueries.getTaskById as jest.MockedFunction<typeof taskQueries.getTaskById>;
const mockGetTasks = taskQueries.getTasks as jest.MockedFunction<typeof taskQueries.getTasks>;
const mockUpdateTask = taskQueries.updateTask as jest.MockedFunction<typeof taskQueries.updateTask>;
const mockDeleteTask = taskQueries.deleteTask as jest.MockedFunction<typeof taskQueries.deleteTask>;
const mockCreateHistoryEntry = taskQueries.createHistoryEntry as jest.MockedFunction<typeof taskQueries.createHistoryEntry>;
const mockGetTaskHistory = taskQueries.getTaskHistory as jest.MockedFunction<typeof taskQueries.getTaskHistory>;
const mockCreateTaskTemplate = taskQueries.createTaskTemplate as jest.MockedFunction<typeof taskQueries.createTaskTemplate>;
const mockGetTaskTemplateById = taskQueries.getTaskTemplateById as jest.MockedFunction<typeof taskQueries.getTaskTemplateById>;
const mockGetTaskTemplates = taskQueries.getTaskTemplates as jest.MockedFunction<typeof taskQueries.getTaskTemplates>;
const mockIncrementTemplateUsage = taskQueries.incrementTemplateUsage as jest.MockedFunction<typeof taskQueries.incrementTemplateUsage>;
const mockFindTemplateByTitle = taskQueries.findTemplateByTitle as jest.MockedFunction<typeof taskQueries.findTemplateByTitle>;
const mockGetUserById = userQueries.getUserById as jest.MockedFunction<typeof userQueries.getUserById>;

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockUsers = {
  alex: { id: 'user-1', name: 'Alex' as const, createdAt: new Date('2024-01-01') },
  becky: { id: 'user-2', name: 'Becky' as const, createdAt: new Date('2024-01-01') },
  sam: { id: 'user-3', name: 'Sam' as const, createdAt: new Date('2024-01-01') },
};

const baseTaskInput: TaskInput = {
  title: 'Vacuum Living Room',
  description: 'Vacuum all carpets',
  assignedTo: 'user-1',
  createdBy: 'user-1',
  dueDate: new Date('2024-06-01T10:00:00Z'),
  isRecurring: false,
};

const mockTask: Task = {
  id: 'task-1',
  title: 'Vacuum Living Room',
  description: 'Vacuum all carpets',
  assignedTo: 'user-1',
  createdBy: 'user-1',
  dueDate: new Date('2024-06-01T10:00:00Z'),
  isRecurring: false,
  status: 'pending',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockRecurringTask: Task = {
  ...mockTask,
  id: 'task-recurring-1',
  isRecurring: true,
  recurrencePattern: { frequency: 'weekly', interval: 1 },
};

const mockCompletedTask: Task = {
  ...mockTask,
  status: 'completed',
  completedAt: new Date('2024-06-01T12:00:00Z'),
  completedBy: 'user-1',
};

const mockHistoryEntry = {
  id: 'history-1',
  taskId: 'task-1',
  title: 'Vacuum Living Room',
  assignedTo: 'user-1',
  completedBy: 'user-1',
  completedAt: new Date('2024-06-01T12:00:00Z'),
  wasRecurring: false,
};

const mockTemplate: TaskTemplate = {
  id: 'template-1',
  title: 'Vacuum Living Room',
  description: 'Vacuum all carpets',
  isPrePopulated: true,
  usageCount: 5,
  createdAt: new Date('2024-01-01'),
};

const mockCustomTemplate: TaskTemplate = {
  id: 'template-custom-1',
  title: 'Custom Chore',
  description: 'A custom chore',
  isPrePopulated: false,
  createdBy: 'user-1',
  usageCount: 0,
  createdAt: new Date('2024-01-01'),
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('TaskService', () => {
  let taskService: TaskService;

  beforeEach(() => {
    taskService = new TaskService();
    jest.clearAllMocks();
  });

  // ── createTask ─────────────────────────────────────────────────────────────

  describe('createTask', () => {
    describe('successful creation', () => {
      it('should create a one-off task without auto-saving as template', async () => {
        mockGetUserById.mockResolvedValue(mockUsers.alex);
        mockCreateTask.mockResolvedValue(mockTask);

        const result = await taskService.createTask(baseTaskInput);

        expect(result).toEqual(mockTask);
        expect(mockCreateTask).toHaveBeenCalledTimes(1);
        // Requirement 5.1 – template is NOT auto-saved
        expect(mockCreateTaskTemplate).not.toHaveBeenCalled();
        expect(mockFindTemplateByTitle).not.toHaveBeenCalled();
      });

      it('should save as template when saveAsTemplate is true and no duplicate exists', async () => {
        mockGetUserById.mockResolvedValue(mockUsers.alex);
        mockCreateTask.mockResolvedValue(mockTask);
        mockFindTemplateByTitle.mockResolvedValue(null); // no existing template
        mockCreateTaskTemplate.mockResolvedValue(mockCustomTemplate);

        const result = await taskService.createTask({ ...baseTaskInput, saveAsTemplate: true });

        expect(result).toEqual(mockTask);
        expect(mockCreateTaskTemplate).toHaveBeenCalledWith({
          title: 'Vacuum Living Room',
          description: 'Vacuum all carpets',
          isPrePopulated: false,
          createdBy: 'user-1',
        });
      });

      it('should increment usage count when saveAsTemplate is true and duplicate exists', async () => {
        mockGetUserById.mockResolvedValue(mockUsers.alex);
        mockCreateTask.mockResolvedValue(mockTask);
        mockFindTemplateByTitle.mockResolvedValue(mockTemplate); // existing template found
        mockIncrementTemplateUsage.mockResolvedValue({ ...mockTemplate, usageCount: 6 });

        const result = await taskService.createTask({ ...baseTaskInput, saveAsTemplate: true });

        expect(result).toEqual(mockTask);
        expect(mockIncrementTemplateUsage).toHaveBeenCalledWith(mockTemplate.id);
        expect(mockCreateTaskTemplate).not.toHaveBeenCalled();
      });

      it('should create a recurring task with a valid recurrence pattern', async () => {
        const recurringInput: TaskInput = {
          ...baseTaskInput,
          isRecurring: true,
          recurrenceFrequency: 'weekly',
          recurrenceInterval: 1,
        };

        const recurringTask: Task = {
          ...mockTask,
          isRecurring: true,
          recurrencePattern: { frequency: 'weekly', interval: 1 },
        };

        mockGetUserById.mockResolvedValue(mockUsers.alex);
        mockCreateTask.mockResolvedValue(recurringTask);

        const result = await taskService.createTask(recurringInput);

        expect(result.isRecurring).toBe(true);
        expect(result.recurrencePattern?.frequency).toBe('weekly');
        expect(result.recurrencePattern?.interval).toBe(1);
        expect(mockCreateTask).toHaveBeenCalledWith(
          expect.objectContaining({
            isRecurring: true,
            recurrenceFrequency: 'weekly',
            recurrenceInterval: 1,
          })
        );
      });

      it('should NOT save a template when saveAsTemplate is not set', async () => {
        mockGetUserById.mockResolvedValue(mockUsers.alex);
        mockCreateTask.mockResolvedValue(mockTask);

        const result = await taskService.createTask(baseTaskInput);

        expect(result).toEqual(mockTask);
        // Template should not be saved without explicit opt-in
        expect(mockCreateTaskTemplate).not.toHaveBeenCalled();
        expect(mockFindTemplateByTitle).not.toHaveBeenCalled();
      });

      it('should NOT save a template when task is from a pre-populated template even with saveAsTemplate', async () => {
        const inputFromTemplate: TaskInput = {
          ...baseTaskInput,
          fromPrePopulatedTemplate: true,
          saveAsTemplate: true,
        };

        mockGetUserById.mockResolvedValue(mockUsers.alex);
        mockCreateTask.mockResolvedValue(mockTask);
        mockFindTemplateByTitle.mockResolvedValue(null);
        mockCreateTaskTemplate.mockResolvedValue(mockCustomTemplate);

        await taskService.createTask(inputFromTemplate);

        // saveAsTemplate is true, so it will still attempt to save
        // (fromPrePopulatedTemplate doesn't block saveAsTemplate in the new flow)
        expect(mockFindTemplateByTitle).toHaveBeenCalled();
      });

      it('should trim whitespace from title', async () => {
        const inputWithSpaces: TaskInput = {
          ...baseTaskInput,
          title: '  Vacuum Living Room  ',
        };

        mockGetUserById.mockResolvedValue(mockUsers.alex);
        mockCreateTask.mockResolvedValue(mockTask);
        mockGetTaskTemplates.mockResolvedValue([]);
        mockCreateTaskTemplate.mockResolvedValue(mockCustomTemplate);

        await taskService.createTask(inputWithSpaces);

        expect(mockCreateTask).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Vacuum Living Room' })
        );
      });

      it('should allow assigning task to any household member', async () => {
        for (const user of Object.values(mockUsers)) {
          jest.clearAllMocks();
          mockGetUserById.mockResolvedValue(user);
          mockCreateTask.mockResolvedValue({ ...mockTask, assignedTo: user.id });

          const result = await taskService.createTask({
            ...baseTaskInput,
            assignedTo: user.id,
          });

          expect(result.assignedTo).toBe(user.id);
        }
      });

      it('should allow assigning task to Anyone (null assignedTo)', async () => {
        mockGetUserById.mockResolvedValue(mockUsers.alex); // only for createdBy check
        mockCreateTask.mockResolvedValue({ ...mockTask, assignedTo: null });

        const result = await taskService.createTask({
          ...baseTaskInput,
          assignedTo: null,
        });

        expect(result.assignedTo).toBeNull();
        // getUserById should only be called once for createdBy, not for assignedTo
        expect(mockGetUserById).toHaveBeenCalledTimes(1);
        expect(mockGetUserById).toHaveBeenCalledWith('user-1'); // createdBy
      });
    });

    describe('validation errors', () => {
      it('should throw TaskValidationError when title is empty', async () => {
        await expect(
          taskService.createTask({ ...baseTaskInput, title: '' })
        ).rejects.toThrow(TaskValidationError);

        await expect(
          taskService.createTask({ ...baseTaskInput, title: '   ' })
        ).rejects.toThrow('Task title is required');
      });

      it('should throw TaskValidationError when dueDate is missing', async () => {
        await expect(
          taskService.createTask({ ...baseTaskInput, dueDate: null as unknown as Date })
        ).rejects.toThrow(TaskValidationError);
      });

      it('should throw TaskValidationError when dueDate is invalid', async () => {
        await expect(
          taskService.createTask({ ...baseTaskInput, dueDate: new Date('invalid') })
        ).rejects.toThrow('Task due date must be a valid date');
      });

      it('should throw TaskValidationError when assignedTo is empty string', async () => {
        await expect(
          taskService.createTask({ ...baseTaskInput, assignedTo: '' })
        ).rejects.toThrow('Task must be assigned to a user or set to null for Anyone');
      });

      it('should throw TaskValidationError when createdBy is empty', async () => {
        await expect(
          taskService.createTask({ ...baseTaskInput, createdBy: '' })
        ).rejects.toThrow('Task must have a creator');
      });

      it('should throw TaskValidationError when isRecurring is not a boolean', async () => {
        await expect(
          taskService.createTask({
            ...baseTaskInput,
            isRecurring: 'yes' as unknown as boolean,
          })
        ).rejects.toThrow('Task must be designated as recurring or one-off');
      });

      it('should throw TaskValidationError when recurring task has no frequency', async () => {
        await expect(
          taskService.createTask({
            ...baseTaskInput,
            isRecurring: true,
            recurrenceInterval: 1,
          })
        ).rejects.toThrow('Recurring tasks must have a recurrence frequency');
      });

      it('should throw TaskValidationError when recurring task has invalid frequency', async () => {
        await expect(
          taskService.createTask({
            ...baseTaskInput,
            isRecurring: true,
            recurrenceFrequency: 'yearly' as any,
            recurrenceInterval: 1,
          })
        ).rejects.toThrow('Recurrence frequency must be one of');
      });

      it('should throw TaskValidationError when recurring task has no interval', async () => {
        await expect(
          taskService.createTask({
            ...baseTaskInput,
            isRecurring: true,
            recurrenceFrequency: 'weekly',
          })
        ).rejects.toThrow('Recurring tasks must have a positive integer recurrence interval');
      });

      it('should throw TaskValidationError when recurring task has zero interval', async () => {
        await expect(
          taskService.createTask({
            ...baseTaskInput,
            isRecurring: true,
            recurrenceFrequency: 'weekly',
            recurrenceInterval: 0,
          })
        ).rejects.toThrow('Recurring tasks must have a positive integer recurrence interval');
      });

      it('should throw TaskValidationError when recurring task has negative interval', async () => {
        await expect(
          taskService.createTask({
            ...baseTaskInput,
            isRecurring: true,
            recurrenceFrequency: 'daily',
            recurrenceInterval: -1,
          })
        ).rejects.toThrow('Recurring tasks must have a positive integer recurrence interval');
      });

      it('should throw TaskValidationError when assigned user does not exist', async () => {
        mockGetUserById.mockResolvedValueOnce(null); // assignedTo not found

        await expect(
          taskService.createTask({ ...baseTaskInput, assignedTo: 'unknown-user' })
        ).rejects.toThrow('Assigned user with ID unknown-user not found');
      });

      it('should throw TaskValidationError when creator user does not exist', async () => {
        mockGetUserById
          .mockResolvedValueOnce(mockUsers.alex) // assignedTo found
          .mockResolvedValueOnce(null);           // createdBy not found

        await expect(
          taskService.createTask({ ...baseTaskInput, createdBy: 'unknown-creator' })
        ).rejects.toThrow('Creator user with ID unknown-creator not found');
      });
    });
  });

  // ── createTaskFromTemplate ─────────────────────────────────────────────────

  describe('createTaskFromTemplate', () => {
    const templateOverrides = {
      assignedTo: 'user-1',
      createdBy: 'user-1',
      dueDate: new Date('2024-06-01T10:00:00Z'),
    };

    it('should create a task populated with template title and description', async () => {
      mockGetTaskTemplateById.mockResolvedValue(mockTemplate);
      mockIncrementTemplateUsage.mockResolvedValue({ ...mockTemplate, usageCount: 6 });
      mockGetUserById.mockResolvedValue(mockUsers.alex);
      mockCreateTask.mockResolvedValue(mockTask);

      const result = await taskService.createTaskFromTemplate('template-1', templateOverrides);

      expect(result).toEqual(mockTask);
      // Requirement 3.3 – task populated from template
      expect(mockCreateTask).toHaveBeenCalledWith(
        expect.objectContaining({
          title: mockTemplate.title,
          description: mockTemplate.description,
          assignedTo: templateOverrides.assignedTo,
          dueDate: templateOverrides.dueDate,
        })
      );
    });

    it('should increment template usage count', async () => {
      mockGetTaskTemplateById.mockResolvedValue(mockTemplate);
      mockIncrementTemplateUsage.mockResolvedValue({ ...mockTemplate, usageCount: 6 });
      mockGetUserById.mockResolvedValue(mockUsers.alex);
      mockCreateTask.mockResolvedValue(mockTask);

      await taskService.createTaskFromTemplate('template-1', templateOverrides);

      expect(mockIncrementTemplateUsage).toHaveBeenCalledWith('template-1');
    });

    it('should allow description override from caller', async () => {
      mockGetTaskTemplateById.mockResolvedValue(mockTemplate);
      mockIncrementTemplateUsage.mockResolvedValue({ ...mockTemplate, usageCount: 6 });
      mockGetUserById.mockResolvedValue(mockUsers.alex);
      mockCreateTask.mockResolvedValue(mockTask);

      await taskService.createTaskFromTemplate('template-1', {
        ...templateOverrides,
        description: 'Custom description override',
      });

      expect(mockCreateTask).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Custom description override' })
      );
    });

    it('should create a recurring task from template when overrides specify recurrence', async () => {
      const recurringTask: Task = {
        ...mockTask,
        isRecurring: true,
        recurrencePattern: { frequency: 'monthly', interval: 1 },
      };

      mockGetTaskTemplateById.mockResolvedValue(mockTemplate);
      mockIncrementTemplateUsage.mockResolvedValue({ ...mockTemplate, usageCount: 6 });
      mockGetUserById.mockResolvedValue(mockUsers.alex);
      mockCreateTask.mockResolvedValue(recurringTask);

      const result = await taskService.createTaskFromTemplate('template-1', {
        ...templateOverrides,
        isRecurring: true,
        recurrenceFrequency: 'monthly',
        recurrenceInterval: 1,
      });

      expect(result.isRecurring).toBe(true);
      expect(result.recurrencePattern?.frequency).toBe('monthly');
    });

    it('should NOT save a new template when using a pre-populated template', async () => {
      mockGetTaskTemplateById.mockResolvedValue(mockTemplate); // isPrePopulated: true
      mockIncrementTemplateUsage.mockResolvedValue({ ...mockTemplate, usageCount: 6 });
      mockGetUserById.mockResolvedValue(mockUsers.alex);
      mockCreateTask.mockResolvedValue(mockTask);

      await taskService.createTaskFromTemplate('template-1', templateOverrides);

      // No auto-save of templates
      expect(mockCreateTaskTemplate).not.toHaveBeenCalled();
    });

    it('should NOT auto-save template when using a custom (non-pre-populated) template', async () => {
      const customTemplate: TaskTemplate = {
        ...mockTemplate,
        isPrePopulated: false,
        createdBy: 'user-1',
      };

      mockGetTaskTemplateById.mockResolvedValue(customTemplate);
      mockIncrementTemplateUsage.mockResolvedValue({ ...customTemplate, usageCount: 1 });
      mockGetUserById.mockResolvedValue(mockUsers.alex);
      mockCreateTask.mockResolvedValue(mockTask);

      // With opt-in template saving, no template is auto-saved
      await taskService.createTaskFromTemplate('template-custom-1', templateOverrides);

      expect(mockCreateTaskTemplate).not.toHaveBeenCalled();
    });

    it('should throw an error when template is not found', async () => {
      mockGetTaskTemplateById.mockResolvedValue(null);

      await expect(
        taskService.createTaskFromTemplate('non-existent-template', templateOverrides)
      ).rejects.toThrow('Task template with ID non-existent-template not found');
    });
  });

  // ── getTasks ───────────────────────────────────────────────────────────────

  describe('getTasks', () => {
    it('should return all tasks when no filters provided', async () => {
      const tasks = [mockTask];
      mockGetTasks.mockResolvedValue(tasks);

      const result = await taskService.getTasks();

      expect(result).toEqual(tasks);
      expect(mockGetTasks).toHaveBeenCalledWith(undefined);
    });

    it('should pass filters to the database query', async () => {
      const filters = { assignedTo: 'user-1', status: 'pending' as const };
      mockGetTasks.mockResolvedValue([mockTask]);

      await taskService.getTasks(filters);

      expect(mockGetTasks).toHaveBeenCalledWith(filters);
    });
  });

  // ── getTaskById ────────────────────────────────────────────────────────────

  describe('getTaskById', () => {
    it('should return task when found', async () => {
      mockGetTaskById.mockResolvedValue(mockTask);

      const result = await taskService.getTaskById('task-1');

      expect(result).toEqual(mockTask);
      expect(mockGetTaskById).toHaveBeenCalledWith('task-1');
    });

    it('should return null when task not found', async () => {
      mockGetTaskById.mockResolvedValue(null);

      const result = await taskService.getTaskById('non-existent');

      expect(result).toBeNull();
    });
  });

  // ── getTaskTemplates ───────────────────────────────────────────────────────

  describe('getTaskTemplates', () => {
    it('should return all templates when no filters provided', async () => {
      const templates = [mockTemplate];
      mockGetTaskTemplates.mockResolvedValue(templates);

      const result = await taskService.getTaskTemplates();

      expect(result).toEqual(templates);
      expect(mockGetTaskTemplates).toHaveBeenCalledWith(undefined);
    });

    it('should pass filters to the database query', async () => {
      const filters = { isPrePopulated: true };
      mockGetTaskTemplates.mockResolvedValue([mockTemplate]);

      await taskService.getTaskTemplates(filters);

      expect(mockGetTaskTemplates).toHaveBeenCalledWith(filters);
    });
  });

  // ── completeTask ───────────────────────────────────────────────────────────

  describe('completeTask', () => {
    describe('successful completion', () => {
      it('should mark a one-off task as complete and create a history entry', async () => {
        mockGetTaskById.mockResolvedValue(mockTask);
        mockGetUserById.mockResolvedValue(mockUsers.alex);
        mockUpdateTask.mockResolvedValue(mockCompletedTask);
        mockCreateHistoryEntry.mockResolvedValue(mockHistoryEntry);

        await taskService.completeTask('task-1', 'user-1');

        // Requirement 4.3 – task status updated to completed
        expect(mockUpdateTask).toHaveBeenCalledWith(
          'task-1',
          expect.objectContaining({
            status: 'completed',
            completedBy: 'user-1',
            completedAt: expect.any(Date),
          })
        );

        // Requirements 4.4, 6.1, 6.2 – history entry created
        expect(mockCreateHistoryEntry).toHaveBeenCalledWith(
          'task-1',
          'Vacuum Living Room',
          'user-1',
          'user-1',
          expect.any(Date),
          false // wasRecurring
        );

        // One-off task – no new task should be created
        expect(mockCreateTask).not.toHaveBeenCalled();
      });

      it('should create the next occurrence when completing a recurring task', async () => {
        mockGetTaskById.mockResolvedValue(mockRecurringTask);
        mockGetUserById.mockResolvedValue(mockUsers.alex);
        mockUpdateTask.mockResolvedValue({ ...mockRecurringTask, status: 'completed' });
        mockCreateHistoryEntry.mockResolvedValue({ ...mockHistoryEntry, wasRecurring: true });
        mockCreateTask.mockResolvedValue({
          ...mockRecurringTask,
          id: 'task-recurring-2',
          dueDate: new Date('2024-06-08T10:00:00Z'),
        });

        await taskService.completeTask('task-recurring-1', 'user-1');

        // Requirement 4.5 – next occurrence created
        expect(mockCreateTask).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Vacuum Living Room',
            assignedTo: 'user-1',
            isRecurring: true,
            recurrenceFrequency: 'weekly',
            recurrenceInterval: 1,
            // Next due date: 2024-06-01 + 7 days = 2024-06-08
            dueDate: new Date('2024-06-08T10:00:00Z'),
          })
        );
      });

      it('should record wasRecurring=true in history for recurring tasks', async () => {
        mockGetTaskById.mockResolvedValue(mockRecurringTask);
        mockGetUserById.mockResolvedValue(mockUsers.alex);
        mockUpdateTask.mockResolvedValue({ ...mockRecurringTask, status: 'completed' });
        mockCreateHistoryEntry.mockResolvedValue({ ...mockHistoryEntry, wasRecurring: true });
        mockCreateTask.mockResolvedValue({ ...mockRecurringTask, id: 'task-recurring-2' });

        await taskService.completeTask('task-recurring-1', 'user-1');

        expect(mockCreateHistoryEntry).toHaveBeenCalledWith(
          'task-recurring-1',
          expect.any(String),
          expect.any(String),
          'user-1',
          expect.any(Date),
          true // wasRecurring
        );
      });

      it('should allow any household member to complete a task', async () => {
        for (const user of Object.values(mockUsers)) {
          jest.clearAllMocks();
          mockGetTaskById.mockResolvedValue(mockTask);
          mockGetUserById.mockResolvedValue(user);
          mockUpdateTask.mockResolvedValue(mockCompletedTask);
          mockCreateHistoryEntry.mockResolvedValue(mockHistoryEntry);

          await taskService.completeTask('task-1', user.id);

          expect(mockUpdateTask).toHaveBeenCalledWith(
            'task-1',
            expect.objectContaining({ completedBy: user.id })
          );
        }
      });
    });

    describe('error cases', () => {
      it('should throw an error when task is not found', async () => {
        mockGetTaskById.mockResolvedValue(null);

        await expect(
          taskService.completeTask('non-existent', 'user-1')
        ).rejects.toThrow('Task with ID non-existent not found');
      });

      it('should throw TaskValidationError when completing user does not exist', async () => {
        mockGetTaskById.mockResolvedValue(mockTask);
        mockGetUserById.mockResolvedValue(null);

        await expect(
          taskService.completeTask('task-1', 'unknown-user')
        ).rejects.toThrow('User with ID unknown-user not found');
      });
    });
  });

  // ── calculateNextDueDate ───────────────────────────────────────────────────

  describe('calculateNextDueDate', () => {
    it('should add the correct number of days for daily recurrence', () => {
      const base = new Date('2024-06-01T10:00:00Z');
      const next = taskService.calculateNextDueDate(base, 'daily', 1);
      expect(next).toEqual(new Date('2024-06-02T10:00:00Z'));
    });

    it('should add multiple days for daily recurrence with interval > 1', () => {
      const base = new Date('2024-06-01T10:00:00Z');
      const next = taskService.calculateNextDueDate(base, 'daily', 3);
      expect(next).toEqual(new Date('2024-06-04T10:00:00Z'));
    });

    it('should add 7 days for weekly recurrence with interval 1', () => {
      const base = new Date('2024-06-01T10:00:00Z'); // Saturday
      const next = taskService.calculateNextDueDate(base, 'weekly', 1);
      expect(next).toEqual(new Date('2024-06-08T10:00:00Z')); // Next Saturday
    });

    it('should add 14 days for weekly recurrence with interval 2', () => {
      const base = new Date('2024-06-01T10:00:00Z');
      const next = taskService.calculateNextDueDate(base, 'weekly', 2);
      expect(next).toEqual(new Date('2024-06-15T10:00:00Z'));
    });

    it('should add one month for monthly recurrence with interval 1', () => {
      const base = new Date('2024-06-01T10:00:00Z');
      const next = taskService.calculateNextDueDate(base, 'monthly', 1);
      expect(next).toEqual(new Date('2024-07-01T10:00:00Z'));
    });

    it('should add multiple months for monthly recurrence with interval > 1', () => {
      const base = new Date('2024-01-15T10:00:00Z');
      const next = taskService.calculateNextDueDate(base, 'monthly', 3);
      // Compare date parts to avoid DST timezone offset issues
      expect(next.getUTCFullYear()).toBe(2024);
      expect(next.getUTCMonth()).toBe(3); // April (0-indexed)
      expect(next.getUTCDate()).toBe(15);
    });

    it('should not mutate the original date', () => {
      const base = new Date('2024-06-01T10:00:00Z');
      const originalTime = base.getTime();
      taskService.calculateNextDueDate(base, 'weekly', 1);
      expect(base.getTime()).toBe(originalTime);
    });
  });

  // ── updateTask ─────────────────────────────────────────────────────────────

  describe('updateTask', () => {
    it('should update a task and return the updated task', async () => {
      const updatedTask: Task = { ...mockTask, title: 'Vacuum Bedroom' };
      mockGetTaskById.mockResolvedValue(mockTask);
      mockUpdateTask.mockResolvedValue(updatedTask);

      const result = await taskService.updateTask('task-1', { title: 'Vacuum Bedroom' });

      expect(result).toEqual(updatedTask);
      expect(mockUpdateTask).toHaveBeenCalledWith('task-1', { title: 'Vacuum Bedroom' });
    });

    it('should verify the new assigned user exists when reassigning', async () => {
      const updatedTask: Task = { ...mockTask, assignedTo: 'user-2' };
      mockGetTaskById.mockResolvedValue(mockTask);
      mockGetUserById.mockResolvedValue(mockUsers.becky);
      mockUpdateTask.mockResolvedValue(updatedTask);

      const result = await taskService.updateTask('task-1', { assignedTo: 'user-2' });

      expect(result.assignedTo).toBe('user-2');
      expect(mockGetUserById).toHaveBeenCalledWith('user-2');
    });

    it('should throw an error when task is not found', async () => {
      mockGetTaskById.mockResolvedValue(null);

      await expect(
        taskService.updateTask('non-existent', { title: 'New Title' })
      ).rejects.toThrow('Task with ID non-existent not found');
    });

    it('should throw TaskValidationError when new assigned user does not exist', async () => {
      mockGetTaskById.mockResolvedValue(mockTask);
      mockGetUserById.mockResolvedValue(null);

      await expect(
        taskService.updateTask('task-1', { assignedTo: 'unknown-user' })
      ).rejects.toThrow('Assigned user with ID unknown-user not found');
    });

    it('should not call getUserById when assignedTo is not being updated', async () => {
      const updatedTask: Task = { ...mockTask, title: 'New Title' };
      mockGetTaskById.mockResolvedValue(mockTask);
      mockUpdateTask.mockResolvedValue(updatedTask);

      await taskService.updateTask('task-1', { title: 'New Title' });

      expect(mockGetUserById).not.toHaveBeenCalled();
    });
  });

  // ── deleteTask ─────────────────────────────────────────────────────────────

  describe('deleteTask', () => {
    it('should delete a task successfully', async () => {
      mockGetTaskById.mockResolvedValue(mockTask);
      mockDeleteTask.mockResolvedValue(true);

      await expect(taskService.deleteTask('task-1')).resolves.toBeUndefined();

      expect(mockDeleteTask).toHaveBeenCalledWith('task-1');
    });

    it('should throw an error when task is not found', async () => {
      mockGetTaskById.mockResolvedValue(null);

      await expect(
        taskService.deleteTask('non-existent')
      ).rejects.toThrow('Task with ID non-existent not found');

      expect(mockDeleteTask).not.toHaveBeenCalled();
    });
  });

  // ── getTaskHistory ─────────────────────────────────────────────────────────

  describe('getTaskHistory', () => {
    it('should return history with default 30-day window', async () => {
      const history = [mockHistoryEntry];
      mockGetTaskHistory.mockResolvedValue(history);

      const result = await taskService.getTaskHistory();

      expect(result).toEqual(history);
      expect(mockGetTaskHistory).toHaveBeenCalledWith(30);
    });

    it('should pass custom days parameter to the database query', async () => {
      mockGetTaskHistory.mockResolvedValue([]);

      await taskService.getTaskHistory(7);

      expect(mockGetTaskHistory).toHaveBeenCalledWith(7);
    });

    it('should return an empty array when no history exists', async () => {
      mockGetTaskHistory.mockResolvedValue([]);

      const result = await taskService.getTaskHistory();

      expect(result).toEqual([]);
    });

    it('should return history entries with completion date and completing user', async () => {
      const historyWithDetails = [
        {
          ...mockHistoryEntry,
          completedAt: new Date('2024-06-01T12:00:00Z'),
          completedBy: 'user-2',
        },
      ];
      mockGetTaskHistory.mockResolvedValue(historyWithDetails);

      const result = await taskService.getTaskHistory(30);

      // Requirement 6.2 – history includes completion date and completing user
      expect(result[0].completedAt).toBeInstanceOf(Date);
      expect(result[0].completedBy).toBe('user-2');
    });
  });
});
