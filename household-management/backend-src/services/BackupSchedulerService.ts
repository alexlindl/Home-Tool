/**
 * Backup Scheduler Service
 * Writes scheduled JSON backups of household data to the Home Assistant
 * add-on persistent config directory on a configured schedule (daily/weekly).
 *
 * This module (task 10.1) implements the config reader, the backup payload
 * builder, the pure schedule due-check, timestamped file writes, and the
 * setInterval-based scheduler that mirrors the ReminderService structure.
 *
 * Encryption (AES-256-GCM) and retention pruning are implemented in task 10.2;
 * the config status endpoint is task 10.3.
 *
 * Validates: Requirements 6.1, 6.2, 6.4, 6.5, 6.6, 6.7, 6.8
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { query } from '../db/connection';
import { logger } from '../logger';
import { BackupConfig } from '../models';

/** Default retention count when BACKUP_RETENTION_COUNT is unset/invalid. */
const DEFAULT_RETENTION_COUNT = 7;

/**
 * Default backup directory inside the Home Assistant add-on persistent
 * `addon_config` mount. Overridable via BACKUP_DIR (primarily for testing).
 */
const DEFAULT_BACKUP_DIR = '/addon_configs/household-management/backups';

/** Filename prefix + extension for scheduled backup files. */
const BACKUP_FILE_PREFIX = 'household-backup-';
const BACKUP_FILE_EXT = '.json';

/**
 * Parse a boolean environment value. Accepts 'true' / '1' (case-insensitive)
 * as true; everything else (including undefined) is false.
 */
function parseBoolEnv(value: string | undefined): boolean {
  if (value === undefined) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1';
}

/**
 * Read the backup configuration from environment variables into a BackupConfig.
 * The encryption key itself is NEVER stored on the config object — only its
 * presence is surfaced via `hasEncryptionKey`.
 */
export function readBackupConfig(): BackupConfig {
  const scheduleRaw = (process.env.BACKUP_SCHEDULE || 'daily').trim().toLowerCase();
  const schedule: 'daily' | 'weekly' = scheduleRaw === 'weekly' ? 'weekly' : 'daily';

  const retentionParsed = parseInt(process.env.BACKUP_RETENTION_COUNT || '', 10);
  const retentionCount =
    Number.isNaN(retentionParsed) || retentionParsed < 1 ? DEFAULT_RETENTION_COUNT : retentionParsed;

  const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY;
  const hasEncryptionKey = typeof encryptionKey === 'string' && encryptionKey.trim().length > 0;

  return {
    enabled: parseBoolEnv(process.env.BACKUP_ENABLED),
    schedule,
    encryptionEnabled: parseBoolEnv(process.env.BACKUP_ENCRYPTION_ENABLED),
    hasEncryptionKey,
    retentionCount,
  };
}

/**
 * The shape of a scheduled backup payload — identical to GET /api/admin/backup.
 */
export interface BackupPayload {
  version: string;
  exportedAt: string;
  data: {
    users: unknown[];
    tasks: unknown[];
    task_history: unknown[];
    task_templates: unknown[];
    shopping_items: unknown[];
    item_templates: unknown[];
    task_lists: unknown[];
    shopping_lists: unknown[];
    categories: unknown[];
  };
}

/**
 * Milliseconds in the configured schedule interval.
 */
function scheduleIntervalMs(schedule: 'daily' | 'weekly'): number {
  const DAY_MS = 24 * 60 * 60 * 1000;
  return schedule === 'weekly' ? 7 * DAY_MS : DAY_MS;
}

/**
 * Pure due-check: returns true when a backup should be written.
 *
 * - If there is no prior backup, a backup is always due.
 * - Otherwise a backup is due once the configured interval (24h daily, 7d
 *   weekly) has elapsed since the most recent backup time.
 *
 * Exported as a pure function so it can be property-tested (Property 10).
 *
 * Validates: Requirements 6.2
 */
export function isBackupDue(
  now: Date,
  mostRecentBackupTime: Date | null,
  schedule: 'daily' | 'weekly',
): boolean {
  if (mostRecentBackupTime === null) {
    return true;
  }
  const elapsed = now.getTime() - mostRecentBackupTime.getTime();
  return elapsed >= scheduleIntervalMs(schedule);
}

