/**
 * Shopping item database queries tests
 */

import { query } from './connection';
import {
  addItem,
  getItemById,
  getShoppingList,
  updateItem,
  deleteItem,
  purchaseItem,
  createItemTemplate,
  getItemTemplateById,
  getItemTemplates,
  incrementItemTemplateUsage,
  deleteItemTemplate,
  AddItemInput,
  UpdateItemInput,
  CreateItemTemplateInput,
  ItemTemplateFilters,
} from './shoppingQueries';

// Mock the database connection
jest.mock('./connection');
const mockQuery = query as jest.MockedFunction<typeof query>;

// Shared mock row factory for shopping items
const makeMockItemRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'item-1',
  name: 'Apples',
  category: 'produce',
  added_by: 'user-1',
  is_purchased: false,
  purchased_by: null,
  purchased_at: null,
  created_at: new Date('2024-01-10T10:00:00Z'),
  updated_at: new Date('2024-01-10T10:00:00Z'),
  ...overrides,
});

// Shared mock row factory for item templates
const makeMockTemplateRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'template-1',
  name: 'Milk',
  category: 'dairy',
  is_prepopulated: true,
  created_by: null,
  usage_count: 0,
  created_at: new Date('2024-01-10T10:00:00Z'),
  ...overrides,
});

