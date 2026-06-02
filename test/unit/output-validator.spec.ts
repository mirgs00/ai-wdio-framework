/**
 * Unit Tests: Output Validator
 * Tests the validation layer for generated code
 */

import {
  validateTypeScriptCode,
  validateSelector,
  validateStepDefinition,
  validateFeatureFile,
  validateJSON,
} from '../../src/utils/validation/outputValidator';

describe('Output Validator Tests', () => {
  describe('TypeScript Code Validation', () => {
    it('should validate correct TypeScript code', () => {
      const code = `
        const x = 10;
        async function test() {
          try {
            await someFunction();
          } catch (error) {
            console.error(error);
          }
        }
      `;

      const result = validateTypeScriptCode(code);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty code', () => {
      const result = validateTypeScriptCode('');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should warn on TODO comments', () => {
      const code = 'const x = 10; // TODO: fix this';

      const result = validateTypeScriptCode(code);

      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should warn on any types', () => {
      const code = 'function test(param: any): any { return param; }';

      const result = validateTypeScriptCode(code);

      expect(result.warnings.some((w) => w.includes('any'))).toBe(true);
    });
  });

  describe('Selector Validation', () => {
    it('should validate CSS selectors', () => {
      const selectors = [
        '#myId',
        '.myClass',
        'button.primary',
        'input[type="text"]',
        '[data-testid="submit"]',
      ];

      selectors.forEach((sel) => {
        const result = validateSelector(sel);
        expect(result.isValid).toBe(true);
      });
    });

    it('should validate XPath selectors', () => {
      const xpaths = [
        '//button[@id="submit"]',
        '//input[@type="text" and @name="email"]',
        '(//div[@class="container"])[1]',
      ];

      xpaths.forEach((xpath) => {
        const result = validateSelector(xpath);
        expect(result.isValid).toBe(true);
      });
    });

    it('should reject empty selector', () => {
      const result = validateSelector('');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject selectors with undefined', () => {
      const result = validateSelector('$(.undefined)');

      expect(result.isValid).toBe(false);
    });

    it('should warn on malformed XPath', () => {
      const result = validateSelector('//[invalid]');

      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Step Definition Validation', () => {
    it('should validate correct step definition', () => {
      const result = validateStepDefinition(
        'When',
        'the user clicks the submit button',
        `try {
          await $('button[type="submit"]').click();
        } catch (error) {
          throw new Error('Click failed');
        }`
      );

      expect(result.isValid).toBe(true);
    });

    it('should reject invalid Gherkin keyword', () => {
      const result = validateStepDefinition(
        'Invalid',
        'some pattern',
        'console.log("test")'
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Gherkin'))).toBe(true);
    });

    it('should reject empty pattern', () => {
      const result = validateStepDefinition(
        'Given',
        '',
        'console.log("test")'
      );

      expect(result.isValid).toBe(false);
    });

    it('should warn on missing error handling', () => {
      const result = validateStepDefinition(
        'When',
        'the user clicks',
        'await $("button").click();'
      );

      expect(result.warnings.some((w) => w.includes('error handling'))).toBe(true);
    });
  });

  describe('Feature File Validation', () => {
    it('should validate correct feature file', () => {
      const feature = `
        Feature: User Login
          
        Scenario: Valid login
          Given the user is on the login page
          When the user enters valid credentials
          Then the user should see the dashboard
      `;

      const result = validateFeatureFile(feature);

      expect(result.isValid).toBe(true);
    });

    it('should reject feature file without Feature keyword', () => {
      const feature = `
        Scenario: Some test
          Given the user does something
      `;

      const result = validateFeatureFile(feature);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Feature'))).toBe(true);
    });

    it('should reject empty feature file', () => {
      const result = validateFeatureFile('');

      expect(result.isValid).toBe(false);
    });

    it('should validate multiple scenarios', () => {
      const feature = `
        Feature: Login Tests
          
        Scenario: Valid credentials
          Given the login page is open
          When valid credentials are entered
          Then user is logged in
          
        Scenario: Invalid credentials
          Given the login page is open
          When invalid credentials are entered
          Then error message is shown
      `;

      const result = validateFeatureFile(feature);

      expect(result.isValid).toBe(true);
    });

    it('should detect scenarios with no steps', () => {
      const feature = `
        Feature: Test
          
        Scenario: Empty scenario
          
        Scenario: Valid scenario
          Given something
      `;

      const result = validateFeatureFile(feature);

      // Should have error about empty scenario
      expect(result.errors.some((e) => e.includes('step'))).toBe(true);
    });
  });

  describe('JSON Validation', () => {
    it('should validate correct JSON', () => {
      const json = JSON.stringify({ key: 'value', nested: { prop: 123 } });

      const result = validateJSON(json);

      expect(result.isValid).toBe(true);
    });

    it('should validate JSON array', () => {
      const json = JSON.stringify([1, 2, 3, { key: 'value' }]);

      const result = validateJSON(json);

      expect(result.isValid).toBe(true);
    });

    it('should reject malformed JSON', () => {
      const json = '{ key: "value" invalid }';

      const result = validateJSON(json);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject empty JSON', () => {
      const result = validateJSON('');

      expect(result.isValid).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle code with comments', () => {
      const code = `
        // This is a comment
        const x = 10;
        /* Multi-line
           comment */
        function test() {}
      `;

      const result = validateTypeScriptCode(code);

      // Should be valid despite comments
      expect(result.isValid).toBe(true);
    });

    it('should handle selectors with special characters', () => {
      const selector = '[data-test="value-with-dash"]';

      const result = validateSelector(selector);

      expect(result.isValid).toBe(true);
    });

    it('should validate feature files with comments', () => {
      const feature = `
        # This is a comment
        Feature: Test
          
        # Scenario comment
        Scenario: Test scenario
          # Step comment
          Given the test setup
      `;

      const result = validateFeatureFile(feature);

      expect(result.isValid).toBe(true);
    });
  });
});
