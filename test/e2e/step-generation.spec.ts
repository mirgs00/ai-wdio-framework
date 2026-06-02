/**
 * E2E Test: Step Generation
 * Tests the core functionality of generating steps from instructions
 */

import { TestGenerationService } from '../../src/services/TestGenerationService';
import { logger } from '../../src/utils/logger';
import { config } from '../../src/config';

describe('Step Generation E2E Tests', () => {
  let service: TestGenerationService;

  beforeAll(() => {
    logger.setLogLevel(logger.constructor.name === 'Logger' ? 'DEBUG' : 'info');
    service = new TestGenerationService();
  });

  describe('Basic Step Generation', () => {
    it('should generate steps from simple login instruction', async () => {
      const instruction = 'User navigates to login page and fills in credentials with user@example.com and password123 then clicks submit button';

      const result = await service.generateSteps(instruction);

      // Verify result structure
      expect(result).toHaveProperty('steps');
      expect(Array.isArray(result.steps)).toBe(true);
      expect(result.steps.length).toBeGreaterThan(0);

      // Verify step structure
      result.steps.forEach((step: any) => {
        expect(step).toHaveProperty('type');
        expect(step).toHaveProperty('text');
        expect(['Given', 'When', 'Then', 'And', 'But']).toContain(step.type);
        expect(typeof step.text).toBe('string');
        expect(step.text.length).toBeGreaterThan(0);
      });

      // Verify expected actions are present
      const stepTexts = result.steps.map((s: any) => s.text.toLowerCase());
      expect(stepTexts.some((s: string) => s.includes('login') || s.includes('navigate'))).toBe(true);
      expect(stepTexts.some((s: string) => s.includes('fill') || s.includes('enter'))).toBe(true);
      expect(stepTexts.some((s: string) => s.includes('click') || s.includes('submit'))).toBe(true);
    });

    it('should generate steps from form submission instruction', async () => {
      const instruction = 'Fill search box with "test query" and click search button';

      const result = await service.generateSteps(instruction);

      expect(result.steps).toBeDefined();
      expect(result.steps.length).toBeGreaterThan(0);

      const stepTexts = result.steps.map((s: any) => s.text.toLowerCase());
      expect(stepTexts.some((s: string) => s.includes('search') || s.includes('fill'))).toBe(true);
    });

    it('should handle multiple sentences', async () => {
      const instruction = 'First, navigate to homepage. Then, click the login link. Finally, verify you see the login form.';

      const result = await service.generateSteps(instruction);

      expect(result.steps.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty instruction gracefully', async () => {
      const instruction = '';

      try {
        const result = await service.generateSteps(instruction);
        // Should either return empty steps or throw error
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle whitespace-only instruction', async () => {
      const instruction = '   \n\t  ';

      try {
        const result = await service.generateSteps(instruction);
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Step Quality', () => {
    it('generated steps should have descriptive text', async () => {
      const instruction = 'Login to application with admin credentials';

      const result = await service.generateSteps(instruction);

      result.steps.forEach((step: any) => {
        expect(step.text.length).toBeGreaterThan(5);
        expect(step.text.length).toBeLessThan(200);
      });
    });

    it('steps should follow Gherkin-like structure', async () => {
      const instruction = 'User opens browser, navigates to site, and sees homepage';

      const result = await service.generateSteps(instruction);

      // At least one step should start with Given/When/Then keywords
      const gherkinSteps = result.steps.filter((s: any) =>
        ['Given', 'When', 'Then', 'And', 'But'].includes(s.type)
      );
      expect(gherkinSteps.length).toBeGreaterThan(0);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle instructions with special characters', async () => {
      const instruction = 'Enter email: "user@domain.co.uk" and password: "P@ss123!#"';

      const result = await service.generateSteps(instruction);

      expect(result.steps).toBeDefined();
      expect(result.steps.length).toBeGreaterThan(0);
    });

    it('should handle instructions with URLs', async () => {
      const instruction = 'Navigate to https://example.com/login and fill username field';

      const result = await service.generateSteps(instruction);

      expect(result.steps).toBeDefined();
      expect(result.steps.length).toBeGreaterThan(0);
    });

    it('should generate consistent results for same instruction', async () => {
      const instruction = 'Click submit button and wait for confirmation';

      const result1 = await service.generateSteps(instruction);
      const result2 = await service.generateSteps(instruction);

      // Both should have similar structure and step count (allowing ±1 variance)
      expect(Math.abs(result1.steps.length - result2.steps.length)).toBeLessThanOrEqual(1);
    });
  });

  afterAll(() => {
    logger.info('Step generation E2E tests completed');
  });
});
