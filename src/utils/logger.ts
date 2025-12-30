/**
 * Logger utility for application-wide logging
 * 
 * Provides type-safe logging with automatic filtering in production.
 * In production, only errors are logged. In development, all logs are shown.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

/**
 * Check if a log level should be displayed
 */
function shouldLog(level: LogLevel): boolean {
  if (isDevelopment) {
    // In development, log everything
    return true;
  }
  
  if (isProduction) {
    // In production, only log errors and warnings
    return level === 'error' || level === 'warn';
  }
  
  // Default: log everything
  return true;
}

/**
 * Format log message with context
 */
function formatMessage(level: LogLevel, ...args: unknown[]): unknown[] {
  const prefix = `[${level.toUpperCase()}]`;
  return [prefix, ...args];
}

/**
 * Create logger instance
 */
function createLogger(): Logger {
  return {
    debug: (...args: unknown[]) => {
      if (shouldLog('debug')) {
        console.debug(...formatMessage('debug', ...args));
      }
    },
    
    info: (...args: unknown[]) => {
      if (shouldLog('info')) {
        console.info(...formatMessage('info', ...args));
      }
    },
    
    warn: (...args: unknown[]) => {
      if (shouldLog('warn')) {
        console.warn(...formatMessage('warn', ...args));
      }
    },
    
    error: (...args: unknown[]) => {
      if (shouldLog('error')) {
        console.error(...formatMessage('error', ...args));
      }
    },
  };
}

// Export singleton logger instance
export const logger = createLogger();

// Export logger factory for creating scoped loggers (optional)
export function createScopedLogger(scope: string): Logger {
  return {
    debug: (...args: unknown[]) => {
      if (shouldLog('debug')) {
        console.debug(...formatMessage('debug', `[${scope}]`, ...args));
      }
    },
    
    info: (...args: unknown[]) => {
      if (shouldLog('info')) {
        console.info(...formatMessage('info', `[${scope}]`, ...args));
      }
    },
    
    warn: (...args: unknown[]) => {
      if (shouldLog('warn')) {
        console.warn(...formatMessage('warn', `[${scope}]`, ...args));
      }
    },
    
    error: (...args: unknown[]) => {
      if (shouldLog('error')) {
        console.error(...formatMessage('error', `[${scope}]`, ...args));
      }
    },
  };
}

