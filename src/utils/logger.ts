export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

class Logger {
  private logLevel: LogLevel = LogLevel.INFO;

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentIndex = levels.indexOf(this.logLevel);
    const messageIndex = levels.indexOf(level);
    return messageIndex >= currentIndex;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(`[INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  error(message: string, error?: Error | unknown): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      if (error instanceof Error) {
        console.error(`[ERROR] ${message}:`, error.message);
        if (error.stack) {
          console.error(error.stack);
        }
      } else if (error) {
        console.error(`[ERROR] ${message}:`, error);
      } else {
        console.error(`[ERROR] ${message}`);
      }
    }
  }
}

export const logger = new Logger();
