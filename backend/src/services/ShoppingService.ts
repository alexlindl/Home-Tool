/**
 * Shopping Service
 * Handles business logic for shopping list operations including item creation,
 * template management, and item retrieval.
 */

import { ShoppingItem, ItemTemplate, Category } from '../models/Shopping';
import {
  addItem as dbAddItem,
  getItemById,
  getShoppingList as dbGetShoppingList,
  updateItem as dbUpdateItem,
  deleteItem as dbDeleteItem,
  purchaseItem as dbPurchaseItem,
  getItemTemplates as dbGetItemTemplates,
  createItemTemplate,
  getItemTemplateById,
  incrementItemTemplateUsage,
  ItemTemplateFilters,
  UpdateItemInput,
} from '../db/shoppingQueries';
import { getUserById } from '../db/userQueries';

/**
 * Valid categories for shopping items
 */
const VALID_CATEGORIES: Category[] = [
  'produce',
  'dairy',
  'bakery',
  'meat',
  'frozen',
  'pantry',
  'household',
];

/**
 * Input for adding a shopping item via the service layer.
 */
export interface ShoppingItemInput {
  name: string;
  category: Category;
  addedBy: string; // User ID
  /**
   * When true the item was created from a pre-populated template,
   * so it should NOT be saved as a new custom template.
   * When false/undefined the item is considered custom and will be
   * saved as an ItemTemplate for future use (Requirement 7.5).
   */
  fromPrePopulatedTemplate?: boolean;
  /** Optional list ID to assign the item to */
  listId?: string;
}

/**
 * Validation error thrown when shopping item input is invalid.
 */
export class ShoppingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShoppingValidationError';
  }
}

/**
 * ShoppingService class
 * Manages shopping item creation, template management, and item retrieval.
 */
export class ShoppingService {
  /**
   * Validate shopping item input before persisting.
   * @throws ShoppingValidationError if any field is invalid
   */
  private validateItemInput(input: ShoppingItemInput): void {
    // Requirement 7.3 – name is required
    if (!input.name || input.name.trim().length === 0) {
      throw new ShoppingValidationError('Item name is required');
    }

    // Requirement 9.1 – category must be a valid category
    if (!input.category || !VALID_CATEGORIES.includes(input.category)) {
      throw new ShoppingValidationError(
        `Category must be one of: ${VALID_CATEGORIES.join(', ')}`
      );
    }

    // addedBy is required
    if (!input.addedBy || input.addedBy.trim().length === 0) {
      throw new ShoppingValidationError('Item must have an addedBy user');
    }
  }

  /**
   * Add a new shopping item with full validation.
   *
   * When the item is not from a pre-populated template (i.e. it is a custom
   * item), it is automatically saved as an ItemTemplate for future use
   * (Requirement 7.5).
   *
   * @param input Shopping item creation data
   * @returns Promise<ShoppingItem> The created shopping item
   * @throws ShoppingValidationError if input is invalid
   * @throws Error if the user does not exist
   */
  async addItem(input: ShoppingItemInput): Promise<ShoppingItem> {
    // Validate all fields
    this.validateItemInput(input);

    // Requirement 7.2 – verify the user exists
    const user = await getUserById(input.addedBy);
    if (!user) {
      throw new ShoppingValidationError(
        `User with ID ${input.addedBy} not found`
      );
    }

    // Persist the shopping item
    const item = await dbAddItem({
      name: input.name.trim(),
      category: input.category,
      addedBy: input.addedBy,
      listId: input.listId,
    });

    // Requirement 7.5 – save custom items as templates for future use.
    // An item is considered "custom" when it was NOT created from a
    // pre-populated system template.
    if (!input.fromPrePopulatedTemplate) {
      await this.saveAsTemplate(item, input.addedBy);
    }

    return item;
  }

  /**
   * Add a shopping item from an existing template.
   *
   * Loads the template, increments its usage count, and creates the item
   * from template data. (Requirement 8.3)
   *
   * @param templateId UUID of the ItemTemplate to use
   * @param overrides Fields that override or supplement the template data
   * @returns Promise<ShoppingItem> The created shopping item
   * @throws Error if the template is not found
   * @throws ShoppingValidationError if the resulting item input is invalid
   */
  async addItemFromTemplate(
    templateId: string,
    overrides: { addedBy: string; listId?: string }
  ): Promise<ShoppingItem> {
    const template = await getItemTemplateById(templateId);

    if (!template) {
      throw new Error(`Item template with ID ${templateId} not found`);
    }

    // Increment usage count
    await incrementItemTemplateUsage(templateId);

    // Build item input from template + overrides (Requirement 8.3)
    const itemInput: ShoppingItemInput = {
      name: template.name,
      category: template.category,
      addedBy: overrides.addedBy,
      // Mark as coming from a template so we don't create a duplicate template
      fromPrePopulatedTemplate: template.isPrePopulated,
      listId: overrides.listId,
    };

    return this.addItem(itemInput);
  }

  /**
   * Get item templates with optional filtering.
   * @param filters Optional filters (isPrePopulated, createdBy)
   * @returns Promise<ItemTemplate[]> Array of matching templates
   */
  async getItemTemplates(filters?: ItemTemplateFilters): Promise<ItemTemplate[]> {
    return dbGetItemTemplates(filters);
  }