/** The `format` discriminator stamped into every encrypted backup envelope. */
const ENCRYPTED_BACKUP_FORMAT = 'household-backup-encrypted';

/** AES-256-GCM parameters used by the encrypted backup envelope. */
const AES_ALGORITHM = 'aes-256-gcm';
const AES_IV_BYTES = 12; // 96-bit IV, the recommended size for GCM.
const AES_TAG_BYTES = 16; // 128-bit auth tag.

/**
 * The on-disk shape of an encrypted backup file. Every field except the
 * ciphertext is fixed metadata; `iv`, `tag`, and `ciphertext` are base64.
 */
export interface EncryptedBackupEnvelope {
  format: typeof ENCRYPTED_BACKUP_FORMAT;
  alg: typeof AES_ALGORITHM;
  kdf: 'sha256';
  iv: string;
  tag: string;
  ciphertext: string;
}

/**
 * Derive the 32-byte AES-256 key from an arbitrary-length key string via
 * SHA-256, so any key string is accepted (matches the design's `kdf: sha256`).
 */
function deriveBackupKey(key: string): Buffer {
  return crypto.createHash('sha256').update(key, 'utf8').digest();
}

/**
 * Encrypt a plaintext backup JSON string with AES-256-GCM and return the
 * envelope JSON string exactly as written to disk.
 *
 * Pure helper (no fs/env access) so it can be property-tested (Property 12).
 *
 * Validates: Requirements 6.5
 */
