import { ServiceContainer } from '../../src/services/ServiceContainer';
import { MockLLMProvider } from '../../src/utils/ai/MockLLMProvider';
import { HealingService } from '../../src/utils/healing/healingService';
import { HealingWorkflow } from '../../src/utils/healing/healingWorkflow';

describe('ServiceContainer', () => {
  it('should create a container with a mock LLM provider', () => {
    const mockProvider = new MockLLMProvider('test-model');
    const container = new ServiceContainer({ llmProvider: mockProvider });

    expect(container.llmProvider).toBe(mockProvider);
    expect(container.llmProvider.getModel()).toBe('test-model');
  });

  it('should wire TestGenerationService with the provided LLM provider', () => {
    const mockProvider = new MockLLMProvider();
    const container = new ServiceContainer({ llmProvider: mockProvider });

    expect(container.testGenerationService).toBeDefined();
  });

  it('should wire HealingService with default pageObjectsDir', () => {
    const container = new ServiceContainer({ llmProvider: new MockLLMProvider() });

    expect(container.healingService).toBeInstanceOf(HealingService);
  });

  it('should wire HealingService with custom pageObjectsDir', () => {
    const container = new ServiceContainer({
      llmProvider: new MockLLMProvider(),
      pageObjectsDir: '/custom/path',
    });

    expect(container.healingService).toBeDefined();
  });

  it('should wire SelectorValidationService', () => {
    const container = new ServiceContainer({ llmProvider: new MockLLMProvider() });

    expect(container.selectorValidationService).toBeDefined();
    expect(typeof container.selectorValidationService.validateSelectors).toBe('function');
  });

  it('should wire TestRunnerService', () => {
    const container = new ServiceContainer({ llmProvider: new MockLLMProvider() });

    expect(container.testRunnerService).toBeDefined();
    expect(typeof container.testRunnerService.runTests).toBe('function');
  });

  it('should wire all services from the same container', () => {
    const container = new ServiceContainer({ llmProvider: new MockLLMProvider() });

    expect(container.llmProvider).toBeDefined();
    expect(container.testGenerationService).toBeDefined();
    expect(container.healingService).toBeDefined();
    expect(container.selectorValidationService).toBeDefined();
    expect(container.testRunnerService).toBeDefined();
  });
});

describe('HealingWorkflow DI', () => {
  it('should accept an injected HealingService', () => {
    const healingService = new HealingService('/tmp/test-page-objects');
    const workflow = new HealingWorkflow(healingService);

    expect(workflow).toBeDefined();
  });

  it('should fall back to creating its own HealingService when none provided', () => {
    const workflow = new HealingWorkflow();

    expect(workflow).toBeDefined();
  });

  it('should accept pageObjectsDir string when no HealingService provided', () => {
    const workflow = new HealingWorkflow('/tmp/page-objects');

    expect(workflow).toBeDefined();
  });
});
