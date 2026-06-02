/**
 * Centralized regex patterns to avoid recompilation and duplication
 * All patterns are compiled once and reused throughout the codebase
 */

export const REGEX_PATTERNS = {
  // CSS/HTML Selectors
  ID_SELECTOR: /#(\w+)/,
  CLASS_SELECTOR: /\.([^\s.#]+)/,
  ID_OR_CLASS: /(?:#|\.)([\w-]+)/,
  REMOVE_ID_PREFIX: /^#/,
  REMOVE_CLASS_PREFIX: /^\./,
  NON_WORD_CHARS: /[^\w-]/g,
  NON_WORD_DASH_CHARS: /[^\w\s]/g,

  // Gherkin/BDD Keywords
  GHERKIN_KEYWORD: /^\s*(Given|When|Then|And|But)\s+/i,
  GHERKIN_STEP_PREFIX: /^\s*(Given|When|Then)\(/,
  GHERKIN_KEYWORD_ONLY: /^(Given|When|Then|And|But)$/,
  GHERKIN_ACTION_PREFIX: /^(Given|When|Then|And|But)\s+/i,

  // String & Text Processing
  WHITESPACE: /\s+/g,
  LEADING_TRAILING_WHITESPACE: /^\s+|\s+$/g,
  QUOTES: /["']/g,
  DOUBLE_QUOTES: /"/g,
  SINGLE_QUOTES: /'/g,
  STRING_WITH_DOUBLE_QUOTES: /"[^"]*"/g,
  STRING_WITH_SINGLE_QUOTES: /'[^']*'/g,
  ESCAPED_CHARS: /["\\]/g,
  PARAM_PLACEHOLDER: /"<PARAM>"/g,
  ESCAPE_REGEX_CHARS: /[.*+?^${}()|[\]\\]/g,

  // Code Blocks & Comments
  CODE_BLOCK: /```(?:typescript|javascript)?([\s\S]*?)```/,
  JSDoc_COMMENT: /\/\*\*\s*\n\s*\*\s*(.+?)\s*\n\s*\*\//,
  BLOCK_COMMENT: /\/\*[\s\S]*?\*\//g,
  TEMPLATE_LITERAL: /`[^`]*`/g,

  // JSON & Data
  JSON_OBJECT: /\{[\s\S]*\}/,
  BUTTON_WORD_PREFIX: /^button\s+/,
  BUTTON_WORD_SUFFIX: /\s+button$/,

  // URL/Href Processing
  PROTOCOL_AND_DOMAIN: /^https?:\/\/[^/]+/i,
  URL_DELIMITERS: /[?#/]/g,

  // LLM/AI Response Extraction
  LLM_CODE_START: /```(?:javascript|typescript)?/,
  LLM_PARAM_REPLACEMENT: /(test_)\d+(?=@)/,

  // Placeholder Replacements
  ESCAPED_QUOTE: /\\"/g,
  REMOVE_GHERKIN_PREFIX: /^(Given|When|Then|And|But)\s+/i,
  UNDERSCORE_TO_SPACE: /_/g,
  SCENARIO_PREFIX: /^[-*]\s*Scenario:\s*/i,

  // Email & Credentials
  EMAIL_TIMESTAMP: /(test_)\d+(?=@)/g,

  // Button/Element Extraction
  CLICK_PATTERN: /.*?clicks?\s+(?:the\s+)?/i,
  BUTTON_SUFFIX_PATTERN: /\s+button.*$/i,
  QUOTED_VALUE: /[\'\"]([^\'\"]+)[\'\"]/,
  FIELD_IN_PATTERN: /in the ([^']+)$/,

  // Text Extraction
  LLM_PREFIX_REMOVAL: /Here is (?:the|a)[\s\S]*?implementation:/gi,
  LLM_NOTE_REMOVAL: /Note that[\s\S]*?requirements\.?/gi,
  LLM_USAGE_REMOVAL: /I've used[\s\S]*?library\.?/gi,
  BACKTICKS: /```/g,

  // Advanced patterns for DOM analysis
  WORD_BOUNDARY: /\W+/,
  WORD_BOUNDARY_GLOBAL: /\W+/g,
  WHITESPACE_OR_QUOTES: /[\s"()]/g,

  // Special character escaping
  SPECIAL_REGEX_CHARS: /[.*+?^${}()|[\]\\]/g,
} as const;

/**
 * Helper functions for common regex operations
 */
export const regexHelpers = {
  /**
   * Escape special characters in regex
   */
  escapeRegex: (str: string): string => {
    return str.replace(REGEX_PATTERNS.ESCAPE_REGEX_CHARS, '\\$&');
  },

  /**
   * Extract ID from selector
   */
  extractId: (selector: string): string | null => {
    const match = selector.match(REGEX_PATTERNS.ID_SELECTOR);
    return match ? match[1] : null;
  },

  /**
   * Extract class from selector
   */
  extractClass: (selector: string): string | null => {
    const match = selector.match(REGEX_PATTERNS.CLASS_SELECTOR);
    return match ? match[1] : null;
  },

  /**
   * Extract ID or class name from selector
   */
  extractIdOrClass: (selector: string): string | null => {
    const match = selector.match(REGEX_PATTERNS.ID_OR_CLASS);
    return match ? match[1] : null;
  },

  /**
   * Check if string is a Gherkin keyword
   */
  isGherkinKeyword: (word: string): boolean => {
    return REGEX_PATTERNS.GHERKIN_KEYWORD_ONLY.test(word);
  },

  /**
   * Extract Gherkin keyword from step
   */
  getGherkinKeyword: (step: string): string | null => {
    const match = step.match(REGEX_PATTERNS.GHERKIN_KEYWORD);
    return match ? match[1] : null;
  },

  /**
   * Remove Gherkin keyword prefix
   */
  removeGherkinPrefix: (step: string): string => {
    return step.trim().replace(REGEX_PATTERNS.REMOVE_GHERKIN_PREFIX, '').trim();
  },

  /**
   * Normalize whitespace
   */
  normalizeWhitespace: (text: string): string => {
    return text.replace(REGEX_PATTERNS.WHITESPACE, ' ').trim();
  },

  /**
   * Extract code block from text
   */
  extractCodeBlock: (text: string): string | null => {
    const match = text.match(REGEX_PATTERNS.CODE_BLOCK);
    return match ? match[1].trim() : null;
  },

  /**
   * Remove common LLM response prefixes
   */
  cleanLLMResponse: (text: string): string => {
    return text
      .replace(REGEX_PATTERNS.LLM_PREFIX_REMOVAL, '')
      .replace(REGEX_PATTERNS.LLM_NOTE_REMOVAL, '')
      .replace(REGEX_PATTERNS.LLM_USAGE_REMOVAL, '')
      .replace(REGEX_PATTERNS.BACKTICKS, '')
      .replace(REGEX_PATTERNS.BLOCK_COMMENT, '');
  },

  /**
   * Extract quoted value from string (supports double and single quotes)
   */
  extractQuotedValue: (text: string): string | null => {
    const doubleMatch = text.match(/"([^\"]+)"/);
    if (doubleMatch) return doubleMatch[1];
    const singleMatch = text.match(/'([^']+)'/);
    return singleMatch ? singleMatch[1] : null;
  },

  /**
   * Check if string matches Gherkin step pattern
   */
  isGherkinStep: (line: string): boolean => {
    return REGEX_PATTERNS.GHERKIN_KEYWORD.test(line);
  },
};