export function encryptBackup(plaintext: string, key: string): string {
  const derivedKey = deriveBackupKey(key);
  const iv = crypto.randomBytes(AES_IV_BYTES);
  const cipher = crypto.createCipheriv(AES_ALGORITHM, derivedKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const envelope: EncryptedBackupEnvelope = {
    format: ENCRYPTED_BACKUP_FORMAT,
    alg: AES_ALGORITHM,
    kdf: 'sha256',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
  return JSON.stringify(envelope, null, 2);
}

/**
 * Decrypt an encrypted backup envelope JSON string with the given key and
 * return the original plaintext. Throws if the envelope is malformed or the
 * authentication tag does not verify (wrong key or tampered ciphertext).
 *
 * Pure helper (no fs/env access) so it can be property-tested (Property 12).
 *
 * Validates: Requirements 6.5
 */
export function decryptBackup(envelopeJson: string, key: string): string {
  const parsed = JSON.parse(envelopeJson) as Partial<EncryptedBackupEnvelope>;
  if (
    parsed.format !== ENCRYPTED_BACKUP_FORMAT ||
    parsed.alg !== AES_ALGORITHM ||
    typeof parsed.iv !== 'string' ||
    typeof parsed.tag !== 'string' ||
    typeof parsed.ciphertext !== 'string'
  ) {
    throw new Error('Invalid encrypted backup envelope');
  }

  const derivedKey = deriveBackupKey(key);
  const iv = Buffer.from(parsed.iv, 'base64');
  const tag = Buffer.from(parsed.tag, 'base64');
  const ciphertext = Buffer.from(parsed.ciphertext, 'base64');

  if (iv.length !== AES_IV_BYTES || tag.length !== AES_TAG_BYTES) {
    throw new Error('Invalid encrypted backup envelope');
  }

  const decipher = crypto.createDecipheriv(AES_ALGORITHM, derivedKey, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

/**
 * Prune scheduled backup files in `dir` so that at most `retentionCount` of the
 * newest files remain, deleting the oldest. Files are ordered newest-first by
 * the timestamp embedded in the filename (which is filesystem-safe ISO order),
 * falling back to mtime when the embedded stamp cannot be read.
 *
 * After pruning, exactly `min(retentionCount, N)` newest files remain and every
 * deleted file is older than every retained file (Property 11).
 *
 * Pure with respect to inputs (dir + count); performs fs deletes as a side
 * effect. Exported so it can be property-tested (Property 11).
 *
 * Validates: Requirements 6.4
 */
export function pruneOldBackups(dir: string, retentionCount: number): void {
  if (!fs.existsSync(dir)) {
    return;
  }

  const names = fs
    .readdirSync(dir)
    .filter((name) => name.startsWith(BACKUP_FILE_PREFIX) && name.endsWith(BACKUP_FILE_EXT));

  // Build a sortable key per file: prefer the embedded timestamp (lexicographic
  // order == chronological order for the ISO-derived stamp), fall back to mtime.
  const sortable = names.map((name) => {
    const stamp = name.slice(BACKUP_FILE_PREFIX.length, name.length - BACKUP_FILE_EXT.length);
    let mtimeMs = 0;
    try {
      mtimeMs = fs.statSync(path.join(dir, name)).mtimeMs;
    } catch {
      // Unreadable stat: rely solely on the embedded stamp for ordering.
    }
    return { name, stamp, mtimeMs };
  });

  // Sort newest-first: primary by embedded stamp (desc), tiebreak by mtime (desc).
  sortable.sort((a, b) => {
    if (a.stamp !== b.stamp) {
      return a.stamp < b.stamp ? 1 : -1;
    }
    return b.mtimeMs - a.mtimeMs;
  });

  const keep = Math.max(0, retentionCount);
  const toDelete = sortable.slice(keep);
  for (const entry of toDelete) {
    try {
      fs.unlinkSync(path.join(dir, entry.name));
    } catch (error) {
      logger.error(
        `Failed to prune old backup ${entry.name}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

/**
 * BackupSchedulerService
 * Periodically checks whether a scheduled backup is due and writes it.
 */
export class BackupSchedulerService {
  /** Interval handle for the scheduler. */
  private schedulerInterval: ReturnType<typeof setInterval> | null = null;

  /** Default check cadence: hourly. */
  private static readonly DEFAULT_INTERVAL_MS = 60 * 60 * 1000;

  /**
   * Resolve the backup directory. Reads BACKUP_DIR (overridable for testing),
   * falling back to the add-on config path.
   */
  getBackupDir(): string {
    const configured = process.env.BACKUP_DIR;
    if (typeof configured === 'string' && configured.trim().length > 0) {
      return configured.trim();
    }
    return DEFAULT_BACKUP_DIR;
  }

  /**
   * Build the backup payload by querying every exported table. Same shape as
   * GET /api/admin/backup.
   */
  async buildBackupPayload(): Promise<BackupPayload> {
    const users = await query('SELECT * FROM users');
    const tasks = await query('SELECT * FROM tasks');
    const taskHistory = await query('SELECT * FROM task_history');
    const taskTemplates = await query('SELECT * FROM task_templates');
    const shoppingItems = await query('SELECT * FROM shopping_items');
    const itemTemplates = await query('SELECT * FROM item_templates');
    const taskLists = await query('SELECT * FROM task_lists');
    const shoppingLists = await query('SELECT * FROM shopping_lists');
    const categories = await query('SELECT * FROM categories');

    return {
      version: '1.5.0',
      exportedAt: new Date().toISOString(),
      data: {
        users: users.rows,
        tasks: tasks.rows,
        task_history: taskHistory.rows,
        task_templates: taskTemplates.rows,
        shopping_items: shoppingItems.rows,
        item_templates: itemTemplates.rows,
        task_lists: taskLists.rows,
        shopping_lists: shoppingLists.rows,
        categories: categories.rows,
      },
    };
  }

  /**
   * Build a timestamped backup filename, e.g.
   * `household-backup-2025-01-31T12-00-00-000Z.json`.
   * Colons/periods are replaced so the name is filesystem-safe.
   */
  buildBackupFilename(now: Date): string {
    const stamp = now.toISOString().replace(/[:.]/g, '-');
    return `${BACKUP_FILE_PREFIX}${stamp}${BACKUP_FILE_EXT}`;
  }

  /**
   * List existing scheduled backup files (full paths) in the backup dir.
   * Returns an empty array if the directory does not exist.
   */
  private listBackupFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) {
      return [];
    }
    return fs
      .readdirSync(dir)
      .filter((name) => name.startsWith(BACKUP_FILE_PREFIX) && name.endsWith(BACKUP_FILE_EXT))
      .map((name) => path.join(dir, name));
  }

  /**
   * Return the modification time of the most recent existing backup file, or
   * null when no backups exist. Used by the scheduler to decide if a backup is
   * due after a restart (timestamps survive restarts).
   */
  getMostRecentBackupTime(dir: string): Date | null {
    const files = this.listBackupFiles(dir);
    let mostRecent: Date | null = null;
    for (const file of files) {
      try {
        const mtime = fs.statSync(file).mtime;
        if (mostRecent === null || mtime.getTime() > mostRecent.getTime()) {
          mostRecent = mtime;
        }
      } catch {
        // Ignore files we can't stat; they don't affect the due-check.
      }
    }
    return mostRecent;
  }

  /**
   * Encrypt the serialized payload into an AES-256-GCM envelope JSON string.
   * Delegates to the pure `encryptBackup` helper so the crypto is testable in
   * isolation (Property 12).
   */
  private encryptPayload(serialized: string, key: string): string {
    return encryptBackup(serialized, key);
  }

  /**
   * Perform a single backup run. Safe to call directly (used by the scheduler
   * and by tests). Never throws — all failures are logged and swallowed so the
   * process keeps running (AC 6.8).
   */
  async writeBackupOnce(): Promise<void> {
    try {
      const config = readBackupConfig();

      // Disabled → no-op (AC 6.1 gate).
      if (!config.enabled) {
        return;
      }

      // Encryption enabled but no key → skip write, log error (AC 6.6).
      if (config.encryptionEnabled && !config.hasEncryptionKey) {
        logger.error(
          'Scheduled backup skipped: encryption is enabled but no BACKUP_ENCRYPTION_KEY was provided',
        );
        return;
      }

      const dir = this.getBackupDir();
      fs.mkdirSync(dir, { recursive: true });

      const now = new Date();
      const payload = await this.buildBackupPayload();
      let serialized = JSON.stringify(payload, null, 2);

      // Encryption path is a hook for task 10.2; plain JSON for now (AC 6.7).
      if (config.encryptionEnabled && config.hasEncryptionKey) {
        const key = process.env.BACKUP_ENCRYPTION_KEY as string;
        serialized = this.encryptPayload(serialized, key);
      }

      const filename = this.buildBackupFilename(now);
      const filePath = path.join(dir, filename);
      fs.writeFileSync(filePath, serialized, 'utf8');

      logger.info(`Scheduled backup written: ${filePath}`);

      // Enforce retention: keep only the newest `retentionCount` files (AC 6.4).
      pruneOldBackups(dir, config.retentionCount);
    } catch (error) {
      // AC 6.8: log and continue; do not terminate the process.
      logger.error(
        `Scheduled backup failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Check whether a backup is due right now and write one if so. Reads the
   * most-recent backup file timestamp so the decision survives restarts.
   */
  async checkAndRun(): Promise<void> {
    const config = readBackupConfig();
    if (!config.enabled) {
      return;
    }
    const dir = this.getBackupDir();
    const mostRecent = this.getMostRecentBackupTime(dir);
    if (isBackupDue(new Date(), mostRecent, config.schedule)) {
      await this.writeBackupOnce();
    }
  }

  /**
   * Start the scheduler. Checks hourly (by default) whether a backup is due.
   *
   * @param intervalMs Override the check cadence (primarily for testing).
   */
  startScheduler(intervalMs?: number): void {
    if (this.schedulerInterval) {
      logger.warn('Backup scheduler is already running');
      return;
    }

    const config = readBackupConfig();
    if (!config.enabled) {
      logger.info('Scheduled backups are disabled; scheduler not started');
      return;
    }

    const interval = intervalMs ?? BackupSchedulerService.DEFAULT_INTERVAL_MS;

    this.schedulerInterval = setInterval(() => {
      void this.checkAndRun();
    }, interval);

    logger.info(
      `Backup scheduler started (schedule: ${config.schedule}, interval: ${interval}ms)`,
    );

    // Run an initial check on startup so a due backup is written promptly.
    void this.checkAndRun();
  }

  /**
   * Stop the scheduler.
   */
  stopScheduler(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
      logger.info('Backup scheduler stopped');
    }
  }
}

/** Singleton instance. */
export const backupSchedulerService = new BackupSchedulerService();
