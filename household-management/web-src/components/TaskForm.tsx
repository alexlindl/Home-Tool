/**
 * TaskForm Component
 * Modal/dialog for creating or editing a task with autocomplete title input,
 * native date picker, RecurrenceSelector, notification lead time, and list selector.
 *
 * @version 0.7.0-alpha
 * Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.9, 4.1, 4.2, 5.6, 6.1, 6.2
 */

import React, { useState, useEffect } from 'react';
import type { Task, CreateTaskInput, UpdateTaskInput, User, EnhancedRecurrencePattern, TaskList } from '@/types';
import { taskApi, userApi, taskListApi } from '@/services/api';
import { TaskAutocomplete } from '@/components/TaskAutocomplete';
import { RecurrenceSelector } from '@/components/RecurrenceSelector';

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
  const [assignedTo, setAssignedTo] = useState<string>('anyone');
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [dueTime, setDueTime] = useState('09:00');
  const [timePreset, setTimePreset] = useState<TimePreset>('morning');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<EnhancedRecurrencePattern | null>({ type: 'every_n_days', interval: 1 });
  const [notificationLeadHours, setNotificationLeadHours] = useState<number | null>(null);
  const [wantNotification, setWantNotification] = useState(false);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [rotationEnabled, setRotationEnabled] = useState(false);
  const [rotationUserIds, setRotationUserIds] = useState<string[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [lists, setLists] = useState<TaskList[]>([]);
  const [selectedListId, setSelectedListId] = useState(listId || '');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isEditMode = !!editTask;

  useEffect(() => {
    if (open) {
      setFormError(null);
      userApi.getAllUsers().then(setUsers).catch(() => {});
      taskListApi.getAll().then(setLists).catch(() => {});
      // Reset selectedListId to prop value when form opens
      setSelectedListId(listId || '');
    }
  }, [open, listId]);

  // Pre-populate fields when editing
  useEffect(() => {
    if (editTask) {
      setTitle(editTask.title);
      setDescription(editTask.description || '');
      setAssignedTo(editTask.assignedTo ?? 'anyone');
      if (editTask.dueDate) {
        const d = new Date(editTask.dueDate);
        const datePart = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        setDueDate(datePart);
        const timePart = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
        setDueTime(timePart);
        setTimePreset(getPresetFromTime(timePart));
      } else {
        setDueDate(null);
        setDueTime('09:00');
        setTimePreset('morning');
      }
      setIsRecurring(editTask.isRecurring);
      if (editTask.recurrencePattern) {
        // Map legacy frequency to enhanced pattern for RecurrenceSelector
        const freq = editTask.recurrencePattern.frequency;
        if (freq === 'daily') {
          setRecurrencePattern({ type: 'every_n_days', interval: editTask.recurrencePattern.interval || 1 });
        } else if (freq === 'weekly') {
          setRecurrencePattern({ type: 'every_n_days', interval: (editTask.recurrencePattern.interval || 1) * 7 });
        } else {
          setRecurrencePattern({ type: 'every_n_days', interval: 1 });
        }
      } else if (editTask.recurrenceType && editTask.recurrenceInterval) {
        // Enhanced pattern: use recurrenceType and recurrenceInterval directly
        setRecurrencePattern({
          type: editTask.recurrenceType as 'every_n_days' | 'every_n_months' | 'every_n_years',
          interval: editTask.recurrenceInterval,
        });
      } else {
        setRecurrencePattern(null);
      }
      setNotificationLeadHours(editTask.notificationLeadHours ?? null);
      setWantNotification(editTask.notificationLeadHours != null && editTask.notificationLeadHours >= 0);
      setRotationEnabled(editTask.rotationEnabled ?? false);
      setRotationUserIds(editTask.rotationUserIds ?? []);
    } else {
      resetForm();
    }
  }, [editTask]);

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
    if (!title.trim()) return;

    // Rotation validation
    if (rotationEnabled && !isRecurring) {
      setFormError('Rotation can only be enabled on recurring tasks.');
      return;
    }
    if (rotationEnabled && rotationUserIds.length < 2) {
      setFormError('At least 2 users must be selected for rotation.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      // Resolve assignedTo: "anyone" sentinel → null for API
      const resolvedAssignedTo = assignedTo === 'anyone' ? null : assignedTo;
      // Combine date and time into full ISO timestamp, or null if no due date
      const fullDueDate = dueDate ? combineDateAndTime(dueDate, dueTime) : null;

      if (isEditMode && editTask) {
        // Update existing task
        const input: UpdateTaskInput = {
          title: title.trim(),
          description: description.trim() || undefined,
          assignedTo: resolvedAssignedTo ?? undefined,
          dueDate: fullDueDate, // explicit null clears due date
          isRecurring,
          rotationEnabled,
          rotationUserIds: rotationEnabled ? rotationUserIds : [],
          rotationCurrentIndex: rotationEnabled ? (editTask.rotationCurrentIndex ?? 0) : 0,
        };
        if (isRecurring && recurrencePattern) {
          input.recurrencePattern = recurrencePattern;
        } else {
          input.recurrencePattern = null; // explicitly clear recurrence when not recurring
        }
        if (wantNotification && notificationLeadHours !== null) {
          input.notificationLeadHours = notificationLeadHours;
        } else {
          input.notificationLeadHours = 0;
        }
        const updatedTask = await taskApi.updateTask(editTask.id, input);
        onCreated(updatedTask);
      } else {
        // Create new task
        const input: CreateTaskInput & { createdBy: string } = {
          title: title.trim(),
          description: description.trim() || undefined,
          assignedTo: resolvedAssignedTo,
          dueDate: fullDueDate,
          isRecurring,
          createdBy: currentUserId,
          rotationEnabled: rotationEnabled || undefined,
          rotationUserIds: rotationEnabled ? rotationUserIds : undefined,
          rotationCurrentIndex: rotationEnabled ? 0 : undefined,
        };
        if (isRecurring && recurrencePattern) {
          input.recurrencePattern = recurrencePattern;
        }
        if (wantNotification && notificationLeadHours !== null) {
          input.notificationLeadHours = notificationLeadHours;
        }
        if (saveAsTemplate) {
          input.saveAsTemplate = true;
        }
        // Use selectedListId (from dropdown) instead of listId prop
        const effectiveListId = selectedListId || listId;
        const payload = effectiveListId ? { ...input, listId: effectiveListId } : input;
        const task = await taskApi.createTask(payload as CreateTaskInput & { createdBy: string });
        onCreated(task);
      }
      resetForm();
      onClose();
    } catch (err: unknown) {
      let message = 'Something went wrong. Please try again.';
      if (err && typeof err === 'object' && 'response' in err) {
        const resp = (err as { response?: { data?: { error?: string; message?: string } } }).response;
        if (resp?.data?.error) message = resp.data.error;
        else if (resp?.data?.message) message = resp.data.message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      setFormError(message);
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
    } catch (err: unknown) {
      let message = 'Failed to delete task. Please try again.';
      if (err instanceof Error) message = err.message;
      setFormError(message);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setAssignedTo('anyone');
    setDueDate(null);
    setDueTime('09:00');
    setTimePreset('morning');
    setIsRecurring(false);
    setRecurrencePattern({ type: 'every_n_days', interval: 1 });
    setNotificationLeadHours(null);
    setWantNotification(false);
    setSaveAsTemplate(false);
    setRotationEnabled(false);
    setRotationUserIds([]);
    setFormError(null);
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
          <div className="form-group">
            <label htmlFor="task-title">Title *</label>
            <TaskAutocomplete
              value={title}
              onChange={(val) => { setTitle(val); setFormError(null); }}
              placeholder="Enter task title"
            />
          </div>

          {!isEditMode && lists.length > 0 && (
            <div className="form-group">
              <label htmlFor="task-list">List</label>
              <select
                id="task-list"
                value={selectedListId}
                onChange={(e) => setSelectedListId(e.target.value)}
              >
                {!selectedListId && <option value="">Select a list...</option>}
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          )}

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
            <label htmlFor="task-assignee">Assign To</label>
            <select
              id="task-assignee"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
            >
              <option value="anyone">👥 Anyone</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="task-due-date">Due Date (optional)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                id="task-due-date"
                type="date"
                value={dueDate ?? ''}
                onChange={(e) => setDueDate(e.target.value || null)}
                style={{ flex: 1 }}
              />
              {dueDate && (
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => {
                    setDueDate(null);
                    setDueTime('09:00');
                    setTimePreset('morning');
                    if (isRecurring) {
                      setIsRecurring(false);
                      setRecurrencePattern(null);
                      setRotationEnabled(false);
                    }
                  }}
                  aria-label="Clear due date"
                  style={{ padding: '4px 8px', fontSize: '1rem', lineHeight: 1 }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {dueDate && (
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
          )}

          <div className="form-group form-group--inline">
            <label htmlFor="task-recurring">
              <input
                id="task-recurring"
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsRecurring(checked);
                  if (!checked) {
                    setRotationEnabled(false);
                  }
                }}
              />
              Recurring task
            </label>
          </div>

          {isRecurring && !dueDate && (
            <p className="form-warning" style={{ color: 'var(--color-warning, #e67e22)', fontSize: '0.8rem', margin: '-8px 0 8px 0' }}>
              Recurring tasks require a due date
            </p>
          )}

          {isRecurring && (
            <div className="form-group">
              <label>Recurrence Pattern</label>
              <RecurrenceSelector
                value={recurrencePattern}
                onChange={setRecurrencePattern}
              />
            </div>
          )}

          {isRecurring && (
            <div className="form-group form-group--inline">
              <label htmlFor="task-rotation-enabled">
                <input
                  id="task-rotation-enabled"
                  type="checkbox"
                  checked={rotationEnabled}
                  onChange={(e) => setRotationEnabled(e.target.checked)}
                />
                Rotate assignment between users
              </label>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem', margin: '2px 0 0 24px' }}>
                Each time this task recurs, it assigns to the next person in the list
              </p>
            </div>
          )}

          {isRecurring && rotationEnabled && (
            <div className="form-group">
              <label>Rotation Users (select at least 2)</label>
              <div className="rotation-user-checkboxes" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {users.map((u) => (
                  <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}>
                    <input
                      type="checkbox"
                      checked={rotationUserIds.includes(u.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setRotationUserIds((prev) => [...prev, u.id]);
                        } else {
                          setRotationUserIds((prev) => prev.filter((id) => id !== u.id));
                        }
                      }}
                    />
                    {u.name}
                  </label>
                ))}
              </div>
              {rotationUserIds.length < 2 && (
                <p className="form-error" style={{ color: 'var(--color-danger, #e74c3c)', fontSize: '0.8rem', margin: '4px 0 0 0' }}>
                  At least 2 users must be selected for rotation
                </p>
              )}
            </div>
          )}

          <div className="form-group form-group--inline">
            <label htmlFor="task-want-notification">
              <input
                id="task-want-notification"
                type="checkbox"
                checked={wantNotification}
                onChange={(e) => {
                  setWantNotification(e.target.checked);
                  if (!e.target.checked) {
                    setNotificationLeadHours(null);
                  } else if (notificationLeadHours === null) {
                    setNotificationLeadHours(0);
                  }
                }}
              />
              Notify me before due date
            </label>
          </div>

          {wantNotification && (
            <div className="form-group">
              <label htmlFor="task-notification-lead">Notify before (hours)</label>
              <input
                id="task-notification-lead"
                type="number"
                min={0}
                value={notificationLeadHours ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setNotificationLeadHours(val === '' ? null : Math.max(0, parseInt(val) || 0));
                }}
                placeholder="0 = when due"
                style={{ width: '120px' }}
              />
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

          {formError && (
            <p className="form-error" style={{ color: 'var(--color-danger, #e74c3c)', fontSize: '0.85rem', margin: '0 0 8px 0' }}>
              {formError}
            </p>
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
              disabled={submitting || !title.trim()}
            >
              {submitting ? (isEditMode ? 'Saving...' : 'Creating...') : (isEditMode ? 'Save Changes' : 'Create Task')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
