/**
 * Smart Locators Unit Tests
 * Basic tests to verify Smart Locator functionality
 */

import { SmartLocator, ElementDescription } from './smartLocator';

describe('SmartLocator', () => {
  let smartLocator: SmartLocator;

  beforeEach(() => {
    smartLocator = new SmartLocator('./build', false); // Disable AI for tests
  });

  afterEach(() => {
    smartLocator.clearCache();
  });

  describe('Locator Strategy Generation', () => {
    test('should generate multiple strategies for element description', async () => {
      const description: ElementDescription = {
        text: 'Submit Button',
        type: 'button',
        ariaLabel: 'Send Form',
      };

      const strategies = (smartLocator as any).generateLocatorStrategies(description, 'test');
      
      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies.some(s => s.type === 'text')).toBe(true);
      expect(strategies.some(s => s.type === 'aria')).toBe(true);
    });

    test('should prioritize ID selector highest', async () => {
      const description: ElementDescription = { text: 'Button' };
      const strategies = (smartLocator as any).generateLocatorStrategies(description, 'test');
      
      const idStrategy = strategies.find(s => s.type === 'id');
      expect(idStrategy?.priority).toBeGreaterThan(90);
    });

    test('should handle missing attributes gracefully', async () => {
      const description: ElementDescription = { text: 'Button' };
      const strategies = (smartLocator as any).generateLocatorStrategies(description, 'test');
      
      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies.every(s => s.selector)).toBe(true);
    });
  });

  describe('Cache Management', () => {
    test('should generate consistent cache keys', () => {
      const desc1: ElementDescription = { text: 'Button' };
      const desc2: ElementDescription = { text: 'Button' };

      const key1 = (smartLocator as any).generateCacheKey(desc1);
      const key2 = (smartLocator as any).generateCacheKey(desc2);

      expect(key1).toBe(key2);
    });

    test('should differentiate different elements', () => {
      const desc1: ElementDescription = { text: 'Button1' };
      const desc2: ElementDescription = { text: 'Button2' };

      const key1 = (smartLocator as any).generateCacheKey(desc1);
      const key2 = (smartLocator as any).generateCacheKey(desc2);

      expect(key1).not.toBe(key2);
    });

    test('should retrieve cache statistics', () => {
      const stats = smartLocator.getStats();

      expect(stats).toHaveProperty('totalCached');
      expect(stats).toHaveProperty('successfulStrategies');
      expect(stats).toHaveProperty('averageSuccessRate');
      expect(stats.totalCached).toBe(0);
    });

    test('should clear cache', () => {
      smartLocator.clearCache();
      const stats = smartLocator.getStats();
      expect(stats.totalCached).toBe(0);
    });
  });

  describe('Text Sanitization', () => {
    test('should sanitize text for selectors', () => {
      const result = (smartLocator as any).sanitize('Submit Button!@#$%');
      
      expect(result).toBe('submit_button');
      expect(result).not.toContain('!');
      expect(result).not.toContain('@');
    });

    test('should handle whitespace', () => {
      const result = (smartLocator as any).sanitize('Multiple   Spaces');
      
      expect(result).toContain('multiple');
      expect(result).not.toContain('   ');
    });

    test('should limit length', () => {
      const longText = 'a'.repeat(100);
      const result = (smartLocator as any).sanitize(longText);
      
      expect(result.length).toBeLessThanOrEqual(50);
    });
  });

  describe('Selector Generation', () => {
    test('should generate ID selector correctly', () => {
      const selector = (smartLocator as any).generateIdSelector('Login Button');
      
      expect(selector).toMatch(/^#/);
      expect(selector.toLowerCase()).toContain('login');
    });

    test('should generate composite selector with multiple attributes', () => {
      const desc: ElementDescription = {
        text: 'Search',
        placeholder: 'Search users',
        role: 'searchbox',
      };

      const selector = (smartLocator as any).generateCompositeSelector(desc);
      
      expect(selector).toContain('Search');
      expect(selector).toContain('searchbox');
      expect(selector).toContain('xpath');
    });

    test('should generate fuzzy XPath', () => {
      const desc: ElementDescription = {
        text: 'Submit',
        type: 'button',
      };

      const selector = (smartLocator as any).generateFuzzyXPath(desc);
      
      expect(selector).toContain('normalize-space');
      expect(selector).toContain('xpath') ||
        expect(selector).toContain('//');
    });
  });

  describe('Strategy Priority', () => {
    test('should assign priorities in descending order', async () => {
      const description: ElementDescription = {
        text: 'Button',
        type: 'submit',
        ariaLabel: 'Save',
      };

      const strategies = (smartLocator as any).generateLocatorStrategies(description, 'test');
      
      for (let i = 0; i < strategies.length - 1; i++) {
        expect(strategies[i].priority).toBeGreaterThanOrEqual(strategies[i + 1].priority);
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle empty element description', async () => {
      const description: ElementDescription = {};

      const strategies = (smartLocator as any).generateLocatorStrategies(description, 'test');
      
      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies.some(s => s.selector.length > 0)).toBe(true);
    });
  });

  describe('Cache Key Generation', () => {
    test('should create unique keys for different attributes', () => {
      const key1 = (smartLocator as any).generateCacheKey({
        text: 'Button',
        ariaLabel: 'Submit',
      });

      const key2 = (smartLocator as any).generateCacheKey({
        text: 'Button',
        ariaLabel: 'Save',
      });

      expect(key1).not.toBe(key2);
    });

    test('should handle string descriptions', () => {
      const key1 = (smartLocator as any).generateCacheKey('Submit Button');
      const key2 = (smartLocator as any).generateCacheKey('Submit Button');

      expect(key1).toBe(key2);
    });
  });
});

describe('SmartLocator Integration', () => {
  test('should export singleton instance', () => {
    const { smartLocator } = require('./smartLocator');
    
    expect(smartLocator).toBeDefined();
    expect(smartLocator).toBeInstanceOf(SmartLocator);
  });

  test('should support re-export from index', () => {
    const {
      SmartLocator: SmartLocatorClass,
      smartLocator: instance,
    } = require('./index');

    expect(SmartLocatorClass).toBeDefined();
    expect(instance).toBeDefined();
  });
});