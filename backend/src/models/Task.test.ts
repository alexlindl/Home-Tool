/**
 * Unit tests for Task model serialization/deserialization helpers
 *
 * Validates: Requirements 2.7, 5.8
 */

import {
  serializeRecurrencePattern,
  deserializeRecurrencePattern,
  taskFromRow,
  TaskRow,
} from './Task';
import type { EnhancedRecurrencePattern } from '../utils/recurrenceEngine';

describe('serializeRecurrencePattern', () => {
  it('serializes an every_n_days pattern correctly', () => {
    const pattern: EnhancedRecurrencePattern = {
      type: 'every_n_days',
      interval: 4,
    };
    const result = serializeRecurrencePattern(pattern);
    expect(result).toEqual({
      recurrence_type: 'every_n_days',
      recurrence_interval: 4,
      recurrence_day_of_week: null,
      recurrence_ordinal_week: null,
      recurrence_end_date: null,
    });
  });

  it('serializes an every_specific_day pattern correctly', () => {
    const pattern: EnhancedRecurrencePattern = {
      type: 'every_specific_day',
      interval: 1,
      dayOfWeek: 'tuesday',
    };
    const result = serializeRecurrencePattern(pattern);
    expect(result).toEqual({
      recurrence_type: 'every_specific_day',
      recurrence_interval: 1,
      recurrence_day_of_week: 'tuesday',
      recurrence_ordinal_week: null,
      recurrence_end_date: null,
    });
  });

  it('serializes an every_nth_day pattern correctly', () => {
    const pattern: EnhancedRecurrencePattern = {
      type: 'every_nth_day',
      interval: 1,
      dayOfWeek: 'wednesday',
      ordinalWeek: 2,
    };
    const result = serializeRecurrencePattern(pattern);
    expect(result).toEqual({
      recurrence_type: 'every_nth_day',
      recurrence_interval: 1,
      recurrence_day_of_week: 'wednesday',
      recurrence_ordinal_week: 2,
      recurrence_end_date: null,
    });
  });

  it('serializes an every_n_weeks_on_day pattern with endDate', () => {
    const endDate = new Date('2025-06-01');
    const pattern: EnhancedRecurrencePattern = {
      type: 'every_n_weeks_on_day',
      interval: 4,
      dayOfWeek: 'saturday',
      endDate,
    };
    const result = serializeRecurrencePattern(pattern);
    expect(result).toEqual({
      recurrence_type: 'every_n_weeks_on_day',
      recurrence_interval: 4,
      recurrence_day_of_week: 'saturday',
      recurrence_ordinal_week: null,
      recurrence_end_date: endDate,
    });
  });
});

describe('deserializeRecurrencePattern', () => {
  it('returns null when recurrence_type is null', () => {
    const result = deserializeRecurrencePattern({
      recurrence_type: null,
      recurrence_interval: null,
      recurrence_day_of_week: null,
      recurrence_ordinal_week: null,
      recurrence_end_date: null,
    });
    expect(result).toBeNull();
  });

  it('deserializes an every_n_days pattern', () => {
    const result = deserializeRecurrencePattern({
      recurrence_type: 'every_n_days',
      recurrence_interval: 7,
      recurrence_day_of_week: null,
      recurrence_ordinal_week: null,
      recurrence_end_date: null,
    });
    expect(result).toEqual({
      type: 'every_n_days',
      interval: 7,
    });
  });

  it('deserializes an every_specific_day pattern', () => {
    const result = deserializeRecurrencePattern({
      recurrence_type: 'every_specific_day',
      recurrence_interval: 1,
      recurrence_day_of_week: 'friday',
      recurrence_ordinal_week: null,
      recurrence_end_date: null,
    });
    expect(result).toEqual({
      type: 'every_specific_day',
      interval: 1,
      dayOfWeek: 'friday',
    });
  });

  it('deserializes an every_nth_day pattern', () => {
    const result = deserializeRecurrencePattern({
      recurrence_type: 'every_nth_day',
      recurrence_interval: 1,
      recurrence_day_of_week: 'monday',
      recurrence_ordinal_week: 3,
      recurrence_end_date: null,
    });
    expect(result).toEqual({
      type: 'every_nth_day',
      interval: 1,
      dayOfWeek: 'monday',
      ordinalWeek: 3,
    });
  });

  it('deserializes a pattern with endDate', () => {
    const endDate = new Date('2025-12-31');
    const result = deserializeRecurrencePattern({
      recurrence_type: 'every_n_weeks_on_day',
      recurrence_interval: 2,
      recurrence_day_of_week: 'sunday',
      recurrence_ordinal_week: null,
      recurrence_end_date: endDate,
    });
    expect(result).toEqual({
      type: 'every_n_weeks_on_day',
      interval: 2,
      dayOfWeek: 'sunday',
      endDate,
    });
  });

  it('defaults interval to 1 when recurrence_interval is null', () => {
    const result = deserializeRecurrencePattern({
      recurrence_type: 'every_n_days',
      recurrence_interval: null,
      recurrence_day_of_week: null,
      recurrence_ordinal_week: null,
      recurrence_end_date: null,
    });
    expect(result).toEqual({
      type: 'every_n_days',
      interval: 1,
    });
  });
});

