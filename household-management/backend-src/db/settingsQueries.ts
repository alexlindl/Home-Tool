/**
 * App settings database queries
 * Provides functions to interact with the app_settings table
 */

import { query } from './connection';

/**
 * Get an app setting value by key
 * @param key Setting key to look up
 * @returns Promise<string | null> The setting value or null if not found
 */
export const getAppSetting = async (key: string): Promise<string | null> => {
  const result = await query(
    'SELECT value FROM app_settings WHERE key = $1',
    [key]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return (result.rows[0] as { value: string }).value;
};

/**
 * Set an app setting value (upsert — insert or update)
 * @param key Setting key
 * @param value Setting value
 * @returns Promise<void>
 */
export const setAppSetting = async (key: string, value: string): Promise<void> => {
  await query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
    [key, value]
  );
};
