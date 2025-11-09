import { logger } from './logger';

export class AppError extends Error {
  constructor(
    message: string,
    public code: string = 'INTERNAL_ERROR',
    public statusCode: number = 500,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function handleError(error: unknown, context: string = ''): AppError {
  if (error instanceof AppError) {
    logger.error(`${context}: ${error.message}`, error.originalError);
    return error;
  }

  if (error instanceof Error) {
    const appError = new AppError(error.message, 'INTERNAL_ERROR', 500, error);
    logger.error(`${context}: ${error.message}`, error);
    return appError;
  }

  const appError = new AppError(String(error), 'UNKNOWN_ERROR', 500);
  logger.error(`${context}: ${String(error)}`);
  return appError;
}

export function throwError(
  message: string,
  code: string = 'INTERNAL_ERROR',
  statusCode: number = 500
): never {
  const error = new AppError(message, code, statusCode);
  logger.error(message);
  throw error;
}
