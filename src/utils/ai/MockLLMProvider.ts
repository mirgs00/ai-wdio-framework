import type { LLMProvider, LLMOptions } from './types';

export class MockLLMProvider implements LLMProvider {
  private modelName: string;
  private mockResponses: Map<string, string>;
  private shouldFail: boolean = false;

  constructor(modelName: string = 'mock-model') {
    this.modelName = modelName;
    this.mockResponses = new Map();
  }

  setMockResponse(prompt: string, response: string): void {
    this.mockResponses.set(prompt, response);
  }

  setShouldFail(fail: boolean): void {
    this.shouldFail = fail;
  }

  async generateText(_prompt: string, _options?: LLMOptions): Promise<string> {
    if (this.shouldFail) {
      throw new Error('Mock LLM failure');
    }

    const cached = this.mockResponses.get(_prompt);
    if (cached) {
      return cached;
    }

    if (_prompt.toLowerCase().includes('form') && _prompt.toLowerCase().includes('field')) {
      return JSON.stringify({
        '#email': 'test_123@test.com',
        '#password': 'TestPass123!',
      });
    }

    if (_prompt.toLowerCase().includes('json') || _prompt.toLowerCase().includes('selector')) {
      return JSON.stringify({ newLocator: '#new-element', locatorType: 'css', reasoning: 'Mock replacement' });
    }

    return `Mock response for: ${_prompt.slice(0, 50)}...`;
  }

  async checkHealth(): Promise<boolean> {
    return !this.shouldFail;
  }

  getModel(): string {
    return this.modelName;
  }
}
