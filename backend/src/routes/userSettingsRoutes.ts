/**
 * User Settings API routes
 * Handles per-user settings (e.g., default_list_id)
 */

import { Router, Request, Response } from 'express';
import { getUserSetting, upsertUserSetting } from '../db/userSettingsQueries';

const router = Router();

/**
 * GET /api/user-settings/:userId/:key
 * Get a user setting value by userId and key
 *
 * Response: 200 OK
 * { "value": "some-list-id" }
 *
 * Response: 404 Not Found
 * { "status": "error", "message": "Setting not found" }
 */
router.get('/:userId/:key', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.params.userId as string;
    const key = req.params.key as string;

    const value = await getUserSetting(userId, key);

    if (value === null) {
      res.status(404).json({
        status: 'error',
        message: `Setting '${key}' not found for user`,
      });
      return;
    }

    res.status(200).json({ value });
  } catch (error) {
    console.error('Error fetching user setting:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch user setting',
    });
  }
});

/**
 * PUT /api/user-settings/:userId/:key
 * Upsert a user setting value
 *
 * Request body:
 * { "value": "some-list-id" }
 *
 * Response: 200 OK
 * { "message": "Saved" }
 *
 * Response: 400 Bad Request
 * { "status": "error", "message": "value is required" }
 */
router.put('/:userId/:key', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.params.userId as string;
    const key = req.params.key as string;
    const { value } = req.body;

    if (value === undefined || value === null) {
      res.status(400).json({
        status: 'error',
        message: 'value is required',
      });
      return;
    }

    const stringValue = String(value);
    await upsertUserSetting(userId, key, stringValue);

    res.status(200).json({ message: 'Saved' });
  } catch (error) {
    console.error('Error saving user setting:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to save user setting',
    });
  }
});

export default router;
