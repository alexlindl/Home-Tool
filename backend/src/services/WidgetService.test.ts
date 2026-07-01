/**
 * WidgetService unit tests
 * Tests HTML structure, meta refresh tag, theme CSS classes,
 * read-only vs interactive mode, responsive meta viewport.
 *
 * Task 4.4 — ha-dashboard-integration
 * _Requirements: 8.4, 8.5, 8.6, 8.7, 8.8_
 */

import { WidgetService } from './WidgetService';

// Mock the database connection module
jest.mock('../db/connection', () => ({
  query: jest.fn(),
}));

import { query } from '../db/connection';

const mockQuery = query as jest.MockedFunction<typeof query>;

describe('WidgetService', () => {
  let service: WidgetService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WidgetService();
  });

  // ─── renderTaskWidget ─────────────────────────────────────────────────────

  describe('renderTaskWidget()', () => {
    beforeEach(() => {
      mockQuery.mockResolvedValue({
        rows: [
          { id: 'task-1', title: 'Take out trash', assignee_name: 'Alex', due_date: new Date('2024-06-01') },
          { id: 'task-2', title: 'Buy milk', assignee_name: null, due_date: null },
        ],
        rowCount: 2,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });
    });

    it('should contain meta refresh tag with 60 second interval', async () => {
      const html = await service.renderTaskWidget({ theme: 'light' });
      expect(html).toContain('<meta http-equiv="refresh" content="60">');
    });

    it('should contain responsive meta viewport tag', async () => {
      const html = await service.renderTaskWidget({ theme: 'light' });
      expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
    });

    it('should contain max-width: 600px in CSS', async () => {
      const html = await service.renderTaskWidget({ theme: 'light' });
      expect(html).toContain('max-width: 600px');
    });

    it('should contain min-width: 300px in CSS', async () => {
      const html = await service.renderTaskWidget({ theme: 'light' });
      expect(html).toContain('min-width: 300px');
    });

    it('should use dark theme colors when theme=dark', async () => {
      const html = await service.renderTaskWidget({ theme: 'dark' });
      // Dark theme background color
      expect(html).toContain('#1a1a2e');
      // Dark theme text color
      expect(html).toContain('#e0e0e0');
    });

    it('should use light theme colors when theme=light', async () => {
      const html = await service.renderTaskWidget({ theme: 'light' });
      // Light theme background
      expect(html).toContain('background-color: #ffffff');
      // Light theme text color
      expect(html).toContain('color: #1a1a1a');
    });

    it('should contain <button elements when userId is provided (interactive mode)', async () => {
      const html = await service.renderTaskWidget({ userId: 'user-1', theme: 'light' });
      expect(html).toContain('<button');
      expect(html).toContain('action-btn');
    });

    it('should NOT contain <button elements when no userId (read-only mode)', async () => {
      const html = await service.renderTaskWidget({ theme: 'light' });
      expect(html).not.toContain('<button');
    });

    it('should render a valid HTML document with DOCTYPE', async () => {
      const html = await service.renderTaskWidget({ theme: 'light' });
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('</html>');
    });

    it('should include task titles in the output', async () => {
      const html = await service.renderTaskWidget({ theme: 'light' });
      expect(html).toContain('Take out trash');
      expect(html).toContain('Buy milk');
    });

    it('should show empty state message when no tasks', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const html = await service.renderTaskWidget({ theme: 'light' });
      expect(html).toContain('No pending tasks');
    });

    it('should include inline script when userId is provided', async () => {
      const html = await service.renderTaskWidget({ userId: 'user-42', theme: 'light' });
      expect(html).toContain('<script>');
      expect(html).toContain('completeTask');
    });

    it('should NOT include inline script when no userId', async () => {
      const html = await service.renderTaskWidget({ theme: 'light' });
      expect(html).not.toContain('<script>');
    });
  });

  // ─── renderShoppingWidget ─────────────────────────────────────────────────

  describe('renderShoppingWidget()', () => {
    beforeEach(() => {
      mockQuery.mockResolvedValue({
        rows: [
          { id: 'item-1', name: 'Milk', category: 'dairy' },
          { id: 'item-2', name: 'Bread', category: 'bakery' },
        ],
        rowCount: 2,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });
    });

    it('should contain meta refresh tag with 60 second interval', async () => {
      const html = await service.renderShoppingWidget({ theme: 'light' });
      expect(html).toContain('<meta http-equiv="refresh" content="60">');
    });

    it('should contain responsive meta viewport tag', async () => {
      const html = await service.renderShoppingWidget({ theme: 'light' });
      expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
    });

    it('should contain max-width: 600px in CSS', async () => {
      const html = await service.renderShoppingWidget({ theme: 'light' });
      expect(html).toContain('max-width: 600px');
    });

    it('should contain min-width: 300px in CSS', async () => {
      const html = await service.renderShoppingWidget({ theme: 'light' });
      expect(html).toContain('min-width: 300px');
    });

    it('should use dark theme colors when theme=dark', async () => {
      const html = await service.renderShoppingWidget({ theme: 'dark' });
      expect(html).toContain('#1a1a2e');
      expect(html).toContain('#e0e0e0');
    });

    it('should use light theme colors when theme=light', async () => {
      const html = await service.renderShoppingWidget({ theme: 'light' });
      expect(html).toContain('background-color: #ffffff');
      expect(html).toContain('color: #1a1a1a');
    });

    it('should contain <button elements when userId is provided (interactive mode)', async () => {
      const html = await service.renderShoppingWidget({ userId: 'user-1', theme: 'light' });
      expect(html).toContain('<button');
      expect(html).toContain('action-btn');
    });

    it('should NOT contain <button elements when no userId (read-only mode)', async () => {
      const html = await service.renderShoppingWidget({ theme: 'light' });
      expect(html).not.toContain('<button');
    });

    it('should render a valid HTML document with DOCTYPE', async () => {
      const html = await service.renderShoppingWidget({ theme: 'light' });
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('</html>');
    });

    it('should include item names in the output', async () => {
      const html = await service.renderShoppingWidget({ theme: 'light' });
      expect(html).toContain('Milk');
      expect(html).toContain('Bread');
    });

    it('should show empty state message when no items', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const html = await service.renderShoppingWidget({ theme: 'light' });
      expect(html).toContain('No items to buy');
    });

    it('should include inline script when userId is provided', async () => {
      const html = await service.renderShoppingWidget({ userId: 'user-42', theme: 'light' });
      expect(html).toContain('<script>');
      expect(html).toContain('purchaseItem');
    });

    it('should NOT include inline script when no userId', async () => {
      const html = await service.renderShoppingWidget({ theme: 'light' });
      expect(html).not.toContain('<script>');
    });
  });
});
