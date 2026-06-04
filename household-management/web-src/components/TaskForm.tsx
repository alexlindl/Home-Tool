/**
 * TaskForm Component
 * Modal/dialog for creating or editing a task with template selection.
 *
 * Requirements: 4.1, 6.1, 14.1, 14.2, 14.3, 14.4, 14.5
 */

import React, { useState, useEffect } from 'react';
import type { Task, TaskTemplate, CreateTaskInput, UpdateTaskInput, User } from '@/types';
import { taskApi, userApi } from '@/services/api';

interface TaskFormProps {
  open: boolean;
  onClose: () => void;
  onCreated: (task: Task) => void;
  currentUserId: string;
  /** When provided, the form operates in edit mode with pre-populated fields */
  editTask?: Task | null;
  /** Optional list ID to assign the task to */
  listId?: string;
}

export const TaskForm: React.FC<TaskFormProps> = ({
  open,
  onClose,
  onCreated,
  currentUserId,
  editTask,
  listId,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const isEditMode = !!editTask;

  useEffect(() => {
    if (open) {
      taskApi.getTemplates().then(setTemplates).catch(() => {});
      userApi.getAllUsers().then(setUsers).catch(() => {});
    }
  }, [open]);

  // Pre-populate fields when editing
  useEffect(() => {
    if (editTask) {
      setTitle(editTask.title);
      setDescription(editTask.description || '');
      setAssignedTo(editTask.assignedTo);
      setDueDate(editTask.dueDate ? editTask.dueDate.split('T')[0] ?? '' : '');
      setIsRecurring(editTask.isRecurring);
      if (editTask.recurrencePattern) {
        setFrequency(editTask.recurrencePattern.frequency);
      }
    } else {
      resetForm();
    }
  }, [editTask]);

  const handleTemplateSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tmpl = templates.find((t) => t.id === e.target.value);
    if (tmpl) {
      setTitle(tmpl.title);
      setDescription(tmpl.description || '');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !assignedTo || !dueDate) return;

    setSubmitting(true);
    try {
      if (isEditMode && editTask) {
        // Update existing task
        const input: UpdateTaskInput = {
          title: title.trim(),
          description: description.trim() || undefined,
          assignedTo,
          dueDate,
          isRecurring,
        };
        if (isRecurring) {
          input.recurrencePattern = {
            frequency,
            interval: editTask.recurrencePattern?.interval || 1,
          };
        }
        const updatedTask = await taskApi.updateTask(editTask.id, input);
        onCreated(updatedTask);
      } else {
        // Create new task
        const input: Record<string, unknown> = {
          title: title.trim(),
          description: description.trim() || undefined,
          assignedTo,
          dueDate,
          isRecurring,
          createdBy: currentUserId,
          listId: listId || undefined,
        };
        if (isRecurring) {
          input.recurrenceFrequency = frequency;
          input.recurrenceInterval = 1;
        }
        const task = await taskApi.createTask(input as unknown as CreateTaskInput & { createdBy: string });
        onCreated(task);
      }
      resetForm();
      onClose();
    } catch {
      // Error handling could show a toast
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setAssignedTo('');
    setDueDate('');
    setIsRecurring(false);
    setFrequency('weekly');
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-label={isEditMode ? 'Edit task' : 'Create task'}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditMode ? 'Edit Task' : 'New Task'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="task-form">
          {!isEditMode && templates.length > 0 && (
            <div className="form-group">
              <label htmlFor="task-template">Template</label>
              <select id="task-template" onChange={handleTemplateSelect} defaultValue="">
                <option value="" disabled>
                  Select a template...
                </option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="task-title">Title *</label>
            <input
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="task-description">Description</label>
            <textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label htmlFor="task-assignee">Assign To *</label>
            <select
              id="task-assignee"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              required
            >
              <option value="" disabled>
                Select person...
              </option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="task-due-date">Due Date *</label>
            <input
              id="task-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group form-group--inline">
            <label htmlFor="task-recurring">
              <input
                id="task-recurring"
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
              />
              Recurring task
            </label>
          </div>

          {isRecurring && (
            <div className="form-group">
              <label htmlFor="task-frequency">Frequency</label>
              <select
                id="task-frequency"
                value={frequency}
                onChange={(e) =>
                  setFrequency(e.target.value as 'daily' | 'weekly' | 'monthly')
                }
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={submitting || !title.trim() || !assignedTo || !dueDate}
            >
              {submitting ? (isEditMode ? 'Saving...' : 'Creating...') : (isEditMode ? 'Save Changes' : 'Create Task')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
