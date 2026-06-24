/**
 * Shopping data models
 * Represents shopping list items and item templates
 */

/**
 * Valid categories for shopping items.
 * Widened to string to allow dynamic, DB-backed categories beyond the original defaults.
 * Runtime validation (via getAllCategories()) enforces that the category exists in the DB.
 */
export type Category = string;

/**
 * Default categories (kept for reference/seeding purposes).
 */
export const DEFAULT_CATEGORIES = [
  'produce',
  'dairy',
  'bakery',
  'meat',
  'frozen',
  'pantry',
  'household',
] as const;

/**
 * Shopping item model
 */
export interface ShoppingItem {
  id: string;              // UUID
  name: string;
  category: Category;
  addedBy: string;         // User ID
  isPurchased: boolean;
  purchasedBy?: string;    // User ID
  purchasedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Shopping item database row (matches PostgreSQL schema)
 */
export interface ShoppingItemRow {
  id: string;
  name: string;
  category: string;
  added_by: string;
  is_purchased: boolean;
  purchased_by: string | null;
  purchased_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Convert database row to ShoppingItem model
 */
export const shoppingItemFromRow = (row: ShoppingItemRow): ShoppingItem => {
  return {
    id: row.id,
    name: row.name,
    category: row.category as Category,
    addedBy: row.added_by,
    isPurchased: row.is_purchased,
    purchasedBy: row.purchased_by || undefined,
    purchasedAt: row.purchased_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

/**
 * Item template model
 */
export interface ItemTemplate {
  id: string;              // UUID
  name: string;
  category: Category;
  isPrePopulated: boolean; // true for system templates
  createdBy?: string;      // User ID for custom templates
  usageCount: number;      // Track popularity
  createdAt: Date;
}

/**
 * Item template database row (matches PostgreSQL schema)
 */
export interface ItemTemplateRow {
  id: string;
  name: string;
  category: string;
  is_prepopulated: boolean;
  created_by: string | null;
  usage_count: number;
  created_at: Date;
}

/**
 * Convert database row to ItemTemplate model
 */
export const itemTemplateFromRow = (row: ItemTemplateRow): ItemTemplate => {
  return {
    id: row.id,
    name: row.name,
    category: row.category as Category,
    isPrePopulated: row.is_prepopulated,
    createdBy: row.created_by || undefined,
    usageCount: row.usage_count,
    createdAt: row.created_at,
  };
};
