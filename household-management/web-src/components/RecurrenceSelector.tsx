/**
 * RecurrenceSelector Component
 * A simple row with a frequency dropdown and interval numeric input.
 * Constructs the correct EnhancedRecurrencePattern based on selection.
 *
 * The parent (TaskForm) controls visibility based on isRecurring toggle.
 *
 * Uses internal state with a lastEmitted ref to prevent the days/weeks
 * multiplication loop bug (where re-deriving from prop caused 7×7=49 etc).
 *
 * @version 0.7.0-alpha
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.9
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { EnhancedRecurrencePattern } from '@/types';

type Frequency = 'days' | 'weeks' | 'months' | 'years';

interface RecurrenceSelectorProps {
  value: EnhancedRecurrencePattern | null;
  onChange: (pattern: EnhancedRecurrencePattern) => void;
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

/**
 * Parse an existing pattern back into frequency + user-facing interval.
 */
function parsePattern(pattern: EnhancedRecurrencePattern | null): { frequency: Frequency; interval: number } {
  if (!pattern) return { frequency: 'days', interval: 1 };

  if (pattern.type === 'every_n_months') return { frequency: 'months', interval: pattern.interval };
  if (pattern.type === 'every_n_years') return { frequency: 'years', interval: pattern.interval };

  // every_n_days — check if it's a multiple of 7 (weeks)
  if (pattern.type === 'every_n_days') {
    if (pattern.interval >= 7 && pattern.interval % 7 === 0) {
      return { frequency: 'weeks', interval: pattern.interval / 7 };
    }
    return { frequency: 'days', interval: pattern.interval };
  }

  return { frequency: 'days', interval: 1 };
}

export const RecurrenceSelector: React.FC<RecurrenceSelectorProps> = ({ value, onChange }) => {
  const [frequency, setFrequency] = useState<Frequency>(() => parsePattern(value).frequency);
  const [interval, setInterval] = useState(() => parsePattern(value).interval);

  // Track what we last emitted so we don't re-parse our own output
  const lastEmitted = useRef<string>('');

  // Sync from parent when value changes externally (e.g., switching to edit mode)
  useEffect(() => {
    const serialized = value ? `${value.type}:${value.interval}` : '';
    if (serialized !== lastEmitted.current) {
      const p = parsePattern(value);
      setFrequency(p.frequency);
      setInterval(p.interval);
    }
  }, [value]);

  const handleFrequencyChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newFreq = e.target.value as Frequency;
      setFrequency(newFreq);
      const pattern = buildPattern(newFreq, interval);
      lastEmitted.current = `${pattern.type}:${pattern.interval}`;
      onChange(pattern);
    },
    [interval, onChange]
  );

  const handleIntervalChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newInterval = Math.max(1, parseInt(e.target.value) || 1);
      setInterval(newInterval);
      const pattern = buildPattern(frequency, newInterval);
      lastEmitted.current = `${pattern.type}:${pattern.interval}`;
      onChange(pattern);
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