describe('Shopping Item Database Queries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // addItem
  // ---------------------------------------------------------------------------
  describe('addItem', () => {
    it('should insert a new shopping item and return the model', async () => {
      const input: AddItemInput = {
        name: 'Apples',
        category: 'produce',
        addedBy: 'user-1',
      };

      const mockRow = makeMockItemRow({ name: 'Apples', category: 'produce', added_by: 'user-1' });
      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 } as any);

      const result = await addItem(input);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO shopping_items'),
        [input.name, input.category, input.addedBy]
      );

      expect(result).toMatchObject({
        id: 'item-1',
        name: 'Apples',
        category: 'produce',
        addedBy: 'user-1',
        isPurchased: false,
        purchasedBy: undefined,
        purchasedAt: undefined,
      });
    });

    it('should handle different categories', async () => {
      const input: AddItemInput = {
        name: 'Bread',
        category: 'bakery',
        addedBy: 'user-2',
      };

      const mockRow = makeMockItemRow({ name: 'Bread', category: 'bakery', added_by: 'user-2' });
      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 } as any);

      const result = await addItem(input);

      expect(result.category).toBe('bakery');
      expect(result.addedBy).toBe('user-2');
    });
  });

  // ---------------------------------------------------------------------------
  // getItemById
  // ---------------------------------------------------------------------------
  describe('getItemById', () => {
    it('should retrieve a shopping item by ID', async () => {
      const mockRow = makeMockItemRow();
      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 } as any);

      const result = await getItemById('item-1');

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM shopping_items WHERE id = $1',
        ['item-1']
      );
      expect(result).toMatchObject({
        id: 'item-1',
        name: 'Apples',
        category: 'produce',
      });
    });

    it('should return null if item not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await getItemById('non-existent');

      expect(result).toBeNull();
    });

    it('should map purchased fields when item is purchased', async () => {
      const purchasedAt = new Date('2024-01-15T12:00:00Z');
      const mockRow = makeMockItemRow({
        is_purchased: true,
        purchased_by: 'user-2',
        purchased_at: purchasedAt,
      });
      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 } as any);

      const result = await getItemById('item-1');

      expect(result?.isPurchased).toBe(true);
      expect(result?.purchasedBy).toBe('user-2');
      expect(result?.purchasedAt).toEqual(purchasedAt);
    });
  });

  // ---------------------------------------------------------------------------
  // getShoppingList
  // ---------------------------------------------------------------------------
  describe('getShoppingList', () => {
    const mockItems = [
      makeMockItemRow({ id: 'item-1', name: 'Apples', category: 'produce' }),
      makeMockItemRow({ id: 'item-2', name: 'Milk', category: 'dairy' }),
      makeMockItemRow({ id: 'item-3', name: 'Bread', category: 'bakery' }),
    ];

    it('should return all unpurchased items without a category filter', async () => {
      mockQuery.mockResolvedValue({ rows: mockItems, rowCount: 3 } as any);

      const result = await getShoppingList();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('is_purchased = FALSE'),
        []
      );
      expect(result).toHaveLength(3);
    });

    it('should filter by category when provided', async () => {
      const produceItems = [mockItems[0]];
      mockQuery.mockResolvedValue({ rows: produceItems, rowCount: 1 } as any);

      const result = await getShoppingList('produce');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('category = $1'),
        ['produce']
      );
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('produce');
    });

    it('should order items by category then name', async () => {
      mockQuery.mockResolvedValue({ rows: mockItems, rowCount: 3 } as any);

      await getShoppingList();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY category ASC, name ASC'),
        []
      );
    });

    it('should not include purchased items', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      await getShoppingList();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('is_purchased = FALSE'),
        []
      );
    });
  });

  // ---------------------------------------------------------------------------
  // updateItem
  // ---------------------------------------------------------------------------
  describe('updateItem', () => {
    it('should update item name', async () => {
      const mockRow = makeMockItemRow({ name: 'Granny Smith Apples' });
      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 } as any);

      const result = await updateItem('item-1', { name: 'Granny Smith Apples' });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE shopping_items SET'),
        expect.arrayContaining(['Granny Smith Apples', 'item-1'])
      );
      expect(result?.name).toBe('Granny Smith Apples');
    });

    it('should update item category', async () => {
      const mockRow = makeMockItemRow({ category: 'frozen' });
      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 } as any);

      const result = await updateItem('item-1', { category: 'frozen' });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE shopping_items SET'),
        expect.arrayContaining(['frozen', 'item-1'])
      );
      expect(result?.category).toBe('frozen');
    });

    it('should update both name and category', async () => {
      const mockRow = makeMockItemRow({ name: 'Frozen Peas', category: 'frozen' });
      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 } as any);

      const input: UpdateItemInput = { name: 'Frozen Peas', category: 'frozen' };
      const result = await updateItem('item-1', input);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE shopping_items SET'),
        expect.arrayContaining(['Frozen Peas', 'frozen', 'item-1'])
      );
      expect(result).toMatchObject({ name: 'Frozen Peas', category: 'frozen' });
    });

    it('should return null if item not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await updateItem('non-existent', { name: 'Something' });

      expect(result).toBeNull();
    });

    it('should always update the updated_at timestamp', async () => {
      const mockRow = makeMockItemRow({ name: 'Oranges', updated_at: new Date() });
      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 } as any);

      await updateItem('item-1', { name: 'Oranges' });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('updated_at = CURRENT_TIMESTAMP'),
        expect.any(Array)
      );
    });
  });

  // ---------------------------------------------------------------------------
  // deleteItem
  // ---------------------------------------------------------------------------
  describe('deleteItem', () => {
    it('should delete a shopping item and return true', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      const result = await deleteItem('item-1');

      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM shopping_items WHERE id = $1',
        ['item-1']
      );
      expect(result).toBe(true);
    });

    it('should return false if item not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await deleteItem('non-existent');

      expect(result).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // purchaseItem
  // ---------------------------------------------------------------------------
  describe('purchaseItem', () => {
    it('should mark an item as purchased and set metadata', async () => {
      const purchasedAt = new Date('2024-01-15T14:00:00Z');
      const mockRow = makeMockItemRow({
        is_purchased: true,
        purchased_by: 'user-2',
        purchased_at: purchasedAt,
        updated_at: purchasedAt,
      });
      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 } as any);

      const result = await purchaseItem('item-1', 'user-2');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('is_purchased = TRUE'),
        ['user-2', 'item-1']
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('purchased_by = $1'),
        ['user-2', 'item-1']
      );
      expect(result).toMatchObject({
        isPurchased: true,
        purchasedBy: 'user-2',
      });
      expect(result?.purchasedAt).toEqual(purchasedAt);
    });

    it('should return null if item not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await purchaseItem('non-existent', 'user-1');

      expect(result).toBeNull();
    });

    it('should set purchased_at timestamp', async () => {
      const mockRow = makeMockItemRow({
        is_purchased: true,
        purchased_by: 'user-1',
        purchased_at: new Date(),
      });
      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 } as any);

      const result = await purchaseItem('item-1', 'user-1');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('purchased_at = CURRENT_TIMESTAMP'),
        expect.any(Array)
      );
      expect(result?.purchasedAt).toBeDefined();
    });
  });
});

