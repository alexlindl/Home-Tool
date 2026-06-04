/**
 * UserSelector Component
 * Full-screen modal for selecting the current household member.
 * On first install (no users), shows a setup form to create the first user.
 *
 * Requirements: 1.2
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { userApi, adminApi } from '@/services/api';
import type { User } from '@/types';

const colors = ['#4a90d9', '#e85d9a', '#4caf50', '#ff9800', '#9c27b0', '#00bcd4'];

export const UserSelector: React.FC = () => {
  const { selectUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    userApi.getAllUsers().then((data) => {
      setUsers(data);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, []);

  const handleSelect = async (name: string) => {
    setSelecting(true);
    setSelectedName(name);
    try {
      await selectUser(name);
    } catch {
      setSelecting(false);
      setSelectedName(null);
    }
  };

  const handleCreateUser = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const user = await userApi.createUser(newName.trim());
      setUsers((prev) => [...prev, user]);
      setNewName('');
      // Auto-select the new user
      await selectUser(user.name);
    } catch {
      setError('Failed to create user. Name may already exist.');
      setCreating(false);
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoring(true);
    setError('');
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const data = json.data || json;
      await adminApi.importBackup(data);
      // Reload users after restore
      const restored = await userApi.getAllUsers();
      setUsers(restored);
      setRestoring(false);
    } catch {
      setError('Failed to restore backup. Check the file is valid.');
      setRestoring(false);
    }
    e.target.value = '';
  };

  if (loading) {
    return (
      <div className="user-selector-overlay">
        <div className="user-selector-content">
          <p style={{ color: '#fff' }}>Loading...</p>
        </div>
      </div>
    );
  }

  // First install — no users exist
  if (users.length === 0) {
    return (
      <div className="user-selector-overlay" role="dialog" aria-label="Setup">
        <div className="user-selector-content">
          <h1 className="user-selector-title">Welcome!</h1>
          <p className="user-selector-subtitle">Create your first user to get started</p>
          <div style={{ maxWidth: 320, margin: '0 auto' }}>
            {error && <p style={{ color: '#fca5a5', marginBottom: 12 }}>{error}</p>}
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateUser()}
              placeholder="Enter your name"
              autoFocus
              style={{
                width: '100%',
                padding: '14px 18px',
                fontSize: '1.1rem',
                border: 'none',
                borderRadius: 12,
                marginBottom: 16,
                outline: 'none',
              }}
            />
            <button
              className="user-selector-btn"
              onClick={handleCreateUser}
              disabled={creating || !newName.trim()}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <span className="user-selector-name">
                {creating ? 'Creating...' : 'Create & Continue'}
              </span>
            </button>

            <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.2)', textAlign: 'center' }}>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem', marginBottom: 12 }}>
                Or restore from a previous backup:
              </p>
              <label
                style={{
                  display: 'inline-block',
                  padding: '10px 20px',
                  background: 'rgba(255,255,255,0.15)',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: '0.875rem',
                  cursor: restoring ? 'not-allowed' : 'pointer',
                  opacity: restoring ? 0.6 : 1,
                }}
              >
                {restoring ? 'Restoring...' : '📁 Import Backup File'}
                <input
                  type="file"
                  accept=".json"
                  onChange={handleRestore}
                  disabled={restoring}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="user-selector-overlay" role="dialog" aria-label="Select user">
      <div className="user-selector-content">
        <h1 className="user-selector-title">Who&apos;s here?</h1>
        <p className="user-selector-subtitle">Select your profile to continue</p>
        <div className="user-selector-buttons">
          {users.map((user, index) => (
            <button
              key={user.id}
              className="user-selector-btn"
              onClick={() => handleSelect(user.name)}
              disabled={selecting}
              aria-busy={selecting && selectedName === user.name}
            >
              <span
                className="user-selector-avatar"
                style={{ backgroundColor: colors[index % colors.length] }}
              >
                {user.name.charAt(0)}
              </span>
              <span className="user-selector-name">{user.name}</span>
              {selecting && selectedName === user.name && (
                <span className="user-selector-loading">Loading...</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
