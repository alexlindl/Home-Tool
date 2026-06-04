/**
 * UserSelector Component
 * Full-screen modal for selecting the current household member.
 *
 * Requirements: 1.2
 */

import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

const users = [
  { name: 'Alex', color: '#4a90d9' },
  { name: 'Becky', color: '#e85d9a' },
  { name: 'Sam', color: '#4caf50' },
] as const;

export const UserSelector: React.FC = () => {
  const { selectUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const handleSelect = async (name: string) => {
    setLoading(true);
    setSelectedName(name);
    try {
      await selectUser(name);
    } catch {
      setLoading(false);
      setSelectedName(null);
    }
  };

  return (
    <div className="user-selector-overlay" role="dialog" aria-label="Select user">
      <div className="user-selector-content">
        <h1 className="user-selector-title">Who&apos;s here?</h1>
        <p className="user-selector-subtitle">Select your profile to continue</p>
        <div className="user-selector-buttons">
          {users.map((user) => (
            <button
              key={user.name}
              className="user-selector-btn"
              onClick={() => handleSelect(user.name)}
              disabled={loading}
              aria-busy={loading && selectedName === user.name}
            >
              <span
                className="user-selector-avatar"
                style={{ backgroundColor: user.color }}
              >
                {user.name.charAt(0)}
              </span>
              <span className="user-selector-name">{user.name}</span>
              {loading && selectedName === user.name && (
                <span className="user-selector-loading">Loading...</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
