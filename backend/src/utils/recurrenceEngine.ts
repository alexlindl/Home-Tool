/** Supported recurrence pattern types */
export type RecurrencePatternType =
  | 'every_n_days' // e.g., every 4 days
  | 'every_specific_day' // e.g., every Tuesday
  | 'every_nth_day' // e.g., every 2nd Wednesday
  | 'every_n_weeks_on_day'; // e.g., every 4 weeks on Saturday

/** Days of the week */
export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

/** Enhanced recurrence pattern structure */
export interface EnhancedRecurrencePattern {
  type: RecurrencePatternType;
  interval: number; // N in "every N days/weeks"
  dayOfWeek?: DayOfWeek; // specific day for day-based patterns
  ordinalWeek?: number; // 1-5 for Nth occurrence patterns
  endDate?: Date;
}

const VALID_DAYS: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const DAY_TO_JS_DAY: Record<DayOfWeek, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/** Validate that a recurrence pattern is well-formed */
export function validateRecurrencePattern(
  pattern: EnhancedRecurrencePattern,
): { valid: boolean; error?: string } {
  // Validate interval is a positive integer
  if (!Number.isInteger(pattern.interval) || pattern.interval < 1) {
    return { valid: false, error: 'Interval must be a positive integer' };
  }

  // Validate pattern type
  const validTypes: RecurrencePatternType[] = [
    'every_n_days',
    'every_specific_day',
    'every_nth_day',
    'every_n_weeks_on_day',
  ];
  if (!validTypes.includes(pattern.type)) {
    return { valid: false, error: 'Invalid recurrence pattern type' };
  }

  // Day-based patterns require dayOfWeek
  const dayBasedPatterns: RecurrencePatternType[] = [
    'every_specific_day',
    'every_nth_day',
    'every_n_weeks_on_day',
  ];
  if (dayBasedPatterns.includes(pattern.type)) {
    if (!pattern.dayOfWeek) {
      return {
        valid: false,
        error: 'dayOfWeek is required for day-based patterns',
      };
    }
    if (!VALID_DAYS.includes(pattern.dayOfWeek)) {
      return {
        valid: false,
        error: `Invalid day of week. Must be one of: ${VALID_DAYS.join(', ')}`,
      };
    }
  }

  // Validate dayOfWeek if provided
  if (
    pattern.dayOfWeek !== undefined &&
    !VALID_DAYS.includes(pattern.dayOfWeek)
  ) {
    return {
      valid: false,
      error: `Invalid day of week. Must be one of: ${VALID_DAYS.join(', ')}`,
    };
  }

  // Validate ordinalWeek for every_nth_day pattern
  if (pattern.type === 'every_nth_day') {
    if (pattern.ordinalWeek === undefined) {
      return {
        valid: false,
        error: 'ordinalWeek is required for every_nth_day pattern',
      };
    }
    if (
      !Number.isInteger(pattern.ordinalWeek) ||
      pattern.ordinalWeek < 1 ||
      pattern.ordinalWeek > 5
    ) {
      return {
        valid: false,
        error: 'Invalid recurrence pattern: ordinal week must be between 1 and 5',
      };
    }
  }

  // Validate ordinalWeek range if provided (even for other pattern types)
  if (pattern.ordinalWeek !== undefined) {
    if (
      !Number.isInteger(pattern.ordinalWeek) ||
      pattern.ordinalWeek < 1 ||
      pattern.ordinalWeek > 5
    ) {
      return {
        valid: false,
        error: 'Invalid recurrence pattern: ordinal week must be between 1 and 5',
      };
    }
  }

  return { valid: true };
}

/** Map legacy patterns to enhanced format for backwards compatibility */
export function fromLegacyPattern(
  frequency: 'daily' | 'weekly' | 'monthly',
  interval: number,
  endDate?: Date,
): EnhancedRecurrencePattern {
  switch (frequency) {
    case 'daily':
      return {
        type: 'every_n_days',
        interval,
        ...(endDate && { endDate }),
      };
    case 'weekly':
      return {
        type: 'every_n_days',
        interval: interval * 7,
        ...(endDate && { endDate }),
      };
    case 'monthly':
      return {
        type: 'every_n_days',
        interval: interval * 30,
        ...(endDate && { endDate }),
      };
  }
}

