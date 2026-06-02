/**
 * Test Utilities and Helpers
 * Provides common utilities for E2E and unit tests
 */

import { logger } from '../../src/utils/logger';

/**
 * Test fixture manager for consistent test data
 */
export class TestFixtures {
  static readonly SIMPLE_INSTRUCTIONS = {
    LOGIN: 'User navigates to login page and enters username and password then clicks submit',
    FORM_FILL: 'Fill search box with "test query" and click search button',
    NAVIGATION: 'Navigate to homepage and click profile link',
    VERIFICATION: 'Verify that success message appears on screen',
  };

  static readonly COMPLEX_INSTRUCTIONS = {
    MULTI_STEP: 'First, navigate to homepage. Then, click the login link. Finally, verify you see the login form.',
    WITH_URLS: 'Navigate to https://example.com/login and fill username field with user@example.com',
    WITH_SPECIAL_CHARS: 'Enter email: "user@domain.co.uk" and password: "P@ss123!#"',
  };

  static readonly GHERKIN_FEATURES = {
    SIMPLE: `
      Feature: User Login
      
      Scenario: Valid credentials
        Given the user is on the login page
        When the user enters valid credentials
        Then the user should be logged in
    `,
    MULTIPLE_SCENARIOS: `
      Feature: Login Tests
      
      Scenario: Valid login
        Given the login page is open
        When valid credentials are entered
        Then user is logged in
      
      Scenario: Invalid login
        Given the login page is open
        When invalid credentials are entered
        Then error message is shown
    `,
  };

  static readonly CODE_SAMPLES = {
    VALID_TYPESCRIPT: `
      async function handleClick() {
        try {
          await $('button').click();
        } catch (error) {
          throw new Error('Click failed');
        }
      }
    `,
    WITH_ANY_TYPE: `
      function process(data: any): any {
        return data;
      }
    `,
    WITH_TODO: `
      // TODO: implement this
      const x = 10;
    `,
  };

  static readonly SELECTORS = {
    VALID_CSS: ['#myId', '.myClass', 'button.primary', 'input[type="text"]'],
    VALID_XPATH: ['//button[@id="submit"]', '//input[@type="text"]', '(//div)[1]'],
    INVALID: ['', 'undefined', '$(invalid)'],
  };
}

/**
 * Mock service for testing without actual Ollama
 */
export class MockTestGenerationService {
  async generateSteps(instruction: string) {
    return {
      steps: [
        { type: 'Given', text: 'the user is on the page' },
        { type: 'When', text: `${instruction.substring(0, 30)}...` },
        { type: 'Then', text: 'the action is completed' },
      ],
    };
  }
}

/**
 * Test matchers for common assertions
 */
export const testMatchers = {
  /**
   * Check if step follows Gherkin format
   */
  isGherkinStep: (step: any): boolean => {
    if (!step || typeof step !== 'object') return false;
    if (!['Given', 'When', 'Then', 'And', 'But'].includes(step.type)) return false;
    if (typeof step.text !== 'string' || step.text.length === 0) return false;
    return true;
  },

  /**
   * Check if selector is valid
   */
  isValidSelector: (selector: string): boolean => {
    if (!selector || typeof selector !== 'string') return false;
    if (selector.includes('undefined') || selector.includes('null')) return false;
    if (selector.trim().length === 0) return false;
    return true;
  },

  /**
   * Check if code looks like TypeScript
   */
  looksLikeTypeScript: (code: string): boolean => {
    if (!code || typeof code !== 'string') return false;
    return /const|let|async|function|class|interface|type/i.test(code);
  },

  /**
   * Check if feature file looks valid
   */
  isValidFeatureFile: (content: string): boolean => {
    if (!content || typeof content !== 'string') return false;
    return /^Feature:/m.test(content.trim()) && /Scenario:/m.test(content);
  },
};

/**
 * Assertion helpers
 */
