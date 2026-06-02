/**
 * Unit Tests: Regex Patterns
 * Tests the centralized regex patterns and helpers
 */

import { REGEX_PATTERNS, regexHelpers } from '../../src/utils/constants/regexPatterns';

describe('Regex Patterns Tests', () => {
  describe('Pattern Constants', () => {
    it('should have all required regex patterns defined', () => {
      expect(REGEX_PATTERNS.ID_SELECTOR).toBeDefined();
      expect(REGEX_PATTERNS.CLASS_SELECTOR).toBeDefined();
      expect(REGEX_PATTERNS.GHERKIN_KEYWORD).toBeDefined();
      expect(REGEX_PATTERNS.WHITESPACE).toBeDefined();
      expect(REGEX_PATTERNS.QUOTES).toBeDefined();
    });

    it('ID_SELECTOR should match IDs', () => {
      expect('#myId'.match(REGEX_PATTERNS.ID_SELECTOR)).toBeTruthy();
      expect('no-id'.match(REGEX_PATTERNS.ID_SELECTOR)).toBeFalsy();
    });

    it('CLASS_SELECTOR should match classes', () => {
      expect('.myClass'.match(REGEX_PATTERNS.CLASS_SELECTOR)).toBeTruthy();
      expect('.btn-primary'.match(REGEX_PATTERNS.CLASS_SELECTOR)).toBeTruthy();
    });

    it('GHERKIN_KEYWORD should match Gherkin keywords', () => {
      expect('Given the user is logged in'.match(REGEX_PATTERNS.GHERKIN_KEYWORD)).toBeTruthy();
      expect('When the user clicks button'.match(REGEX_PATTERNS.GHERKIN_KEYWORD)).toBeTruthy();
      expect('Then the result is shown'.match(REGEX_PATTERNS.GHERKIN_KEYWORD)).toBeTruthy();
    });
  });

  describe('Helper Functions', () => {
    describe('escapeRegex', () => {
      it('should escape special regex characters', () => {
        const input = 'test.*+?^${}()|[]\\';
        const escaped = regexHelpers.escapeRegex(input);

        // Ensure characters are escaped (contains backslash+dot)
        expect(escaped).toContain('\\.');
        // Ensure there are no unescaped dots (dot not preceded by backslash)
        expect(/(?<!\\)\./.test(escaped)).toBe(false);
      });

      it('should handle empty string', () => {
        expect(regexHelpers.escapeRegex('')).toBe('');
      });

      it('should escape regex special characters correctly', () => {
        const input = '(test)';
        const escaped = regexHelpers.escapeRegex(input);
        expect(escaped).toBe('\\(test\\)');
      });
    });

    describe('extractId', () => {
      it('should extract ID from selector', () => {
        const id = regexHelpers.extractId('#myId');

        expect(id).toBe('myId');
      });

      it('should return null for non-ID selector', () => {
        const id = regexHelpers.extractId('.myClass');

        expect(id).toBeNull();
      });

      it('should handle complex selectors', () => {
        const id = regexHelpers.extractId('div#userId');

        expect(id).toBe('userId');
      });
    });

    describe('extractClass', () => {
      it('should extract class from selector', () => {
        const cls = regexHelpers.extractClass('.myClass');

        expect(cls).toBe('myClass');
      });

      it('should return null for non-class selector', () => {
        const cls = regexHelpers.extractClass('#myId');

        expect(cls).toBeNull();
      });

      it('should extract first class in multi-class selector', () => {
        const cls = regexHelpers.extractClass('.btn.primary');

        expect(cls).toBe('btn');
      });
    });

    describe('isGherkinKeyword', () => {
      it('should recognize valid Gherkin keywords', () => {
        expect(regexHelpers.isGherkinKeyword('Given')).toBe(true);
        expect(regexHelpers.isGherkinKeyword('When')).toBe(true);
        expect(regexHelpers.isGherkinKeyword('Then')).toBe(true);
        expect(regexHelpers.isGherkinKeyword('And')).toBe(true);
        expect(regexHelpers.isGherkinKeyword('But')).toBe(true);
      });

      it('should not recognize non-Gherkin keywords', () => {
        expect(regexHelpers.isGherkinKeyword('Invalid')).toBe(false);
        expect(regexHelpers.isGherkinKeyword('given')).toBe(false);
        expect(regexHelpers.isGherkinKeyword('Feature')).toBe(false);
      });
    });

    describe('getGherkinKeyword', () => {
      it('should extract Gherkin keyword from step', () => {
        const keyword = regexHelpers.getGherkinKeyword('Given the user is logged in');

        expect(keyword).toBe('Given');
      });

      it('should handle different keywords', () => {
        expect(regexHelpers.getGherkinKeyword('When I click button')).toBe('When');
        expect(regexHelpers.getGherkinKeyword('Then I see result')).toBe('Then');
        expect(regexHelpers.getGherkinKeyword('And something happens')).toBe('And');
      });

      it('should return null for non-Gherkin step', () => {
        const keyword = regexHelpers.getGherkinKeyword('This is just text');

        expect(keyword).toBeNull();
      });
    });

    describe('removeGherkinPrefix', () => {
      it('should remove Gherkin prefix', () => {
        const result = regexHelpers.removeGherkinPrefix('Given the user is logged in');

        expect(result).toBe('the user is logged in');
      });

      it('should handle all keywords', () => {
        expect(regexHelpers.removeGherkinPrefix('When I click')).toBe('I click');
        expect(regexHelpers.removeGherkinPrefix('Then I see')).toBe('I see');
      });

      it('should trim whitespace', () => {
        const result = regexHelpers.removeGherkinPrefix('  Given   the user  ');

        expect(result).toBe('the user');
      });
    });

    describe('normalizeWhitespace', () => {
      it('should normalize whitespace', () => {
        const result = regexHelpers.normalizeWhitespace('hello    world  \n  test');

        expect(result).toBe('hello world test');
      });

      it('should handle tabs and newlines', () => {
        const result = regexHelpers.normalizeWhitespace('hello\t\tworld\n\ntest');

        expect(result).toBe('hello world test');
      });

      it('should trim leading/trailing whitespace', () => {
        const result = regexHelpers.normalizeWhitespace('  hello world  ');

        expect(result).toBe('hello world');
      });
    });

    describe('extractCodeBlock', () => {
      it('should extract code from triple backticks', () => {
        const text = '```typescript\nconst x = 10;\n```';
        const code = regexHelpers.extractCodeBlock(text);

        expect(code).toContain('const x = 10');
      });

      it('should extract JavaScript code block', () => {
        const text = '```javascript\nfunction test() {}\n```';
        const code = regexHelpers.extractCodeBlock(text);

        expect(code).toContain('function test');
      });

      it('should return null for no code block', () => {
        const code = regexHelpers.extractCodeBlock('just some text');

        expect(code).toBeNull();
      });

      it('should handle code block without language', () => {
        const text = '```\nsome code\n```';
        const code = regexHelpers.extractCodeBlock(text);

        expect(code).toContain('some code');
      });
    });

    describe('cleanLLMResponse', () => {
      it('should remove common LLM prefixes', () => {
        const response = 'Here is the implementation: const x = 10;';
        const cleaned = regexHelpers.cleanLLMResponse(response);

        expect(cleaned).not.toContain('Here is');
        expect(cleaned).toContain('const x = 10');
      });

      it('should remove code block markers', () => {
        const response = '```typescript\nconst x = 10;\n```';
        const cleaned = regexHelpers.cleanLLMResponse(response);

        expect(cleaned).not.toContain('```');
        expect(cleaned).toContain('const x = 10');
      });

      it('should remove block comments', () => {
        const response = 'const x = 10; /* comment */ const y = 20;';
        const cleaned = regexHelpers.cleanLLMResponse(response);

        expect(cleaned).not.toContain('/*');
        expect(cleaned).toContain('const x = 10');
      });
    });

    describe('extractQuotedValue', () => {
      it('should extract quoted string', () => {
        const value = regexHelpers.extractQuotedValue("The value is 'test value'");

        expect(value).toBe('test value');
      });

      it('should handle double quotes', () => {
        const value = regexHelpers.extractQuotedValue('Email: "user@example.com"');

        expect(value).toBe('user@example.com');
      });

      it('should return null if no quotes', () => {
        const value = regexHelpers.extractQuotedValue('no quotes here');

        expect(value).toBeNull();
      });
    });

    describe('isGherkinStep', () => {
      it('should recognize Gherkin steps', () => {
        expect(regexHelpers.isGherkinStep('Given the user is logged in')).toBe(true);
        expect(regexHelpers.isGherkinStep('When I click button')).toBe(true);
        expect(regexHelpers.isGherkinStep('Then I see result')).toBe(true);
      });

      it('should not recognize non-Gherkin lines', () => {
        expect(regexHelpers.isGherkinStep('Feature: Login')).toBe(false);
        expect(regexHelpers.isGherkinStep('Scenario: Test')).toBe(false);
        expect(regexHelpers.isGherkinStep('just text')).toBe(false);
      });

      it('should handle whitespace variations', () => {
        expect(regexHelpers.isGherkinStep('  Given  the user  ')).toBe(true);
        expect(regexHelpers.isGherkinStep('\tWhen I click')).toBe(true);
      });
    });
  });

  describe('Performance', () => {
    it('patterns should be compiled efficiently', () => {
      const startTime = performance.now();

      // Run patterns 1000 times
      for (let i = 0; i < 1000; i++) {
        '#myId'.match(REGEX_PATTERNS.ID_SELECTOR);
        'Given test'.match(REGEX_PATTERNS.GHERKIN_KEYWORD);
      }

      const duration = performance.now() - startTime;

      // Should complete 2000 matches in < 100ms
      expect(duration).toBeLessThan(100);
    });
  });
});
