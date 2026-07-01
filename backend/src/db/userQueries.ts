/**
 * User database queries
 * Provides functions to interact with the users table
 */

import { query } from './connection';
import { User, UserRow, userFromRow } from '../models/User';

/**
 * Get all users from the database
 * @returns Promise<User[]> Array of all users
 */
export const getAllUsers = async (): Promise<User[]> => {
  const result = await query('SELECT id, name, ha_username, created_at FROM users ORDER BY name');
  return result.rows.map((row: UserRow) => userFromRow(row));
};

/**
 * Get a user by their ID
 * @param id User UUID
 * @returns Promise<User | null> User object or null if not found
 */
export const getUserById = async (id: string): Promise<User | null> => {
  const result = await query(
    'SELECT id, name, ha_username, created_at FROM users WHERE id = $1',
    [id]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  return userFromRow(result.rows[0] as UserRow);
};

/**
 * Get a user by their name
 * @param name User name (Alex, Becky, or Sam)
 * @returns Promise<User | null> User object or null if not found
 */
export const getUserByName = async (name: string): Promise<User | null> => {
  const result = await query(
    'SELECT id, name, ha_username, created_at FROM users WHERE name = $1',
    [name]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  return userFromRow(result.rows[0] as UserRow);
};

/**
 * Create a new user
 * @param name User name (must be unique)
 * @returns Promise<User> The created user
 */
export const createUser = async (name: string): Promise<User> => {
  const result = await query(
    'INSERT INTO users (name) VALUES ($1) RETURNING id, name, ha_username, created_at',
    [name]
  );
  return userFromRow(result.rows[0] as UserRow);
};

/**
 * Update a user's name
 * @param id User UUID
 * @param name New name (must be unique)
 * @returns Promise<User | null> Updated user or null if not found
 */
export const updateUser = async (id: string, name: string): Promise<User | null> => {
  const result = await query(
    'UPDATE users SET name = $1 WHERE id = $2 RETURNING id, name, ha_username, created_at',
    [name, id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return userFromRow(result.rows[0] as UserRow);
};

/**
 * Update a user's Home Assistant username
 * @param id User UUID
 * @param haUsername HA username to link, or null to unlink
 * @returns Promise<User | null> Updated user or null if not found
 */
export const updateHaUsername = async (id: string, haUsername: string | null): Promise<User | null> => {
  const result = await query(
    'UPDATE users SET ha_username = $1 WHERE id = $2 RETURNING id, name, ha_username, created_at',
    [haUsername, id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return userFromRow(result.rows[0] as UserRow);
};

/**
 * Find a user by their Home Assistant username (case-insensitive)
 * @param haUsername HA username to search for
 * @returns Promise<User | null> User with matching HA username or null
 */
export const findUserByHaUsername = async (haUsername: string): Promise<User | null> => {
  const result = await query(
    'SELECT id, name, ha_username, created_at FROM users WHERE LOWER(ha_username) = LOWER($1)',
    [haUsername]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return userFromRow(result.rows[0] as UserRow);
};

/**
 * Get all users that have a linked Home Assistant account
 * @returns Promise<User[]> Array of users with non-null ha_username
 */
export const getLinkedUsers = async (): Promise<User[]> => {
  const result = await query(
    'SELECT id, name, ha_username, created_at FROM users WHERE ha_username IS NOT NULL'
  );
  return result.rows.map((row: UserRow) => userFromRow(row));
};

/**
 * Delete a user from the database
 * @param id User UUID
 * @returns Promise<boolean> True if user was deleted, false if not found
 */
export const deleteUser = async (id: string): Promise<boolean> => {
  const result = await query('DELETE FROM users WHERE id = $1', [id]);
  return result.rowCount !== null && result.rowCount > 0;
};
