/**
 * Validates TypeScript code for basic syntax errors.
 * 
 * @param code The TypeScript code to validate
 * @returns true if the code appears valid, false otherwise
 */
export function validateTypeScript(code: string): boolean {
  try {
    // Basic syntax checks - don't use Function() as it doesn't support imports
    // Check for balanced braces and parentheses
    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;

    if (openBraces !== closeBraces || openParens !== closeParens) {
      return false;
    }

    // Check for unterminated strings (only for code blocks, not regex patterns)
    const lines = code.split('\n');
    let inString = false;
    let stringChar = '';

    for (const line of lines) {
      // Skip lines with regex patterns like Given(/^pattern$/)
      if (line.match(/^\s*(Given|When|Then)\(/)) {
        continue;
      }

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const prevChar = i > 0 ? line[i - 1] : '';

        // Skip escaped quotes
        if (prevChar === '\\') {
          continue;
        }

        if ((char === '"' || char === "'") && !inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar && inString) {
          inString = false;
          stringChar = '';
        }
      }
    }

    return !inString;
  } catch {
    return false;
  }
}
