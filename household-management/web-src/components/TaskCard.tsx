/**
 * TaskCard Component
 * Displays a task with completion checkbox, title, due date, and assignee badge.
 *
 * Requirements: 4.1, 4.2, 2.5, 3.4, 3.5, 3.7
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

export function getTaskStatus(dueDate: string): 'overdue' | 'due-today' | 'normal' {
  const now = new Date();
  const due = new Date(dueDate);

  if (due < now) return 'overdue';

  // Check if same calendar day
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  if (due >= todayStart && due <= todayEnd) return 'due-today';
  return 'normal';
}

export function formatTaskDate(dateStr: string): string {
  const date = new Date(dateStr);
  const hours = date.getHours();
  const minutes = date.getMinutes();

  // Only show time if it's not the default 09:00
  const isDefaultTime = hours === 9 && minutes === 0;
  const dateFormatted = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  if (isDefaultTime) {
    return dateFormatted;
  }

  const timeFormatted = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return `${dateFormatted} at ${timeFormatted}`;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onComplete,
  onEdit,
  userNames = {},
  isCurrentUser = false,
}) => {
  const status = getTaskStatus(task.dueDate);
  const isAnyone = task.assignedTo === null;
  const assigneeName = isAnyone ? 'Anyone' : (userNames[task.assignedTo] || task.assignedTo);

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
          <span className="task-card-date">{formatTaskDate(task.dueDate)}</span>
          {task.isRecurring && (
            <span className="task-card-recurring" title="Recurring task">
              🔄
            </span>
          )}
        </span>
      </div>
      <div className="task-card-assignee">
        {isAnyone ? (
          <span className="task-card-anyone-badge" aria-label="Anyone avatar">👥 Anyone</span>
        ) : (
          <UserBadge userName={assigneeName} size="sm" />
        )}
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
