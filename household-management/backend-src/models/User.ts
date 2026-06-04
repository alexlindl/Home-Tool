/**
 * User data model
 * Represents a household member
 */

export interface User {
  id: string;              // UUID
  name: string;
  createdAt: Date;
}

/**
 * User database row (matches PostgreSQL schema)
 */
export interface UserRow {
  id: string;
  name: string;
  created_at: Date;
}

/**
 * Convert database row to User model
 */
export const userFromRow = (row: UserRow): User => {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
  };
};
