/**
 * Auth API routes
 * Handles authentication-related endpoints including HA ingress auto-login.
 *
 * Requirements: 4.2, 4.3, 4.4, 4.5
 */

import { Router, Request, Response } from 'express';
import { findUserByHaUsername } from '../db/userQueries';

const router = Router();

/**
 * GET /api/auth/me
 * Reads the X-Ingress-User header (set by HA ingress proxy) and returns
 * the matched household user for auto-login.
 *
 * - If header present and matches a user's ha_username (case-insensitive): returns user data
 * - If header absent, empty, or no match: returns { user: null }
 *
 * Always returns 200 — the frontend decides whether to show user-selection.
 */
router.get('/me', async (req: Request, res: Response): Promise<void> => {
  try {
    const ingressUser = req.headers['x-ingress-user'] as string | undefined;

    if (!ingressUser || ingressUser.trim().length === 0) {
      res.status(200).json({ user: null });
      return;
    }

    const user = await findUserByHaUsername(ingressUser.trim());

    if (!user) {
      res.status(200).json({ user: null });
      return;
    }

    res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        haUsername: user.haUsername,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Error in /api/auth/me:', error);
    res.status(200).json({ user: null });
  }
});

export default router;
