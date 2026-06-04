/**
 * UserBadge Component
 * Displays a colored avatar circle with user's initial.
 *
 * Requirements: 1.2
 */

import React from 'react';

interface UserBadgeProps {
  userName: string;
  size?: 'sm' | 'md' | 'lg';
}

const colorMap: Record<string, string> = {
  Alex: '#4a90d9',
  Becky: '#e85d9a',
  Sam: '#4caf50',
};

const sizeMap: Record<string, number> = {
  sm: 24,
  md: 36,
  lg: 48,
};

export const UserBadge: React.FC<UserBadgeProps> = ({ userName, size = 'md' }) => {
  const diameter = sizeMap[size] ?? 36;
  const bgColor = colorMap[userName] || '#888';
  const initial = userName.charAt(0).toUpperCase();
  const fontSize = diameter * 0.45;

  return (
    <span
      className="user-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: diameter,
        height: diameter,
        borderRadius: '50%',
        backgroundColor: bgColor,
        color: '#fff',
        fontSize,
        fontWeight: 600,
        flexShrink: 0,
      }}
      aria-label={`${userName} avatar`}
    >
      {initial}
    </span>
  );
};
