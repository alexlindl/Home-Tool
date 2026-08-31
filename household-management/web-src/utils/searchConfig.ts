/**
 * Shared search configuration for text-search inputs across the app.
 *
 * These constants are extracted from the existing Tasks search
 * (see TaskDashboard.tsx) so the Shopping list search reuses the exact same
 * debounce interval and minimum-character threshold rather than duplicating
 * the values.
 *
 * - SEARCH_DEBOUNCE_MS: delay applied to search input changes before the
 *   filter is applied (Tasks search debounces at 100ms).
 * - SEARCH_MIN_CHARS: minimum number of characters before filtering kicks in;
 *   below this threshold all items are shown unfiltered (Tasks search uses 2).
 */
import { useEffect, useState } from 'react';

export const SEARCH_DEBOUNCE_MS = 100;
export const SEARCH_MIN_CHARS = 2;

/**
 * Debounces a rapidly-changing value, returning the latest value only after it
 * has been stable for `delayMs` milliseconds. Defaults to SEARCH_DEBOUNCE_MS so
 * callers get the shared search debounce interval without repeating it.
 *
 * @param value   the value to debounce
 * @param delayMs debounce delay in milliseconds (defaults to SEARCH_DEBOUNCE_MS)
 * @returns the debounced value
 */
export function useDebouncedValue<T>(value: T, delayMs: number = SEARCH_DEBOUNCE_MS): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}
