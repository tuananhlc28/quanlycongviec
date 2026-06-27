// src/lib/tableUtils.ts

/** Utility functions for table components */

/**
 * Save visible column IDs to localStorage.
 * @param key storage key unique per page
 * @param columns array of column ids that are visible
 */
export function saveColumnVisibility(key: string, columns: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(columns));
  } catch (e) {
    console.error('Failed to save column visibility', e);
  }
}

/**
 * Load visible column IDs from localStorage.
 * Returns array of column ids or empty array if none saved.
 */
export function loadColumnVisibility(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to load column visibility', e);
    return [];
  }
}

/**
 * Apply a time range filter to an array of items that have a `createdAt` Date field.
 * Returns the filtered array.
 */
export function filterByTimeRange<T extends { createdAt: Date | string }>(
  items: T[],
  start: Date | null,
  end: Date | null,
): T[] {
  if (!start && !end) return items;
  return items.filter((item) => {
    const ts = typeof item.createdAt === 'string' ? new Date(item.createdAt) : item.createdAt;
    if (start && ts < start) return false;
    if (end && ts > end) return false;
    return true;
  });
}
