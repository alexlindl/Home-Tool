/**
 * Widget API routes
 * Serves self-contained HTML widget pages for iframe-based
 * dashboard embedding in Home Assistant.
 *
 * @version 0.6.0-alpha
 */

import { Router, Request, Response } from 'express';
import { widgetService } from '../services';
import { WidgetOptions } from '../services/WidgetService';

const router = Router();

/**
 * Parse and validate the theme query parameter.
 * Returns 'light' or 'dark'. Defaults to 'light' if missing or invalid.
 */
function parseTheme(value: unknown): 'light' | 'dark' {
  if (value === 'dark') return 'dark';
  return 'light';
}

/**
 * GET /api/widgets/tasks
 * Render an embeddable HTML widget displaying pending tasks.
 *
 * Query parameters:
 *   userId - Optional user ID for interactive mode (action buttons)
 *   theme  - 'light' or 'dark' (defaults to 'light')
 *
 * Response: 200 OK with Content-Type: text/html; charset=utf-8
 * Returns self-contained HTML page with inline CSS/JS.
 *
 * Requirements: 8.1, 8.3, 8.4, 8.5, 8.6
 */
router.get('/tasks', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, theme } = req.query;

    const options: WidgetOptions = {
      userId: userId ? String(userId) : undefined,
      theme: parseTheme(theme),
    };

    const html = await widgetService.renderTaskWidget(options);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (error) {
    console.error('Error rendering task widget:', error);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(500).send(
      '<!DOCTYPE html><html><body><p>Error loading widget. Please try again later.</p></body></html>'
    );
  }
});

/**
 * GET /api/widgets/shopping
 * Render an embeddable HTML widget displaying unpurchased shopping items.
 *
 * Query parameters:
 *   userId - Optional user ID for interactive mode (check-off buttons)
 *   theme  - 'light' or 'dark' (defaults to 'light')
 *
 * Response: 200 OK with Content-Type: text/html; charset=utf-8
 * Returns self-contained HTML page with inline CSS/JS.
 *
 * Requirements: 8.2, 8.3, 8.4, 8.5, 8.6
 */
router.get('/shopping', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, theme } = req.query;

    const options: WidgetOptions = {
      userId: userId ? String(userId) : undefined,
      theme: parseTheme(theme),
    };

    const html = await widgetService.renderShoppingWidget(options);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (error) {
    console.error('Error rendering shopping widget:', error);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(500).send(
      '<!DOCTYPE html><html><body><p>Error loading widget. Please try again later.</p></body></html>'
    );
  }
});

export default router;
