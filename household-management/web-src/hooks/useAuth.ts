/**
 * useAuth Hook with React Context
 * Manages current user state with localStorage persistence.
 * Uses context so all components share the same auth state.
 *
 * Requirements: 1.2
 */

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import type { User } from '@/types';
import { userApi } from '@/services/api';
import React from 'react';

const STORAGE_KEY = 'household_current_user';

interface AuthContextValue {
  currentUser: User | null;
  isAuthenticated: boolean;
  selectUser: (name: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * AuthProvider wraps the app and provides shared auth state.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user from localStorage on mount and verify it still exists
  useEffect(() => {
    const verify = async () => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const user: User = JSON.parse(stored);
          // Verify user still exists in the database
          const users = await userApi.getAllUsers();
          const found = users.find((u) => u.id === user.id);
          if (found) {
            setCurrentUser(found);
          } else {
            // User was deleted or DB was reset
            localStorage.removeItem(STORAGE_KEY);
          }
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
      setLoading(false);
    };
    verify();
  }, []);

  const selectUser = useCallback(async (name: string) => {
    // Notify the backend of the selection
    await userApi.selectUser(name);
    // Fetch all users and find the one matching the selected name
    const users = await userApi.getAllUsers();
    const user = users.find((u) => u.name === name) ?? null;
    if (user) {
      setCurrentUser(user);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    }
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value: AuthContextValue = {
    currentUser,
    isAuthenticated: currentUser !== null,
    selectUser,
    logout,
    loading,
  };

  return React.createElement(AuthContext.Provider, { value }, children);
}

/**
 * Hook to access the shared auth state.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
