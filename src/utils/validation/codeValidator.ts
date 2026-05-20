const MAX_INPUT_SIZE = 100_000;

/**
 * Validates TypeScript code for basic syntax errors.
 *
 * @param code The TypeScript code to validate
 * @returns true if the code appears valid, false otherwise
 */
export function validateTypeScript(code: string): boolean {
  try {
    if (code.length > MAX_INPUT_SIZE) {
      return false;
    }

    // Check for balanced braces, parentheses, and square brackets
    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;
    const openBrackets = (code.match(/\[/g) || []).length;
    const closeBrackets = (code.match(/\]/g) || []).length;

    if (openBraces !== closeBraces || openParens !== closeParens || openBrackets !== closeBrackets) {
      return false;
    }

    // Check for unterminated strings
    const lines = code.split('\n');
    let inString = false;
    let stringChar = '';

    for (const line of lines) {
      if (line.match(/^\s*(Given|When|Then)\(/)) {
        continue;
      }

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        // Count consecutive backslashes before this char
        let backslashCount = 0;
        while (i - backslashCount - 1 >= 0 && line[i - backslashCount - 1] === '\\') {
          backslashCount++;
        }

        // If odd number of backslashes, this char is escaped
        if (backslashCount % 2 === 1) {
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
