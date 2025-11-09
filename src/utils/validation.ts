import isUrl from 'is-url';
import { quote } from 'shell-quote';
import { URLError, ValidationError } from './errors';

export class InputValidator {
  static validateURL(url: string): string {
    if (!url || typeof url !== 'string') {
      throw new URLError('URL is required and must be a string', {
        receivedType: typeof url,
        receivedValue: url,
      });
    }

    const trimmedUrl = url.trim();

    if (!isUrl(trimmedUrl)) {
      throw new URLError('Invalid URL format', {
        url: trimmedUrl,
        hint: 'URL should start with http:// or https://',
      });
    }

    return trimmedUrl;
  }

  static sanitizePrompt(prompt: string): string {
    if (!prompt || typeof prompt !== 'string') {
      throw new ValidationError('Prompt is required and must be a string', {
        receivedType: typeof prompt,
      });
    }

    const trimmed = prompt.trim();

    if (trimmed.length === 0) {
      throw new ValidationError('Prompt cannot be empty');
    }

    if (trimmed.length > 10000) {
      throw new ValidationError('Prompt exceeds maximum length of 10000 characters', {
        length: trimmed.length,
      });
    }

    return trimmed;
  }

  static escapeShellArgument(arg: string): string {
    try {
      return quote([arg]);
    } catch (error) {
      throw new ValidationError('Failed to escape shell argument', {
        argument: arg,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  static validateTimeout(timeout: unknown): number {
    if (timeout === undefined || timeout === null) {
      return 30000;
    }

    const timeoutNum = Number(timeout);

    if (isNaN(timeoutNum) || timeoutNum <= 0) {
      throw new ValidationError('Timeout must be a positive number', {
        received: timeout,
      });
    }

    if (timeoutNum > 600000) {
      throw new ValidationError('Timeout cannot exceed 600 seconds (600000ms)', {
        received: timeout,
      });
    }

    return timeoutNum;
  }
}
