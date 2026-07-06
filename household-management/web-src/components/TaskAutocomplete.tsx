/**
 * TaskAutocomplete Component
 * Wraps a title input with a dropdown that queries previously-used task titles.
 * Shows suggestions after 2+ characters typed, debounced at ~300ms.
 *
 * Requirements: 6.2, 6.3, 6.4
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { taskApi } from '@/services/api';

interface TaskAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const TaskAutocomplete: React.FC<TaskAutocompleteProps> = ({
  value,
  onChange,
  placeholder = 'Enter task title',
}) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search function
  const searchTitles = useCallback((query: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const results = await taskApi.searchTitles(query);
        if (results.length > 0) {
          setSuggestions(results);
          setShowDropdown(true);
        } else {
          setSuggestions([]);
          setShowDropdown(false);
        }
      } catch {
        setSuggestions([]);
        setShowDropdown(false);
      }
    }, 300);
  }, []);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    searchTitles(newValue);
    setHighlightIndex(-1);
  };

  // Handle suggestion selection
  const handleSelect = (title: string) => {
    onChange(title);
    setShowDropdown(false);
    setSuggestions([]);
    setHighlightIndex(-1);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[highlightIndex]!);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      setHighlightIndex(-1);
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setHighlightIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div className="autocomplete-container" ref={containerRef}>
      <input
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={showDropdown}
        aria-autocomplete="list"
        aria-controls="task-autocomplete-list"
      />
      {showDropdown && suggestions.length > 0 && (
        <ul
          id="task-autocomplete-list"
          className="autocomplete-dropdown"
          role="listbox"
        >
          {suggestions.map((title, index) => (
            <li
              key={title}
              className={`autocomplete-item${index === highlightIndex ? ' autocomplete-item--highlighted' : ''}`}
              role="option"
              aria-selected={index === highlightIndex}
              onMouseDown={() => handleSelect(title)}
              onMouseEnter={() => setHighlightIndex(index)}
            >
              {title}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
