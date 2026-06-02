import { ServiceContainer } from '../../src/services/ServiceContainer';
import { MockLLMProvider } from '../../src/utils/ai/MockLLMProvider';
import { OllamaClient } from '../../src/utils/ai/ollamaClient';

describe('ServiceContainer', () => {
  it('should create a container with a mock LLM provider', () => {
    const mockProvider = new MockLLMProvider('test-model');
    const container = new ServiceContainer({ llmProvider: mockProvider });

    expect(container.llmProvider).toBe(mockProvider);
    expect(container.llmProvider.getModel()).toBe('test-model');
  });

  it('should create a container with a real OllamaClient', () => {
    const ollamaClient = new OllamaClient({ model: 'test-model' });
    const container = new ServiceContainer({ llmProvider: ollamaClient });

    expect(container.llmProvider).toBe(ollamaClient);
    expect(container.llmProvider.getModel()).toBe('test-model');
  });

  it('should wire TestGenerationService with the provided LLM provider', async () => {
    const mockProvider = new MockLLMProvider();
    mockProvider.setMockResponse(
      'health-check',
      'ok'
    );

    const container = new ServiceContainer({ llmProvider: mockProvider });

    expect(await container.llmProvider.checkHealth()).toBe(true);
  });
});

describe('MockLLMProvider', () => {
  it('should return mock responses', async () => {
    const mock = new MockLLMProvider();
    mock.setMockResponse('test prompt', 'mock response');

    const result = await mock.generateText('test prompt');
    expect(result).toBe('mock response');
  });

  it('should fall back to default responses', async () => {
    const mock = new MockLLMProvider();
    const result = await mock.generateText('generate form data for fields');

    expect(result).toContain('#email');
    expect(result).toContain('#password');
  });

  it('should throw when set to fail mode', async () => {
    const mock = new MockLLMProvider();
    mock.setShouldFail(true);

    await expect(mock.generateText('test')).rejects.toThrow('Mock LLM failure');
    await expect(mock.checkHealth()).resolves.toBe(false);
  });

  it('should check health successfully in normal mode', async () => {
    const mock = new MockLLMProvider();
    await expect(mock.checkHealth()).resolves.toBe(true);
  });

  it('should return model name', () => {
    const mock = new MockLLMProvider('custom-model');
    expect(mock.getModel()).toBe('custom-model');
  });
});