describe('serialize/deserialize round-trip', () => {
  /**
   * Validates: Requirements 2.7
   * Property 5: Recurrence pattern serialization round-trip
   */
  it('every_n_days round-trips correctly', () => {
    const pattern: EnhancedRecurrencePattern = {
      type: 'every_n_days',
      interval: 14,
    };
    const serialized = serializeRecurrencePattern(pattern);
    const deserialized = deserializeRecurrencePattern(serialized);
    expect(deserialized).toEqual(pattern);
  });

  it('every_specific_day round-trips correctly', () => {
    const pattern: EnhancedRecurrencePattern = {
      type: 'every_specific_day',
      interval: 1,
      dayOfWeek: 'thursday',
    };
    const serialized = serializeRecurrencePattern(pattern);
    const deserialized = deserializeRecurrencePattern(serialized);
    expect(deserialized).toEqual(pattern);
  });

  it('every_nth_day round-trips correctly', () => {
    const pattern: EnhancedRecurrencePattern = {
      type: 'every_nth_day',
      interval: 1,
      dayOfWeek: 'wednesday',
      ordinalWeek: 2,
    };
    const serialized = serializeRecurrencePattern(pattern);
    const deserialized = deserializeRecurrencePattern(serialized);
    expect(deserialized).toEqual(pattern);
  });

  it('every_n_weeks_on_day with endDate round-trips correctly', () => {
    const pattern: EnhancedRecurrencePattern = {
      type: 'every_n_weeks_on_day',
      interval: 4,
      dayOfWeek: 'saturday',
      endDate: new Date('2025-09-01'),
    };
    const serialized = serializeRecurrencePattern(pattern);
    const deserialized = deserializeRecurrencePattern(serialized);
    expect(deserialized).toEqual(pattern);
  });
});

describe('taskFromRow maps enhanced recurrence fields', () => {
  const baseRow: TaskRow = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    title: 'Test Task',
    description: null,
    assigned_to: null,
    created_by: 'user-1',
    due_date: new Date('2025-01-15'),
    is_recurring: true,
    recurrence_frequency: null,
    recurrence_interval: 4,
    recurrence_end_date: null,
    recurrence_type: 'every_n_weeks_on_day',
    recurrence_day_of_week: 'saturday',
    recurrence_ordinal_week: null,
    status: 'pending',
    completed_at: null,
    completed_by: null,
    created_at: new Date('2025-01-01'),
    updated_at: new Date('2025-01-01'),
  };

  it('maps recurrence_type to recurrenceType', () => {
    const task = taskFromRow(baseRow);
    expect(task.recurrenceType).toBe('every_n_weeks_on_day');
  });

  it('maps recurrence_day_of_week to recurrenceDayOfWeek', () => {
    const task = taskFromRow(baseRow);
    expect(task.recurrenceDayOfWeek).toBe('saturday');
  });

  it('maps recurrence_ordinal_week to recurrenceOrdinalWeek when present', () => {
    const row: TaskRow = {
      ...baseRow,
      recurrence_type: 'every_nth_day',
      recurrence_day_of_week: 'wednesday',
      recurrence_ordinal_week: 2,
    };
    const task = taskFromRow(row);
    expect(task.recurrenceOrdinalWeek).toBe(2);
  });

  it('does not set recurrenceOrdinalWeek when null', () => {
    const task = taskFromRow(baseRow);
    expect(task.recurrenceOrdinalWeek).toBeUndefined();
  });

  it('maps null due_date to null dueDate for backlog tasks', () => {
    const row: TaskRow = { ...baseRow, due_date: null, is_recurring: false, recurrence_type: null };
    const task = taskFromRow(row);
    expect(task.dueDate).toBeNull();
  });
});
