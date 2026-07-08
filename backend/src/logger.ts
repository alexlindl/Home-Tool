export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export interface Logger {
  error(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
  getLevel(): LogLevel;
}

export function resolveLogLevel(envValue: string | undefined): LogLevel {
  if (envValue === undefined) {
    return LogLevel.INFO;
  }
  const normalized = envValue.trim().toLowerCase();
  switch (normalized) {
    case 'error':
      return LogLevel.ERROR;
    case 'warn':
      return LogLevel.WARN;
    case 'info':
      return LogLevel.INFO;
    case 'debug':
      return LogLevel.DEBUG;
    default:
      return LogLevel.INFO;
  }
}

export function createLogger(level?: LogLevel): Logger {
  const activeLevel = level !== undefined ? level : LogLevel.INFO;

  return {
    error(message: string, ..._args: unknown[]): void {
      try {
        if (LogLevel.ERROR <= activeLevel) {
          const timestamp = new Date().toISOString();
          const formatted = `${timestamp} [ERROR] ${message}\n`;
          process.stderr.write(formatted);
        }
      } catch {
        // Silently swallow formatting/write errors for resilience
      }
    },

    warn(message: string, ..._args: unknown[]): void {
      try {
        if (LogLevel.WARN <= activeLevel) {
          const timestamp = new Date().toISOString();
          const formatted = `${timestamp} [WARN] ${message}\n`;
          process.stdout.write(formatted);
        }
      } catch {
        // Silently swallow formatting/write errors for resilience
      }
    },

    info(message: string, ..._args: unknown[]): void {
      try {
        if (LogLevel.INFO <= activeLevel) {
          const timestamp = new Date().toISOString();
          const formatted = `${timestamp} [INFO] ${message}\n`;
          process.stdout.write(formatted);
        }
      } catch {
        // Silently swallow formatting/write errors for resilience
      }
    },

    debug(message: string, ..._args: unknown[]): void {
      try {
        if (LogLevel.DEBUG <= activeLevel) {
          const timestamp = new Date().toISOString();
          const formatted = `${timestamp} [DEBUG] ${message}\n`;
          process.stdout.write(formatted);
        }
      } catch {
        // Silently swallow formatting/write errors for resilience
      }
    },

    getLevel(): LogLevel {
      return activeLevel;
    },
  };
}

export const logger = createLogger(resolveLogLevel(process.env.LOG_LEVEL));
