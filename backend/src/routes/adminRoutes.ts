/**
 * Admin API routes
 * Handles administrative operations: database reset, configuration management
 */

import { Router, Request, Response } from 'express';
import { query } from '../db/connection';
import fs from 'fs';
import path from 'path';

const router = Router();

/**
 * POST /api/admin/reset
 * Reset database data based on provided options.
 * Preserves users and pre-populated templates always.
 *
 * Request body:
 * {
 *   "confirm": true,
 *   "clearHistory": boolean,
 *   "clearTasks": boolean,
 *   "clearShopping": boolean
 * }
 *
 * Response: 200 OK
 * { "message": "Database reset completed", "cleared": ["task_history", "tasks", ...] }
 *
 * Response: 400 Bad Request
 * { "status": "error", "message": "Confirmation required" }
 */
router.post('/reset', async (req: Request, res: Response): Promise<void> => {
  try {
    const { confirm, clearHistory, clearTasks, clearShopping } = req.body;

    if (confirm !== true) {
      res.status(400).json({
        status: 'error',
        message: 'Confirmation required. Set confirm: true to proceed.',
      });
      return;
    }

    const cleared: string[] = [];

    if (clearHistory) {
      await query('DELETE FROM task_history');
      cleared.push('task_history');
    }

    if (clearTasks) {
      await query('DELETE FROM tasks');
      cleared.push('tasks');
    }

    if (clearShopping) {
      await query('DELETE FROM shopping_items');
      cleared.push('shopping_items');
    }

    // If all three are cleared, also clear non-prepopulated templates
    if (clearHistory && clearTasks && clearShopping) {
      await query('DELETE FROM task_templates WHERE is_prepopulated = FALSE');
      await query('DELETE FROM item_templates WHERE is_prepopulated = FALSE');
      cleared.push('custom_templates');
    }

    res.status(200).json({
      message: 'Database reset completed',
      cleared,
    });
  } catch (error) {
    console.error('Error resetting database:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to reset database',
    });
  }
});

/**
 * GET /api/admin/config
 * Read the current configuration from .env file
 *
 * Response: 200 OK
 * { "port": 8080, ... }
 */
router.get('/config', async (_req: Request, res: Response): Promise<void> => {
  try {
    // Try .env.docker first, then .env in project root
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    let envPath = path.join(projectRoot, '.env.docker');
    
    if (!fs.existsSync(envPath)) {
      envPath = path.join(projectRoot, '.env');
    }

    if (!fs.existsSync(envPath)) {
      res.status(200).json({ port: 8080 });
      return;
    }

    const envContent = fs.readFileSync(envPath, 'utf8');
    const portMatch = envContent.match(/^WEB_PORT=(\d+)/m);
    const port = portMatch ? parseInt(portMatch[1], 10) : 8080;

    res.status(200).json({ port });
  } catch (error) {
    console.error('Error reading config:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to read configuration',
    });
  }
});

/**
 * PUT /api/admin/config
 * Update configuration (currently supports port)
 *
 * Request body:
 * { "port": 9090 }
 *
 * Response: 200 OK
 * { "message": "Configuration updated", "port": 9090, "restartRequired": true }
 *
 * Response: 400 Bad Request
 * { "status": "error", "message": "..." }
 */
router.put('/config', async (req: Request, res: Response): Promise<void> => {
  try {
    const { port } = req.body;

    // Validate port
    if (port === undefined || port === null) {
      res.status(400).json({
        status: 'error',
        message: 'Port is required',
      });
      return;
    }

    const portNum = Number(port);
    if (!Number.isInteger(portNum) || portNum < 1024 || portNum > 65535) {
      res.status(400).json({
        status: 'error',
        message: 'Port must be an integer between 1024 and 65535',
      });
      return;
    }

    // Find the .env file
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    let envPath = path.join(projectRoot, '.env');

    if (!fs.existsSync(envPath)) {
      // Create .env with just the port
      fs.writeFileSync(envPath, `WEB_PORT=${portNum}\n`, 'utf8');
    } else {
      // Read, replace WEB_PORT line, write back
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      if (envContent.match(/^WEB_PORT=/m)) {
        envContent = envContent.replace(/^WEB_PORT=.*/m, `WEB_PORT=${portNum}`);
      } else {
        envContent += `\nWEB_PORT=${portNum}\n`;
      }

      fs.writeFileSync(envPath, envContent, 'utf8');
    }

    res.status(200).json({
      message: 'Configuration updated',
      port: portNum,
      restartRequired: true,
    });
  } catch (error) {
    console.error('Error updating config:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update configuration',
    });
  }
});

export default router;
