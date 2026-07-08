/**
 * Property-based tests for DB query logging in connection.ts
 *
 * Tests Properties 5, 6, 7, 8 from the reduce-log-volume design:
 * - Property 5: Successful DB query log content at debug level
 * - Property 6: Failed DB query log content at error level
 * - Property 7: Parameter truncation
 * - Property 8: Error propagation preservation
 *
 * **Validates: Requirements 2.1, 2.2, 2.4, 2.5, 7.2, 7.3**
 */

import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Mock setup — must be before imports of modules that use pg/logger
// ---------------------------------------------------------------------------

// Use a shared reference that the mock factory can capture
const mockPoolQuery = jest.fn();

jest.mock('pg', () => ({
  Pool: jest.fn(() => ({
    query: mockPoolQuery,
    on: jest.fn(),
    connect: jest.fn(),
    end: jest.fn(),
  })),
}));

jest.mock('../logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    getLevel: jest.fn().mockReturnValue(3), // DEBUG
  },
  LogLevel: { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 },
  createLogger: jest.fn(),
  resolveLogLevel: jest.fn(),
}));

// Import after mocks
import { query, truncateParams } from './connection';
import { logger } from '../logger';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** SQL-like text arbitrary — non-empty printable strings */
const arbSqlText: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 200 })
  .filter((s: string) => s.trim().length > 0);

/** Parameter value arbitrary (mixed types) */
const arbParamValue: fc.Arbitrary<string | number | boolean | null> = fc.oneof(
  fc.string({ minLength: 0, maxLength: 100 }),
  fc.integer(),
  fc.boolean(),
  fc.constant(null)
);

/** Parameter array arbitrary */
const arbParams: fc.Arbitrary<Array<string | number | boolean | null>> = fc.array(arbParamValue, { minLength: 0, maxLength: 10 });

/** Row count arbitrary */
const arbRowCount: fc.Arbitrary<number> = fc.nat({ max: 10000 });

/** Error message arbitrary */
const arbErrorMessage: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 200 })
  .filter((s: string) => s.trim().length > 0);

/** String of varying length for truncation testing */
const arbVaryingString: fc.Arbitrary<string> = fc.string({ minLength: 0, maxLength: 500 });

// ---------------------------------------------------------------------------
// Feature: reduce-log-volume, Property 5: Successful DB query log content at debug level
// Validates: Requirements 2.1, 2.4, 7.3
// ---------------------------------------------------------------------------

