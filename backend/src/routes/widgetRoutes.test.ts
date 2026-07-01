/**
 * Widget routes unit tests
 * Tests endpoint responses return text/html, correct status codes,
 * theme query param passthrough, and error handling.
 *
 * Task 4.4 — ha-dashboard-integration
 * _Requirements: 8.4, 8.5, 8.6, 8.7, 8.8_
 */

import request from 'supertest';
import app from '../index';

// Mock the services module
jest.mock('../services', () => {
  const actual = jest.requireActual('../services');
  return {
    ...actual,
    widgetService: {
      renderTaskWidget: jest.fn(),
      renderShoppingWidget: jest.fn(),
    },
  };
});

// Import after mocking
import { widgetService } from '../services';

const mockWidgetService = widgetService as jest.Mocked<typeof widgetService>;

// ─── Mock HTML responses ──────────────────────────────────────────────────────

const MOCK_TASK_HTML = '<!DOCTYPE html><html><head><meta http-equiv="refresh" content="60"></head><body><h1>Tasks Widget</h1></body></html>';
const MOCK_SHOPPING_HTML = '<!DOCTYPE html><html><head><meta http-equiv="refresh" content="60"></head><body><h1>Shopping Widget</h1></body></html>';

// ─── Unit Tests ──────────────────────────────────────────────────────────────

describe('Widget API Routes - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWidgetService.renderTaskWidget.mockResolvedValue(MOCK_TASK_HTML);
    mockWidgetService.renderShoppingWidget.mockResolvedValue(MOCK_SHOPPING_HTML);
  });

  // ─── GET /api/widgets/tasks ─────────────────────────────────────────────────

  describe('GET /api/widgets/tasks', () => {
    it('should return 200 with Content-Type text/html', async () => {
      const response = await request(app)
        .get('/api/widgets/tasks')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/html/);
    });

    it('should return HTML content in response body', async () => {
      const response = await request(app)
        .get('/api/widgets/tasks')
        .expect(200);

      expect(response.text).toContain('<!DOCTYPE html>');
      expect(response.text).toContain('Tasks Widget');
    });

    it('should pass theme query param to WidgetService', async () => {
      await request(app)
        .get('/api/widgets/tasks?theme=dark')
        .expect(200);

      expect(mockWidgetService.renderTaskWidget).toHaveBeenCalledWith({
        userId: undefined,
        theme: 'dark',
      });
    });

    it('should pass userId query param to WidgetService', async () => {
      await request(app)
        .get('/api/widgets/tasks?userId=user-42&theme=light')
        .expect(200);

      expect(mockWidgetService.renderTaskWidget).toHaveBeenCalledWith({
        userId: 'user-42',
        theme: 'light',
      });
    });

    it('should default theme to light when not specified', async () => {
      await request(app)
        .get('/api/widgets/tasks')
        .expect(200);

      expect(mockWidgetService.renderTaskWidget).toHaveBeenCalledWith({
        userId: undefined,
        theme: 'light',
      });
    });

    it('should default theme to light for invalid theme values', async () => {
      await request(app)
        .get('/api/widgets/tasks?theme=invalid')
        .expect(200);

      expect(mockWidgetService.renderTaskWidget).toHaveBeenCalledWith({
        userId: undefined,
        theme: 'light',
      });
    });

    it('should return 500 with text/html on service error', async () => {
      mockWidgetService.renderTaskWidget.mockRejectedValue(new Error('DB connection failed'));

      const response = await request(app)
        .get('/api/widgets/tasks')
        .expect(500);

      expect(response.headers['content-type']).toMatch(/text\/html/);
      expect(response.text).toContain('Error loading widget');
    });
  });

  // ─── GET /api/widgets/shopping ──────────────────────────────────────────────

  describe('GET /api/widgets/shopping', () => {
    it('should return 200 with Content-Type text/html', async () => {
      const response = await request(app)
        .get('/api/widgets/shopping')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/html/);
    });

    it('should return HTML content in response body', async () => {
      const response = await request(app)
        .get('/api/widgets/shopping')
        .expect(200);

      expect(response.text).toContain('<!DOCTYPE html>');
      expect(response.text).toContain('Shopping Widget');
    });

    it('should pass theme query param to WidgetService', async () => {
      await request(app)
        .get('/api/widgets/shopping?theme=dark')
        .expect(200);

      expect(mockWidgetService.renderShoppingWidget).toHaveBeenCalledWith({
        userId: undefined,
        theme: 'dark',
      });
    });

    it('should pass userId query param to WidgetService', async () => {
      await request(app)
        .get('/api/widgets/shopping?userId=user-99&theme=dark')
        .expect(200);

      expect(mockWidgetService.renderShoppingWidget).toHaveBeenCalledWith({
        userId: 'user-99',
        theme: 'dark',
      });
    });

    it('should default theme to light when not specified', async () => {
      await request(app)
        .get('/api/widgets/shopping')
        .expect(200);

      expect(mockWidgetService.renderShoppingWidget).toHaveBeenCalledWith({
        userId: undefined,
        theme: 'light',
      });
    });

    it('should default theme to light for invalid theme values', async () => {
      await request(app)
        .get('/api/widgets/shopping?theme=blue')
        .expect(200);

      expect(mockWidgetService.renderShoppingWidget).toHaveBeenCalledWith({
        userId: undefined,
        theme: 'light',
      });
    });

    it('should return 500 with text/html on service error', async () => {
      mockWidgetService.renderShoppingWidget.mockRejectedValue(new Error('Query timeout'));

      const response = await request(app)
        .get('/api/widgets/shopping')
        .expect(500);

      expect(response.headers['content-type']).toMatch(/text\/html/);
      expect(response.text).toContain('Error loading widget');
    });
  });
});
