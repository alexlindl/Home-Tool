/**
 * Pure grouping/ordering helper for the shopping list view.
 *
 * Builds the ordered sequence of category groups from category `sortPosition`
 * values returned by the Category API, folding items whose category is absent
 * from the category results into the reserved `uncategorized` group, always
 * placing `uncategorized` last, and omitting empty groups.
 *
 * Extracted from ShoppingList.tsx so it can be property-tested without
 * rendering.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.6, 7.8
 */

/** The reserved category name for items without a resolvable category. */
export const UNCATEGORIZED = 'uncategorized';

/** Minimal shape of a category needed to determine ordering. */
export interface CategoryOrderInput {
  name: string;
  sortPosition: number;
}

/** Minimal shape of a shopping item needed for grouping. */
export interface GroupableItem {
  category: string;
}

/** A category group with its resolved item list, in display order. */
export interface CategoryGroup<TItem extends GroupableItem> {
  category: string;
  items: TItem[];
}

/**
 * Order category names by ascending `sortPosition`, breaking ties by
 * case-insensitive ascending name. The `uncategorized` name is excluded here;
 * it is always appended last by the caller.
 *
 * This tie-break is defensively re-applied even though the API already sorts,
 * so the helper is total and deterministic on any input.
 */
export function orderCategoryNames(categories: CategoryOrderInput[]): string[] {
  return categories
    .filter((c) => c.name !== UNCATEGORIZED)
    .slice()
    .sort((a, b) => {
      if (a.sortPosition !== b.sortPosition) {
        return a.sortPosition - b.sortPosition;
      }
      const an = a.name.toLowerCase();
      const bn = b.name.toLowerCase();
      if (an < bn) return -1;
      if (an > bn) return 1;
      return 0;
    })
    .map((c) => c.name);
}

/**
 * Build the ordered list of non-empty category groups for display.
 *
 * - Category groups are ordered by ascending `sortPosition` with a
 *   case-insensitive name tie-break (Req 7.1, 7.2, 7.4).
 * - Items whose category is not present in `categories` are folded into the
 *   `uncategorized` group (Req 7.6).
 * - The `uncategorized` group is always placed last, regardless of any
 *   `sortPosition` a category named `uncategorized` might carry (Req 7.3).
 * - Empty groups are omitted from the result (Req 7.8).
 */
export function buildCategoryGroups<TItem extends GroupableItem>(
  items: TItem[],
  categories: CategoryOrderInput[],
): CategoryGroup<TItem>[] {
  const knownNames = new Set(categories.map((c) => c.name));

  // Bucket items by their resolved group name.
  const buckets = new Map<string, TItem[]>();
  for (const item of items) {
    const resolved =
      item.category !== UNCATEGORIZED && knownNames.has(item.category)
        ? item.category
        : UNCATEGORIZED;
    const bucket = buckets.get(resolved);
    if (bucket) {
      bucket.push(item);
    } else {
      buckets.set(resolved, [item]);
    }
  }

  const groups: CategoryGroup<TItem>[] = [];

  // Ordered known categories first (excluding uncategorized), omitting empties.
  for (const name of orderCategoryNames(categories)) {
    const bucket = buckets.get(name);
    if (bucket && bucket.length > 0) {
      groups.push({ category: name, items: bucket });
    }
  }

  // Uncategorized always last, only if non-empty.
  const uncategorized = buckets.get(UNCATEGORIZED);
  if (uncategorized && uncategorized.length > 0) {
    groups.push({ category: UNCATEGORIZED, items: uncategorized });
  }

  return groups;
}
