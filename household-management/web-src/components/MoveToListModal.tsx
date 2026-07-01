/**
 * MoveToListModal Component
 * Shows a modal list picker for moving a task or shopping item to another list.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */

import React, { useState, useEffect } from 'react';
import { taskListApi, shoppingListApi } from '@/services/api';
import type { TaskList, ShoppingList } from '@/types';

type ListType = 'task' | 'shopping';
type ListItem = TaskList | ShoppingList;

interface MoveToListModalProps {
  open: boolean;
  type: ListType;
  currentListId: string;
  itemName: string;
  onSelect: (targetListId: string, targetListName: string) => void;
  onClose: () => void;
}

export const MoveToListModal: React.FC<MoveToListModalProps> = ({
  open,
  type,
  currentListId,
  itemName,
  onSelect,
  onClose,
}) => {
  const [lists, setLists] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const api = type === 'task' ? taskListApi : shoppingListApi;
    api.getAll()
      .then((data) => {
        setLists(data.filter((l) => l.id !== currentListId));
      })
      .catch(() => {
        setLists([]);
      })
      .finally(() => setLoading(false));
  }, [open, type, currentListId]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content move-to-list-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Move "${itemName}" to list`}
      >
        <div className="modal-header">
          <h3>Move to list</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">
          {loading && <div className="loading-state">Loading lists...</div>}
          {!loading && lists.length === 0 && (
            <div className="empty-state">
              <p>No other lists available.</p>
            </div>
          )}
          {!loading && lists.length > 0 && (
            <div className="move-to-list-options">
              {lists.map((list) => (
                <button
                  key={list.id}
                  className="move-to-list-option"
                  onClick={() => onSelect(list.id, list.name)}
                >
                  <span className="move-to-list-option-name">{list.name}</span>
                  {list.isDefault && (
                    <span className="move-to-list-option-badge">default</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
