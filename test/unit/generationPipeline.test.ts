import { GenerationPipeline } from '../../src/services/GenerationPipeline';
import { ServiceContainer } from '../../src/services/ServiceContainer';
import { MockLLMProvider } from '../../src/utils/ai/MockLLMProvider';

describe('GenerationPipeline', () => {
  let container: ServiceContainer;

  beforeEach(() => {
    container = new ServiceContainer({
      llmProvider: new MockLLMProvider(),
    });
  });

  it('creates pipeline with default config', () => {
    const pipeline = new GenerationPipeline(container);
    expect(pipeline).toBeDefined();
  });

  it('creates pipeline with custom LLM provider', () => {
    const mockProvider = new MockLLMProvider();
    const customContainer = new ServiceContainer({
      llmProvider: mockProvider,
    });
    const pipeline = new GenerationPipeline(customContainer);
    expect(pipeline).toBeDefined();
  });

  it('has generate method', () => {
    const pipeline = new GenerationPipeline(container);
    expect(typeof pipeline.generate).toBe('function');
  });
});
