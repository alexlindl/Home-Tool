/**
 * ShoppingService tests
 * Tests for shopping item creation logic, template management, and validation
 */

import { ShoppingService, ShoppingItemInput, ShoppingValidationError } from './ShoppingService';
import { ShoppingItem, ItemTemplate } from '../models/Shopping';
import * as shoppingQueries from '../db/shoppingQueries';
import * as userQueries from '../db/userQueries';
import * as categoryQueries from '../db/categoryQueries';

// Mock the database query modules
jest.mock('../db/shoppingQueries');
jest.mock('../db/userQueries');
jest.mock('../db/categoryQueries');

const mockAddItem = shoppingQueries.addItem as jest.MockedFunction<typeof shoppingQueries.addItem>;
const mockGetItemById = shoppingQueries.getItemById as jest.MockedFunction<typeof shoppingQueries.getItemById>;
const mockGetShoppingList = shoppingQueries.getShoppingList as jest.MockedFunction<typeof shoppingQueries.getShoppingList>;
const mockUpdateItem = shoppingQueries.updateItem as jest.MockedFunction<typeof shoppingQueries.updateItem>;
const mockDeleteItem = shoppingQueries.deleteItem as jest.MockedFunction<typeof shoppingQueries.deleteItem>;
const mockPurchaseItem = shoppingQueries.purchaseItem as jest.MockedFunction<typeof shoppingQueries.purchaseItem>;
const mockGetItemTemplates = shoppingQueries.getItemTemplates as jest.MockedFunction<typeof shoppingQueries.getItemTemplates>;
const mockCreateItemTemplate = shoppingQueries.createItemTemplate as jest.MockedFunction<typeof shoppingQueries.createItemTemplate>;
const mockGetItemTemplateById = shoppingQueries.getItemTemplateById as jest.MockedFunction<typeof shoppingQueries.getItemTemplateById>;
const mockIncrementItemTemplateUsage = shoppingQueries.incrementItemTemplateUsage as jest.MockedFunction<typeof shoppingQueries.incrementItemTemplateUsage>;
const mockGetUserById = userQueries.getUserById as jest.MockedFunction<typeof userQueries.getUserById>;
const mockGetAllCategories = categoryQueries.getAllCategories as jest.MockedFunction<typeof categoryQueries.getAllCategories>;

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockUsers = {
  alex: { id: 'user-1', name: 'Alex' as const, createdAt: new Date('2024-01-01') },
  becky: { id: 'user-2', name: 'Becky' as const, createdAt: new Date('2024-01-01') },
  sam: { id: 'user-3', name: 'Sam' as const, createdAt: new Date('2024-01-01') },
};

const baseItemInput: ShoppingItemInput = {
  name: 'Whole Milk',
  category: 'dairy',
  addedBy: 'user-1',
};

