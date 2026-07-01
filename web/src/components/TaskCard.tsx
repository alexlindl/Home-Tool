/**
 * TaskCard Component
 * Displays a task with completion checkbox, title, due date, assignee badge,
 * and action menu with edit and move options.
 *
 * Requirements: 4.1, 4.2, 2.5, 3.4, 3.5, 3.7
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

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onComplete,
  onEdit,
  onMoveToList,
  canMove = false,
  userNames = {},
  isCurrentUser = false,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const status = getTaskStatus(task.dueDate);
  const isAnyone = task.assignedTo === null;
  const assigneeName = isAnyone ? 'Anyone' : (userNames[task.assignedTo!] || task.assignedTo!);

  const cardClass = [
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
  );
};