describe('Feature: reduce-log-volume, Property 5: Successful DB query log content at debug level', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('debug log contains SQL text, params, duration, and row count for successful queries', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbSqlText,
        arbParams,
        arbRowCount,
        async (sqlText: string, params: Array<string | number | boolean | null>, rowCount: number) => {
          jest.clearAllMocks();

          // Mock pool.query to return a successful result
          mockPoolQuery.mockResolvedValueOnce({
            rows: Array(rowCount).fill({}),
            rowCount: rowCount,
          });

          await query(sqlText, params);

          // Verify logger.debug was called
          expect(logger.debug).toHaveBeenCalledTimes(1);
          const debugMsg = (logger.debug as jest.Mock).mock.calls[0][0] as string;

          // The debug log must contain the SQL text
          expect(debugMsg).toContain(sqlText);

          // The debug log must contain the row count
          expect(debugMsg).toContain(String(rowCount));

          // The debug log must contain the truncated params as JSON
          const expectedParams = truncateParams(params);
          expect(debugMsg).toContain(JSON.stringify(expectedParams));

          // The debug log must contain "ms" indicating duration is present
          expect(debugMsg).toMatch(/\d+ms/);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: reduce-log-volume, Property 6: Failed DB query log content at error level
// Validates: Requirements 2.2
// ---------------------------------------------------------------------------

describe('Feature: reduce-log-volume, Property 6: Failed DB query log content at error level', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('error log contains SQL text, error message, and duration for failed queries', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbSqlText,
        arbErrorMessage,
        async (sqlText: string, errorMessage: string) => {
          jest.clearAllMocks();

          // Mock pool.query to throw an error
          const testError = new Error(errorMessage);
          mockPoolQuery.mockRejectedValueOnce(testError);

          // query should re-throw
          await expect(query(sqlText, [])).rejects.toThrow();

          // Verify logger.error was called
          expect(logger.error).toHaveBeenCalledTimes(1);
          const errorMsg = (logger.error as jest.Mock).mock.calls[0][0] as string;

          // The error log must contain the SQL text
          expect(errorMsg).toContain(sqlText);

          // The error log must contain the error message
          expect(errorMsg).toContain(errorMessage);

          // The error log must contain duration indicator
          expect(errorMsg).toMatch(/\d+ms/);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: reduce-log-volume, Property 7: Parameter truncation
// Validates: Requirements 2.5
// ---------------------------------------------------------------------------

describe('Feature: reduce-log-volume, Property 7: Parameter truncation', () => {
  it('strings > 200 chars are truncated to exactly 200 chars (plus ellipsis), strings <= 200 are unchanged', () => {
    fc.assert(
      fc.property(arbVaryingString, (input: string) => {
        const result = truncateParams([input]);

        expect(result).toBeDefined();
        expect(result!.length).toBe(1);

        const truncated = result![0] as string;

        if (input.length > 200) {
          // Must be truncated to exactly 200 chars + ellipsis character
          expect(truncated.length).toBe(201); // 200 chars + 1 char ellipsis '…'
          expect(truncated.slice(0, 200)).toBe(input.slice(0, 200));
          expect(truncated[200]).toBe('\u2026');
        } else {
          // Must be unchanged
          expect(truncated).toBe(input);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('non-string parameters are left unchanged', () => {
    const arbNonString: fc.Arbitrary<number | boolean | null> = fc.oneof(
      fc.integer(),
      fc.boolean(),
      fc.constant(null)
    );

    fc.assert(
      fc.property(arbNonString, (input: number | boolean | null) => {
        const result = truncateParams([input]);

        expect(result).toBeDefined();
        expect(result![0]).toBe(input);
      }),
      { numRuns: 100 }
    );
  });

  it('undefined params returns undefined', () => {
    expect(truncateParams(undefined)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Feature: reduce-log-volume, Property 8: Error propagation preservation
// Validates: Requirements 7.2
// ---------------------------------------------------------------------------

describe('Feature: reduce-log-volume, Property 8: Error propagation preservation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('query re-throws the same exception type and message regardless of log level', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbSqlText,
        arbErrorMessage,
        arbParams,
        async (sqlText: string, errorMessage: string, params: Array<string | number | boolean | null>) => {
          jest.clearAllMocks();

          // Create a typed error
          const originalError = new Error(errorMessage);
          mockPoolQuery.mockRejectedValueOnce(originalError);

          let caughtError: unknown;
          try {
            await query(sqlText, params);
          } catch (e) {
            caughtError = e;
          }

          // Must have thrown
          expect(caughtError).toBeDefined();

          // Must be the exact same error object (same reference)
          expect(caughtError).toBe(originalError);

          // Same type
          expect(caughtError).toBeInstanceOf(Error);

          // Same message
          expect((caughtError as Error).message).toBe(errorMessage);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('query re-throws custom error types preserving type identity', async () => {
    class DatabaseError extends Error {
      public code: string;
      constructor(message: string, code: string) {
        super(message);
        this.name = 'DatabaseError';
        this.code = code;
      }
    }

    await fc.assert(
      fc.asyncProperty(
        arbSqlText,
        arbErrorMessage,
        fc.string({ minLength: 1, maxLength: 10 }),
        async (sqlText: string, errorMessage: string, errorCode: string) => {
          jest.clearAllMocks();

          const originalError = new DatabaseError(errorMessage, errorCode);
          mockPoolQuery.mockRejectedValueOnce(originalError);

          let caughtError: unknown;
          try {
            await query(sqlText, []);
          } catch (e) {
            caughtError = e;
          }

          // Must be the exact same error instance
          expect(caughtError).toBe(originalError);
          expect(caughtError).toBeInstanceOf(DatabaseError);
          expect((caughtError as DatabaseError).message).toBe(errorMessage);
          expect((caughtError as DatabaseError).code).toBe(errorCode);
        }
      ),
      { numRuns: 100 }
    );
  });
});
