/**
 * Notification Service
 * Sends Home Assistant notifications for tasks that are due today or overdue.
 * Integrates with the HA supervisor API to deliver push notifications to linked users.
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8
 */

import { Task } from '../models/Task';
import { User } from '../models/User';
import { getLinkedUsers } from '../db/userQueries';
import { getTasks, TaskFilters } from '../db/taskQueries';

export type NotificationType = 'due' | 'overdue';

/**
 * NotificationService class
 * Handles checking for due/overdue tasks and sending HA notifications
 * to linked users with deduplication to prevent repeat alerts.
 */
export class NotificationService {
  /** Tracks sent notifications to avoid duplicates. Key: `${taskId}:${type}:${date}:${userId}` */
  private sentNotifications: Set<string> = new Set();

  /** Timeout for HA API calls in milliseconds */
  private static readonly HA_TIMEOUT_MS = 10_000;

  /** HA supervisor API base URL */
  private static readonly HA_API_BASE =
    process.env.HA_API_BASE_URL || 'http://supervisor/core';

  /**
   * Check for due/overdue tasks and send notifications to linked HA users.
   * - Queries all users with linked HA accounts
   * - Finds pending tasks with due dates on or before today
   * - Resolves notification targets based on task assignment
   * - Sends deduplicated notifications via HA API
   *
   * Validates: Requirements 7.1, 7.2, 7.3, 7.4
   */
  async checkAndSendNotifications(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const linkedUsers = await getLinkedUsers();
    if (linkedUsers.length === 0) return;

    const filters: TaskFilters = { status: 'pending' };
    const pendingTasks = await getTasks(filters);

    for (const task of pendingTasks) {
      if (!task.dueDate) continue;

      const dueDay = new Date(task.dueDate);
      dueDay.setHours(0, 0, 0, 0);

      let type: NotificationType | null = null;
      if (dueDay.getTime() === today.getTime()) {
        type = 'due';
      } else if (dueDay.getTime() < today.getTime()) {
        type = 'overdue';
      }
      if (!type) continue;

      // Resolve notification targets
      const targets = this.resolveTargets(task, linkedUsers);

      for (const user of targets) {
        await this.sendNotification(user, task, type, today);
      }
    }
  }

  /**
   * Resolve which users should receive a notification for a task.
   * - If assignedTo is a linked user → only that user
   * - If assignedTo is a non-linked user → no one
   * - If assignedTo is null → all linked users
   *
   * Validates: Requirements 7.3, 7.4
   */
  private resolveTargets(task: Task, linkedUsers: User[]): User[] {
    if (task.assignedTo) {
      return linkedUsers.filter((u) => u.id === task.assignedTo);
    }
    // Unassigned tasks → notify all linked users
    return linkedUsers;
  }

  /**
   * Send a notification to a user for a specific task, with deduplication.
   * Uses an in-memory Set keyed by `${taskId}:${type}:${date}:${userId}`.
   *
   * Validates: Requirements 7.5, 7.6
   *
   * @param user The target user with a linked HA account
   * @param task The task that triggered the notification
   * @param type Whether the task is 'due' or 'overdue'
   * @param today The reference date (start of today)
   */
  async sendNotification(
    user: User,
    task: Task,
    type: NotificationType,
    today: Date,
  ): Promise<void> {
    const dateStr = today.toISOString().slice(0, 10);
    const key = `${task.id}:${type}:${dateStr}:${user.id}`;

    // Deduplication check
    if (this.sentNotifications.has(key)) return;

    const message = this.formatMessage(task, type);

    try {
      await this.callHaApi(user.haUsername!, message);
      this.sentNotifications.add(key);
    } catch (error) {
      console.error(
        `HA notification failed for task ${task.id} → ${user.haUsername}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  /**
   * Format the notification message based on type.
   *
   * Validates: Requirements 7.5
   *
   * @param task The task
   * @param type 'due' or 'overdue'
   * @returns Formatted notification message
   */
  private formatMessage(task: Task, type: NotificationType): string {
    const dateStr = this.formatDate(task.dueDate!);

    if (type === 'due') {
      return `Task "${task.title}" is due today (${dateStr})`;
    }
    return `Task "${task.title}" is overdue (was due ${dateStr})`;
  }

  /**
   * Format a date as YYYY-MM-DD for display in notification messages.
   */
  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  /**
   * Call the Home Assistant supervisor API to send a notification.
   * POST /api/services/notify/notify with 10s timeout.
   *
   * Validates: Requirements 7.7, 7.8
   *
   * @param haUsername The HA username to notify
   * @param message The notification message body
   */
  async callHaApi(haUsername: string, message: string): Promise<void> {
    const url = `${NotificationService.HA_API_BASE}/api/services/notify/notify`;
    const token = process.env.SUPERVISOR_TOKEN || '';

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      NotificationService.HA_TIMEOUT_MS,
    );

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message,
          target: haUsername,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `HA API returned ${response.status}: ${response.statusText}`,
        );
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Clear the sent notifications tracking set.
   * Useful for testing and for daily reset.
   */
  clearSentNotifications(): void {
    this.sentNotifications.clear();
  }

  /**
   * Get the number of sent notifications (for testing/monitoring).
   */
  getSentNotificationsCount(): number {
    return this.sentNotifications.size;
  }

  /**
   * Check if a notification has been sent for a given key.
   */
  hasNotificationBeenSent(
    taskId: string,
    type: NotificationType,
    date: string,
    userId: string,
  ): boolean {
    return this.sentNotifications.has(`${taskId}:${type}:${date}:${userId}`);
  }
}

/** Singleton instance */
export const notificationService = new NotificationService();
