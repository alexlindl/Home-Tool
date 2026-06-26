/**
 * Task Service
 * Handles business logic for task operations including task creation,
 * template management, and task retrieval.
 */

import { Task, TaskHistory, TaskTemplate } from '../models/Task';
import {
  CreateTaskInput,
  UpdateTaskInput,
  TaskFilters,
  createTask as dbCreateTask,
  getTaskById,
  getTasks as dbGetTasks,
  updateTask as dbUpdateTask,
  deleteTask as dbDeleteTask,
  createHistoryEntry,
  getTaskHistory as dbGetTaskHistory,
  createTaskTemplate,
  getTaskTemplateById,
  getTaskTemplates as dbGetTaskTemplates,
  TaskTemplateFilters,
  incrementTemplateUsage,
  findTemplateByTitle,
} from '../db/taskQueries';
import { getUserById } from '../db/userQueries';
import {
  EnhancedRecurrencePattern,
  validateRecurrencePattern,
  calculateNextDueDate as recurrenceCalculateNextDueDate,
} from '../utils/recurrenceEngine';

/**
 * Input for creating a task via the service layer.
 * Mirrors CreateTaskInput but exposes a friendlier interface.
 */
export interface TaskInput {
  title: string;
  description?: string;
  assignedTo: string | null;   // User ID or null for "Anyone"
  createdBy: string;    // User ID
  dueDate: Date | null;        // Now nullable for backlog tasks
  isRecurring: boolean;
  recurrencePattern?: EnhancedRecurrencePattern;  // New enhanced pattern field
  // Legacy fields kept for backwards compatibility:
  recurrenceFrequency?: 'daily' | 'weekly' | 'monthly';
  recurrenceInterval?: number;
  recurrenceEndDate?: Date;
  /**
   * When true, the task will be saved as a template.
   * Template saving is opt-in only (Requirement 5.1, 5.2).
   */
  saveAsTemplate?: boolean;
  /**
   * When true the task was created from a pre-populated template,
   * so it should NOT be saved as a new custom template.
   */
  fromPrePopulatedTemplate?: boolean;
  /** Optional list ID to assign the task to */
  listId?: string;
}

/**
 * Validation error thrown when task input is invalid.
 */
export class TaskValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaskValidationError';
  }
}

/**
 * TaskService class
 * Manages task creation, template management, and task retrieval.
 */
export class TaskService {
  /**
   * Validate task input before persisting.
   * @throws TaskValidationError if any field is invalid
   */
  private validateTaskInput(input: TaskInput): void {
    // Requirement 2.1 – title is required
    if (!input.title || input.title.trim().length === 0) {
      throw new TaskValidationError('Task title is required');
    }

    // dueDate is now nullable for backlog tasks (Requirement 5.3)
    // But if provided, it must be a valid date
    if (input.dueDate !== null && input.dueDate !== undefined) {
      if (!(input.dueDate instanceof Date) || isNaN(input.dueDate.getTime())) {
        throw new TaskValidationError('Task due date must be a valid date');
      }
    }

    // Requirement 5.7 – recurring tasks must have a due date
    if (input.dueDate === null && input.isRecurring === true) {
      throw new TaskValidationError('Recurring tasks must have a due date');
    }

    if (!input.assignedTo && input.assignedTo !== null) {
      throw new TaskValidationError('Task must be assigned to a user or set to null for Anyone');
    }

    if (input.assignedTo !== null && input.assignedTo.trim().length === 0) {
      throw new TaskValidationError('Task must be assigned to a user or set to null for Anyone');
    }

    if (!input.createdBy || input.createdBy.trim().length === 0) {
      throw new TaskValidationError('Task must have a creator');
    }

    // Requirement 2.3 – isRecurring must be explicitly set (boolean)
    if (typeof input.isRecurring !== 'boolean') {
      throw new TaskValidationError('Task must be designated as recurring or one-off');
    }

    // Validate enhanced recurrence pattern if provided
    if (input.recurrencePattern) {
      const patternValidation = validateRecurrencePattern(input.recurrencePattern);
      if (!patternValidation.valid) {
        throw new TaskValidationError(patternValidation.error || 'Invalid recurrence pattern');
      }
    }

    // Requirement 2.4 – recurring tasks need a valid recurrence pattern
    // Either enhanced pattern OR legacy fields must be provided
    if (input.isRecurring) {
      if (!input.recurrencePattern) {
        // Fall back to legacy validation
        if (!input.recurrenceFrequency) {
          throw new TaskValidationError(
            'Recurring tasks must have a recurrence frequency (daily, weekly, or monthly)'
          );
        }

        const validFrequencies = ['daily', 'weekly', 'monthly'];
        if (!validFrequencies.includes(input.recurrenceFrequency)) {
          throw new TaskValidationError(
            `Recurrence frequency must be one of: ${validFrequencies.join(', ')}`
          );
        }

        if (
          input.recurrenceInterval === undefined ||
          input.recurrenceInterval === null ||
          input.recurrenceInterval <= 0 ||
          !Number.isInteger(input.recurrenceInterval)
        ) {
          throw new TaskValidationError(
            'Recurring tasks must have a positive integer recurrence interval'
          );
        }
      }
    }
  }

