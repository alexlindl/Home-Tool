/**
 * Shopping routes unit tests
 * Tests the shopping API endpoints (CRUD, purchase, templates)
 */

import request from 'supertest';
import app from '../index';
import * as shoppingQueries from '../db/shoppingQueries';
import * as userQueries from '../db/userQueries';

// Mock the database queries
jest.mock('../db/shoppingQueries');
jest.mock('../db/userQueries');

const mockUser = {
  id: 'user-uuid-1',
  name: 'Alex' as const,
  createdAt: new Date('2024-01-01'),
};

const mockShoppingItem = {
  id: 'item-uuid-123',
  name: 'Milk',
  category: 'dairy' as const,
  addedBy: 'user-uuid-1',
  isPurchased: false,
  purchasedBy: undefined,
  purchasedAt: undefined,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
};

const mockPurchasedItem = {
  ...mockShoppingItem,
  isPurchased: true,
  purchasedBy: 'user-uuid-1',
  purchasedAt: new Date('2024-01-02T10:00:00.000Z'),
};

const mockTemplate = {
  id: 'tmpl-uuid-1',
  name: 'Milk',
  category: 'dairy' as const,
  isPrePopulated: true,
  createdBy: undefined,
  usageCount: 5,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
};

describe('Shopping API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── POST /api/shopping ─────────────────────────────────────────────────────

  describe('POST /api/shopping', () => {
    const validBody = {
      name: 'Milk',
      category: 'dairy',
      addedBy: 'user-uuid-1',
    };

    it('should add an item and return 201', async () => {
      (userQueries.getUserById as jest.Mock).mockResolvedValue(mockUser);
      (shoppingQueries.addItem as jest.Mock).mockResolvedValue(mockShoppingItem);
      (shoppingQueries.getItemTemplates as jest.Mock).mockResolvedValue([]);
      (shoppingQueries.createItemTemplate as jest.Mock).mockResolvedValue(mockTemplate);

      const response = await request(app)
        .post('/api/shopping')
        .send(validBody)
        .expect(201);

      expect(response.body).toHaveProperty('item');
      expect(response.body.item).toHaveProperty('id', 'item-uuid-123');
      expect(response.body.item).toHaveProperty('name', 'Milk');
    });

    it('should add item from template when templateId is provided', async () => {
      (shoppingQueries.getItemTemplateById as jest.Mock).mockResolvedValue(mockTemplate);
      (shoppingQueries.incrementItemTemplateUsage as jest.Mock).mockResolvedValue(mockTemplate);
      (userQueries.getUserById as jest.Mock).mockResolvedValue(mockUser);
      (shoppingQueries.addItem as jest.Mock).mockResolvedValue(mockShoppingItem);
      (shoppingQueries.getItemTemplates as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .post('/api/shopping')
        .send({ templateId: 'tmpl-uuid-1', addedBy: 'user-uuid-1' })
        .expect(201);

      expect(response.body).toHaveProperty('item');
      expect(shoppingQueries.getItemTemplateById).toHaveBeenCalledWith('tmpl-uuid-1');
    });

    it('should return 400 when name is missing', async () => {
      const response = await request(app)
        .post('/api/shopping')
        .send({ category: 'dairy', addedBy: 'user-uuid-1' })
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('name');
    });

    it('should return 400 when category is missing', async () => {
      const response = await request(app)
        .post('/api/shopping')
        .send({ name: 'Milk', addedBy: 'user-uuid-1' })
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('category');
    });

    it('should return 400 when addedBy is missing', async () => {
      const response = await request(app)
        .post('/api/shopping')
        .send({ name: 'Milk', category: 'dairy' })
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('addedBy');
    });

    it('should return 400 when addedBy is missing for template-based add', async () => {
      const response = await request(app)
        .post('/api/shopping')
        .send({ templateId: 'tmpl-uuid-1' })
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('addedBy');
    });

    it('should return 400 for invalid category', async () => {
      (userQueries.getUserById as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/shopping')
        .send({ name: 'Milk', category: 'invalid', addedBy: 'user-uuid-1' })
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('Category');
    });

    it('should return 400 when user does not exist', async () => {
      (userQueries.getUserById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/shopping')
        .send(validBody)
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('not found');
    });

    it('should return 404 when template does not exist', async () => {
      (shoppingQueries.getItemTemplateById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/shopping')
        .send({ templateId: 'nonexistent-tmpl', addedBy: 'user-uuid-1' })
        .expect(404);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('template');
    });

    it('should handle database errors gracefully', async () => {
      (userQueries.getUserById as jest.Mock).mockResolvedValue(mockUser);
      (shoppingQueries.addItem as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );
      (shoppingQueries.getItemTemplates as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .post('/api/shopping')
        .send(validBody)
        .expect(500);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('message', 'Failed to add shopping item');
    });
  });

  // ─── GET /api/shopping ──────────────────────────────────────────────────────

  describe('GET /api/shopping', () => {
    it('should return all unpurchased items with 200', async () => {
      (shoppingQueries.getShoppingList as jest.Mock).mockResolvedValue([mockShoppingItem]);

      const response = await request(app)
        .get('/api/shopping')
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0]).toHaveProperty('id', 'item-uuid-123');
    });

    it('should return empty array when no items exist', async () => {
      (shoppingQueries.getShoppingList as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/shopping')
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(response.body.items).toHaveLength(0);
    });

    it('should filter items by category', async () => {
      (shoppingQueries.getShoppingList as jest.Mock).mockResolvedValue([mockShoppingItem]);

      const response = await request(app)
        .get('/api/shopping?category=dairy')
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(shoppingQueries.getShoppingList).toHaveBeenCalledWith('dairy');
    });

    it('should return 400 for invalid category', async () => {
      const response = await request(app)
        .get('/api/shopping?category=invalid')
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('Category');
    });

    it('should handle database errors gracefully', async () => {
      (shoppingQueries.getShoppingList as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .get('/api/shopping')
        .expect(500);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('message', 'Failed to fetch shopping list');
    });
  });

  // ─── GET /api/shopping/templates ────────────────────────────────────────────

  describe('GET /api/shopping/templates', () => {
    const mockTemplates = [
      mockTemplate,
      {
        id: 'tmpl-uuid-2',
        name: 'Bread',
        category: 'bakery' as const,
        isPrePopulated: false,
        createdBy: 'user-uuid-1',
        usageCount: 2,
        createdAt: new Date('2024-02-01T00:00:00.000Z'),
      },
    ];

    it('should return all templates with 200 when no filter provided', async () => {
      (shoppingQueries.getItemTemplates as jest.Mock).mockResolvedValue(mockTemplates);

      const response = await request(app)
        .get('/api/shopping/templates')
        .expect(200);

      expect(response.body).toHaveProperty('templates');
      expect(response.body.templates).toHaveLength(2);
      expect(shoppingQueries.getItemTemplates).toHaveBeenCalledWith(undefined);
    });

    it('should return only pre-populated templates when isPrePopulated=true', async () => {
      const prePopulated = mockTemplates.filter((t) => t.isPrePopulated);
      (shoppingQueries.getItemTemplates as jest.Mock).mockResolvedValue(prePopulated);

      const response = await request(app)
        .get('/api/shopping/templates?isPrePopulated=true')
        .expect(200);

      expect(response.body).toHaveProperty('templates');
      expect(response.body.templates).toHaveLength(1);
      expect(response.body.templates[0]).toHaveProperty('isPrePopulated', true);
      expect(shoppingQueries.getItemTemplates).toHaveBeenCalledWith({ isPrePopulated: true });
    });

    it('should return only custom templates when isPrePopulated=false', async () => {
      const custom = mockTemplates.filter((t) => !t.isPrePopulated);
      (shoppingQueries.getItemTemplates as jest.Mock).mockResolvedValue(custom);

      const response = await request(app)
        .get('/api/shopping/templates?isPrePopulated=false')
        .expect(200);

      expect(response.body).toHaveProperty('templates');
      expect(response.body.templates).toHaveLength(1);
      expect(response.body.templates[0]).toHaveProperty('isPrePopulated', false);
      expect(shoppingQueries.getItemTemplates).toHaveBeenCalledWith({ isPrePopulated: false });
    });

    it('should return empty array when no templates exist', async () => {
      (shoppingQueries.getItemTemplates as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/shopping/templates')
        .expect(200);

      expect(response.body).toHaveProperty('templates');
      expect(response.body.templates).toHaveLength(0);
    });

    it('should return 400 for invalid isPrePopulated value', async () => {
      const response = await request(app)
        .get('/api/shopping/templates?isPrePopulated=yes')
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('isPrePopulated');
    });

    it('should handle database errors gracefully', async () => {
      (shoppingQueries.getItemTemplates as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .get('/api/shopping/templates')
        .expect(500);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('message', 'Failed to fetch item templates');
    });
  });

  // ─── GET /api/shopping/:id ──────────────────────────────────────────────────

  describe('GET /api/shopping/:id', () => {
    it('should return an item by ID with 200', async () => {
      (shoppingQueries.getItemById as jest.Mock).mockResolvedValue(mockShoppingItem);

      const response = await request(app)
        .get('/api/shopping/item-uuid-123')
        .expect(200);

      expect(response.body).toHaveProperty('item');
      expect(response.body.item).toHaveProperty('id', 'item-uuid-123');
      expect(response.body.item).toHaveProperty('name', 'Milk');
    });

    it('should return 404 when item is not found', async () => {
      (shoppingQueries.getItemById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/shopping/nonexistent-id')
        .expect(404);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('not found');
    });

    it('should handle database errors gracefully', async () => {
      (shoppingQueries.getItemById as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .get('/api/shopping/item-uuid-123')
        .expect(500);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('message', 'Failed to fetch shopping item');
    });
  });

  // ─── PUT /api/shopping/:id ──────────────────────────────────────────────────

  describe('PUT /api/shopping/:id', () => {
    it('should update an item and return 200', async () => {
      const updatedItem = { ...mockShoppingItem, name: 'Organic Milk' };
      (shoppingQueries.getItemById as jest.Mock).mockResolvedValue(mockShoppingItem);
      (shoppingQueries.updateItem as jest.Mock).mockResolvedValue(updatedItem);

      const response = await request(app)
        .put('/api/shopping/item-uuid-123')
        .send({ name: 'Organic Milk' })
        .expect(200);

      expect(response.body).toHaveProperty('item');
      expect(response.body.item).toHaveProperty('name', 'Organic Milk');
    });

    it('should update category and return 200', async () => {
      const updatedItem = { ...mockShoppingItem, category: 'produce' };
      (shoppingQueries.getItemById as jest.Mock).mockResolvedValue(mockShoppingItem);
      (shoppingQueries.updateItem as jest.Mock).mockResolvedValue(updatedItem);

      const response = await request(app)
        .put('/api/shopping/item-uuid-123')
        .send({ category: 'produce' })
        .expect(200);

      expect(response.body).toHaveProperty('item');
      expect(response.body.item).toHaveProperty('category', 'produce');
    });

    it('should return 404 when item is not found', async () => {
      (shoppingQueries.getItemById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .put('/api/shopping/nonexistent-id')
        .send({ name: 'Updated' })
        .expect(404);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('not found');
    });

    it('should return 400 for invalid category', async () => {
      (shoppingQueries.getItemById as jest.Mock).mockResolvedValue(mockShoppingItem);

      const response = await request(app)
        .put('/api/shopping/item-uuid-123')
        .send({ category: 'invalid' })
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('Category');
    });

    it('should return 400 for empty name', async () => {
      (shoppingQueries.getItemById as jest.Mock).mockResolvedValue(mockShoppingItem);

      const response = await request(app)
        .put('/api/shopping/item-uuid-123')
        .send({ name: '  ' })
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('name');
    });

    it('should handle database errors gracefully', async () => {
      (shoppingQueries.getItemById as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .put('/api/shopping/item-uuid-123')
        .send({ name: 'Updated' })
        .expect(500);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('message', 'Failed to update shopping item');
    });
  });

  // ─── DELETE /api/shopping/:id ───────────────────────────────────────────────

  describe('DELETE /api/shopping/:id', () => {
    it('should delete an item and return 200', async () => {
      (shoppingQueries.getItemById as jest.Mock).mockResolvedValue(mockShoppingItem);
      (shoppingQueries.deleteItem as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/shopping/item-uuid-123')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Shopping item deleted successfully');
    });

    it('should return 404 when item is not found', async () => {
      (shoppingQueries.getItemById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/shopping/nonexistent-id')
        .expect(404);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('not found');
    });

    it('should handle database errors gracefully', async () => {
      (shoppingQueries.getItemById as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .delete('/api/shopping/item-uuid-123')
        .expect(500);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('message', 'Failed to delete shopping item');
    });
  });

  // ─── POST /api/shopping/:id/purchase ────────────────────────────────────────

  describe('POST /api/shopping/:id/purchase', () => {
    it('should mark an item as purchased and return 200', async () => {
      (shoppingQueries.getItemById as jest.Mock).mockResolvedValue(mockShoppingItem);
      (userQueries.getUserById as jest.Mock).mockResolvedValue(mockUser);
      (shoppingQueries.purchaseItem as jest.Mock).mockResolvedValue(mockPurchasedItem);

      const response = await request(app)
        .post('/api/shopping/item-uuid-123/purchase')
        .send({ userId: 'user-uuid-1' })
        .expect(200);

      expect(response.body).toHaveProperty('item');
      expect(response.body.item).toHaveProperty('isPurchased', true);
      expect(response.body.item).toHaveProperty('purchasedBy', 'user-uuid-1');
    });

    it('should return 400 when userId is missing', async () => {
      const response = await request(app)
        .post('/api/shopping/item-uuid-123/purchase')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('userId');
    });

    it('should return 404 when item is not found', async () => {
      (shoppingQueries.getItemById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/shopping/nonexistent-id/purchase')
        .send({ userId: 'user-uuid-1' })
        .expect(404);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('not found');
    });

    it('should return 400 when item is already purchased', async () => {
      (shoppingQueries.getItemById as jest.Mock).mockResolvedValue(mockPurchasedItem);

      const response = await request(app)
        .post('/api/shopping/item-uuid-123/purchase')
        .send({ userId: 'user-uuid-1' })
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('already purchased');
    });

    it('should return 400 when user does not exist', async () => {
      (shoppingQueries.getItemById as jest.Mock).mockResolvedValue(mockShoppingItem);
      (userQueries.getUserById as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/shopping/item-uuid-123/purchase')
        .send({ userId: 'nonexistent-user-id' })
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body.message).toContain('not found');
    });

    it('should handle database errors gracefully', async () => {
      (shoppingQueries.getItemById as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .post('/api/shopping/item-uuid-123/purchase')
        .send({ userId: 'user-uuid-1' })
        .expect(500);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('message', 'Failed to purchase shopping item');
    });
  });
});
