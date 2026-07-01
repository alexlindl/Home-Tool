/**
 * Widget Service
 * Server-side HTML generation for embeddable widget pages.
 * Produces self-contained HTML with inline CSS and JS for
 * iframe-based dashboard embedding in Home Assistant.
 *
 * @version 0.6.0-alpha
 */

import { query } from '../db/connection';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface WidgetOptions {
  userId?: string;
  theme?: 'light' | 'dark';
}

// ---------------------------------------------------------------------------
// Internal types for query results
// ---------------------------------------------------------------------------

interface TaskWidgetRow {
  id: string;
  title: string;
  assignee_name: string | null;
  due_date: Date | null;
}

interface ShoppingWidgetRow {
  id: string;
  name: string;
  category: string;
}

// ---------------------------------------------------------------------------
// WidgetService class
// ---------------------------------------------------------------------------

export class WidgetService {
  /**
   * Render a self-contained HTML widget page displaying pending tasks.
   *
   * Features:
   * - Meta refresh every 60 seconds
   * - Responsive layout (300–600px width)
   * - Theme support (light/dark)
   * - Interactive action buttons when userId is provided
   * - Read-only mode when no userId
   *
   * Requirements: 8.1, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8
   */
  async renderTaskWidget(options: WidgetOptions): Promise<string> {
    const { userId, theme } = options;
    const isDark = theme === 'dark';

    // Query pending tasks sorted by due date ascending, nulls last
    const result = await query(
      `SELECT t.id, t.title, u.name as assignee_name, t.due_date
       FROM tasks t
       LEFT JOIN users u ON t.assigned_to = u.id
       WHERE t.status = 'pending'
       ORDER BY t.due_date ASC NULLS LAST`,
      []
    );

    const tasks = result.rows as TaskWidgetRow[];

    // Build task list HTML
    const taskListHtml = tasks.length > 0
      ? tasks.map((task) => this.renderTaskItem(task, userId)).join('\n')
      : '<li class="empty-state">No pending tasks</li>';

    return this.buildHtmlPage({
      title: 'Tasks Widget',
      isDark,
      bodyContent: `
    <h1 class="widget-title">Pending Tasks</h1>
    <ul class="item-list">
      ${taskListHtml}
    </ul>`,
      inlineScript: userId ? this.getTaskScript(userId) : '',
    });
  }

