/**
 * ShoppingService Property-Based Tests - Bug Condition Exploration
 *
 * Property 1: Bug Condition - Custom DB Category Rejected by Hardcoded Validation
 *
 * This test demonstrates that the ShoppingService rejects categories that exist
 * in the categories DB table but are NOT in the hardcoded VALID_CATEGORIES array.
 *
 * The bug: ShoppingService.ts has a hardcoded VALID_CATEGORIES array that rejects
 * any category not in ['produce', 'dairy', 'bakery', 'meat', 'frozen', 'pantry', 'household'],
 * even if the category exists in the categories DB table.
 *
 * EXPECTED: These tests FAIL on unfixed code — failure confirms the bug exists.
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.5**
 */

import * as fc from 'fast-check';
import { ShoppingService } from './ShoppingService';
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
const mockGetItemTemplates = shoppingQueries.getItemTemplates as jest.MockedFunction<typeof shoppingQueries.getItemTemplates>;
const mockCreateItemTemplate = shoppingQueries.createItemTemplate as jest.MockedFunction<typeof shoppingQueries.createItemTemplate>;
const mockGetUserById = userQueries.getUserById as jest.MockedFunction<typeof userQueries.getUserById>;
const mockGetAllCategories = categoryQueries.getAllCategories as jest.MockedFunction<typeof categoryQueries.getAllCategories>;

// ─── Constants ───────────────────────────────────────────────────────────────

/** Categories that exist in the DB but are NOT in the hardcoded VALID_CATEGORIES */
const CUSTOM_DB_CATEGORIES = ['drinks', 'snacks', 'toiletries', 'cleaning', 'pets'];

/** All categories that exist in the DB (defaults + custom) */
const ALL_DB_CATEGORIES = [
  { id: 'cat-1', name: 'produce', isDefault: true, createdAt: new Date('2024-01-01') },
  { id: 'cat-2', name: 'dairy', isDefault: true, createdAt: new Date('2024-01-01') },
  { id: 'cat-3', name: 'bakery', isDefault: true, createdAt: new Date('2024-01-01') },
  { id: 'cat-4', name: 'meat', isDefault: true, createdAt: new Date('2024-01-01') },
  { id: 'cat-5', name: 'frozen', isDefault: true, createdAt: new Date('2024-01-01') },
  { id: 'cat-6', name: 'pantry', isDefault: true, createdAt: new Date('2024-01-01') },
  { id: 'cat-7', name: 'household', isDefault: true, createdAt: new Date('2024-01-01') },
  { id: 'cat-8', name: 'drinks', isDefault: false, createdAt: new Date('2024-02-01') },
  { id: 'cat-9', name: 'snacks', isDefault: false, createdAt: new Date('2024-02-01') },
  { id: 'cat-10', name: 'toiletries', isDefault: false, createdAt: new Date('2024-02-01') },
  { id: 'cat-11', name: 'cleaning', isDefault: false, createdAt: new Date('2024-02-01') },
  { id: 'cat-12', name: 'pets', isDefault: false, createdAt: new Date('2024-02-01') },
];

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockUser = { id: 'user-1', name: 'Alex' as const, haUsername: null, createdAt: new Date('2024-01-01') };

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generates a category from the custom DB categories (NOT in hardcoded VALID_CATEGORIES) */
const customCategoryArb = fc.constantFrom(...CUSTOM_DB_CATEGORIES);

