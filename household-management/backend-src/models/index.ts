/**
 * Models index
 * Central export point for all data models
 */

export * from './User';
export * from './Task';
export * from './Shopping';

// Per-list category position (backend db layer)
export interface ListCategoryPositionRow {
  list_id: string;
  category_id: string;
  sort_position: number;
}

// Paginated response envelope (shared shape, generic over item)
export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null; // opaque base64; null => no more pages
  pageSize: number;
}

// Backup scheduler config (backend, read from env)
export interface BackupConfig {
  enabled: boolean;
  schedule: 'daily' | 'weekly';
  encryptionEnabled: boolean;
  hasEncryptionKey: boolean;
  retentionCount: number;
}