  /**
   * Create a new task with full validation.
   *
   * When the task is not from a pre-populated template (i.e. it is a custom
   * task), it is automatically saved as a TaskTemplate for future use
   * (Requirement 2.6).
   *
   * @param input Task creation data
   * @returns Promise<Task> The created task
   * @throws TaskValidationError if input is invalid
   * @throws Error if the assigned user or creator does not exist
   */
  async createTask(input: TaskInput): Promise<Task> {
    // Validate all fields
    this.validateTaskInput(input);

    // Requirement 2.2 – verify the assigned user exists (skip when null = "Anyone")
    if (input.assignedTo !== null) {
      const assignedUser = await getUserById(input.assignedTo);
      if (!assignedUser) {
        throw new TaskValidationError(
          `Assigned user with ID ${input.assignedTo} not found`
        );
      }
    }

    // Verify the creator exists
    const creatorUser = await getUserById(input.createdBy);
    if (!creatorUser) {
      throw new TaskValidationError(
        `Creator user with ID ${input.createdBy} not found`
      );
    }

    // Build the DB input
    const dbInput: CreateTaskInput = {
      title: input.title.trim(),
      description: input.description?.trim(),
      assignedTo: input.assignedTo,
      createdBy: input.createdBy,
      dueDate: input.dueDate,
      isRecurring: input.isRecurring,
      recurrenceFrequency: input.recurrenceFrequency,
      recurrenceInterval: input.recurrencePattern?.interval ?? input.recurrenceInterval,
      recurrenceEndDate: input.recurrencePattern?.endDate ?? input.recurrenceEndDate,
      recurrenceType: input.recurrencePattern?.type,
      recurrenceDayOfWeek: input.recurrencePattern?.dayOfWeek,
      recurrenceOrdinalWeek: input.recurrencePattern?.ordinalWeek,
      listId: input.listId,
    };

    // Persist the task
    const task = await dbCreateTask(dbInput);

    // Requirement 5.1, 5.2 – Only save as template when explicitly requested
    if (input.saveAsTemplate === true) {
      await this.saveAsTemplate(task, input.createdBy);
    }

    return task;
  }

  /**
   * Create a task from an existing template.
   *
   * Populates task fields from the template and then calls createTask.
   * Increments the template's usage count.
   * (Requirement 3.3)
   *
   * @param templateId UUID of the TaskTemplate to use
   * @param overrides Fields that override or supplement the template data
   * @returns Promise<Task> The created task
   * @throws Error if the template is not found
   * @throws TaskValidationError if the resulting task input is invalid
   */
  async createTaskFromTemplate(
    templateId: string,
    overrides: {
      assignedTo: string;
      createdBy: string;
      dueDate: Date;
      isRecurring?: boolean;
      recurrenceFrequency?: 'daily' | 'weekly' | 'monthly';
      recurrenceInterval?: number;
      recurrenceEndDate?: Date;
      description?: string;
    }
  ): Promise<Task> {
    const template = await getTaskTemplateById(templateId);

    if (!template) {
      throw new Error(`Task template with ID ${templateId} not found`);
    }

    // Increment usage count (fire-and-forget style – don't block task creation)
    await incrementTemplateUsage(templateId);

    // Build task input from template + overrides (Requirement 3.3)
    const taskInput: TaskInput = {
      title: template.title,
      description: overrides.description ?? template.description,
      assignedTo: overrides.assignedTo,
      createdBy: overrides.createdBy,
      dueDate: overrides.dueDate,
      isRecurring: overrides.isRecurring ?? false,
      recurrenceFrequency: overrides.recurrenceFrequency,
      recurrenceInterval: overrides.recurrenceInterval,
      recurrenceEndDate: overrides.recurrenceEndDate,
      // Mark as coming from a template so we don't create a duplicate template
      fromPrePopulatedTemplate: template.isPrePopulated,
    };

    return this.createTask(taskInput);
  }

