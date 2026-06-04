/**
 * User API routes
 * Handles user-related HTTP endpoints
 */

import { Router, Request, Response } from 'express';
import { userService } from '../services/UserService';
import { createUser, getUserByName, updateUser, deleteUser, getUserById } from '../db/userQueries';
import { query } from '../db/connection';

const router = Router();

/**
 * GET /api/users
 * Get all users
 * 
 * Response: 200 OK
 * {
 *   "users": [
 *     { "id": "uuid", "name": "Alex", "createdAt": "2024-01-01T00:00:00.000Z" },
 *     ...
 *   ]
 * }
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const users = await userService.getAllUsers();
    res.status(200).json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch users',
    });
  }
});

/**
 * POST /api/users
 * Create a new user
 * 
 * Request body:
 * { "name": "NewUser" }
 * 
 * Response: 201 Created
 * { "user": { "id": "uuid", "name": "NewUser", "createdAt": "..." } }
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;

    // Validate non-empty name
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({
        status: 'error',
        message: 'Name is required and must be a non-empty string',
      });
      return;
    }

    const trimmedName = name.trim();

    // Check uniqueness
    const existing = await getUserByName(trimmedName);
    if (existing) {
      res.status(409).json({
        status: 'error',
        message: `A user with the name "${trimmedName}" already exists`,
      });
      return;
    }

    const user = await createUser(trimmedName);
    res.status(201).json({ user });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create user',
    });
  }
});

/**
 * PUT /api/users/:id
 * Rename a user
 * 
 * Request body:
 * { "name": "NewName" }
 * 
 * Response: 200 OK
 * { "user": { "id": "uuid", "name": "NewName", "createdAt": "..." } }
 */
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { name } = req.body;

    // Validate non-empty name
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({
        status: 'error',
        message: 'Name is required and must be a non-empty string',
      });
      return;
    }

    const trimmedName = name.trim();

    // Check user exists
    const existingUser = await getUserById(id);
    if (!existingUser) {
      res.status(404).json({
        status: 'error',
        message: `User with ID ${id} not found`,
      });
      return;
    }

    // Check uniqueness (allow same name for same user)
    const duplicate = await getUserByName(trimmedName);
    if (duplicate && duplicate.id !== id) {
      res.status(409).json({
        status: 'error',
        message: `A user with the name "${trimmedName}" already exists`,
      });
      return;
    }

    const user = await updateUser(id, trimmedName);
    res.status(200).json({ user });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update user',
    });
  }
});

/**
 * DELETE /api/users/:id
 * Delete a user and reassign their tasks to unassigned (null)
 * 
 * Response: 200 OK
 * { "message": "User deleted successfully" }
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    // Check user exists
    const existingUser = await getUserById(id);
    if (!existingUser) {
      res.status(404).json({
        status: 'error',
        message: `User with ID ${id} not found`,
      });
      return;
    }

    // Reassign tasks: set assigned_to to NULL for tasks assigned to this user
    // First we need to drop the NOT NULL constraint temporarily or handle it
    // Since the schema has assigned_to as NOT NULL REFERENCES users(id),
    // we'll reassign to the first available user that isn't the deleted user
    const allUsers = await userService.getAllUsers();
    const otherUsers = allUsers.filter(u => u.id !== id);
    
    if (otherUsers.length > 0) {
      // Reassign to first available user
      await query(
        'UPDATE tasks SET assigned_to = $1 WHERE assigned_to = $2',
        [otherUsers[0].id, id]
      );
      // Also reassign created_by references
      await query(
        'UPDATE tasks SET created_by = $1 WHERE created_by = $2',
        [otherUsers[0].id, id]
      );
    } else {
      // No other users — delete orphan tasks
      await query('DELETE FROM tasks WHERE assigned_to = $1', [id]);
    }

    // Remove references in task_history
    await query(
      'DELETE FROM task_history WHERE assigned_to = $1 OR completed_by = $1',
      [id]
    );

    // Remove references in shopping_items
    await query(
      'DELETE FROM shopping_items WHERE added_by = $1',
      [id]
    );

    const deleted = await deleteUser(id);
    if (!deleted) {
      res.status(500).json({
        status: 'error',
        message: 'Failed to delete user',
      });
      return;
    }

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete user',
    });
  }
});

/**
 * POST /api/users/select
 * Select current user for the session
 */
router.post('/select', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, userName } = req.body;

    // Validation: Either userId or userName must be provided
    if (!userId && !userName) {
      res.status(400).json({
        status: 'error',
        message: 'Either userId or userName is required',
      });
      return;
    }

    // Generate session ID from request
    const sessionId = req.headers['x-session-id'] as string || 
                      `${req.ip}-${req.headers['user-agent']}`;

    let session;
    
    if (userId) {
      session = await userService.selectUser(sessionId, userId);
    } else {
      session = await userService.selectUserByName(sessionId, userName);
    }

    res.status(200).json({ session });
  } catch (error) {
    console.error('Error selecting user:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        status: 'error',
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      status: 'error',
      message: 'Failed to select user',
    });
  }
});

export default router;
