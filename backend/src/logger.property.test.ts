/**
 * Property-based tests for the Logger module
 *
 * Uses fast-check to verify universal properties of level filtering,
 * level resolution, output formatting, stream routing, and error resilience.
 */

import * as fc from 'fast-check';
import { LogLevel, createLogger, resolveLogLevel } from './logger';

// ---------------------------------------------------------------------------
// Helpers & Arbitraries
// ---------------------------------------------------------------------------

const ALL_LEVELS = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG] as const;
const LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.ERROR]: 'error',
  [LogLevel.WARN]: 'warn',
  [LogLevel.INFO]: 'info',
  [LogLevel.DEBUG]: 'debug',
};

/** Generate a random LogLevel */
const arbLogLevel = fc.constantFrom(...ALL_LEVELS);

/** Generate a non-empty message string (avoid empty since format asserts .+) */
const arbMessage = fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0);

/** Valid level strings with random casing and whitespace padding */
const arbValidLevelString = fc
  .constantFrom('error', 'warn', 'info', 'debug')
  .chain((level) =>
    fc.tuple(fc.string({ minLength: 0, maxLength: 3 }), fc.string({ minLength: 0, maxLength: 3 })).map(
      ([padLeft, padRight]) => {
        // Apply random casing
        const randomCase = level
          .split('')
          .map((c) => (Math.random() > 0.5 ? c.toUpperCase() : c.toLowerCase()))
          .join('');
        // Return with whitespace padding (spaces/tabs only)
        return padLeft.replace(/[^ \t]/g, ' ') + randomCase + padRight.replace(/[^ \t]/g, ' ');
      }
    )
  );

/** Invalid level strings that don't match any valid level */
const arbInvalidLevelString = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => !['error', 'warn', 'info', 'debug'].includes(s.trim().toLowerCase()));

// ---------------------------------------------------------------------------
// Feature: reduce-log-volume, Property 1: Level threshold filtering
// Validates: Requirements 1.2, 2.3, 3.2, 3.3, 3.4, 3.5
// ---------------------------------------------------------------------------

