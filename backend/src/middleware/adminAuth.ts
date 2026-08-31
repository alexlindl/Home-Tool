/**
 * Admin authorization middleware
 *
 * Guards the destructive administrative endpoints (backup, restore, reset,
 * factory-reset, config) behind a shared secret.
 *
 * Behavior is opt-in so it never breaks an existing deployment:
 * - If the ADMIN_API_SECRET environment variable is unset or empty, the guard
 *   is disabled and requests pass through unchanged (legacy behavior).
 * - If ADMIN_API_SECRET is set, every admin request MUST present a matching
 *   `X-Admin-Secret` header, otherwise it is rejected with 401.
 *
 * The comparison is length-safe and constant-time to avoid leaking the secret
 * via timing side channels.
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Constant-time string comparison that does not short-circuit on length.
 * Returns false for any mismatch (including differing lengths) without
 * revealing where the difference occurred.
 */
const safeEqual = (a: string, b: string): boolean => {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  // timingSafeEqual throws if lengths differ, so guard first — but still run a
  // comparison against a fixed-length buffer so the early return is not itself
  // a timing oracle on length.
  if (aBuf.length !== bBuf.length) {
    // Compare bBuf to itself to keep the work roughly constant, then fail.
    crypto.timingSafeEqual(bBuf, bBuf);
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
};

/**
 * Express middleware enforcing the admin shared secret when configured.
 */
export const requireAdminSecret = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const configuredSecret = process.env.ADMIN_API_SECRET;

  // Guard disabled when no secret is configured (opt-in).
  if (!configuredSecret || configuredSecret.trim().length === 0) {
    next();
    return;
  }

  const provided = req.headers['x-admin-secret'];
  const providedSecret = Array.isArray(provided) ? provided[0] : provided;

  if (typeof providedSecret !== 'string' || !safeEqual(providedSecret, configuredSecret)) {
    res.status(401).json({
      status: 'error',
      message: 'Admin authorization required',
    });
    return;
  }

  next();
};