const mockShoppingItem: ShoppingItem = {
  id: 'item-1',
  name: 'Whole Milk',
  category: 'dairy',
  addedBy: 'user-1',
  isPurchased: false,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockPrePopulatedTemplate: ItemTemplate = {
  id: 'template-1',
  name: 'Milk',
  category: 'dairy',
  isPrePopulated: true,
  usageCount: 10,
  createdAt: new Date('2024-01-01'),
};

const mockCustomTemplate: ItemTemplate = {
  id: 'template-custom-1',
  name: 'Whole Milk',
  category: 'dairy',
  isPrePopulated: false,
  createdBy: 'user-1',
  usageCount: 0,
  createdAt: new Date('2024-01-01'),
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ShoppingService', () => {
  let shoppingService: ShoppingService;

  beforeEach(() => {
    shoppingService = new ShoppingService();
    jest.clearAllMocks();

    // Mock getAllCategories to return default categories for all tests
    mockGetAllCategories.mockResolvedValue([
      { id: 'cat-1', name: 'produce', isDefault: true, createdAt: new Date('2024-01-01') },
      { id: 'cat-2', name: 'dairy', isDefault: true, createdAt: new Date('2024-01-01') },
      { id: 'cat-3', name: 'bakery', isDefault: true, createdAt: new Date('2024-01-01') },
      { id: 'cat-4', name: 'meat', isDefault: true, createdAt: new Date('2024-01-01') },
      { id: 'cat-5', name: 'frozen', isDefault: true, createdAt: new Date('2024-01-01') },
      { id: 'cat-6', name: 'pantry', isDefault: true, createdAt: new Date('2024-01-01') },
      { id: 'cat-7', name: 'household', isDefault: true, createdAt: new Date('2024-01-01') },
    ]);
  });

  // ── addItem ────────────────────────────────────────────────────────────────

  describe('addItem', () => {
    describe('successful creation', () => {
      it('should add an item and save it as a custom template', async () => {
        mockGetUserById.mockResolvedValue(mockUsers.alex);
        mockAddItem.mockResolvedValue(mockShoppingItem);
        mockGetItemTemplates.mockResolvedValue([]); // no existing templates
        mockCreateItemTemplate.mockResolvedValue(mockCustomTemplate);

        const result = await shoppingService.addItem(baseItemInput);

        expect(result).toEqual(mockShoppingItem);
        expect(mockAddItem).toHaveBeenCalledTimes(1);
        expect(mockAddItem).toHaveBeenCalledWith({
          name: 'Whole Milk',
          category: 'dairy',
          addedBy: 'user-1',
        });
        // Requirement 7.5 – custom item saved as template
        expect(mockCreateItemTemplate).toHaveBeenCalledWith({
          name: 'Whole Milk',
          category: 'dairy',
          isPrePopulated: false,
          createdBy: 'user-1',
        });
      });

      it('should NOT save a duplicate custom template when one already exists', async () => {
        const existingTemplate: ItemTemplate = {
          ...mockCustomTemplate,
          name: 'Whole Milk',
        };

        mockGetUserById.mockResolvedValue(mockUsers.alex);
        mockAddItem.mockResolvedValue(mockShoppingItem);
        mockGetItemTemplates.mockResolvedValue([existingTemplate]);

        const result = await shoppingService.addItem(baseItemInput);

        expect(result).toEqual(mockShoppingItem);
        // Template already exists – should not create another
        expect(mockCreateItemTemplate).not.toHaveBeenCalled();
      });

      it('should NOT save a template when item is from a pre-populated template', async () => {
        const inputFromTemplate: ShoppingItemInput = {
          ...baseItemInput,
          fromPrePopulatedTemplate: true,
        };

        mockGetUserById.mockResolvedValue(mockUsers.alex);
        mockAddItem.mockResolvedValue(mockShoppingItem);

        await shoppingService.addItem(inputFromTemplate);

        expect(mockCreateItemTemplate).not.toHaveBeenCalled();
        expect(mockGetItemTemplates).not.toHaveBeenCalled();
      });

      it('should trim whitespace from item name', async () => {
        const inputWithSpaces: ShoppingItemInput = {
          ...baseItemInput,
          name: '  Whole Milk  ',
        };

        mockGetUserById.mockResolvedValue(mockUsers.alex);
        mockAddItem.mockResolvedValue(mockShoppingItem);
        mockGetItemTemplates.mockResolvedValue([]);
        mockCreateItemTemplate.mockResolvedValue(mockCustomTemplate);

        await shoppingService.addItem(inputWithSpaces);

        expect(mockAddItem).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Whole Milk' })
        );
      });

      it('should allow any household member to add items', async () => {
        for (const user of Object.values(mockUsers)) {
          jest.clearAllMocks();
          mockGetAllCategories.mockResolvedValue([
            { id: 'cat-1', name: 'produce', isDefault: true, createdAt: new Date('2024-01-01') },
            { id: 'cat-2', name: 'dairy', isDefault: true, createdAt: new Date('2024-01-01') },
            { id: 'cat-3', name: 'bakery', isDefault: true, createdAt: new Date('2024-01-01') },
            { id: 'cat-4', name: 'meat', isDefault: true, createdAt: new Date('2024-01-01') },
            { id: 'cat-5', name: 'frozen', isDefault: true, createdAt: new Date('2024-01-01') },
            { id: 'cat-6', name: 'pantry', isDefault: true, createdAt: new Date('2024-01-01') },
            { id: 'cat-7', name: 'household', isDefault: true, createdAt: new Date('2024-01-01') },
          ]);
          mockGetUserById.mockResolvedValue(user);
          mockAddItem.mockResolvedValue({ ...mockShoppingItem, addedBy: user.id });
          mockGetItemTemplates.mockResolvedValue([]);
          mockCreateItemTemplate.mockResolvedValue(mockCustomTemplate);

          const result = await shoppingService.addItem({
            ...baseItemInput,
            addedBy: user.id,
          });

          expect(result.addedBy).toBe(user.id);
        }
      });

      it('should handle duplicate check case-insensitively', async () => {
        const existingTemplate: ItemTemplate = {
          ...mockCustomTemplate,
          name: 'whole milk', // lowercase
        };

        mockGetUserById.mockResolvedValue(mockUsers.alex);
        mockAddItem.mockResolvedValue(mockShoppingItem);
        mockGetItemTemplates.mockResolvedValue([existingTemplate]);

        await shoppingService.addItem(baseItemInput); // name: 'Whole Milk'

        // Should detect duplicate despite different casing
        expect(mockCreateItemTemplate).not.toHaveBeenCalled();
      });
    });

    describe('validation errors', () => {
      it('should throw ShoppingValidationError when name is empty', async () => {
        await expect(
          shoppingService.addItem({ ...baseItemInput, name: '' })
        ).rejects.toThrow(ShoppingValidationError);

        await expect(
          shoppingService.addItem({ ...baseItemInput, name: '   ' })
        ).rejects.toThrow('Item name is required');
      });

      it('should throw ShoppingValidationError when category is invalid', async () => {
        await expect(
          shoppingService.addItem({ ...baseItemInput, category: 'electronics' as any })
        ).rejects.toThrow(ShoppingValidationError);

        await expect(
          shoppingService.addItem({ ...baseItemInput, category: 'electronics' as any })
        ).rejects.toThrow('Category must be one of');
      });

      it('should throw ShoppingValidationError when category is empty', async () => {
        await expect(
          shoppingService.addItem({ ...baseItemInput, category: '' as any })
        ).rejects.toThrow(ShoppingValidationError);
      });

      it('should throw ShoppingValidationError when addedBy is empty', async () => {
        await expect(
          shoppingService.addItem({ ...baseItemInput, addedBy: '' })
        ).rejects.toThrow('Item must have an addedBy user');
      });

      it('should throw ShoppingValidationError when user does not exist', async () => {
        mockGetUserById.mockResolvedValue(null);

        await expect(
          shoppingService.addItem({ ...baseItemInput, addedBy: 'unknown-user' })
        ).rejects.toThrow('User with ID unknown-user not found');
      });

      it('should validate all categories are accepted', async () => {
        const validCategories = ['produce', 'dairy', 'bakery', 'meat', 'frozen', 'pantry', 'household'] as const;

        for (const category of validCategories) {
          jest.clearAllMocks();
          mockGetAllCategories.mockResolvedValue([
            { id: 'cat-1', name: 'produce', isDefault: true, createdAt: new Date('2024-01-01') },
            { id: 'cat-2', name: 'dairy', isDefault: true, createdAt: new Date('2024-01-01') },
            { id: 'cat-3', name: 'bakery', isDefault: true, createdAt: new Date('2024-01-01') },
            { id: 'cat-4', name: 'meat', isDefault: true, createdAt: new Date('2024-01-01') },
            { id: 'cat-5', name: 'frozen', isDefault: true, createdAt: new Date('2024-01-01') },
            { id: 'cat-6', name: 'pantry', isDefault: true, createdAt: new Date('2024-01-01') },
            { id: 'cat-7', name: 'household', isDefault: true, createdAt: new Date('2024-01-01') },
          ]);
          mockGetUserById.mockResolvedValue(mockUsers.alex);
          mockAddItem.mockResolvedValue({ ...mockShoppingItem, category });
          mockGetItemTemplates.mockResolvedValue([]);
          mockCreateItemTemplate.mockResolvedValue(mockCustomTemplate);

          const result = await shoppingService.addItem({
            ...baseItemInput,
            category,
          });

          expect(result.category).toBe(category);
        }
      });
    });
  });

  // ── addItemFromTemplate ────────────────────────────────────────────────────

  describe('addItemFromTemplate', () => {
    const overrides = { addedBy: 'user-1' };

    it('should create an item populated with template name and category', async () => {
      mockGetItemTemplateById.mockResolvedValue(mockPrePopulatedTemplate);
      mockIncrementItemTemplateUsage.mockResolvedValue({ ...mockPrePopulatedTemplate, usageCount: 11 });
      mockGetUserById.mockResolvedValue(mockUsers.alex);
      mockAddItem.mockResolvedValue({ ...mockShoppingItem, name: 'Milk', category: 'dairy' });

      const result = await shoppingService.addItemFromTemplate('template-1', overrides);

      expect(result).toBeDefined();
      expect(mockAddItem).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Milk',
          category: 'dairy',
          addedBy: 'user-1',
        })
      );
    });

    it('should increment template usage count', async () => {
      mockGetItemTemplateById.mockResolvedValue(mockPrePopulatedTemplate);
      mockIncrementItemTemplateUsage.mockResolvedValue({ ...mockPrePopulatedTemplate, usageCount: 11 });
      mockGetUserById.mockResolvedValue(mockUsers.alex);
      mockAddItem.mockResolvedValue(mockShoppingItem);

      await shoppingService.addItemFromTemplate('template-1', overrides);

      expect(mockIncrementItemTemplateUsage).toHaveBeenCalledWith('template-1');
    });

    it('should NOT save a new template when using a pre-populated template', async () => {
      mockGetItemTemplateById.mockResolvedValue(mockPrePopulatedTemplate); // isPrePopulated: true
      mockIncrementItemTemplateUsage.mockResolvedValue({ ...mockPrePopulatedTemplate, usageCount: 11 });
      mockGetUserById.mockResolvedValue(mockUsers.alex);
      mockAddItem.mockResolvedValue(mockShoppingItem);

      await shoppingService.addItemFromTemplate('template-1', overrides);

      expect(mockCreateItemTemplate).not.toHaveBeenCalled();
    });

    it('should save a new template when using a custom (non-pre-populated) template', async () => {
      const customTemplate: ItemTemplate = {
        ...mockPrePopulatedTemplate,
        id: 'template-custom-2',
        isPrePopulated: false,
        createdBy: 'user-1',
      };

      mockGetItemTemplateById.mockResolvedValue(customTemplate);
      mockIncrementItemTemplateUsage.mockResolvedValue({ ...customTemplate, usageCount: 1 });
      mockGetUserById.mockResolvedValue(mockUsers.alex);
      mockAddItem.mockResolvedValue(mockShoppingItem);
      mockGetItemTemplates.mockResolvedValue([]); // no existing custom templates
      mockCreateItemTemplate.mockResolvedValue(mockCustomTemplate);

      await shoppingService.addItemFromTemplate('template-custom-2', overrides);

      expect(mockCreateItemTemplate).toHaveBeenCalled();
    });

    it('should throw an error when template is not found', async () => {
      mockGetItemTemplateById.mockResolvedValue(null);

      await expect(
        shoppingService.addItemFromTemplate('non-existent-template', overrides)
      ).rejects.toThrow('Item template with ID non-existent-template not found');
    });
  });

  // ── getItemTemplates ───────────────────────────────────────────────────────

  describe('getItemTemplates', () => {
    it('should return all templates when no filters provided', async () => {
      const templates = [mockPrePopulatedTemplate];
      mockGetItemTemplates.mockResolvedValue(templates);

      const result = await shoppingService.getItemTemplates();

      expect(result).toEqual(templates);
      expect(mockGetItemTemplates).toHaveBeenCalledWith(undefined);
    });

    it('should pass filters to the database query', async () => {
      const filters = { isPrePopulated: true };
      mockGetItemTemplates.mockResolvedValue([mockPrePopulatedTemplate]);

      await shoppingService.getItemTemplates(filters);

      expect(mockGetItemTemplates).toHaveBeenCalledWith(filters);
    });

    it('should support filtering by createdBy', async () => {
      const filters = { createdBy: 'user-1' };
      mockGetItemTemplates.mockResolvedValue([mockCustomTemplate]);

      const result = await shoppingService.getItemTemplates(filters);

      expect(result).toEqual([mockCustomTemplate]);
      expect(mockGetItemTemplates).toHaveBeenCalledWith(filters);
    });
  });

  // ── getItemById ────────────────────────────────────────────────────────────

  describe('getItemById', () => {
    it('should return item when found', async () => {
      mockGetItemById.mockResolvedValue(mockShoppingItem);

      const result = await shoppingService.getItemById('item-1');

      expect(result).toEqual(mockShoppingItem);
      expect(mockGetItemById).toHaveBeenCalledWith('item-1');
    });

    it('should return null when item not found', async () => {
      mockGetItemById.mockResolvedValue(null);

      const result = await shoppingService.getItemById('non-existent');

      expect(result).toBeNull();
    });
  });

  // ── purchaseItem ───────────────────────────────────────────────────────────

  describe('purchaseItem', () => {
    const purchasedItem: ShoppingItem = {
      ...mockShoppingItem,
      isPurchased: true,
      purchasedBy: 'user-1',
      purchasedAt: new Date('2024-01-02'),
    };

    it('should mark an item as purchased when item exists and user is valid', async () => {
      mockGetItemById.mockResolvedValue(mockShoppingItem); // not purchased
      mockGetUserById.mockResolvedValue(mockUsers.alex);
      mockPurchaseItem.mockResolvedValue(purchasedItem);

      const result = await shoppingService.purchaseItem('item-1', 'user-1');

      expect(result).toEqual(purchasedItem);
      expect(result.isPurchased).toBe(true);
      expect(result.purchasedBy).toBe('user-1');
      expect(mockPurchaseItem).toHaveBeenCalledWith('item-1', 'user-1');
    });

    it('should throw ShoppingValidationError when item not found', async () => {
      mockGetItemById.mockResolvedValue(null);

      await expect(
        shoppingService.purchaseItem('non-existent', 'user-1')
      ).rejects.toThrow(ShoppingValidationError);

      await expect(
        shoppingService.purchaseItem('non-existent', 'user-1')
      ).rejects.toThrow('Shopping item with ID non-existent not found');
    });

    it('should throw ShoppingValidationError when item is already purchased', async () => {
      mockGetItemById.mockResolvedValue(purchasedItem); // already purchased

      await expect(
        shoppingService.purchaseItem('item-1', 'user-1')
      ).rejects.toThrow(ShoppingValidationError);

      await expect(
        shoppingService.purchaseItem('item-1', 'user-1')
      ).rejects.toThrow('already purchased');
    });

    it('should throw ShoppingValidationError when user does not exist', async () => {
      mockGetItemById.mockResolvedValue(mockShoppingItem);
      mockGetUserById.mockResolvedValue(null);

      await expect(
        shoppingService.purchaseItem('item-1', 'unknown-user')
      ).rejects.toThrow(ShoppingValidationError);

      await expect(
        shoppingService.purchaseItem('item-1', 'unknown-user')
      ).rejects.toThrow('User with ID unknown-user not found');
    });

    it('should allow any household member to purchase an item', async () => {
      for (const user of Object.values(mockUsers)) {
        jest.clearAllMocks();
        mockGetAllCategories.mockResolvedValue([
          { id: 'cat-1', name: 'produce', isDefault: true, createdAt: new Date('2024-01-01') },
          { id: 'cat-2', name: 'dairy', isDefault: true, createdAt: new Date('2024-01-01') },
          { id: 'cat-3', name: 'bakery', isDefault: true, createdAt: new Date('2024-01-01') },
          { id: 'cat-4', name: 'meat', isDefault: true, createdAt: new Date('2024-01-01') },
          { id: 'cat-5', name: 'frozen', isDefault: true, createdAt: new Date('2024-01-01') },
          { id: 'cat-6', name: 'pantry', isDefault: true, createdAt: new Date('2024-01-01') },
          { id: 'cat-7', name: 'household', isDefault: true, createdAt: new Date('2024-01-01') },
        ]);
        mockGetItemById.mockResolvedValue(mockShoppingItem);
        mockGetUserById.mockResolvedValue(user);
        mockPurchaseItem.mockResolvedValue({
          ...purchasedItem,
          purchasedBy: user.id,
        });

        const result = await shoppingService.purchaseItem('item-1', user.id);
        expect(result.purchasedBy).toBe(user.id);
      }
    });
  });

  // ── getShoppingList ────────────────────────────────────────────────────────

  describe('getShoppingList', () => {
    it('should return all unpurchased items', async () => {
      const items: ShoppingItem[] = [
        mockShoppingItem,
        { ...mockShoppingItem, id: 'item-2', name: 'Bread', category: 'bakery' },
      ];
      mockGetShoppingList.mockResolvedValue(items);

      const result = await shoppingService.getShoppingList();

      expect(result).toEqual(items);
      expect(mockGetShoppingList).toHaveBeenCalledWith(undefined, undefined);
    });

    it('should return empty array when no items exist', async () => {
      mockGetShoppingList.mockResolvedValue([]);

      const result = await shoppingService.getShoppingList();

      expect(result).toEqual([]);
    });
  });

  // ── getItemsByCategory ─────────────────────────────────────────────────────

  describe('getItemsByCategory', () => {
    it('should return items filtered by category', async () => {
      const dairyItems: ShoppingItem[] = [
        mockShoppingItem,
        { ...mockShoppingItem, id: 'item-3', name: 'Cheese' },
      ];
      mockGetShoppingList.mockResolvedValue(dairyItems);

      const result = await shoppingService.getItemsByCategory('dairy');

      expect(result).toEqual(dairyItems);
      expect(mockGetShoppingList).toHaveBeenCalledWith('dairy', undefined);
    });

    it('should return empty array when no items exist for category', async () => {
      mockGetShoppingList.mockResolvedValue([]);

      const result = await shoppingService.getItemsByCategory('frozen');

      expect(result).toEqual([]);
      expect(mockGetShoppingList).toHaveBeenCalledWith('frozen', undefined);
    });

    it('should throw ShoppingValidationError for invalid category', async () => {
      await expect(
        shoppingService.getItemsByCategory('electronics' as any)
      ).rejects.toThrow(ShoppingValidationError);

      await expect(
        shoppingService.getItemsByCategory('electronics' as any)
      ).rejects.toThrow('Category must be one of');
    });
  });

  // ── updateItem ─────────────────────────────────────────────────────────────

  describe('updateItem', () => {
    it('should update item name', async () => {
      const updatedItem = { ...mockShoppingItem, name: 'Oat Milk' };
      mockGetItemById.mockResolvedValue(mockShoppingItem);
      mockUpdateItem.mockResolvedValue(updatedItem);

      const result = await shoppingService.updateItem('item-1', { name: 'Oat Milk' });

      expect(result.name).toBe('Oat Milk');
      expect(mockUpdateItem).toHaveBeenCalledWith('item-1', { name: 'Oat Milk' });
    });

    it('should update item category', async () => {
      const updatedItem = { ...mockShoppingItem, category: 'produce' as const };
      mockGetItemById.mockResolvedValue(mockShoppingItem);
      mockUpdateItem.mockResolvedValue(updatedItem);

      const result = await shoppingService.updateItem('item-1', { category: 'produce' });

      expect(result.category).toBe('produce');
    });

    it('should throw ShoppingValidationError when item not found', async () => {
      mockGetItemById.mockResolvedValue(null);

      await expect(
        shoppingService.updateItem('non-existent', { name: 'Test' })
      ).rejects.toThrow(ShoppingValidationError);

      await expect(
        shoppingService.updateItem('non-existent', { name: 'Test' })
      ).rejects.toThrow('Shopping item with ID non-existent not found');
    });

    it('should throw ShoppingValidationError for invalid category', async () => {
      mockGetItemById.mockResolvedValue(mockShoppingItem);

      await expect(
        shoppingService.updateItem('item-1', { category: 'electronics' as any })
      ).rejects.toThrow(ShoppingValidationError);
    });

    it('should throw ShoppingValidationError for empty name', async () => {
      mockGetItemById.mockResolvedValue(mockShoppingItem);

      await expect(
        shoppingService.updateItem('item-1', { name: '   ' })
      ).rejects.toThrow(ShoppingValidationError);

      await expect(
        shoppingService.updateItem('item-1', { name: '' })
      ).rejects.toThrow('Item name cannot be empty');
    });
  });

  // ── deleteItem ─────────────────────────────────────────────────────────────

  describe('deleteItem', () => {
    it('should delete an existing item', async () => {
      mockGetItemById.mockResolvedValue(mockShoppingItem);
      mockDeleteItem.mockResolvedValue(true);

      await expect(shoppingService.deleteItem('item-1')).resolves.toBeUndefined();
      expect(mockDeleteItem).toHaveBeenCalledWith('item-1');
    });

    it('should throw ShoppingValidationError when item not found', async () => {
      mockGetItemById.mockResolvedValue(null);

      await expect(
        shoppingService.deleteItem('non-existent')
      ).rejects.toThrow(ShoppingValidationError);

      await expect(
        shoppingService.deleteItem('non-existent')
      ).rejects.toThrow('Shopping item with ID non-existent not found');
    });
  });
});
