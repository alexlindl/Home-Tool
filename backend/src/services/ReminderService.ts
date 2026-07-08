/**
 * Reminder Service
 * Monitors task due dates and sends notifications for upcoming/overdue tasks.
 * Uses WebSocket to deliver real-time reminders to connected clients.
 *
 * Validates: Requirements 5.1, 5.2, 5.3
 */

import { Task, isTaskOverdue } from '../models/Task';
import { getTasks, TaskFilters } from '../db/taskQueries';
import { getAppSetting } from '../db/settingsQueries';
import { getIO } from '../websocket/socketServer';
import { notificationService } from './NotificationService';

export type ReminderType = 'upcoming' | 'overdue';

export interface ReminderPayload {
  taskId: string;
  title: string;
  assignedTo: string | null;
  dueDate: string;
  type: ReminderType;
  message: string;
  sentAt: string;
}

/**
 * ReminderService class
 * Handles scheduled checks for upcoming and overdue tasks,
 * and emits WebSocket reminder notifications.
 */
export class ReminderService {
  /** Tracks sent reminders to avoid duplicates. Key format: `${taskId}:${type}` */
  private sentReminders: Set<string> = new Set();

  /** Interval handle for the scheduler */
  private schedulerInterval: ReturnType<typeof setInterval> | null = null;

  /** Default check interval: 5 minutes */
  private static readonly DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

  /**
   * Check for tasks due within the configurable lead time window and send reminders.
   * Reads global default from app_settings, then uses per-task override if set.
   * A task is within the window if: currentTime >= dueDate - effectiveLeadHours AND currentTime <= dueDate
   *
   * Validates: Requirements 5.1, 5.2, 5.3, 5.4
   */
  async checkReminders(): Promise<void> {
    const now = new Date();

    // Read global default lead time (falls back to 0 hours if not set or invalid)
    const globalDefault = await this.getGlobalLeadHours();

    // Query all pending tasks (we need per-task lead time, so filter in code)
    const filters: TaskFilters = { status: 'pending' };
    const tasks = await getTasks(filters);

    for (const task of tasks) {
      if (!task.dueDate) continue;

      const effectiveLeadHours = task.notificationLeadHours ?? globalDefault;
      const leadTimeMs = effectiveLeadHours * 60 * 60 * 1000;
      const windowStart = new Date(task.dueDate.getTime() - leadTimeMs);

      // Check if current time is within reminder window
      if (effectiveLeadHours === 0) {
        // Zero lead time: fire 'upcoming' when now >= dueDate and same calendar day
        const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dueDay = new Date(task.dueDate.getFullYear(), task.dueDate.getMonth(), task.dueDate.getDate());

        if (now >= task.dueDate && nowDay.getTime() === dueDay.getTime()) {
          await this.sendReminder(task, 'upcoming');
        }
      } else {
        // Positive lead time: existing window logic
        if (now >= windowStart && now <= task.dueDate) {
          await this.sendReminder(task, 'upcoming');
        }
      }
    }
  }

  /**
   * Read the global notification lead hours from app_settings.
   * Falls back to 0 if the setting doesn't exist or is invalid.
   * Accepts 0 as a valid value (meaning "notify when due").
   *
   * @returns The global lead time in hours (non-negative number, default 0)
   */
  private async getGlobalLeadHours(): Promise<number> {
    try {
      const raw = await getAppSetting('notification_lead_hours');
      if (raw === null) return 0;
      const parsed = parseInt(raw, 10);
      return isNaN(parsed) || parsed < 0 ? 0 : parsed;
    } catch {
      return 0;
    }
  }

  /**
   * Check for overdue tasks (due date in the past, still pending).
   * Queries pending tasks with dueDate before now.
   * Skips backlog tasks (null due date) — they are never overdue.
   *
   * Validates: Requirements 5.2, 5.6
   */
  async checkOverdueTasks(): Promise<void> {
    const now = new Date();

    const filters: TaskFilters = {
      status: 'pending',
      dueDateTo: now,
    };

    const tasks = await getTasks(filters);

    // Filter to only truly overdue tasks using isTaskOverdue
    // This correctly skips backlog tasks (null dueDate)
    const overdueTasks = tasks.filter((task) => isTaskOverdue(task, now));

    for (const task of overdueTasks) {
      await this.sendReminder(task, 'overdue');
    }
  }

  /**
   * Send a reminder notification via WebSocket for a specific task.
   * Tracks sent reminders to avoid duplicates within the same scheduler cycle.
   *
   * Validates: Requirements 5.1, 5.2, 5.3
   *
   * @param task The task to send a reminder for
   * @param type The reminder type ('upcoming' or 'overdue')
   */
  async sendReminder(task: Task, type: ReminderType): Promise<void> {
    const reminderKey = `${task.id}:${type}`;

    // Skip if already sent
    if (this.sentReminders.has(reminderKey)) {
      return;
    }

    const io = getIO();
    if (!io) {
      console.warn('WebSocket server not initialized, cannot send reminder');
      return;
    }

    const message = this.formatReminderMessage(task, type);

    const payload: ReminderPayload = {
      taskId: task.id,
      title: task.title,
      assignedTo: task.assignedTo,
      dueDate: task.dueDate ? task.dueDate.toISOString() : '',
      type,
      message,
      sentAt: new Date().toISOString(),
    };

    io.emit('reminder:notify', payload);

    // Track as sent
    this.sentReminders.add(reminderKey);
  }

  /**
   * Format a human-readable reminder message.
   *
   * @param task The task
   * @param type The reminder type
   * @returns Formatted message string
   */
  private formatReminderMessage(task: Task, type: ReminderType): string {
    if (type === 'overdue') {
      return `Task "${task.title}" is overdue! It was due on ${task.dueDate!.toLocaleDateString()}.`;
    }
    return `Reminder: Task "${task.title}" is due on ${task.dueDate ? task.dueDate.toLocaleDateString() : 'no date'}.`;
  }

  /**
   * Start the scheduler to periodically check for reminders.
   *
   * @param intervalMs Interval in milliseconds between checks (default: 5 minutes)
   */
  startScheduler(intervalMs?: number): void {
    if (this.schedulerInterval) {
      console.warn('Reminder scheduler is already running');
      return;
    }

    const interval = intervalMs ?? ReminderService.DEFAULT_INTERVAL_MS;

    this.schedulerInterval = setInterval(async () => {
      try {
        await this.checkReminders();
        await this.checkOverdueTasks();
      } catch (error) {
        console.error('Error in reminder scheduler:', error);
      }

      // HA notifications check — wrapped in separate try/catch so failures
      // don't break the reminder loop (Validates: Requirements 7.9)
      try {
        await notificationService.checkAndSendNotifications();
      } catch (error) {
        console.error('Error in HA notification check:', error);
      }
    }, interval);

    console.log(`Reminder scheduler started (interval: ${interval}ms)`);
  }

  /**
   * Stop the scheduler.
   */
  stopScheduler(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
      console.log('Reminder scheduler stopped');
    }
  }

  /**
   * Clear the sent reminders tracking set.
   * Useful for allowing reminders to be re-sent (e.g., on a new day).
   */
  clearSentReminders(): void {
    this.sentReminders.clear();
  }

  /**
   * Get the number of sent reminders (for testing/monitoring).
   */
  getSentRemindersCount(): number {
    return this.sentReminders.size;
  }

  /**
   * Check if a reminder has been sent for a given task and type.
   */
  hasReminderBeenSent(taskId: string, type: ReminderType): boolean {
    return this.sentReminders.has(`${taskId}:${type}`);
  }
}

/** Singleton instance */
export const reminderService = new ReminderService();