// ---------------------------------------------------------------------------
// Item Template queries
// ---------------------------------------------------------------------------
describe('Item Template Database Queries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createItemTemplate', () => {
    it('should create a pre-populated item template', async () => {
      const input: CreateItemTemplateInput = {
        name: 'Milk',
        category: 'dairy',
        isPrePopulated: true,
      };

      const mockRow = makeMockTemplateRow();
      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 } as any);

      const result = await createItemTemplate(input);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO item_templates'),
        [input.name, input.category, true, null]
      );

      expect(result).toMatchObject({
        id: 'template-1',
        name: 'Milk',
        category: 'dairy',
        isPrePopulated: true,
        usageCount: 0,
      });
    });

    it('should create a custom item template with creator', async () => {
      const input: CreateItemTemplateInput = {
        name: 'Oat Milk',
        category: 'dairy',
        isPrePopulated: false,
        createdBy: 'user-1',
      };

      const mockRow = makeMockTemplateRow({
        name: 'Oat Milk',
        is_prepopulated: false,
        created_by: 'user-1',
      });
      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 } as any);

      const result = await createItemTemplate(input);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO item_templates'),
        [input.name, input.category, false, 'user-1']
      );

      expect(result).toMatchObject({
        name: 'Oat Milk',
        isPrePopulated: false,
        createdBy: 'user-1',
      });
    });
  });

  describe('getItemTemplateById', () => {
    it('should retrieve an item template by ID', async () => {
      const mockRow = makeMockTemplateRow({ usage_count: 5 });
      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 } as any);

      const result = await getItemTemplateById('template-1');

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM item_templates WHERE id = $1',
        ['template-1']
      );
      expect(result).toMatchObject({
        id: 'template-1',
        name: 'Milk',
        category: 'dairy',
        isPrePopulated: true,
        usageCount: 5,
      });
    });

    it('should return null if template not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await getItemTemplateById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getItemTemplates', () => {
    const mockTemplates = [
      makeMockTemplateRow({ id: 'template-1', name: 'Milk', category: 'dairy', usage_count: 10 }),
      makeMockTemplateRow({ id: 'template-2', name: 'Eggs', category: 'dairy', usage_count: 8 }),
      makeMockTemplateRow({
        id: 'template-3',
        name: 'Oat Milk',
        category: 'dairy',
        is_prepopulated: false,
        created_by: 'user-1',
        usage_count: 3,
      }),
    ];

    it('should get all item templates without filters', async () => {
      mockQuery.mockResolvedValue({ rows: mockTemplates, rowCount: 3 } as any);

      const result = await getItemTemplates();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM item_templates'),
        []
      );
      expect(result).toHaveLength(3);
    });

    it('should filter templates by pre-populated status', async () => {
      const prePopulated = mockTemplates.filter(t => t.is_prepopulated);
      mockQuery.mockResolvedValue({ rows: prePopulated, rowCount: 2 } as any);

      const filters: ItemTemplateFilters = { isPrePopulated: true };
      const result = await getItemTemplates(filters);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE is_prepopulated = $1'),
        [true]
      );
      expect(result).toHaveLength(2);
    });

    it('should filter templates by custom (non-prepopulated) status', async () => {
      const custom = mockTemplates.filter(t => !t.is_prepopulated);
      mockQuery.mockResolvedValue({ rows: custom, rowCount: 1 } as any);

      const filters: ItemTemplateFilters = { isPrePopulated: false };
      const result = await getItemTemplates(filters);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE is_prepopulated = $1'),
        [false]
      );
      expect(result).toHaveLength(1);
    });

    it('should filter templates by creator', async () => {
      const userTemplates = mockTemplates.filter(t => t.created_by === 'user-1');
      mockQuery.mockResolvedValue({ rows: userTemplates, rowCount: 1 } as any);

      const filters: ItemTemplateFilters = { createdBy: 'user-1' };
      const result = await getItemTemplates(filters);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE created_by = $1'),
        ['user-1']
      );
      expect(result).toHaveLength(1);
    });

    it('should combine isPrePopulated and createdBy filters', async () => {
      mockQuery.mockResolvedValue({ rows: [mockTemplates[2]], rowCount: 1 } as any);

      const filters: ItemTemplateFilters = { isPrePopulated: false, createdBy: 'user-1' };
      const result = await getItemTemplates(filters);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE is_prepopulated = $1 AND created_by = $2'),
        [false, 'user-1']
      );
      expect(result).toHaveLength(1);
    });

    it('should order templates by usage count descending then name ascending', async () => {
      mockQuery.mockResolvedValue({ rows: mockTemplates, rowCount: 3 } as any);

      await getItemTemplates();

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY usage_count DESC, name ASC'),
        []
      );
    });
  });

  describe('incrementItemTemplateUsage', () => {
    it('should increment usage count for a template', async () => {
      const mockRow = makeMockTemplateRow({ usage_count: 11 });
      mockQuery.mockResolvedValue({ rows: [mockRow], rowCount: 1 } as any);

      const result = await incrementItemTemplateUsage('template-1');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('usage_count = usage_count + 1'),
        ['template-1']
      );
      expect(result).toMatchObject({
        id: 'template-1',
        usageCount: 11,
      });
    });

    it('should return null if template not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await incrementItemTemplateUsage('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('deleteItemTemplate', () => {
    it('should delete an item template and return true', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      const result = await deleteItemTemplate('template-1');

      expect(mockQuery).toHaveBeenCalledWith(
        'DELETE FROM item_templates WHERE id = $1',
        ['template-1']
      );
      expect(result).toBe(true);
    });

    it('should return false if template not found', async () => {
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      const result = await deleteItemTemplate('non-existent');

      expect(result).toBe(false);
    });
  });
});
