/**
 * ReminderService tests
 * Tests for reminder scheduling, overdue detection, and WebSocket notification logic.
 *
 * Validates: Requirements 5.1, 5.2, 5.3
 */

import { ReminderService, ReminderPayload } from './ReminderService';
import { Task } from '../models/Task';
import * as taskQueries from '../db/taskQueries';
import * as settingsQueries from '../db/settingsQueries';
import * as socketServer from '../websocket/socketServer';

// Mock dependencies
jest.mock('../db/taskQueries');
jest.mock('../db/settingsQueries');
jest.mock('../websocket/socketServer');
jest.mock('./NotificationService', () => ({
  notificationService: {
    checkAndSendNotifications: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockGetTasks = taskQueries.getTasks as jest.MockedFunction<typeof taskQueries.getTasks>;
const mockGetAppSetting = settingsQueries.getAppSetting as jest.MockedFunction<typeof settingsQueries.getAppSetting>;
const mockGetIO = socketServer.getIO as jest.MockedFunction<typeof socketServer.getIO>;

// ─── Fixtures ────────────────────────────────────────────────────────────────

const createMockTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  title: 'Vacuum Living Room',
  description: 'Vacuum all carpets',
  assignedTo: 'user-1',
  createdBy: 'user-2',
  dueDate: new Date('2024-06-01T10:00:00Z'),
  isRecurring: false,
  rotationEnabled: false,
  rotationUserIds: [],
  rotationCurrentIndex: 0,
  status: 'pending',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

const createMockIO = () => ({
  emit: jest.fn(),
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ReminderService', () => {
  let service: ReminderService;
  let mockIO: ReturnType<typeof createMockIO>;

  beforeEach(() => {
    service = new ReminderService();
    mockIO = createMockIO();
    mockGetIO.mockReturnValue(mockIO as any);
    mockGetTasks.mockResolvedValue([]);
    mockGetAppSetting.mockResolvedValue('24');
    jest.useFakeTimers();
  });

  afterEach(() => {
    service.stopScheduler();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('checkReminders', () => {
    it('should query all pending tasks and filter by configurable lead time', async () => {
      jest.setSystemTime(new Date('2024-06-01T08:00:00Z'));

      await service.checkReminders();

      expect(mockGetTasks).toHaveBeenCalledWith({
        status: 'pending',
      });
      expect(mockGetAppSetting).toHaveBeenCalledWith('notification_lead_hours');
    });

    it('should send reminders for tasks within lead time window', async () => {
      jest.setSystemTime(new Date('2024-06-01T08:00:00Z'));

      // Task due in 4 hours (within 24h window)
      const task1 = createMockTask({ id: 'task-1', dueDate: new Date('2024-06-01T12:00:00Z') });
      // Task due in 10 hours (within 24h window)
      const task2 = createMockTask({ id: 'task-2', title: 'Do Dishes', dueDate: new Date('2024-06-01T18:00:00Z') });
      mockGetTasks.mockResolvedValue([task1, task2]);

      await service.checkReminders();

      expect(mockIO.emit).toHaveBeenCalledTimes(2);
      expect(mockIO.emit).toHaveBeenCalledWith('reminder:notify', expect.objectContaining({
        taskId: 'task-1',
        type: 'upcoming',
      }));
      expect(mockIO.emit).toHaveBeenCalledWith('reminder:notify', expect.objectContaining({
        taskId: 'task-2',
        type: 'upcoming',
      }));
    });

    it('should not send reminders for tasks outside the lead time window', async () => {
      jest.setSystemTime(new Date('2024-06-01T08:00:00Z'));

      // Task due in 30 hours (outside default 24h window)
      const task = createMockTask({ id: 'task-far', dueDate: new Date('2024-06-02T14:00:00Z') });
      mockGetTasks.mockResolvedValue([task]);

      await service.checkReminders();

      expect(mockIO.emit).not.toHaveBeenCalled();
    });

    it('should not send reminders for tasks already past due', async () => {
      jest.setSystemTime(new Date('2024-06-02T08:00:00Z'));

      // Task was due yesterday (past due, should not be "upcoming")
      const task = createMockTask({ id: 'task-past', dueDate: new Date('2024-06-01T10:00:00Z') });
      mockGetTasks.mockResolvedValue([task]);

      await service.checkReminders();

      expect(mockIO.emit).not.toHaveBeenCalled();
    });

    it('should use per-task notificationLeadHours override when set', async () => {
      jest.setSystemTime(new Date('2024-06-01T08:00:00Z'));

      // Task due in 4 hours with 2h per-task override — NOT within window (8h is 4h before, need 2h window)
      const taskOutside = createMockTask({
        id: 'task-outside',
        dueDate: new Date('2024-06-01T12:00:00Z'),
        notificationLeadHours: 2,
      });
      // Task due in 1 hour with 2h per-task override — within window
      const taskInside = createMockTask({
        id: 'task-inside',
        dueDate: new Date('2024-06-01T09:00:00Z'),
        notificationLeadHours: 2,
      });
      mockGetTasks.mockResolvedValue([taskOutside, taskInside]);

      await service.checkReminders();

      expect(mockIO.emit).toHaveBeenCalledTimes(1);
      expect(mockIO.emit).toHaveBeenCalledWith('reminder:notify', expect.objectContaining({
        taskId: 'task-inside',
        type: 'upcoming',
      }));
    });

    it('should use custom global default when app_settings has a value', async () => {
      jest.setSystemTime(new Date('2024-06-01T08:00:00Z'));
      mockGetAppSetting.mockResolvedValue('48'); // 48 hour lead time

      // Task due in 30 hours — within 48h window
      const task = createMockTask({ id: 'task-48h', dueDate: new Date('2024-06-02T14:00:00Z') });
      mockGetTasks.mockResolvedValue([task]);

      await service.checkReminders();

      expect(mockIO.emit).toHaveBeenCalledTimes(1);
      expect(mockIO.emit).toHaveBeenCalledWith('reminder:notify', expect.objectContaining({
        taskId: 'task-48h',
        type: 'upcoming',
      }));
    });

    it('should fall back to 0h when app_settings returns invalid value', async () => {
      jest.setSystemTime(new Date('2024-06-01T08:00:00Z'));
      mockGetAppSetting.mockResolvedValue('invalid');

      // Task due in 4 hours — with 0h fallback, window is [dueDate, dueDate] so no reminder
      const task = createMockTask({ id: 'task-1', dueDate: new Date('2024-06-01T12:00:00Z') });
      mockGetTasks.mockResolvedValue([task]);

      await service.checkReminders();

      expect(mockIO.emit).not.toHaveBeenCalled();
    });

    it('should fall back to 0h when getAppSetting throws', async () => {
      jest.setSystemTime(new Date('2024-06-01T08:00:00Z'));
      mockGetAppSetting.mockRejectedValue(new Error('DB error'));

      // Task due in 4 hours — with 0h fallback, window is [dueDate, dueDate] so no reminder
      const task = createMockTask({ id: 'task-1', dueDate: new Date('2024-06-01T12:00:00Z') });
      mockGetTasks.mockResolvedValue([task]);

      await service.checkReminders();

      expect(mockIO.emit).not.toHaveBeenCalled();
    });

    it('should not send reminders when no tasks are due', async () => {
      mockGetTasks.mockResolvedValue([]);

      await service.checkReminders();

      expect(mockIO.emit).not.toHaveBeenCalled();
    });

    it('should skip tasks with no dueDate', async () => {
      jest.setSystemTime(new Date('2024-06-01T08:00:00Z'));

      const backlogTask = createMockTask({ id: 'task-backlog', dueDate: null });
      mockGetTasks.mockResolvedValue([backlogTask]);

      await service.checkReminders();

      expect(mockIO.emit).not.toHaveBeenCalled();
    });
  });

  describe('checkOverdueTasks', () => {
    it('should query pending tasks with due date before now', async () => {
      jest.setSystemTime(new Date('2024-06-01T08:00:00Z'));

      await service.checkOverdueTasks();

      expect(mockGetTasks).toHaveBeenCalledWith({
        status: 'pending',
        dueDateTo: expect.any(Date),
      });
    });

    it('should send overdue reminders for tasks past their due date', async () => {
      jest.setSystemTime(new Date('2024-06-02T08:00:00Z'));

      const overdueTask = createMockTask({
        id: 'task-overdue',
        dueDate: new Date('2024-06-01T10:00:00Z'),
      });
      mockGetTasks.mockResolvedValue([overdueTask]);

      await service.checkOverdueTasks();

      expect(mockIO.emit).toHaveBeenCalledWith('reminder:notify', expect.objectContaining({
        taskId: 'task-overdue',
        type: 'overdue',
      }));
    });

    it('should not send overdue reminders for tasks due exactly now', async () => {
      const now = new Date('2024-06-01T10:00:00Z');
      jest.setSystemTime(now);

      // Task due at exactly now - not strictly overdue
      const task = createMockTask({ id: 'task-now', dueDate: now });
      mockGetTasks.mockResolvedValue([task]);

      await service.checkOverdueTasks();

      // dueDate is not < now, it's equal, so it shouldn't be considered overdue
      expect(mockIO.emit).not.toHaveBeenCalled();
    });
  });

  describe('sendReminder', () => {
    it('should emit reminder:notify event with correct payload', async () => {
      jest.setSystemTime(new Date('2024-06-01T08:00:00Z'));

      const task = createMockTask();

      await service.sendReminder(task, 'upcoming');

      expect(mockIO.emit).toHaveBeenCalledWith('reminder:notify', expect.objectContaining({
        taskId: task.id,
        title: task.title,
        assignedTo: task.assignedTo,
        dueDate: task.dueDate!.toISOString(),
        type: 'upcoming',
        message: expect.stringContaining(task.title),
        sentAt: expect.any(String),
      }));
    });

    it('should format overdue message correctly', async () => {
      const task = createMockTask();

      await service.sendReminder(task, 'overdue');

      const payload: ReminderPayload = mockIO.emit.mock.calls[0][1];
      expect(payload.message).toContain('overdue');
      expect(payload.message).toContain(task.title);
    });

    it('should format upcoming message correctly', async () => {
      const task = createMockTask();

      await service.sendReminder(task, 'upcoming');

      const payload: ReminderPayload = mockIO.emit.mock.calls[0][1];
      expect(payload.message).toContain('Reminder');
      expect(payload.message).toContain(task.title);
    });

    it('should not send duplicate reminders for the same task and type', async () => {
      const task = createMockTask();

      await service.sendReminder(task, 'upcoming');
      await service.sendReminder(task, 'upcoming');

      expect(mockIO.emit).toHaveBeenCalledTimes(1);
    });

    it('should allow different types for the same task', async () => {
      const task = createMockTask();

      await service.sendReminder(task, 'upcoming');
      await service.sendReminder(task, 'overdue');

      expect(mockIO.emit).toHaveBeenCalledTimes(2);
    });

    it('should not emit when WebSocket server is not initialized', async () => {
      mockGetIO.mockReturnValue(null);
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const task = createMockTask();
      await service.sendReminder(task, 'upcoming');

      expect(mockIO.emit).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        'WebSocket server not initialized, cannot send reminder'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('duplicate tracking', () => {
    it('should track sent reminders', async () => {
      const task = createMockTask();

      expect(service.hasReminderBeenSent(task.id, 'upcoming')).toBe(false);

      await service.sendReminder(task, 'upcoming');

      expect(service.hasReminderBeenSent(task.id, 'upcoming')).toBe(true);
      expect(service.hasReminderBeenSent(task.id, 'overdue')).toBe(false);
    });

    it('should clear sent reminders', async () => {
      const task = createMockTask();

      await service.sendReminder(task, 'upcoming');
      expect(service.getSentRemindersCount()).toBe(1);

      service.clearSentReminders();
      expect(service.getSentRemindersCount()).toBe(0);
      expect(service.hasReminderBeenSent(task.id, 'upcoming')).toBe(false);
    });
  });

  describe('scheduler', () => {
    it('should start periodic checks', async () => {
      mockGetTasks.mockResolvedValue([]);

      service.startScheduler(1000);

      // Advance time by one interval
      jest.advanceTimersByTime(1000);

      // Wait for async operations (both checkReminders and checkOverdueTasks)
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // getTasks should be called for both checkReminders and checkOverdueTasks
      expect(mockGetTasks).toHaveBeenCalledTimes(2);
    });

    it('should not start multiple schedulers', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      service.startScheduler(1000);
      service.startScheduler(1000);

      expect(consoleSpy).toHaveBeenCalledWith('Reminder scheduler is already running');
      consoleSpy.mockRestore();
    });

    it('should stop the scheduler', () => {
      service.startScheduler(1000);
      service.stopScheduler();

      jest.advanceTimersByTime(5000);

      expect(mockGetTasks).not.toHaveBeenCalled();
    });

    it('should handle errors in scheduled checks gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockGetTasks.mockRejectedValue(new Error('DB connection failed'));

      service.startScheduler(1000);

      // advanceTimersByTimeAsync properly flushes async timer callbacks
      await jest.advanceTimersByTimeAsync(1000);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error in reminder scheduler:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });
});
