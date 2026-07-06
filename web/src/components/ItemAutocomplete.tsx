/**
 * ItemAutocomplete Component
 * Typeahead input for shopping item names with category display.
 * Queries GET /api/shopping/search?q=... after 1+ character typed (debounced ~300ms).
 * Displays name-category pairs as distinct suggestions.
 *
 * Requirements: 8.1, 8.4, 9.3
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { ShoppingSearchResult } from '@/types';
import { shoppingApi } from '@/services/api';

interface ItemAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelectItem: (name: string, category: string) => void;
  placeholder?: string;
}

export const ItemAutocomplete: React.FC<ItemAutocompleteProps> = ({
  value,
  onChange,
  onSelectItem,
  placeholder = 'Enter item name',
}) => {
  const [suggestions, setSuggestions] = useState<ShoppingSearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch suggestions when value changes (debounced)
  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const results = await shoppingApi.search(query);
      setSuggestions(results);
      setShowSuggestions(true);
    } catch {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (value.length >= 1) {
      debounceRef.current = setTimeout(() => {
        fetchSuggestions(value);
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, fetchSuggestions]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setHighlightedIndex(-1);
  };

  const handleSelect = (item: ShoppingSearchResult) => {
    onSelectItem(item.name, item.category);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[highlightedIndex]!);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    }
  };

  const handleFocus = () => {
    if (value.length >= 1 && suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  return (
    <div className="autocomplete-container" ref={containerRef}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        placeholder={placeholder}
        className="autocomplete-input"
        autoComplete="off"
        role="combobox"
        aria-expanded={showSuggestions}
        aria-autocomplete="list"
        aria-controls="item-autocomplete-list"
      />
      {showSuggestions && suggestions.length > 0 && (
        <ul
          id="item-autocomplete-list"
          className="autocomplete-dropdown"
          role="listbox"
        >
          {suggestions.map((item, index) => (
            <li
              key={`${item.name}-${item.category}`}
              className={`autocomplete-option${index === highlightedIndex ? ' autocomplete-option--highlighted' : ''}`}
              role="option"
              aria-selected={index === highlightedIndex}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(item)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <span className="autocomplete-option-name">{item.name}</span>
              <span className="autocomplete-option-category">({item.category})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
