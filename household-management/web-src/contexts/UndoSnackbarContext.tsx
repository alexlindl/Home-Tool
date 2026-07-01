/**
 * UndoSnackbar Context
 * Provides a shared snackbar for undo actions (complete/purchase).
 * Queue behavior: new action immediately commits previous (no longer undoable), replaces snackbar.
 *
 * Requirements: 10.1, 10.2, 10.4, 10.5, 10.6, 10.7, 10.8
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

export interface UndoSnackbarOptions {
  itemName: string;
  actionDescription: string;
  onUndo: () => Promise<void>;
}

interface UndoSnackbarState {
  visible: boolean;
  itemName: string;
  actionDescription: string;
  undoCallback: (() => Promise<void>) | null;
  error: string | null;
  undoing: boolean;
}

interface UndoSnackbarContextValue {
  state: UndoSnackbarState;
  showUndo: (options: UndoSnackbarOptions) => void;
  dismiss: () => void;
  performUndo: () => void;
}

const initialState: UndoSnackbarState = {
  visible: false,
  itemName: '',
  actionDescription: '',
  undoCallback: null,
  error: null,
  undoing: false,
};

const UndoSnackbarContext = createContext<UndoSnackbarContextValue | null>(null);

/**
 * Truncates item name to 40 characters with ellipsis if longer.
 */
export function truncateItemName(name: string): string {
  if (name.length <= 40) return name;
  return name.slice(0, 40) + '\u2026';
}

const UNDO_WINDOW_MS = 5000;

export function UndoSnackbarProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<UndoSnackbarState>(initialState);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearTimer();
    setState(initialState);
  }, [clearTimer]);

  const showUndo = useCallback((options: UndoSnackbarOptions) => {
    // Queue behavior: new action immediately commits previous (no longer undoable)
    // We simply replace — the previous action is already committed on the backend
    clearTimer();

    setState({
      visible: true,
      itemName: options.itemName,
      actionDescription: options.actionDescription,
      undoCallback: options.onUndo,
      error: null,
      undoing: false,
    });

    // Auto-dismiss after 5 seconds
    timerRef.current = setTimeout(() => {
      setState(initialState);
    }, UNDO_WINDOW_MS);
  }, [clearTimer]);

  const performUndo = useCallback(async () => {
    if (!state.undoCallback || state.undoing) return;

    setState((prev) => ({ ...prev, undoing: true, error: null }));
    clearTimer();

    try {
      await state.undoCallback();
      setState(initialState);
    } catch {
      setState((prev) => ({
        ...prev,
        undoing: false,
        error: 'Could not undo \u2014 item remains completed/purchased',
      }));
      // Auto-dismiss error after 3 seconds
      timerRef.current = setTimeout(() => {
        setState(initialState);
      }, 3000);
    }
  }, [state.undoCallback, state.undoing, clearTimer]);

  const value: UndoSnackbarContextValue = {
    state,
    showUndo,
    dismiss,
    performUndo,
  };

  return React.createElement(UndoSnackbarContext.Provider, { value }, children);
}

/**
 * Hook to access the undo snackbar context.
 */
export function useUndoSnackbar(): UndoSnackbarContextValue {
  const ctx = useContext(UndoSnackbarContext);
  if (!ctx) {
    throw new Error('useUndoSnackbar must be used within an UndoSnackbarProvider');
  }
  return ctx;
}
