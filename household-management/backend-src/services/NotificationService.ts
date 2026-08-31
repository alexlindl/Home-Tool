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

  /**
   * The local date (YYYY-MM-DD) that the current `sentNotifications` set is
   * scoped to. When a new day rolls over we clear the set so tasks can
   * re-notify, and so the set stays bounded to a single day's keys (avoiding a
   * slow memory leak). In-memory reset on restart is acceptable and actually
   * SAFER once keys are date-scoped: a restart just means at most one extra
   * notification per task per day, and the HA-side notificationId dedup further
   * reduces duplicates.
   */
  private currentDedupDate: string | null = null;

  /** Timeout for HA API calls in milliseconds */
  private static readonly HA_TIMEOUT_MS = 10_000;

  /** HA supervisor API base URL */
  private static readonly HA_API_BASE =
    process.env.HA_API_BASE_URL || 'http://supervisor/core';

  /**
   * Check for due/overdue tasks and send notifications to linked HA users.
   * Uses configurable notification lead time (global default + per-task override).
   * - Queries all users with linked HA accounts
   * - Finds pending tasks within the lead time window or overdue
   * - Resolves notification targets based on task assignment
   * - Sends deduplicated notifications via HA API
   *
   * Validates: Requirements 5.5, 7.1, 7.2, 7.3, 7.4
   */
  async checkAndSendNotifications(): Promise<void> {
    const now = new Date();

    // Daily rollover: if the local calendar day changed since the dedup set was
    // last scoped, clear it. This bounds the set to one day's keys and lets a
    // new day re-notify. Uses the SAME local-date basis as sendNotification.
    const todayStr = this.formatLocalDate(now);
    if (todayStr !== this.currentDedupDate) {
      this.sentNotifications.clear();
      this.currentDedupDate = todayStr;
    }

    const linkedUsers = await getLinkedUsers();
    if (linkedUsers.length === 0) return;

    const filters: TaskFilters = { status: 'pending' };
    const pendingTasks = await getTasks(filters);

    for (const task of pendingTasks) {
      if (!task.dueDate) continue;

      // Only notify for tasks that have notifications explicitly enabled
      // notificationLeadHours === null means the user did NOT opt in to notifications
      if (task.notificationLeadHours === null || task.notificationLeadHours === undefined) continue;

      const effectiveLeadHours = task.notificationLeadHours;
      const leadTimeMs = effectiveLeadHours * 60 * 60 * 1000;
      const windowStart = new Date(task.dueDate.getTime() - leadTimeMs);

      let type: NotificationType | null = null;

      if (effectiveLeadHours === 0) {
        // Zero lead time: fire 'due' on the same calendar day, 'overdue' after
        const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dueDay = new Date(task.dueDate.getFullYear(), task.dueDate.getMonth(), task.dueDate.getDate());

        if (now >= task.dueDate && nowDay.getTime() === dueDay.getTime()) {
          type = 'due';
        } else if (now > task.dueDate) {
          type = 'overdue';
        }
      } else {
        // Positive lead time: existing window logic
        if (now > task.dueDate) {
          type = 'overdue';
        } else if (now >= windowStart && now <= task.dueDate) {
          type = 'due';
        }
      }

      if (!type) continue;

      // Resolve notification targets
      const targets = this.resolveTargets(task, linkedUsers);

      const today = new Date(now);
      today.setHours(0, 0, 0, 0);

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
    const dateStr = this.formatLocalDate(today);
    const key = `${task.id}:${type}:${dateStr}:${user.id}`;

    // Deduplication check
    if (this.sentNotifications.has(key)) return;

    const message = this.formatMessage(task, type);
    const title = type === 'due' ? 'Task Reminder' : 'Task Overdue';
    const notificationId = `hometool_${task.id}_${type}_${dateStr}`;

    try {
      await this.callHaApi(user.haUsername!, message, title, notificationId);
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
    const dateStr = this.formatLocalDate(task.dueDate!);

    if (type === 'due') {
      return `Task "${task.title}" is due today (${dateStr})`;
    }
    return `Task "${task.title}" is overdue (was due ${dateStr})`;
  }

  /**
   * Format a Date as a LOCAL `YYYY-MM-DD` string (zero-padded), used for both
   * the displayed date in messages and the dedup key / daily rollover.
   * Using local date everywhere keeps the "same calendar day" checks (which
   * use local getFullYear/getMonth/getDate) consistent with the dedup date and
   * avoids the off-by-one that UTC `toISOString().slice(0,10)` caused.
   */
  private formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Call the Home Assistant supervisor API to send notifications.
   * Makes two independent calls:
   *   1. POST /api/services/persistent_notification/create (dashboard notification)
   *   2. POST /api/services/notify/mobile_app_{haUsername} (mobile push)
   *
   * Each call has its own 10s timeout. Partial failures are handled gracefully:
   * if at least one call succeeds, the notification is considered sent.
   * Only throws if BOTH calls fail.
   *
   * Validates: Requirements 7.7, 7.8
   *
   * @param haUsername The HA username to notify
   * @param message The notification message body
   * @param title The notification title (defaults to "Task Notification")
   * @param notificationId The notification ID for dedup (defaults to "hometool_unknown")
   */
  async callHaApi(
    haUsername: string,
    message: string,
    title: string = 'Task Notification',
    notificationId: string = 'hometool_unknown',
  ): Promise<void> {
    const token = process.env.SUPERVISOR_TOKEN || '';
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    // Call 1: Persistent notification (dashboard)
    const persistentUrl = `${NotificationService.HA_API_BASE}/api/services/persistent_notification/create`;
    const persistentBody = JSON.stringify({
      message,
      title,
      notification_id: notificationId,
    });

    // Call 2: Mobile push notification
    const mobileUrl = `${NotificationService.HA_API_BASE}/api/services/notify/mobile_app_${haUsername}`;
    const mobileBody = JSON.stringify({
      message,
      title,
    });

    let persistentSuccess = false;
    let mobileSuccess = false;
    let persistentError: Error | null = null;
    let mobileError: Error | null = null;

    // Attempt persistent notification call with its own timeout
    const persistentController = new AbortController();
    const persistentTimeoutId = setTimeout(
      () => persistentController.abort(),
      NotificationService.HA_TIMEOUT_MS,
    );

    try {
      const response = await fetch(persistentUrl, {
        method: 'POST',
        headers,
        body: persistentBody,
        signal: persistentController.signal,
      });

      if (!response.ok) {
        persistentError = new Error(
          `HA API persistent_notification/create returned ${response.status}: ${response.statusText}`,
        );
      } else {
        persistentSuccess = true;
      }
    } catch (error) {
      persistentError =
        error instanceof Error
          ? error
          : new Error(String(error));
    } finally {
      clearTimeout(persistentTimeoutId);
    }

    // Attempt mobile push call with its own timeout
    const mobileController = new AbortController();
    const mobileTimeoutId = setTimeout(
      () => mobileController.abort(),
      NotificationService.HA_TIMEOUT_MS,
    );

    try {
      const response = await fetch(mobileUrl, {
        method: 'POST',
        headers,
        body: mobileBody,
        signal: mobileController.signal,
      });

      if (!response.ok) {
        mobileError = new Error(
          `HA API notify/mobile_app_${haUsername} returned ${response.status}: ${response.statusText}`,
        );
      } else {
        mobileSuccess = true;
      }
    } catch (error) {
      mobileError =
        error instanceof Error
          ? error
          : new Error(String(error));
    } finally {
      clearTimeout(mobileTimeoutId);
    }

    // Log specific failures
    if (persistentError) {
      console.error(
        `HA persistent_notification/create failed for ${haUsername}:`,
        persistentError.message,
      );
    }
    if (mobileError) {
      console.error(
        `HA notify/mobile_app_${haUsername} failed:`,
        mobileError.message,
      );
    }

    // Only throw if BOTH calls failed
    if (!persistentSuccess && !mobileSuccess) {
      throw new Error(
        `Both HA notification calls failed for ${haUsername}. ` +
          `Persistent: ${persistentError?.message}. ` +
          `Mobile: ${mobileError?.message}.`,
      );
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
