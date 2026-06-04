/**
 * ListSelector Component
 * Dropdown to select and manage lists (task lists or shopping lists).
 * Shows available lists, a "Create New List" option, and per-list rename/delete actions.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { taskListApi, shoppingListApi } from '@/services/api';
import type { TaskList, ShoppingList } from '@/types';

type ListType = 'task' | 'shopping';
type ListItem = TaskList | ShoppingList;

interface ListSelectorProps {
  type: ListType;
  selectedId: string;
  onSelect: (id: string) => void;
  onRefresh: () => void;
  showAllOption?: boolean;
}

export const ListSelector: React.FC<ListSelectorProps> = ({
  type,
  selectedId,
  onSelect,
  onRefresh,
  showAllOption = false,
}) => {
  const [lists, setLists] = useState<ListItem[]>([]);
  const [open, setOpen] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const api = type === 'task' ? taskListApi : shoppingListApi;

  const fetchLists = useCallback(async () => {
    try {
      const data = await api.getAll();
      setLists(data);
    } catch {
      // Silently handle errors
    }
  }, [api]);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setMenuOpenId(null);
        setCreating(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedList = lists.find((l) => l.id === selectedId);
  const displayName = selectedId === 'all'
    ? 'All Lists'
    : selectedList?.name || 'Select List';

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const list = await api.create(newName.trim());
      setNewName('');
      setCreating(false);
      await fetchLists();
      onSelect(list.id);
      onRefresh();
    } catch {
      // Silently handle errors
    }
  };

  const handleRename = async (id: string) => {
    if (!renameValue.trim()) return;
    try {
      await api.update(id, renameValue.trim());
      setRenamingId(null);
      await fetchLists();
      onRefresh();
    } catch {
      // Silently handle errors
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.remove(id);
      await fetchLists();
      // If we deleted the selected list, switch to default
      if (id === selectedId) {
        const defaultList = lists.find((l) => l.isDefault && l.id !== id);
        if (defaultList) {
          onSelect(defaultList.id);
        }
      }
      onRefresh();
    } catch {
      // Silently handle errors
    }
  };

  return (
    <div className="list-selector" ref={dropdownRef}>
      <button
        className="list-selector-trigger"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="list-selector-label">{displayName}</span>
        <span className="list-selector-chevron">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="list-selector-dropdown" role="listbox">
          {showAllOption && (
            <button
              className={`list-selector-item ${selectedId === 'all' ? 'list-selector-item--active' : ''}`}
              onClick={() => { onSelect('all'); setOpen(false); }}
              role="option"
              aria-selected={selectedId === 'all'}
            >
              <span className="list-selector-item-name">All Lists</span>
            </button>
          )}

          {lists.map((list) => (
            <div key={list.id} className="list-selector-item-row">
              {renamingId === list.id ? (
                <div className="list-selector-rename">
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(list.id);
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    autoFocus
                  />
                  <button className="btn btn--primary" onClick={() => handleRename(list.id)}>Save</button>
                  <button className="btn btn--secondary" onClick={() => setRenamingId(null)}>✕</button>
                </div>
              ) : (
                <>
                  <button
                    className={`list-selector-item ${selectedId === list.id ? 'list-selector-item--active' : ''}`}
                    onClick={() => { onSelect(list.id); setOpen(false); }}
                    role="option"
                    aria-selected={selectedId === list.id}
                  >
                    <span className="list-selector-item-name">
                      {list.name}
                      {list.isDefault && <span className="list-selector-badge">default</span>}
                    </span>
                  </button>
                  <button
                    className="list-selector-menu-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId(menuOpenId === list.id ? null : list.id);
                    }}
                    aria-label={`Actions for ${list.name}`}
                  >
                    ⋯
                  </button>
                  {menuOpenId === list.id && (
                    <div className="list-selector-actions">
                      <button
                        className="list-selector-action"
                        onClick={() => {
                          setRenamingId(list.id);
                          setRenameValue(list.name);
                          setMenuOpenId(null);
                        }}
                      >
                        Rename
                      </button>
                      {!list.isDefault && (
                        <button
                          className="list-selector-action list-selector-action--danger"
                          onClick={() => { handleDelete(list.id); setMenuOpenId(null); }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}

          {creating ? (
            <div className="list-selector-create-form">
              <input
                type="text"
                placeholder="List name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') setCreating(false);
                }}
                autoFocus
              />
              <button className="btn btn--primary" onClick={handleCreate} disabled={!newName.trim()}>
                Add
              </button>
              <button className="btn btn--secondary" onClick={() => setCreating(false)}>
                ✕
              </button>
            </div>
          ) : (
            <button
              className="list-selector-item list-selector-item--create"
              onClick={() => setCreating(true)}
            >
              + Create New List
            </button>
          )}
        </div>
      )}
    </div>
  );
};
