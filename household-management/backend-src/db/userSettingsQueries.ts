/**
 * User settings database queries
 * Provides functions to interact with the user_settings table
 */

import { query } from './connection';

/**
 * Get a user setting value by userId and key
 * @param userId The user's ID
 * @param key Setting key to look up
 * @returns Promise<string | null> The setting value or null if not found
 */
export const getUserSetting = async (userId: string, key: string): Promise<string | null> => {
  const result = await query(
    'SELECT setting_value FROM user_settings WHERE user_id = $1 AND setting_key = $2',
    [userId, key]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return (result.rows[0] as { setting_value: string }).setting_value;
};

/**
 * Upsert a user setting value (insert or update)
 * @param userId The user's ID
 * @param key Setting key
 * @param value Setting value
 * @returns Promise<void>
 */
export const upsertUserSetting = async (userId: string, key: string, value: string): Promise<void> => {
  await query(
    `INSERT INTO user_settings (user_id, setting_key, setting_value, updated_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id, setting_key) DO UPDATE SET setting_value = $3, updated_at = CURRENT_TIMESTAMP`,
    [userId, key, value]
  );
};
