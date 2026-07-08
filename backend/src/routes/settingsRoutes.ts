/**
 * App Settings API routes
 * Handles reading and updating application-level settings
 */

import { Router, Request, Response } from 'express';
import { getAppSetting, setAppSetting } from '../db/settingsQueries';

const router = Router();

/**
 * GET /api/settings/:key
 * Get an app setting value by key
 *
 * Response: 200 OK
 * { "key": "notification_lead_hours", "value": "24" }
 *
 * Response: 404 Not Found
 * { "status": "error", "message": "Setting not found" }
 */
router.get('/:key', async (req: Request, res: Response): Promise<void> => {
  try {
    const key = req.params.key as string;

    const value = await getAppSetting(key);

    if (value === null) {
      res.status(404).json({
        status: 'error',
        message: `Setting '${key}' not found`,
      });
      return;
    }

    res.status(200).json({ key, value });
  } catch (error) {
    console.error('Error fetching setting:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch setting',
    });
  }
});

/**
 * PUT /api/settings/:key
 * Update an app setting value
 *
 * Request body:
 * { "value": "48" }
 *
 * Response: 200 OK
 * { "key": "notification_lead_hours", "value": "48" }
 *
 * Response: 400 Bad Request (validation error)
 * { "status": "error", "message": "..." }
 */
router.put('/:key', async (req: Request, res: Response): Promise<void> => {
  try {
    const key = req.params.key as string;
    const { value } = req.body;

    if (value === undefined || value === null) {
      res.status(400).json({
        status: 'error',
        message: 'value is required',
      });
      return;
    }

    // Validate notification_lead_hours specifically: must be a non-negative integer
    if (key === 'notification_lead_hours') {
      const num = Number(value);
      if (!Number.isInteger(num) || num < 0) {
        res.status(400).json({
          status: 'error',
          message: 'notification_lead_hours must be a non-negative integer',
        });
        return;
      }
    }

    const stringValue = String(value);
    await setAppSetting(key, stringValue);

    res.status(200).json({ key, value: stringValue });
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update setting',
    });
  }
});

export default router;