  /**
   * Render a self-contained HTML widget page displaying unpurchased shopping items.
   *
   * Features:
   * - Meta refresh every 60 seconds
   * - Responsive layout (300–600px width)
   * - Theme support (light/dark)
   * - Interactive check-off buttons when userId is provided
   * - Read-only mode when no userId
   *
   * Requirements: 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8
   */
  async renderShoppingWidget(options: WidgetOptions): Promise<string> {
    const { userId, theme } = options;
    const isDark = theme === 'dark';

    // Query unpurchased shopping items
    const result = await query(
      `SELECT si.id, si.name, si.category
       FROM shopping_items si
       WHERE si.is_purchased = FALSE
       ORDER BY si.category ASC, si.name ASC`,
      []
    );

    const items = result.rows as ShoppingWidgetRow[];

    // Build shopping list HTML
    const itemListHtml = items.length > 0
      ? items.map((item) => this.renderShoppingItem(item, userId)).join('\n')
      : '<li class="empty-state">No items to buy</li>';

    return this.buildHtmlPage({
      title: 'Shopping Widget',
      isDark,
      bodyContent: `
    <h1 class="widget-title">Shopping List</h1>
    <ul class="item-list">
      ${itemListHtml}
    </ul>`,
      inlineScript: userId ? this.getShoppingScript(userId) : '',
    });
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private renderTaskItem(task: TaskWidgetRow, userId?: string): string {
    const dueDateStr = task.due_date
      ? new Date(task.due_date).toLocaleDateString()
      : '';
    const assigneeStr = task.assignee_name || 'Anyone';
    const actionButton = userId
      ? `<button class="action-btn" onclick="completeTask('${this.escapeHtml(task.id)}')">&#x2713;</button>`
      : '';

    return `      <li class="item-row">
        <div class="item-content">
          <span class="item-title">${this.escapeHtml(task.title)}</span>
          <span class="item-meta">${this.escapeHtml(assigneeStr)}${dueDateStr ? ' &middot; ' + this.escapeHtml(dueDateStr) : ''}</span>
        </div>
        ${actionButton}
      </li>`;
  }

  private renderShoppingItem(item: ShoppingWidgetRow, userId?: string): string {
    const actionButton = userId
      ? `<button class="action-btn" onclick="purchaseItem('${this.escapeHtml(item.id)}')">&#x2713;</button>`
      : '';

    return `      <li class="item-row">
        <div class="item-content">
          <span class="item-title">${this.escapeHtml(item.name)}</span>
          <span class="item-meta">${this.escapeHtml(item.category)}</span>
        </div>
        ${actionButton}
      </li>`;
  }

  private getTaskScript(userId: string): string {
    const escapedUserId = this.escapeHtml(userId);
    return `
    function completeTask(taskId) {
      var btn = event.currentTarget;
      btn.disabled = true;
      btn.textContent = '...';
      fetch('/api/tasks/' + taskId + '/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: '${escapedUserId}' })
      }).then(function(res) {
        if (res.ok) {
          btn.closest('.item-row').style.opacity = '0.4';
          btn.textContent = '\\u2714';
        } else {
          btn.disabled = false;
          btn.textContent = '\\u2713';
        }
      }).catch(function() {
        btn.disabled = false;
        btn.textContent = '\\u2713';
      });
    }`;
  }

  private getShoppingScript(userId: string): string {
    const escapedUserId = this.escapeHtml(userId);
    return `
    function purchaseItem(itemId) {
      var btn = event.currentTarget;
      btn.disabled = true;
      btn.textContent = '...';
      fetch('/api/shopping/' + itemId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPurchased: true, purchasedBy: '${escapedUserId}' })
      }).then(function(res) {
        if (res.ok) {
          btn.closest('.item-row').style.opacity = '0.4';
          btn.textContent = '\\u2714';
        } else {
          btn.disabled = false;
          btn.textContent = '\\u2713';
        }
      }).catch(function() {
        btn.disabled = false;
        btn.textContent = '\\u2713';
      });
    }`;
  }

  private buildHtmlPage(opts: {
    title: string;
    isDark: boolean;
    bodyContent: string;
    inlineScript: string;
  }): string {
    const { title, isDark, bodyContent, inlineScript } = opts;

    const bgColor = isDark ? '#1a1a2e' : '#ffffff';
    const textColor = isDark ? '#e0e0e0' : '#1a1a1a';
    const metaColor = isDark ? '#a0a0a0' : '#666666';
    const borderColor = isDark ? '#333355' : '#e0e0e0';
    const btnBg = isDark ? '#4a4a6a' : '#4caf50';
    const btnColor = '#ffffff';
    const hoverBtnBg = isDark ? '#5a5a7a' : '#45a049';
    const emptyColor = isDark ? '#888888' : '#999999';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="60">
  <title>${this.escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: ${bgColor};
      color: ${textColor};
      padding: 12px;
      min-width: 300px;
      max-width: 600px;
      margin: 0 auto;
    }
    .widget-title {
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid ${borderColor};
    }
    .item-list {
      list-style: none;
      padding: 0;
    }
    .item-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 4px;
      border-bottom: 1px solid ${borderColor};
    }
    .item-row:last-child {
      border-bottom: none;
    }
    .item-content {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
      margin-right: 8px;
    }
    .item-title {
      font-size: 0.95rem;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .item-meta {
      font-size: 0.8rem;
      color: ${metaColor};
      margin-top: 2px;
    }
    .action-btn {
      flex-shrink: 0;
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 50%;
      background: ${btnBg};
      color: ${btnColor};
      font-size: 1rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.2s;
    }
    .action-btn:hover {
      background: ${hoverBtnBg};
    }
    .action-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .empty-state {
      padding: 20px 4px;
      text-align: center;
      color: ${emptyColor};
      font-style: italic;
    }
  </style>
</head>
<body>
  ${bodyContent.trim()}
  ${inlineScript ? `<script>${inlineScript}\n  </script>` : ''}
</body>
</html>`;
  }

  /**
   * Escape HTML special characters to prevent XSS in rendered output.
   */
  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

// Export singleton instance
export const widgetService = new WidgetService();