  /**
   * Get tasks with optional filtering.
   * @param filters Optional filters (assignedTo, status, date range)
   * @returns Promise<Task[]> Array of matching tasks
   */
  async getTasks(filters?: TaskFilters): Promise<Task[]> {
    return dbGetTasks(filters);
  }

  /**
   * Get a task by its ID.
   * @param id Task UUID
   * @returns Promise<Task | null> Task or null if not found
   */
  async getTaskById(id: string): Promise<Task | null> {
    return getTaskById(id);
  }

  /**
   * Update an existing task.
   *
   * Validates that the task exists before applying updates.
   * If assignedTo is being changed, verifies the new user exists.
   *
   * @param id Task UUID
   * @param updates Partial task fields to update
   * @returns Promise<Task> The updated task
   * @throws Error if the task is not found
   * @throws TaskValidationError if the new assigned user does not exist
   */
  async updateTask(id: string, updates: UpdateTaskInput): Promise<Task> {
    const existing = await getTaskById(id);
    if (!existing) {
      throw new Error(`Task with ID ${id} not found`);
    }

    // If reassigning, verify the new user exists
    if (updates.assignedTo) {
      const assignedUser = await getUserById(updates.assignedTo);
      if (!assignedUser) {
        throw new TaskValidationError(
          `Assigned user with ID ${updates.assignedTo} not found`
        );
      }
    }

    const updated = await dbUpdateTask(id, updates);
    if (!updated) {
      throw new Error(`Failed to update task with ID ${id}`);
    }

    return updated;
  }

  /**
   * Delete a task by its ID.
   *
   * @param id Task UUID
   * @returns Promise<void>
   * @throws Error if the task is not found
   */
  async deleteTask(id: string): Promise<void> {
    const existing = await getTaskById(id);
    if (!existing) {
      throw new Error(`Task with ID ${id} not found`);
    }

    await dbDeleteTask(id);
  }

  /**
   * Get task templates with optional filtering.
   * @param filters Optional filters (isPrePopulated, createdBy)
   * @returns Promise<TaskTemplate[]> Array of matching templates
   */
  async getTaskTemplates(filters?: TaskTemplateFilters): Promise<TaskTemplate[]> {
    return dbGetTaskTemplates(filters);
  }

  /**
   * Mark a task as complete.
   *
   * Steps:
   *  1. Fetch the task and verify it exists.
   *  2. Update the task status to 'completed' with completedAt / completedBy.
   *  3. Create a TaskHistory entry (Requirement 4.4, 6.1, 6.2).
   *  4. If the task is recurring, generate the next occurrence based on the
   *     recurrence pattern (Requirement 4.5).
   *
   * @param id Task UUID
   * @param userId User ID of the person completing the task
   * @returns Promise<void>
   * @throws Error if the task is not found
   * @throws TaskValidationError if the completing user does not exist
   */
  async completeTask(id: string, userId: string): Promise<void> {
    // Step 1 – fetch the task
    const task = await getTaskById(id);
    if (!task) {
      throw new Error(`Task with ID ${id} not found`);
    }

    // Verify the completing user exists
    const completingUser = await getUserById(userId);
    if (!completingUser) {
      throw new TaskValidationError(`User with ID ${userId} not found`);
    }

    const completedAt = new Date();

    // Step 2 – mark the task as completed in the DB (Requirement 4.3)
    await dbUpdateTask(id, {
      status: 'completed',
      completedAt,
      completedBy: userId,
    });

    // Step 3 – create a history entry (Requirements 4.4, 6.1, 6.2)
    await createHistoryEntry(
      task.id,
      task.title,
      task.assignedTo,
      userId,
      completedAt,
      task.isRecurring
    );

    // Step 4 – generate next occurrence for recurring tasks (Requirement 4.5)
    if (task.isRecurring && task.recurrencePattern) {
      // Determine if this task has enhanced recurrence data
      // by checking for recurrence_type via the task's dueDate and pattern
      const enhancedPattern = this.getEnhancedPatternFromTask(task);

      let nextDueDate: Date;
      let nextDbInput: CreateTaskInput;

      if (enhancedPattern) {
        // Use the RecurrenceEngine for enhanced patterns (Requirement 2.5)
        nextDueDate = recurrenceCalculateNextDueDate(task.dueDate!, enhancedPattern);
        nextDbInput = {
          title: task.title,
          description: task.description,
          assignedTo: task.assignedTo,
          createdBy: task.createdBy,
          dueDate: nextDueDate,
          isRecurring: true,
          recurrenceFrequency: task.recurrencePattern.frequency,
          recurrenceInterval: enhancedPattern.interval,
          recurrenceEndDate: enhancedPattern.endDate ?? task.recurrencePattern.endDate,
          recurrenceType: enhancedPattern.type,
          recurrenceDayOfWeek: enhancedPattern.dayOfWeek,
          recurrenceOrdinalWeek: enhancedPattern.ordinalWeek,
        };
      } else {
        // Legacy fallback: use old calculation method
        nextDueDate = this.calculateNextDueDate(
          task.dueDate!,
          task.recurrencePattern.frequency,
          task.recurrencePattern.interval
        );
        nextDbInput = {
          title: task.title,
          description: task.description,
          assignedTo: task.assignedTo,
          createdBy: task.createdBy,
          dueDate: nextDueDate,
          isRecurring: true,
          recurrenceFrequency: task.recurrencePattern.frequency,
          recurrenceInterval: task.recurrencePattern.interval,
          recurrenceEndDate: task.recurrencePattern.endDate,
        };
      }

      await dbCreateTask(nextDbInput);
    }
  }

