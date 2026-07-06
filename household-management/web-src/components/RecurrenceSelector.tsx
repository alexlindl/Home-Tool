/**
 * RecurrenceSelector Component
 * A simple row with a frequency dropdown and interval numeric input.
 * Constructs the correct EnhancedRecurrencePattern based on selection.
 *
 * The parent (TaskForm) controls visibility based on isRecurring toggle.
 *
 * @version 0.7.0-alpha
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.9
 */

import React, { useCallback } from 'react';
import type { EnhancedRecurrencePattern } from '@/types';

type Frequency = 'days' | 'weeks' | 'months' | 'years';

interface RecurrenceSelectorProps {
  value: EnhancedRecurrencePattern | null;
  onChange: (pattern: EnhancedRecurrencePattern) => void;
}

/**
 * Derives the frequency selection from an existing pattern value.
 */
function getFrequencyFromPattern(pattern: EnhancedRecurrencePattern | null): Frequency {
  if (!pattern) return 'days';
  switch (pattern.type) {
    case 'every_n_months':
      return 'months';
    case 'every_n_years':
      return 'years';
    case 'every_n_days':
      // If interval is a multiple of 7 and > 0, it might be "weeks"
      // but we can't be sure unless we track it; default to days
      return 'days';
    default:
      return 'days';
  }
}

/**
 * Derives the interval value from an existing pattern.
 */
function getIntervalFromPattern(pattern: EnhancedRecurrencePattern | null): number {
  if (!pattern) return 1;
  return Math.max(1, pattern.interval);
}

/**
 * Builds an EnhancedRecurrencePattern from the frequency and interval selections.
 */
function buildPattern(frequency: Frequency, interval: number): EnhancedRecurrencePattern {
  const safeInterval = Math.max(1, interval);
  switch (frequency) {
    case 'days':
      return { type: 'every_n_days', interval: safeInterval };
    case 'weeks':
      return { type: 'every_n_days', interval: safeInterval * 7 };
    case 'months':
      return { type: 'every_n_months', interval: safeInterval };
    case 'years':
      return { type: 'every_n_years', interval: safeInterval };
  }
}

export const RecurrenceSelector: React.FC<RecurrenceSelectorProps> = ({ value, onChange }) => {
  const frequency = getFrequencyFromPattern(value);
  const interval = getIntervalFromPattern(value);

  const handleFrequencyChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newFreq = e.target.value as Frequency;
      onChange(buildPattern(newFreq, interval));
    },
    [interval, onChange]
  );

  const handleIntervalChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newInterval = Math.max(1, parseInt(e.target.value) || 1);
      onChange(buildPattern(frequency, newInterval));
    },
    [frequency, onChange]
  );

  return (
    <div className="recurrence-selector" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
      <label htmlFor="recurrence-interval" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
        Every
      </label>
      <input
        id="recurrence-interval"
        type="number"
        min={1}
        value={interval}
        onChange={handleIntervalChange}
        style={{ width: '64px' }}
        aria-label="Recurrence interval"
      />
      <select
        id="recurrence-frequency"
        value={frequency}
        onChange={handleFrequencyChange}
        aria-label="Recurrence frequency"
      >
        <option value="days">day(s)</option>
        <option value="weeks">week(s)</option>
        <option value="months">month(s)</option>
        <option value="years">year(s)</option>
      </select>
    </div>
  );
};