export const assert = {
  /**
   * Assert that array has expected length
   */
  hasLength: (array: any[], expected: number, message?: string) => {
    const msg = message || `Expected array length ${expected}, got ${array?.length}`;
    expect(Array.isArray(array)).toBe(true);
    expect(array.length).toBe(expected);
  },

  /**
   * Assert that value is not empty
   */
  notEmpty: (value: any, message?: string) => {
    const msg = message || 'Value should not be empty';
    expect(value).toBeTruthy();
  },

  /**
   * Assert that value has property
   */
  hasProperty: (value: any, property: string, message?: string) => {
    const msg = message || `Expected property ${property}`;
    expect(value).toHaveProperty(property);
  },

  /**
   * Assert that steps are valid
   */
  stepsAreValid: (steps: any[], minLength = 1, message?: string) => {
    expect(Array.isArray(steps)).toBe(true);
    expect(steps.length).toBeGreaterThanOrEqual(minLength);
    steps.forEach((step, index) => {
      expect(testMatchers.isGherkinStep(step)).toBe(
        true,
        `Step ${index} is not a valid Gherkin step: ${JSON.stringify(step)}`
      );
    });
  },

  /**
   * Assert that selectors are valid
   */
  selectorsAreValid: (selectors: string[], message?: string) => {
    expect(Array.isArray(selectors)).toBe(true);
    selectors.forEach((sel, index) => {
      expect(testMatchers.isValidSelector(sel)).toBe(
        true,
        `Selector ${index} is invalid: ${sel}`
      );
    });
  },
};

/**
 * Test utilities for setup/teardown
 */
export const testUtils = {
  /**
   * Setup test with logging
   */
  setupTest: (testName: string) => {
    logger.info(`🧪 Starting test: ${testName}`);
    const startTime = performance.now();

    return () => {
      const duration = performance.now() - startTime;
      logger.info(`✅ Test completed: ${testName} (${duration.toFixed(0)}ms)`);
    };
  },

  /**
   * Wait for async operation
   */
  wait: (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  /**
   * Retry operation with backoff
   */
  retry: async (
    operation: () => Promise<any>,
    maxAttempts = 3,
    delayMs = 1000
  ): Promise<any> => {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts) {
          await testUtils.wait(delayMs * attempt);
        }
      }
    }
    throw lastError;
  },

  /**
   * Track performance of operation
   */
  benchmark: async (
    operation: () => Promise<any>,
    operationName: string
  ): Promise<{ result: any; duration: number }> => {
    const startTime = performance.now();
    const result = await operation();
    const duration = performance.now() - startTime;

    logger.info(`⏱️  ${operationName} took ${duration.toFixed(0)}ms`);

    return { result, duration };
  },

  /**
   * Collect and report test metrics
   */
  metrics: {
    operations: new Map<string, number[]>(),

    record: (operation: string, duration: number) => {
      const durations = testUtils.metrics.operations.get(operation) || [];
      durations.push(duration);
      testUtils.metrics.operations.set(operation, durations);
    },

    report: () => {
      console.log('\n📊 Test Metrics Report:\n');
      testUtils.metrics.operations.forEach((durations, operation) => {
        const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
        const min = Math.min(...durations);
        const max = Math.max(...durations);
        console.log(
          `  ${operation}: avg=${avg.toFixed(0)}ms, min=${min}ms, max=${max}ms, count=${durations.length}`
        );
      });
    },

    reset: () => {
      testUtils.metrics.operations.clear();
    },
  },
};

/**
 * Snapshot utilities for regression testing
 */
export const snapshots = {
  /**
   * Create snapshot of result
   */
  create: (data: any, name: string): object => {
    return {
      timestamp: new Date().toISOString(),
      name,
      data: JSON.stringify(data, null, 2),
    };
  },

  /**
   * Compare with previous snapshot
   */
  compare: (current: any, previous: any): { hasDiff: boolean; changes: string[] } => {
    const changes: string[] = [];
    const curr = JSON.stringify(current);
    const prev = JSON.stringify(previous);

    if (curr !== prev) {
      changes.push(`Content differs`);
    }

    return {
      hasDiff: changes.length > 0,
      changes,
    };
  },
};
