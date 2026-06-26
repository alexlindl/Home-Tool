/**
 * TaskForm Component
 * Modal/dialog for creating or editing a task with template selection.
 *
 * Requirements: 4.1, 6.1, 14.1, 14.2, 14.3, 14.4, 14.5
 * Requirements: 3.1, 3.2, 3.3 (time picker)
 */

import React, { useState, useEffect } from 'react';
import type { Task, TaskTemplate, CreateTaskInput, UpdateTaskInput, User } from '@/types';
import { taskApi, userApi } from '@/services/api';

type TimePreset = 'morning' | 'noon' | 'afternoon' | 'evening' | 'custom';

const TIME_PRESETS: { key: TimePreset; label: string; time: string }[] = [
  { key: 'morning', label: 'Morning', time: '09:00' },
  { key: 'noon', label: 'Noon', time: '12:00' },
  { key: 'afternoon', label: 'Afternoon', time: '15:00' },
  { key: 'evening', label: 'Evening', time: '18:00' },
  { key: 'custom', label: 'Custom', time: '' },
];

/**
 * Combines a date string (YYYY-MM-DD) and a time string (HH:MM) into an ISO timestamp.
 * Used to produce the full due date+time for the API.
 */
export function combineDateAndTime(date: string, time: string): string {
  return `${date}T${time}:00`;
}

/**
 * Extracts the time preset from a time string (HH:MM).
 * Returns the matching preset key or 'custom' if no preset matches.
 */
function getPresetFromTime(time: string): TimePreset {
  const match = TIME_PRESETS.find((p) => p.key !== 'custom' && p.time === time);
  return match ? match.key : 'custom';
}

interface TaskFormProps {
  open: boolean;
  onClose: () => void;
  onCreated: (task: Task) => void;
  onDeleted?: () => void;
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
  onDeleted,
  currentUserId,
  editTask,
  listId,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('09:00');
  const [timePreset, setTimePreset] = useState<TimePreset>('morning');
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
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
      setAssignedTo(editTask.assignedTo ?? 'anyone');
      if (editTask.dueDate) {
        const datePart = editTask.dueDate.split('T')[0] ?? '';
        setDueDate(datePart);
        // Extract time from ISO string (e.g. "2024-01-15T15:00:00" → "15:00")
        const timePart = editTask.dueDate.split('T')[1]?.slice(0, 5) || '09:00';
        setDueTime(timePart);
        setTimePreset(getPresetFromTime(timePart));
      } else {
        setDueDate('');
        setDueTime('09:00');
        setTimePreset('morning');
      }
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

  const handleTimePresetSelect = (preset: TimePreset) => {
    setTimePreset(preset);
    if (preset !== 'custom') {
      const presetConfig = TIME_PRESETS.find((p) => p.key === preset);
      if (presetConfig) {
        setDueTime(presetConfig.time);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate) return;
    // "anyone" is a valid selection, so only block if nothing is selected at all
    if (assignedTo === '') return;

    setSubmitting(true);
    try {
      // Resolve assignedTo: "anyone" sentinel → null for API
      const resolvedAssignedTo = assignedTo === 'anyone' ? null : assignedTo;
      // Combine date and time into full ISO timestamp
      const fullDueDate = combineDateAndTime(dueDate, dueTime);

      if (isEditMode && editTask) {
        // Update existing task
        const input: UpdateTaskInput = {
          title: title.trim(),
          description: description.trim() || undefined,
          assignedTo: resolvedAssignedTo ?? undefined,
          dueDate: fullDueDate,
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
          assignedTo: resolvedAssignedTo,
          dueDate: fullDueDate,
          isRecurring,
          createdBy: currentUserId,
          listId: listId || undefined,
        };
        if (isRecurring) {
          input.recurrenceFrequency = frequency;
          input.recurrenceInterval = 1;
        }
        if (saveAsTemplate) {
          input.saveAsTemplate = true;
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

  const handleDelete = async () => {
    if (!editTask) return;
    if (!window.confirm('Are you sure you want to delete this task? This cannot be undone.')) return;
    try {
      await taskApi.deleteTask(editTask.id);
      onClose();
      if (onDeleted) onDeleted();
    } catch {
      // silently fail
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setAssignedTo('');
    setDueDate('');
    setDueTime('09:00');
    setTimePreset('morning');
    setIsRecurring(false);
    setFrequency('weekly');
    setSaveAsTemplate(false);
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
              <option value="anyone">👥 Anyone</option>
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

          <div className="form-group">
            <label>Time</label>
            <div className="time-preset-chips">
              {TIME_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  className={`time-preset-chip${timePreset === preset.key ? ' time-preset-chip--active' : ''}`}
                  onClick={() => handleTimePresetSelect(preset.key)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {timePreset === 'custom' && (
              <input
                id="task-due-time"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="time-custom-input"
              />
            )}
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

          {!isEditMode && (
            <div className="form-group form-group--inline">
              <label htmlFor="task-save-template">
                <input
                  id="task-save-template"
                  type="checkbox"
                  checked={saveAsTemplate}
                  onChange={(e) => setSaveAsTemplate(e.target.checked)}
                />
                Save as template
              </label>
            </div>
          )}

          <div className="form-actions">
            {isEditMode && (
              <button type="button" className="btn btn--secondary settings-btn-danger" onClick={handleDelete}>
                🗑️ Delete
              </button>
            )}
            <button type="button" className="btn btn--secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={submitting || !title.trim() || assignedTo === '' || !dueDate}
            >
              {submitting ? (isEditMode ? 'Saving...' : 'Creating...') : (isEditMode ? 'Save Changes' : 'Create Task')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
