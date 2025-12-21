import isUrl from 'is-url';

export class InputValidator {
  /**
   * Validates a URL string.
   * Throws an error if the URL is invalid.
   * @param url The URL to validate
   * @returns true if valid
   */
  static validateURL(url: string): boolean {
    if (!url) {
      throw new Error('URL is required');
    }
    if (!isUrl(url)) {
      throw new Error(`Invalid URL format: ${url}`);
    }
    return true;
  }

  /**
   * Validates an instruction string.
   * @param instruction The instruction to validate
   * @returns true if valid
   */
  static validateInstruction(instruction: string): boolean {
    if (!instruction || instruction.trim().length === 0) {
      throw new Error('Instruction cannot be empty');
    }
    return true;
  }
}
