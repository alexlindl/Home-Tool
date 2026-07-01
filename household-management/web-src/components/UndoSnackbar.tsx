/**
 * UndoSnackbar Component
 * Displays a timed undo notification at the bottom of the screen.
 * Accessibility: role="status" + aria-live="polite"
 *
 * Requirements: 10.1, 10.2, 10.4, 10.5, 10.6, 10.7, 10.8
 */

import { useUndoSnackbar, truncateItemName } from '@/contexts/UndoSnackbarContext';

export function UndoSnackbar() {
  const { state, performUndo, dismiss } = useUndoSnackbar();

  if (!state.visible) return null;

  const displayName = truncateItemName(state.itemName);

  return (
    <div className="undo-snackbar" role="status" aria-live="polite">
      <div className="undo-snackbar-content">
        {state.error ? (
          <span className="undo-snackbar-error">{state.error}</span>
        ) : (
          <>
            <span className="undo-snackbar-text">
              {displayName} — {state.actionDescription}
            </span>
            <button
              className="undo-snackbar-btn"
              onClick={performUndo}
              disabled={state.undoing}
              type="button"
            >
              {state.undoing ? 'Undoing…' : 'Undo'}
            </button>
          </>
        )}
        <button
          className="undo-snackbar-dismiss"
          onClick={dismiss}
          aria-label="Dismiss"
          type="button"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