/** Generates a valid item name */
const itemNameArb = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ShoppingService - Bug Condition Exploration (Property 1)', () => {
  let shoppingService: ShoppingService;

  beforeEach(() => {
    shoppingService = new ShoppingService();
    jest.clearAllMocks();

    // Mock getAllCategories to return all DB categories (defaults + custom)
    mockGetAllCategories.mockResolvedValue(ALL_DB_CATEGORIES);

    // Mock getUserById to return a valid user
    mockGetUserById.mockResolvedValue(mockUser);

    // Mock DB functions to succeed
    mockAddItem.mockImplementation(async (input) => ({
      id: 'item-new',
      name: input.name,
      category: input.category as any,
      addedBy: input.addedBy,
      isPurchased: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    mockUpdateItem.mockImplementation(async (id, updates) => ({
      id,
      name: updates.name || 'Existing Item',
      category: (updates.category || 'produce') as any,
      addedBy: 'user-1',
      isPurchased: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    mockGetShoppingList.mockResolvedValue([]);
    mockGetItemTemplates.mockResolvedValue([]);
    mockCreateItemTemplate.mockResolvedValue({
      id: 'template-new',
      name: 'Test',
      category: 'drinks' as any,
      isPrePopulated: false,
      createdBy: 'user-1',
      usageCount: 0,
      createdAt: new Date(),
    });

    mockGetItemById.mockResolvedValue({
      id: 'item-1',
      name: 'Existing Item',
      category: 'produce' as any,
      addedBy: 'user-1',
      isPurchased: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  /**
   * Property 1a: addItem should NOT throw ShoppingValidationError for categories
   * that exist in the DB (even if not in hardcoded VALID_CATEGORIES).
   *
   * Bug condition: VALID_CATEGORIES.includes(category) returns false for custom
   * DB categories like "drinks", "snacks", "toiletries".
   *
   * **Validates: Requirements 1.1, 1.5**
   */
  it('addItem accepts categories that exist in DB but not in hardcoded list', async () => {
    await fc.assert(
      fc.asyncProperty(customCategoryArb, itemNameArb, async (category, name) => {
        const input = {
          name,
          category: category as any,
          addedBy: 'user-1',
        };

        // This should NOT throw - the category exists in the DB
        await expect(shoppingService.addItem(input)).resolves.not.toThrow();
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Property 1b: updateItem should NOT throw ShoppingValidationError for categories
   * that exist in the DB (even if not in hardcoded VALID_CATEGORIES).
   *
   * Bug condition: VALID_CATEGORIES.includes(category) returns false when updating
   * to a custom DB category.
   *
   * **Validates: Requirements 1.2, 1.5**
   */
  it('updateItem accepts categories that exist in DB but not in hardcoded list', async () => {
    await fc.assert(
      fc.asyncProperty(customCategoryArb, async (category) => {
        // This should NOT throw - the category exists in the DB
        await expect(
          shoppingService.updateItem('item-1', { category: category as any })
        ).resolves.not.toThrow();
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Property 1c: getItemsByCategory should NOT throw ShoppingValidationError for
   * categories that exist in the DB (even if not in hardcoded VALID_CATEGORIES).
   *
   * Bug condition: VALID_CATEGORIES.includes(category) returns false when filtering
   * by a custom DB category.
   *
   * **Validates: Requirements 1.1, 1.5**
   */
  it('getItemsByCategory accepts categories that exist in DB but not in hardcoded list', async () => {
    await fc.assert(
      fc.asyncProperty(customCategoryArb, async (category) => {
        // This should NOT throw - the category exists in the DB
        await expect(
          shoppingService.getItemsByCategory(category as any)
        ).resolves.not.toThrow();
      }),
      { numRuns: 50 }
    );
  });
});

// ─── Preservation Property Tests (Task 2) ────────────────────────────────────
// These tests MUST PASS on the unfixed code. They capture baseline behavior
// that must remain unchanged after the fix.

describe('ShoppingService - Preservation Properties (Property 2)', () => {
  let shoppingService: ShoppingService;

  const HARDCODED_VALID_CATEGORIES = [
    'produce',
    'dairy',
    'bakery',
    'meat',
    'frozen',
    'pantry',
    'household',
  ] as const;

  beforeEach(() => {
    shoppingService = new ShoppingService();
    jest.clearAllMocks();

    // Mock getAllCategories to return all DB categories (defaults + custom)
    mockGetAllCategories.mockResolvedValue(ALL_DB_CATEGORIES);

    // Mock getUserById to return a valid user
    mockGetUserById.mockResolvedValue(mockUser);

    // Mock DB functions to succeed
    mockGetItemTemplates.mockResolvedValue([]);
    mockCreateItemTemplate.mockResolvedValue({
      id: 'template-1',
      name: 'Test',
      category: 'dairy' as any,
      isPrePopulated: false,
      createdBy: 'user-1',
      usageCount: 0,
      createdAt: new Date(),
    });
  });

  // ── Preservation of default category acceptance ────────────────────────────

  describe('Preservation of default category acceptance', () => {
    /**
     * For all categories in the hardcoded list (produce, dairy, bakery, meat,
     * frozen, pantry, household), addItem and updateItem succeed without
     * validation error.
     *
     * **Validates: Requirements 3.2**
     */
    it('addItem succeeds for any default (hardcoded) category', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...HARDCODED_VALID_CATEGORIES),
          fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
          async (category, itemName) => {
            jest.clearAllMocks();
            mockGetAllCategories.mockResolvedValue(ALL_DB_CATEGORIES);
            mockGetUserById.mockResolvedValue(mockUser);
            mockGetItemTemplates.mockResolvedValue([]);
            mockCreateItemTemplate.mockResolvedValue({
              id: 'template-1',
              name: itemName.trim(),
              category: category as any,
              isPrePopulated: false,
              createdBy: 'user-1',
              usageCount: 0,
              createdAt: new Date(),
            });
            mockAddItem.mockResolvedValue({
              id: 'item-1',
              name: itemName.trim(),
              category: category as any,
              addedBy: 'user-1',
              isPurchased: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            });

            const result = await shoppingService.addItem({
              name: itemName,
              category: category as any,
              addedBy: 'user-1',
            });

            expect(result).toBeDefined();
            expect(result.category).toBe(category);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('updateItem succeeds for any default (hardcoded) category', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...HARDCODED_VALID_CATEGORIES),
          async (category) => {
            jest.clearAllMocks();
            mockGetAllCategories.mockResolvedValue(ALL_DB_CATEGORIES);
            mockGetItemById.mockResolvedValue({
              id: 'item-1',
              name: 'Existing Item',
              category: 'dairy' as any,
              addedBy: 'user-1',
              isPurchased: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            mockUpdateItem.mockResolvedValue({
              id: 'item-1',
              name: 'Existing Item',
              category: category as any,
              addedBy: 'user-1',
              isPurchased: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            });

            const result = await shoppingService.updateItem('item-1', { category: category as any });

            expect(result).toBeDefined();
            expect(result.category).toBe(category);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // ── Preservation of invalid category rejection ─────────────────────────────

  describe('Preservation of invalid category rejection', () => {
    /**
     * For randomly generated category strings NOT in the hardcoded list or DB,
     * addItem and updateItem throw ShoppingValidationError.
     *
     * **Validates: Requirements 3.1**
     */

    // Generator for categories that are definitely NOT in the hardcoded valid list
    const invalidCategoryArb = fc
      .string({ minLength: 1, maxLength: 50 })
      .filter(
        (s) =>
          s.trim().length > 0 &&
          !HARDCODED_VALID_CATEGORIES.includes(s as any) &&
          !CUSTOM_DB_CATEGORIES.includes(s)
      );

    it('addItem throws ShoppingValidationError for categories not in hardcoded list', async () => {
      await fc.assert(
        fc.asyncProperty(
          invalidCategoryArb,
          fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
          async (invalidCategory, itemName) => {
            jest.clearAllMocks();
            mockGetAllCategories.mockResolvedValue(ALL_DB_CATEGORIES);
            mockGetUserById.mockResolvedValue(mockUser);

            await expect(
              shoppingService.addItem({
                name: itemName,
                category: invalidCategory as any,
                addedBy: 'user-1',
              })
            ).rejects.toThrow('Category must be one of');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('updateItem throws ShoppingValidationError for categories not in hardcoded list', async () => {
      await fc.assert(
        fc.asyncProperty(invalidCategoryArb, async (invalidCategory) => {
          jest.clearAllMocks();
          mockGetAllCategories.mockResolvedValue(ALL_DB_CATEGORIES);
          mockGetItemById.mockResolvedValue({
            id: 'item-1',
            name: 'Existing Item',
            category: 'dairy' as any,
            addedBy: 'user-1',
            isPurchased: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          await expect(
            shoppingService.updateItem('item-1', { category: invalidCategory as any })
          ).rejects.toThrow('Category must be one of');
        }),
        { numRuns: 100 }
      );
    });
  });

  // ── Preservation of purchase flow ──────────────────────────────────────────

  describe('Preservation of purchase flow', () => {
    /**
     * Purchasing an item with a valid ID and user works without
     * any category re-validation.
     *
     * **Validates: Requirements 3.3**
     */
    it('purchaseItem succeeds regardless of item category (no category re-validation)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...HARDCODED_VALID_CATEGORIES),
          fc.uuid(),
          async (category, itemId) => {
            jest.clearAllMocks();
            mockGetAllCategories.mockResolvedValue(ALL_DB_CATEGORIES);

            const existingItem = {
              id: itemId,
              name: 'Some Item',
              category: category as any,
              addedBy: 'user-1',
              isPurchased: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            const purchasedItem = {
              ...existingItem,
              isPurchased: true,
              purchasedBy: 'user-1',
              purchasedAt: new Date(),
            };

            mockGetItemById.mockResolvedValue(existingItem);
            mockGetUserById.mockResolvedValue(mockUser);
            (shoppingQueries.purchaseItem as jest.MockedFunction<typeof shoppingQueries.purchaseItem>)
              .mockResolvedValue(purchasedItem);

            const result = await shoppingService.purchaseItem(itemId, 'user-1');

            expect(result).toBeDefined();
            expect(result.isPurchased).toBe(true);
            expect(result.purchasedBy).toBe('user-1');
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // ── Preservation of item name validation ───────────────────────────────────

  describe('Preservation of item name validation', () => {
    /**
     * Empty or missing item names continue to be rejected with
     * ShoppingValidationError.
     *
     * **Validates: Requirements 3.2**
     */
    it('addItem rejects empty or whitespace-only names', async () => {
      const emptyNameArb = fc.constantFrom('', ' ', '  ', '\t', '\n', '   \t  ');

      await fc.assert(
        fc.asyncProperty(
          emptyNameArb,
          fc.constantFrom(...HARDCODED_VALID_CATEGORIES),
          async (emptyName, category) => {
            jest.clearAllMocks();
            mockGetAllCategories.mockResolvedValue(ALL_DB_CATEGORIES);
            mockGetUserById.mockResolvedValue(mockUser);

            await expect(
              shoppingService.addItem({
                name: emptyName,
                category: category as any,
                addedBy: 'user-1',
              })
            ).rejects.toThrow('Item name is required');
          }
        ),
        { numRuns: 30 }
      );
    });

    it('updateItem rejects empty or whitespace-only names', async () => {
      const emptyNameArb = fc.constantFrom('', ' ', '  ', '\t', '\n', '   \t  ');

      await fc.assert(
        fc.asyncProperty(emptyNameArb, async (emptyName) => {
          jest.clearAllMocks();
          mockGetAllCategories.mockResolvedValue(ALL_DB_CATEGORIES);
          mockGetItemById.mockResolvedValue({
            id: 'item-1',
            name: 'Existing Item',
            category: 'dairy' as any,
            addedBy: 'user-1',
            isPurchased: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          await expect(
            shoppingService.updateItem('item-1', { name: emptyName })
          ).rejects.toThrow('Item name cannot be empty');
        }),
        { numRuns: 30 }
      );
    });
  });
});
