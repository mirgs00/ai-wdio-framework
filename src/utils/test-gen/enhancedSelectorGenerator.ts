import { logger } from '../logger';

export interface SelectorStrategy {
  primary: string;
  fallbacks: string[];
  multiSelector: string;
}

export class EnhancedSelectorGenerator {
  /**
   * Generates a multi-selector strategy for more stable element selection
   * Uses primary selector with multiple fallback patterns
   */
  static generateSelectorStrategy(
    primarySelector: string,
    description: string,
    elementType: string = 'generic'
  ): SelectorStrategy {
    const fallbacks = this.generateFallbackSelectors(primarySelector, description, elementType);
    const multiSelector = [primarySelector, ...fallbacks].join(', ');

    return {
      primary: primarySelector,
      fallbacks,
      multiSelector,
    };
  }

  /**
   * Generates fallback selectors based on element type and description
   */
  private static generateFallbackSelectors(
    primarySelector: string,
    description: string,
    elementType: string
  ): string[] {
    const fallbacks: string[] = [];

    // Add class-based fallbacks if primary is ID-based
    if (primarySelector.startsWith('#')) {
      const idValue = primarySelector.replace('#', '');
      fallbacks.push(`[id="${idValue}"]`);
      fallbacks.push(`[id*="${idValue.split('-')[0]}"]`);
    }

    // Add text-based fallback if description is available
    if (description) {
      const textSelector = this.generateTextSelector(description, elementType);
      if (textSelector) {
        fallbacks.push(textSelector);
      }
    }

    // Add type-specific fallbacks
    const typeSpecificFallbacks = this.getTypeSpecificFallbacks(elementType, primarySelector);
    fallbacks.push(...typeSpecificFallbacks);

    // Add attribute-based patterns
    const attributeFallbacks = this.generateAttributeFallbacks(primarySelector, description);
    fallbacks.push(...attributeFallbacks);

    return fallbacks.filter((f, i, arr) => f && arr.indexOf(f) === i).slice(0, 4);
  }

  /**
   * Generates text-based selectors for robust element finding
   */
  private static generateTextSelector(description: string, elementType: string): string | null {
    const cleanDescription = description
      .replace(/[^\w\s]/g, '')
      .toLowerCase()
      .trim();

    if (!cleanDescription) return null;

    // For buttons and links, use text matching
    if (elementType === 'button' || elementType === 'link' || elementType === 'submit_button') {
      return `*=text("${cleanDescription}")`;
    }

    // For labels and headings, use partial matching
    if (elementType === 'heading' || elementType === 'label') {
      return `//${elementType}[contains(text(), "${cleanDescription}")]`;
    }

    return null;
  }

  /**
   * Returns type-specific fallback selectors
   */
  private static getTypeSpecificFallbacks(elementType: string, primarySelector: string): string[] {
    const fallbacks: string[] = [];

    switch (elementType) {
      case 'submit_button':
        fallbacks.push('[type="submit"]');
        fallbacks.push('button[type="submit"]');
        fallbacks.push('[class*="submit"]');
        fallbacks.push('button[class*="submit"]');
        break;

      case 'login_button':
        fallbacks.push('[class*="login"]');
        fallbacks.push('[id*="login"]');
        fallbacks.push('button[class*="btn"]');
        break;

      case 'success_message':
        fallbacks.push('[class*="success"]');
        fallbacks.push('[id*="success"]');
        fallbacks.push('[class*="alert-success"]');
        fallbacks.push('[role="alert"]');
        break;

      case 'error_message':
        fallbacks.push('[class*="error"]');
        fallbacks.push('[id*="error"]');
        fallbacks.push('[class*="alert-danger"]');
        fallbacks.push('[class*="alert-error"]');
        break;

      case 'input_field':
        fallbacks.push('input[type="text"]');
        fallbacks.push('input[type="email"]');
        fallbacks.push('input[type="password"]');
        fallbacks.push('textarea');
        break;

      case 'heading':
        fallbacks.push('h1, h2, h3');
        fallbacks.push('[class*="heading"]');
        fallbacks.push('[class*="title"]');
        break;

      default:
        break;
    }

    return fallbacks;
  }

  /**
   * Generates attribute-based fallback selectors
   */
  private static generateAttributeFallbacks(
    primarySelector: string,
    description: string
  ): string[] {
    const fallbacks: string[] = [];

    // Extract potential class names from selector
    const classMatches = primarySelector.match(/\.([a-zA-Z0-9-_]+)/g);
    if (classMatches) {
      classMatches.slice(0, 2).forEach((match) => {
        const className = match.replace('.', '');
        fallbacks.push(`[class*="${className}"]`);
      });
    }

    // Add general attribute fallbacks
    fallbacks.push('[role="button"]');
    fallbacks.push('[aria-label*="submit"]');

    return fallbacks.filter((f) => f !== primarySelector);
  }

  /**
   * Enhances a page object getter with multi-selector support
   */
  static enhanceGetterWithFallbacks(
    getterName: string,
    primarySelector: string,
    description: string,
    elementType: string = 'generic'
  ): string {
    const strategy = this.generateSelectorStrategy(primarySelector, description, elementType);

    return `get ${getterName}() {
    return $('${strategy.multiSelector}');
  }`;
  }

  /**
   * Improves selector quality by analyzing success patterns
   */
  static improveSelectorQuality(
    originalSelector: string,
    description: string,
    validationAttempts: number = 0
  ): string {
    // If selector has been validated multiple times, it's likely stable
    if (validationAttempts > 2) {
      logger.logElementDiscovery(originalSelector, true, {
        description,
        validationAttempts,
        quality: 'high',
      });
      return originalSelector;
    }

    // Add class-based specificity for better reliability
    if (originalSelector.startsWith('[')) {
      // Already attribute-based, add more specificity
      return originalSelector
        .replace(/\]$/, ', [class*="active"]')
        .replace(/\], \[class/, '], [class');
    }

    // For simple selectors, add fallbacks
    return originalSelector;
  }

  /**
   * Validates selector stability by checking for common anti-patterns
   */
  static validateSelectorStability(selector: string): { stable: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check for index-based selectors (unstable)
    if (/:nth-child|:nth-of-type|\[(\d+)\]/.test(selector)) {
      issues.push('Index-based selector found - may be unstable');
    }

    // Check for deep nesting (may be brittle)
    const levels = selector.split('>').length - 1;
    if (levels > 4) {
      issues.push(`Deep nesting detected (${levels} levels) - consider simpler selector`);
    }

    // Check for overly specific selectors
    if (selector.length > 100) {
      issues.push('Selector is very long - may be overspecified');
    }

    // Check for attribute selectors with exact matching (brittle)
    if (/\[.*="[^"]*"\]/.test(selector) && !/\*=|\$=|\^=/.test(selector)) {
      issues.push('Exact attribute matching detected - consider substring matching (*=)');
    }

    return {
      stable: issues.length === 0,
      issues,
    };
  }
}