  /**
   * Get a shopping item by its ID.
   * @param id Shopping item UUID
   * @returns Promise<ShoppingItem | null> Shopping item or null if not found
   */
  async getItemById(id: string): Promise<ShoppingItem | null> {
    return getItemById(id);
  }

  /**
   * Mark a shopping item as purchased.
   *
   * Validates the item exists and is not already purchased, verifies the user
   * exists, then delegates to the DB layer.
   * (Requirements 10.1, 10.2)
   *
   * @param id Shopping item UUID
   * @param userId ID of the user who purchased the item
   * @returns Promise<ShoppingItem> The updated shopping item
   * @throws ShoppingValidationError if item not found, already purchased, or user not found
   */
  async purchaseItem(id: string, userId: string): Promise<ShoppingItem> {
    // Verify the item exists
    const item = await getItemById(id);
    if (!item) {
      throw new ShoppingValidationError(`Shopping item with ID ${id} not found`);
    }

    // Verify item is not already purchased
    if (item.isPurchased) {
      throw new ShoppingValidationError(`Shopping item with ID ${id} is already purchased`);
    }

    // Verify the user exists
    const user = await getUserById(userId);
    if (!user) {
      throw new ShoppingValidationError(`User with ID ${userId} not found`);
    }

    // Delegate to DB
    const updatedItem = await dbPurchaseItem(id, userId);
    if (!updatedItem) {
      throw new Error(`Failed to purchase item with ID ${id}`);
    }

    return updatedItem;
  }

  /**
   * Get the shopping list (all unpurchased items), ordered by category then name.
   * Supports category-based grouping by returning items sorted by category.
   * (Requirements 7.1, 9.1, 9.2)
   *
   * @returns Promise<ShoppingItem[]> Array of unpurchased shopping items
   */
  async getShoppingList(listId?: string): Promise<ShoppingItem[]> {
    return dbGetShoppingList(undefined, listId);
  }

  /**
   * Get unpurchased shopping items filtered by category.
   * (Requirements 9.2, 9.3)
   *
   * @param category The category to filter by
   * @param listId Optional list ID to filter by
   * @returns Promise<ShoppingItem[]> Array of unpurchased shopping items in the given category
   * @throws ShoppingValidationError if category is invalid
   */
  async getItemsByCategory(category: Category, listId?: string): Promise<ShoppingItem[]> {
    if (!VALID_CATEGORIES.includes(category)) {
      throw new ShoppingValidationError(
        `Category must be one of: ${VALID_CATEGORIES.join(', ')}`
      );
    }

    return dbGetShoppingList(category, listId);
  }

  /**
   * Update a shopping item.
   *
   * @param id Shopping item UUID
   * @param updates Fields to update (name, category)
   * @returns Promise<ShoppingItem> The updated item
   * @throws ShoppingValidationError if item not found or updates are invalid
   */
  async updateItem(id: string, updates: UpdateItemInput): Promise<ShoppingItem> {
    // Verify item exists
    const item = await getItemById(id);
    if (!item) {
      throw new ShoppingValidationError(`Shopping item with ID ${id} not found`);
    }

    // Validate category if provided
    if (updates.category && !VALID_CATEGORIES.includes(updates.category)) {
      throw new ShoppingValidationError(
        `Category must be one of: ${VALID_CATEGORIES.join(', ')}`
      );
    }

    // Validate name if provided
    if (updates.name !== undefined && updates.name.trim().length === 0) {
      throw new ShoppingValidationError('Item name cannot be empty');
    }

    const updatedItem = await dbUpdateItem(id, updates);
    if (!updatedItem) {
      throw new Error(`Failed to update item with ID ${id}`);
    }

    return updatedItem;
  }

  /**
   * Delete a shopping item.
   *
   * @param id Shopping item UUID
   * @returns Promise<void>
   * @throws ShoppingValidationError if item not found
   */
  async deleteItem(id: string): Promise<void> {
    // Verify item exists
    const item = await getItemById(id);
    if (!item) {
      throw new ShoppingValidationError(`Shopping item with ID ${id} not found`);
    }

    const deleted = await dbDeleteItem(id);
    if (!deleted) {
      throw new Error(`Failed to delete item with ID ${id}`);
    }
  }

  /**
   * Save an item as an ItemTemplate for future use.
   * Checks for an existing template with the same name to avoid duplicates.
   * @param item The shopping item to save as a template
   * @param createdBy User ID of the template creator
   * @returns Promise<ItemTemplate> The created (or existing) template
   */
  private async saveAsTemplate(item: ShoppingItem, createdBy: string): Promise<ItemTemplate> {
    // Check if a custom template with this name already exists to avoid duplicates
    const existingTemplates = await dbGetItemTemplates({ isPrePopulated: false });
    const duplicate = existingTemplates.find(
      (t) => t.name.toLowerCase() === item.name.toLowerCase()
    );

    if (duplicate) {
      // Template already exists – no need to create another one
      return duplicate;
    }

    return createItemTemplate({
      name: item.name,
      category: item.category,
      isPrePopulated: false,
      createdBy,
    });
  }
}

// Export singleton instance
export const shoppingService = new ShoppingService();
