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

/**
 * GET /api/admin/backup
 * Export all database data as JSON for backup purposes.
 *
 * Response: 200 OK (application/json download)
 */
router.get('/backup', async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await query('SELECT * FROM users');
    const tasks = await query('SELECT * FROM tasks');
    const taskHistory = await query('SELECT * FROM task_history');
    const taskTemplates = await query('SELECT * FROM task_templates');
    const shoppingItems = await query('SELECT * FROM shopping_items');
    const itemTemplates = await query('SELECT * FROM item_templates');
    const taskLists = await query('SELECT * FROM task_lists');
    const shoppingLists = await query('SELECT * FROM shopping_lists');
    const categories = await query('SELECT * FROM categories');

    const backup = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      data: {
        users: users.rows,
        tasks: tasks.rows,
        task_history: taskHistory.rows,
        task_templates: taskTemplates.rows,
        shopping_items: shoppingItems.rows,
        item_templates: itemTemplates.rows,
        task_lists: taskLists.rows,
        shopping_lists: shoppingLists.rows,
        categories: categories.rows,
      },
    };

    res.setHeader('Content-Disposition', 'attachment; filename=household-backup.json');
    res.json(backup);
  } catch (error) {
    console.error('Error creating backup:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create backup',
    });
  }
});

/**
 * POST /api/admin/restore
 * Import a backup JSON file, replacing all existing data.
 *
 * Request body:
 * { "data": { ... }, "confirm": true }
 *
 * Response: 200 OK
 * { "message": "Restore completed successfully" }
 */
router.post('/restore', async (req: Request, res: Response): Promise<void> => {
  try {
    const { data, confirm } = req.body;

    if (confirm !== true || !data) {
      res.status(400).json({
        status: 'error',
        message: 'Confirmation and data required',
      });
      return;
    }

    // Clear existing data (order matters for foreign keys)
    await query('DELETE FROM task_history');
    await query('DELETE FROM shopping_items');
    await query('DELETE FROM tasks');
    await query('DELETE FROM item_templates');
    await query('DELETE FROM task_templates');
    await query('DELETE FROM shopping_lists');
    await query('DELETE FROM task_lists');
    await query('DELETE FROM categories');
    await query('DELETE FROM users');

    // Re-insert from backup (with original IDs, respecting foreign key order)
    for (const row of data.users || []) {
      await query(
        'INSERT INTO users (id, name, created_at) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
        [row.id, row.name, row.created_at],
      );
    }

    for (const row of data.categories || []) {
      await query(
        'INSERT INTO categories (id, name, is_default, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
        [row.id, row.name, row.is_default, row.created_at],
      );
    }

    for (const row of data.task_lists || []) {
      await query(
        'INSERT INTO task_lists (id, name, is_default, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
        [row.id, row.name, row.is_default, row.created_at],
      );
    }

    for (const row of data.shopping_lists || []) {
      await query(
        'INSERT INTO shopping_lists (id, name, is_default, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
        [row.id, row.name, row.is_default, row.created_at],
      );
    }

    for (const row of data.task_templates || []) {
      await query(
        'INSERT INTO task_templates (id, title, description, is_prepopulated, created_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
        [row.id, row.title, row.description, row.is_prepopulated, row.created_at],
      );
    }

    for (const row of data.item_templates || []) {
      await query(
        'INSERT INTO item_templates (id, name, category, is_prepopulated, created_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
        [row.id, row.name, row.category, row.is_prepopulated, row.created_at],
      );
    }

    for (const row of data.tasks || []) {
      await query(
        'INSERT INTO tasks (id, title, description, assigned_to, due_date, is_recurring, recurrence_frequency, recurrence_interval, recurrence_end_date, status, created_by, list_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) ON CONFLICT (id) DO NOTHING',
        [row.id, row.title, row.description, row.assigned_to, row.due_date, row.is_recurring, row.recurrence_frequency, row.recurrence_interval, row.recurrence_end_date, row.status, row.created_by, row.list_id, row.created_at],
      );
    }

    for (const row of data.shopping_items || []) {
      await query(
        'INSERT INTO shopping_items (id, name, category, added_by, is_purchased, purchased_by, list_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING',
        [row.id, row.name, row.category, row.added_by, row.is_purchased, row.purchased_by, row.list_id, row.created_at],
      );
    }

    for (const row of data.task_history || []) {
      await query(
        'INSERT INTO task_history (id, task_id, title, assigned_to, completed_by, completed_at, was_recurring) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING',
        [row.id, row.task_id, row.title, row.assigned_to, row.completed_by, row.completed_at, row.was_recurring],
      );
    }

    res.json({ message: 'Restore completed successfully' });
  } catch (error) {
    console.error('Error restoring backup:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to restore backup',
    });
  }
});

/**
 * POST /api/admin/factory-reset
 * Complete factory reset — deletes ALL data including users.
 * Returns the app to a fresh install state.
 *
 * Request body: { "confirm": true }
 */
router.post('/factory-reset', async (req: Request, res: Response): Promise<void> => {
  try {
    const { confirm } = req.body;

    if (confirm !== true) {
      res.status(400).json({
        status: 'error',
        message: 'Confirmation required. Set confirm: true to proceed.',
      });
      return;
    }

    // Delete everything in correct FK order
    await query('DELETE FROM task_history');
    await query('DELETE FROM shopping_items');
    await query('DELETE FROM tasks');
    await query('DELETE FROM item_templates');
    await query('DELETE FROM task_templates');
    await query('DELETE FROM shopping_lists');
    await query('DELETE FROM task_lists');
    await query('DELETE FROM categories');
    await query('DELETE FROM users');

    // Re-seed default lists and categories
    await query("INSERT INTO task_lists (name, is_default) SELECT 'Tasks', TRUE WHERE NOT EXISTS (SELECT 1 FROM task_lists WHERE is_default = TRUE)");
    await query("INSERT INTO shopping_lists (name, is_default) SELECT 'Shopping', TRUE WHERE NOT EXISTS (SELECT 1 FROM shopping_lists WHERE is_default = TRUE)");

    res.status(200).json({ message: 'Factory reset completed. All data has been deleted.' });
  } catch (error) {
    console.error('Error during factory reset:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to perform factory reset',
    });
  }
});

export default router;