describe('Feature: reduce-log-volume, Property 1: Level threshold filtering', () => {
  it('emits a message iff numeric(messageLevel) <= numeric(configuredLevel)', () => {
    fc.assert(
      fc.property(arbLogLevel, arbLogLevel, arbMessage, (configuredLevel, messageLevel, message) => {
        // Capture writes
        const writes: { stream: 'stdout' | 'stderr'; data: string }[] = [];
        const origStdout = process.stdout.write;
        const origStderr = process.stderr.write;

        process.stdout.write = ((data: string) => {
          writes.push({ stream: 'stdout', data });
          return true;
        }) as typeof process.stdout.write;

        process.stderr.write = ((data: string) => {
          writes.push({ stream: 'stderr', data });
          return true;
        }) as typeof process.stderr.write;

        try {
          const logger = createLogger(configuredLevel);
          const methodName = LEVEL_NAMES[messageLevel] as keyof ReturnType<typeof createLogger>;
          (logger[methodName] as (msg: string) => void)(message);

          const shouldEmit = messageLevel <= configuredLevel;
          if (shouldEmit) {
            expect(writes.length).toBe(1);
          } else {
            expect(writes.length).toBe(0);
          }
        } finally {
          process.stdout.write = origStdout;
          process.stderr.write = origStderr;
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: reduce-log-volume, Property 2: Level resolution
// Validates: Requirements 1.3, 1.4, 3.6, 3.7
// ---------------------------------------------------------------------------

describe('Feature: reduce-log-volume, Property 2: Level resolution', () => {
  it('resolves valid level strings (case-insensitive, trimmed) to the correct level', () => {
    fc.assert(
      fc.property(arbValidLevelString, (input) => {
        const resolved = resolveLogLevel(input);
        const normalized = input.trim().toLowerCase();
        switch (normalized) {
          case 'error':
            expect(resolved).toBe(LogLevel.ERROR);
            break;
          case 'warn':
            expect(resolved).toBe(LogLevel.WARN);
            break;
          case 'info':
            expect(resolved).toBe(LogLevel.INFO);
            break;
          case 'debug':
            expect(resolved).toBe(LogLevel.DEBUG);
            break;
        }
      }),
      { numRuns: 100 }
    );
  });

  it('resolves invalid strings to INFO', () => {
    fc.assert(
      fc.property(arbInvalidLevelString, (input) => {
        const resolved = resolveLogLevel(input);
        expect(resolved).toBe(LogLevel.INFO);
      }),
      { numRuns: 100 }
    );
  });

  it('resolves undefined to INFO', () => {
    const resolved = resolveLogLevel(undefined);
    expect(resolved).toBe(LogLevel.INFO);
  });
});

// ---------------------------------------------------------------------------
// Feature: reduce-log-volume, Property 3: Output format compliance
// Validates: Requirements 1.5
// ---------------------------------------------------------------------------

describe('Feature: reduce-log-volume, Property 3: Output format compliance', () => {
  const OUTPUT_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[(ERROR|WARN|INFO|DEBUG)\] .+/;

  it('all emitted messages match the ISO-8601 timestamp + level label format', () => {
    fc.assert(
      fc.property(arbLogLevel, arbMessage, (messageLevel, message) => {
        // Use DEBUG level so all messages pass threshold
        const configuredLevel = LogLevel.DEBUG;

        let captured = '';
        const origStdout = process.stdout.write;
        const origStderr = process.stderr.write;

        process.stdout.write = ((data: string) => {
          captured = data;
          return true;
        }) as typeof process.stdout.write;

        process.stderr.write = ((data: string) => {
          captured = data;
          return true;
        }) as typeof process.stderr.write;

        try {
          const logger = createLogger(configuredLevel);
          const methodName = LEVEL_NAMES[messageLevel] as keyof ReturnType<typeof createLogger>;
          (logger[methodName] as (msg: string) => void)(message);

          // Strip trailing newline for regex match
          const line = captured.replace(/\n$/, '');
          expect(line).toMatch(OUTPUT_REGEX);
        } finally {
          process.stdout.write = origStdout;
          process.stderr.write = origStderr;
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: reduce-log-volume, Property 4: Stream routing
// Validates: Requirements 1.6
// ---------------------------------------------------------------------------

describe('Feature: reduce-log-volume, Property 4: Stream routing', () => {
  it('error messages go to stderr, all others to stdout', () => {
    fc.assert(
      fc.property(arbLogLevel, arbMessage, (messageLevel, message) => {
        // Use DEBUG level so all messages pass threshold
        const configuredLevel = LogLevel.DEBUG;

        let stdoutCalled = false;
        let stderrCalled = false;
        const origStdout = process.stdout.write;
        const origStderr = process.stderr.write;

        process.stdout.write = ((_data: string) => {
          stdoutCalled = true;
          return true;
        }) as typeof process.stdout.write;

        process.stderr.write = ((_data: string) => {
          stderrCalled = true;
          return true;
        }) as typeof process.stderr.write;

        try {
          const logger = createLogger(configuredLevel);
          const methodName = LEVEL_NAMES[messageLevel] as keyof ReturnType<typeof createLogger>;
          (logger[methodName] as (msg: string) => void)(message);

          if (messageLevel === LogLevel.ERROR) {
            expect(stderrCalled).toBe(true);
            expect(stdoutCalled).toBe(false);
          } else {
            expect(stdoutCalled).toBe(true);
            expect(stderrCalled).toBe(false);
          }
        } finally {
          process.stdout.write = origStdout;
          process.stderr.write = origStderr;
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Feature: reduce-log-volume, Property 9: Logger error resilience
// Validates: Requirements 7.4
// ---------------------------------------------------------------------------

describe('Feature: reduce-log-volume, Property 9: Logger error resilience', () => {
  it('no exception escapes logger methods when write throws', () => {
    fc.assert(
      fc.property(arbLogLevel, arbMessage, (messageLevel, message) => {
        // Use DEBUG level so all messages pass threshold
        const configuredLevel = LogLevel.DEBUG;

        const origStdout = process.stdout.write;
        const origStderr = process.stderr.write;

        // Stub both streams to throw
        process.stdout.write = ((_data: string) => {
          throw new Error('stdout write failure');
        }) as typeof process.stdout.write;

        process.stderr.write = ((_data: string) => {
          throw new Error('stderr write failure');
        }) as typeof process.stderr.write;

        try {
          const logger = createLogger(configuredLevel);
          const methodName = LEVEL_NAMES[messageLevel] as keyof ReturnType<typeof createLogger>;

          // This should NOT throw — logger catches internally
          expect(() => {
            (logger[methodName] as (msg: string) => void)(message);
          }).not.toThrow();
        } finally {
          process.stdout.write = origStdout;
          process.stderr.write = origStderr;
        }
      }),
      { numRuns: 100 }
    );
  });
});
