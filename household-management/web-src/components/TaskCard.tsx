/**
 * TaskCard Component
 * Displays a task with completion checkbox, title, due date, assignee badge,
 * and action menu with edit and move options.
 * Supports expandable inline detail panel on title click.
 *
 * Requirements: 4.1, 4.2, 2.5, 3.4, 3.5, 3.7, 14.1, 14.3, 14.4, 14.5, 14.6
 */

import React, { useState, useRef, useEffect } from 'react';
import type { Task } from '@/types';
import { UserBadge } from './UserBadge';

interface TaskCardProps {
  task: Task;
  onComplete: (taskId: string) => void;
  onEdit?: (task: Task) => void;
  onMoveToList?: (task: Task) => void;
  /** Whether other lists exist (to show/hide move option) */
  canMove?: boolean;
  /** Map of user IDs to display names */
  userNames?: Record<string, string>;
  isCurrentUser?: boolean;
  /** Whether this task's detail panel is expanded */
  isExpanded?: boolean;
  /** Callback to toggle expand/collapse of the detail panel */
  onToggleExpand?: (taskId: string) => void;
}

export function getTaskStatus(dueDate: string | null): 'overdue' | 'due-today' | 'normal' {
  if (!dueDate) return 'normal'; // Backlog tasks are never overdue
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

export function formatTaskDate(dateStr: string | null): string {
  if (!dateStr) return 'No due date';
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

/** Format recurrence pattern for display */
function formatRecurrence(task: Task): string | null {
  if (!task.isRecurring) return null;

  if (task.recurrenceType && task.recurrenceInterval) {
    const interval = task.recurrenceInterval;
    switch (task.recurrenceType) {
      case 'every_n_days':
        return interval === 1 ? 'Every day' : `Every ${interval} days`;
      case 'every_n_weeks_on_day':
        return interval === 1 ? 'Every week' : `Every ${interval} weeks`;
      case 'every_n_months':
        return interval === 1 ? 'Every month' : `Every ${interval} months`;
      case 'every_n_years':
        return interval === 1 ? 'Every year' : `Every ${interval} years`;
      case 'every_specific_day':
        return 'Every specific day';
      case 'every_nth_day':
        return `Every ${interval}th day of month`;
      default:
        return 'Recurring';
    }
  }

  if (task.recurrencePattern) {
    const pattern = task.recurrencePattern;
    const interval = pattern.interval;
    switch (pattern.frequency) {
      case 'daily':
        return interval === 1 ? 'Every day' : `Every ${interval} days`;
      case 'weekly':
        return interval === 1 ? 'Every week' : `Every ${interval} weeks`;
      case 'monthly':
        return interval === 1 ? 'Every month' : `Every ${interval} months`;
      default:
        return 'Recurring';
    }
  }

  return 'Recurring';
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onComplete,
  onEdit,
  onMoveToList,
  canMove = false,
  userNames = {},
  isCurrentUser = false,
  isExpanded = false,
  onToggleExpand,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const status = getTaskStatus(task.dueDate);
  const isAnyone = task.assignedTo === null;
  const assigneeName = isAnyone ? 'Anyone' : (userNames[task.assignedTo!] || task.assignedTo!);

  const cardClass = [
    'task-card-wrapper',
    isExpanded ? 'task-card-wrapper--expanded' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const innerCardClass = [
    'task-card',
    `task-card--${status}`,
    isCurrentUser ? 'task-card--mine' : '',
  ]
    .filter(Boolean)
    .join(' ');

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const showMenu = onEdit || (onMoveToList && canMove);

  const handleTitleClick = () => {
    if (onToggleExpand) {
      onToggleExpand(task.id);
    }
  };

  // Build detail fields — only show non-null, non-empty values
  const detailFields: { label: string; value: string }[] = [];

  if (task.description && task.description.trim()) {
    detailFields.push({ label: 'Description', value: task.description });
  }

  if (task.dueDate) {
    detailFields.push({ label: 'Due Date', value: formatTaskDate(task.dueDate) });
  }

  const recurrenceText = formatRecurrence(task);
  if (recurrenceText) {
    detailFields.push({ label: 'Recurrence', value: recurrenceText });
  }

  if (task.assignedTo) {
    const name = userNames[task.assignedTo] || task.assignedTo;
    detailFields.push({ label: 'Assigned To', value: name });
  }

  if (task.createdAt) {
    const createdDate = new Date(task.createdAt).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    detailFields.push({ label: 'Created', value: createdDate });
  }

  return (
    <div className={cardClass}>
      <div className={innerCardClass} role="article" aria-label={`Task: ${task.title}`}>
        <label className="task-card-checkbox">
          <input
            type="checkbox"
            onChange={() => onComplete(task.id)}
            aria-label={`Complete task: ${task.title}`}
          />
          <span className="task-card-checkmark" />
        </label>
        <div className="task-card-body">
          <span
            className="task-card-title task-card-title--clickable"
            onClick={handleTitleClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleTitleClick(); }}
            aria-expanded={isExpanded}
            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} details for ${task.title}`}
          >
            {task.title}
          </span>
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
        {showMenu && (
          <div className="task-card-actions" ref={menuRef}>
            <button
              className="task-card-menu-btn"
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
              aria-label="Task actions"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              ⋮
            </button>
            {menuOpen && (
              <div className="task-card-menu" role="menu">
                {onEdit && (
                  <button
                    className="task-card-menu-item"
                    role="menuitem"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onEdit(task);
                    }}
                  >
                    ✏️ Edit
                  </button>
                )}
                {onMoveToList && canMove && (
                  <button
                    className="task-card-menu-item"
                    role="menuitem"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onMoveToList(task);
                    }}
                  >
                    📋 Move to list
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expandable detail panel */}
      <div className={`task-card-detail-panel ${isExpanded ? 'task-card-detail-panel--open' : ''}`}>
        <div className="task-card-detail-content">
          {detailFields.map((field) => (
            <div key={field.label} className="task-card-detail-field">
              <span className="task-card-detail-label">{field.label}</span>
              <span className="task-card-detail-value">{field.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
