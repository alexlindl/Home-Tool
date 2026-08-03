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
 * The interval input uses LOCAL string state to allow natural editing
 * (select-all-then-type, empty field during typing). The parsed integer
 * value is only emitted to the parent on blur, clamped to [1, 365].
 *
 * @version 0.7.0-alpha
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.9, 7.1–7.8
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { EnhancedRecurrencePattern } from '@/types';

type Frequency = 'days' | 'weeks' | 'months' | 'years';

interface RecurrenceSelectorProps {
  value: EnhancedRecurrencePattern | null;
  onChange: (pattern: EnhancedRecurrencePattern) => void;
}

const MIN_INTERVAL = 1;
const MAX_INTERVAL = 365;

/**
 * Builds an EnhancedRecurrencePattern from the frequency and interval selections.
 */
function buildPattern(frequency: Frequency, interval: number): EnhancedRecurrencePattern {
  const safeInterval = Math.max(MIN_INTERVAL, Math.min(MAX_INTERVAL, interval));
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

/**
 * Clamp a value to [MIN_INTERVAL, MAX_INTERVAL], defaulting empty/NaN to 1.
 */
function clampInterval(raw: string): number {
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed) || raw.trim() === '') return MIN_INTERVAL;
  return Math.max(MIN_INTERVAL, Math.min(MAX_INTERVAL, parsed));
}

export const RecurrenceSelector: React.FC<RecurrenceSelectorProps> = ({ value, onChange }) => {
  const [frequency, setFrequency] = useState<Frequency>(() => parsePattern(value).frequency);
  // Local string state for the interval input — allows empty/partial values during editing
  const [intervalStr, setIntervalStr] = useState<string>(() => String(parsePattern(value).interval));

  // Track what we last emitted so we don't re-parse our own output
  const lastEmitted = useRef<string>('');

  // Sync from parent when value changes externally (e.g., switching to edit mode)
  useEffect(() => {
    const serialized = value ? `${value.type}:${value.interval}` : '';
    if (serialized !== lastEmitted.current) {
      const p = parsePattern(value);
      setFrequency(p.frequency);
      setIntervalStr(String(p.interval));
    }
  }, [value]);

  /** Emit a pattern to parent and record what we emitted */
  const emit = useCallback(
    (freq: Frequency, intVal: number) => {
      const pattern = buildPattern(freq, intVal);
      lastEmitted.current = `${pattern.type}:${pattern.interval}`;
      onChange(pattern);
    },
    [onChange]
  );

  const handleFrequencyChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newFreq = e.target.value as Frequency;
      setFrequency(newFreq);
      // Use the current displayed interval (clamped) for the emit
      const currentInterval = clampInterval(intervalStr);
      setIntervalStr(String(currentInterval));
      emit(newFreq, currentInterval);
    },
    [intervalStr, emit]
  );

  /** During typing: just update local string state, no emit */
  const handleIntervalChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setIntervalStr(e.target.value);
    },
    []
  );

  /** On blur: clamp, update display, emit to parent */
  const handleIntervalBlur = useCallback(() => {
    const clamped = clampInterval(intervalStr);
    setIntervalStr(String(clamped));
    emit(frequency, clamped);
  }, [intervalStr, frequency, emit]);

  /** Increment stepper: +1, max 365 */
  const handleIncrement = useCallback(() => {
    const current = clampInterval(intervalStr);
    const next = Math.min(MAX_INTERVAL, current + 1);
    setIntervalStr(String(next));
    emit(frequency, next);
  }, [intervalStr, frequency, emit]);

  /** Decrement stepper: -1, min 1 */
  const handleDecrement = useCallback(() => {
    const current = clampInterval(intervalStr);
    const next = Math.max(MIN_INTERVAL, current - 1);
    setIntervalStr(String(next));
    emit(frequency, next);
  }, [intervalStr, frequency, emit]);

  return (
    <div className="recurrence-selector" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
      <label htmlFor="recurrence-interval" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
        Every
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
        <button
          type="button"
          onClick={handleDecrement}
          aria-label="Decrease interval"
          style={{
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #ccc',
            borderRadius: '4px',
            background: '#f5f5f5',
            cursor: 'pointer',
            fontSize: '1rem',
            lineHeight: 1,
          }}
        >
          −
        </button>
        <input
          id="recurrence-interval"
          type="number"
          min={MIN_INTERVAL}
          max={MAX_INTERVAL}
          value={intervalStr}
          onChange={handleIntervalChange}
          onBlur={handleIntervalBlur}
          style={{ width: '64px', textAlign: 'center' }}
          aria-label="Recurrence interval"
        />
        <button
          type="button"
          onClick={handleIncrement}
          aria-label="Increase interval"
          style={{
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #ccc',
            borderRadius: '4px',
            background: '#f5f5f5',
            cursor: 'pointer',
            fontSize: '1rem',
            lineHeight: 1,
          }}
        >
          +
        </button>
      </div>
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