  /**
   * Calculate the next due date for a recurring task (legacy method).
   *
   * @param currentDueDate The current due date of the task
   * @param frequency Recurrence frequency ('daily' | 'weekly' | 'monthly')
   * @param interval Number of frequency units between occurrences
   * @returns Date The next due date
   */
  calculateNextDueDate(
    currentDueDate: Date,
    frequency: 'daily' | 'weekly' | 'monthly',
    interval: number
  ): Date {
    const next = new Date(currentDueDate);

    switch (frequency) {
      case 'daily':
        next.setDate(next.getDate() + interval);
        break;
      case 'weekly':
        next.setDate(next.getDate() + interval * 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + interval);
        break;
    }

    return next;
  }

  /**
   * Extract an enhanced recurrence pattern from a task, if present.
   * Tasks with enhanced recurrence have additional fields stored in the DB
   * that map back to an EnhancedRecurrencePattern.
   *
   * @param task The task to check
   * @returns EnhancedRecurrencePattern or null if only legacy fields exist
   */
  private getEnhancedPatternFromTask(task: Task): EnhancedRecurrencePattern | null {
    if (task.recurrenceType) {
      return {
        type: task.recurrenceType as EnhancedRecurrencePattern['type'],
        interval: task.recurrencePattern?.interval ?? 1,
        dayOfWeek: task.recurrenceDayOfWeek as EnhancedRecurrencePattern['dayOfWeek'],
        ordinalWeek: task.recurrenceOrdinalWeek,
        endDate: task.recurrencePattern?.endDate,
      };
    }
    return null;
  }

  /**
   * Get task history with optional date range filtering.
   *
   * Returns completed tasks from the past `days` days (default 30).
   * (Requirements 6.1, 6.3)
   *
   * @param days Number of days to look back (default: 30)
   * @returns Promise<TaskHistory[]> Array of task history entries
   */
  async getTaskHistory(days: number = 30): Promise<TaskHistory[]> {
    return dbGetTaskHistory(days);
  }

  /**
   * Save a task as a TaskTemplate for future use.
   * Checks ALL templates (pre-populated and custom) using case-insensitive title
   * match via findTemplateByTitle. If a duplicate is found, increments usage count
   * instead of creating a new template.
   * (Requirements 5.3, 5.4)
   * @param task The task to save as a template
   * @param createdBy User ID of the template creator
   * @returns Promise<TaskTemplate> The created (or existing) template
   */
  private async saveAsTemplate(task: Task, createdBy: string): Promise<TaskTemplate> {
    // Check ALL templates (both pre-populated and custom) for case-insensitive title match
    const existing = await findTemplateByTitle(task.title);

    if (existing) {
      // Template already exists – increment usage count instead of creating a new one
      const updated = await incrementTemplateUsage(existing.id);
      return updated || existing;
    }

    return createTaskTemplate({
      title: task.title,
      description: task.description,
      isPrePopulated: false,
      createdBy,
    });
  }
}

// Export singleton instance
export const taskService = new TaskService();