/** Calculate next due date from a given reference date */
export function calculateNextDueDate(
  currentDueDate: Date,
  pattern: EnhancedRecurrencePattern,
): Date {
  switch (pattern.type) {
    case 'every_n_days':
      return calculateEveryNDays(currentDueDate, pattern.interval);
    case 'every_specific_day':
      return calculateEverySpecificDay(currentDueDate, pattern.dayOfWeek!);
    case 'every_nth_day':
      return calculateEveryNthDay(
        currentDueDate,
        pattern.dayOfWeek!,
        pattern.ordinalWeek!,
      );
    case 'every_n_weeks_on_day':
      return calculateEveryNWeeksOnDay(
        currentDueDate,
        pattern.dayOfWeek!,
        pattern.interval,
      );
  }
}

/**
 * every_n_days: returns date exactly N days after input
 */
function calculateEveryNDays(currentDueDate: Date, interval: number): Date {
  const result = new Date(currentDueDate);
  result.setDate(result.getDate() + interval);
  return result;
}

/**
 * every_specific_day: returns next occurrence of that day (1-7 days ahead)
 */
function calculateEverySpecificDay(
  currentDueDate: Date,
  dayOfWeek: DayOfWeek,
): Date {
  const targetDay = DAY_TO_JS_DAY[dayOfWeek];
  const currentDay = currentDueDate.getDay();

  // Calculate days until target day (always 1-7 days ahead, never same day)
  let daysAhead = targetDay - currentDay;
  if (daysAhead <= 0) {
    daysAhead += 7;
  }

  const result = new Date(currentDueDate);
  result.setDate(result.getDate() + daysAhead);
  return result;
}

/**
 * every_nth_day: returns the Nth occurrence of that day in the next month
 * e.g., 2nd Wednesday of next month
 */
function calculateEveryNthDay(
  currentDueDate: Date,
  dayOfWeek: DayOfWeek,
  ordinalWeek: number,
): Date {
  const targetDay = DAY_TO_JS_DAY[dayOfWeek];

  // Move to the next month
  const nextMonth = new Date(currentDueDate);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(1);

  // Find the first occurrence of the target day in next month
  const firstDayOfMonth = nextMonth.getDay();
  let daysUntilTarget = targetDay - firstDayOfMonth;
  if (daysUntilTarget < 0) {
    daysUntilTarget += 7;
  }

  // Calculate the Nth occurrence (ordinalWeek is 1-based)
  const nthDay = 1 + daysUntilTarget + (ordinalWeek - 1) * 7;

  const result = new Date(nextMonth);
  result.setDate(nthDay);

  return result;
}

/**
 * every_n_weeks_on_day: returns a date that falls on the specified day
 * and is N×7 days after the most recent occurrence of that day
 * (relative to the input date)
 */
function calculateEveryNWeeksOnDay(
  currentDueDate: Date,
  dayOfWeek: DayOfWeek,
  intervalWeeks: number,
): Date {
  const targetDay = DAY_TO_JS_DAY[dayOfWeek];
  const currentDay = currentDueDate.getDay();

  // Find how many days since the most recent occurrence of target day
  // If currentDay IS the target day, days since is 0
  let daysSinceTarget = currentDay - targetDay;
  if (daysSinceTarget < 0) {
    daysSinceTarget += 7;
  }

  // The most recent occurrence of targetDay is (currentDueDate - daysSinceTarget)
  // The next occurrence at N-week intervals is N*7 days after that most recent occurrence
  const daysToAdd = intervalWeeks * 7 - daysSinceTarget;

  const result = new Date(currentDueDate);
  result.setDate(result.getDate() + daysToAdd);
  return result;
}
