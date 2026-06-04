/**
 * TaskCard Component
 * Displays a task with completion checkbox, title, due date, and assignee badge.
 *
 * Requirements: 4.1, 4.2
 */

import React from 'react';
import type { Task } from '@/types';
import { UserBadge } from './UserBadge';

interface TaskCardProps {
  task: Task;
  onComplete: (taskId: string) => void;
  onEdit?: (task: Task) => void;
  /** Map of user IDs to display names */
  userNames?: Record<string, string>;
  isCurrentUser?: boolean;
}

function getTaskStatus(dueDate: string): 'overdue' | 'due-today' | 'normal' {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  if (due < today) return 'overdue';
  if (due.getTime() === today.getTime()) return 'due-today';
  return 'normal';
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onComplete,
  onEdit,
  userNames = {},
  isCurrentUser = false,
}) => {
  const status = getTaskStatus(task.dueDate);
  const assigneeName = userNames[task.assignedTo] || task.assignedTo;

  const cardClass = [
    'task-card',
    `task-card--${status}`,
    isCurrentUser ? 'task-card--mine' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cardClass} role="article" aria-label={`Task: ${task.title}`}>
      <label className="task-card-checkbox">
        <input
          type="checkbox"
          onChange={() => onComplete(task.id)}
          aria-label={`Complete task: ${task.title}`}
        />
        <span className="task-card-checkmark" />
      </label>
      <div className="task-card-body">
        <span className="task-card-title">{task.title}</span>
        <span className="task-card-meta">
          <span className="task-card-date">{formatDate(task.dueDate)}</span>
          {task.isRecurring && (
            <span className="task-card-recurring" title="Recurring task">
              🔄
            </span>
          )}
        </span>
      </div>
      <div className="task-card-assignee">
        <UserBadge userName={assigneeName} size="sm" />
      </div>
      {onEdit && (
        <button
          className="task-card-edit"
          onClick={(e) => { e.stopPropagation(); onEdit(task); }}
          aria-label="Edit task"
        >
          ✏️
        </button>
      )}
    </div>
  );
};
